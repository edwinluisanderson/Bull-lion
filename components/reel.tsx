"use client";

import { useEffect, useRef, useState } from "react";

import { hapticClick } from "@/lib/haptics";
import { REEL_ITEM_HEIGHT } from "@/lib/metals";

export type ReelSymbol = {
  key: string;
  mark: string;
  detail: string;
  tint?: string;
  disabled?: boolean;
};

type Phase = "idle" | "drag" | "coast" | "snap" | "script";

const DECAY = 2.7;
const MAX_VELOCITY = 28;
const WINDOW = [-2, -1, 0, 1, 2, 3];

type Engine = {
  pointerDown: (y: number, time: number) => void;
  pointerMove: (y: number, time: number) => void;
  pointerUp: () => void;
  step: (direction: number) => void;
  jump: (index: number) => void;
  lever: (order: number) => void;
  destroy: () => void;
};

function mod(value: number, count: number): number {
  if (count <= 0) return 0;
  return ((value % count) + count) % count;
}

function createEngine(options: {
  initialIndex: number;
  setPosition: (position: number) => void;
  getCount: () => number;
  onIndex: (index: number) => void;
  onMotion: (moving: boolean) => void;
  isReduced: () => boolean;
  isEnabled: (index: number) => boolean;
}): Engine {
  let position = options.initialIndex;
  let phase: Phase = "idle";
  let velocity = 0;
  let committed = options.initialIndex;
  let raf = 0;
  let last = 0;
  let animFrom = position;
  let animTo = position;
  let animStart = 0;
  let animDur = 1;
  let drag: { originY: number; originPos: number; samples: { t: number; y: number }[] } | null =
    null;

  function setPhase(next: Phase) {
    if (phase === next) return;
    const wasMoving = phase !== "idle";
    phase = next;
    const moving = next !== "idle";
    if (wasMoving !== moving) options.onMotion(moving);
  }

  function enabledIndex(index: number): boolean {
    return options.isEnabled(mod(index, options.getCount()));
  }

  function nearestEnabledSlot(from: number): number {
    const count = options.getCount();
    const rounded = Math.round(from);
    if (enabledIndex(rounded)) return rounded;
    for (let delta = 1; delta < count; delta += 1) {
      const ahead = rounded + delta;
      const behind = rounded - delta;
      const aheadOk = enabledIndex(ahead);
      const behindOk = enabledIndex(behind);
      if (aheadOk && behindOk) {
        return Math.abs(ahead - from) <= Math.abs(from - behind) ? ahead : behind;
      }
      if (aheadOk) return ahead;
      if (behindOk) return behind;
    }
    return rounded;
  }

  function setPos(next: number) {
    position = next;
    options.setPosition(next);
    const index = mod(Math.round(next), options.getCount());
    if (!enabledIndex(index)) return;
    if (index !== committed) {
      committed = index;
      options.onIndex(index);
      hapticClick();
    }
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function schedule() {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function startSnap(from: number): boolean {
    const target = nearestEnabledSlot(from);
    if (options.isReduced() || Math.abs(target - from) < 0.0001) {
      velocity = 0;
      setPos(target);
      setPhase("idle");
      return false;
    }
    animFrom = from;
    animTo = target;
    animStart = performance.now();
    animDur = 240;
    setPhase("snap");
    return true;
  }

  function animateTo(target: number, duration: number) {
    stop();
    if (options.isReduced() || duration <= 0 || Math.abs(target - position) < 0.0001) {
      velocity = 0;
      setPos(target);
      setPhase("idle");
      return;
    }
    animFrom = position;
    animTo = target;
    animStart = performance.now();
    animDur = duration;
    velocity = 0;
    setPhase("script");
    schedule();
  }

  function tick(now: number) {
    raf = 0;
    if (phase === "idle" || phase === "drag") return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (phase === "coast") {
      const previous = velocity;
      const retained = Math.exp(-DECAY * dt);
      const nextVelocity = previous * retained;
      const distance = (previous - nextVelocity) / DECAY;
      velocity = nextVelocity;
      setPos(position + distance);
      if (Math.abs(nextVelocity) < 0.5) startSnap(position);
    }

    if (phase === "snap" || phase === "script") {
      const progress = Math.min(1, (now - animStart) / animDur);
      const power = phase === "script" ? 4 : 3;
      const eased = 1 - (1 - progress) ** power;
      setPos(progress >= 1 ? animTo : animFrom + (animTo - animFrom) * eased);
      if (progress >= 1) {
        velocity = 0;
        setPhase("idle");
        return;
      }
    }

    if (phase === "coast" || phase === "snap" || phase === "script") {
      raf = requestAnimationFrame(tick);
    }
  }

  function velocityFrom(samples: { t: number; y: number }[]) {
    if (samples.length < 2) return 0;
    const first = samples[0];
    const lastSample = samples[samples.length - 1];
    const elapsed = lastSample.t - first.t;
    if (elapsed < 12) return 0;
    const slotsPerSecond =
      -((lastSample.y - first.y) / elapsed) * (1000 / REEL_ITEM_HEIGHT);
    return Math.min(MAX_VELOCITY, Math.max(-MAX_VELOCITY, slotsPerSecond));
  }

  return {
    pointerDown(y, time) {
      stop();
      velocity = 0;
      setPhase("drag");
      drag = {
        originY: y,
        originPos: position,
        samples: [{ t: time, y }],
      };
    },
    pointerMove(y, time) {
      if (phase !== "drag" || !drag) return;
      setPos(drag.originPos - (y - drag.originY) / REEL_ITEM_HEIGHT);
      drag.samples.push({ t: time, y });
      const cutoff = time - 100;
      while (drag.samples.length > 2 && drag.samples[0].t < cutoff) {
        drag.samples.shift();
      }
    },
    pointerUp() {
      if (phase !== "drag" || !drag) return;
      const samples = drag.samples;
      drag = null;
      const speed = options.isReduced() ? 0 : velocityFrom(samples);
      if (options.isReduced() || Math.abs(speed) < 0.4) {
        if (startSnap(position)) schedule();
        return;
      }
      velocity = speed;
      setPhase("coast");
      schedule();
    },
    step(direction) {
      const count = options.getCount();
      const start = Math.round(position);
      for (let delta = 1; delta <= count; delta += 1) {
        const candidate = start + direction * delta;
        if (enabledIndex(candidate)) {
          animateTo(candidate, options.isReduced() ? 0 : 180);
          return;
        }
      }
    },
    jump(index) {
      const count = options.getCount();
      const current = Math.round(position);
      const target = enabledIndex(index) ? index : nearestEnabledSlot(index);
      const delta = mod(target, count) - mod(current, count);
      animateTo(current + delta, options.isReduced() ? 0 : 220);
    },
    lever(order) {
      const count = options.getCount();
      const current = Math.round(position);
      const enabled: number[] = [];
      for (let index = 0; index < count; index += 1) {
        if (enabledIndex(index)) enabled.push(index);
      }
      const pool = enabled.length > 0 ? enabled : Array.from({ length: count }, (_, index) => index);
      const landIndex = pool[Math.floor(Math.random() * pool.length)] ?? 0;
      let extra = (landIndex - mod(current, count) + count) % count;
      if (extra === 0) extra = count;
      const loops = options.isReduced() ? 0 : 3 + order;
      animateTo(
        current + loops * count + extra,
        options.isReduced() ? 0 : 1400 + order * 480,
      );
    },
    destroy() {
      stop();
      drag = null;
      phase = "idle";
    },
  };
}

export function Reel({
  label,
  items,
  initialIndex,
  spinToken,
  spinOrder,
  guardToken = 0,
  guardIndex = 0,
  onIndex,
  onMotion,
}: {
  label: string;
  items: ReelSymbol[];
  initialIndex: number;
  spinToken: number;
  spinOrder: number;
  guardToken?: number;
  guardIndex?: number;
  onIndex: (index: number) => void;
  onMotion: (moving: boolean) => void;
}) {
  const [position, setPosition] = useState(initialIndex);
  const engineRef = useRef<Engine | null>(null);
  const countRef = useRef(items.length);
  const itemsRef = useRef(items);
  const listenerRef = useRef({ onIndex, onMotion });
  itemsRef.current = items;

  useEffect(() => {
    countRef.current = items.length;
  }, [items.length]);

  useEffect(() => {
    listenerRef.current = { onIndex, onMotion };
  }, [onIndex, onMotion]);

  useEffect(() => {
    const engine = createEngine({
      initialIndex,
      setPosition,
      getCount: () => countRef.current,
      onIndex: (index) => listenerRef.current.onIndex(index),
      onMotion: (moving) => listenerRef.current.onMotion(moving),
      isReduced: () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      isEnabled: (index) => {
        const list = itemsRef.current;
        return !list[mod(index, list.length)]?.disabled;
      },
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, [initialIndex]);

  useEffect(() => {
    if (spinToken === 0) return;
    engineRef.current?.lever(spinOrder);
  }, [spinToken, spinOrder]);

  useEffect(() => {
    if (guardToken === 0) return;
    engineRef.current?.jump(guardIndex);
  }, [guardToken, guardIndex]);

  const count = items.length;
  const base = Math.floor(position);
  const fraction = position - base;
  const active = mod(Math.round(position), count);
  const activeSymbol = items[active];

  return (
    <div className="reel-column" data-testid={`reel-${label.toLowerCase()}`}>
      <div className="reel-name">{label}</div>
      <div
        className="reel-viewport"
        role="slider"
        tabIndex={0}
        aria-label={`${label} reel`}
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, count - 1)}
        aria-valuenow={active}
        aria-valuetext={
          activeSymbol ? `${activeSymbol.mark} ${activeSymbol.detail}` : label
        }
        style={{ height: REEL_ITEM_HEIGHT * 3, touchAction: "none" }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          if (event.cancelable) event.preventDefault();
          const viewport = event.currentTarget;
          viewport.focus({ preventScroll: true });
          const pointerId = event.pointerId;
          const onMove = (moveEvent: PointerEvent) => {
            if (moveEvent.pointerId !== pointerId) return;
            if (moveEvent.cancelable) moveEvent.preventDefault();
            engineRef.current?.pointerMove(moveEvent.clientY, moveEvent.timeStamp);
          };
          const onUp = (upEvent: PointerEvent) => {
            if (upEvent.pointerId !== pointerId) return;
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);
            engineRef.current?.pointerUp();
          };
          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
          window.addEventListener("pointercancel", onUp);
          engineRef.current?.pointerDown(event.clientY, event.timeStamp);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowRight") {
            event.preventDefault();
            engineRef.current?.step(1);
          } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
            event.preventDefault();
            engineRef.current?.step(-1);
          } else if (event.key === "Home") {
            event.preventDefault();
            engineRef.current?.jump(0);
          } else if (event.key === "End") {
            event.preventDefault();
            engineRef.current?.jump(count - 1);
          }
        }}
      >
        {WINDOW.map((offset) => {
          const index = mod(base + offset, count);
          const symbol = items[index];
          if (!symbol) return null;
          const y = (offset - fraction) * REEL_ITEM_HEIGHT + REEL_ITEM_HEIGHT;
          const isActive = index === active;
          return (
            <div
              key={offset}
              className="symbol"
              style={{ height: REEL_ITEM_HEIGHT, transform: `translate3d(0, ${y}px, 0)` }}
            >
              <div
                className={
                  symbol.disabled
                    ? "symbol-plate is-disabled"
                    : isActive
                      ? "symbol-plate is-active"
                      : "symbol-plate"
                }
                style={
                  !symbol.disabled && isActive && symbol.tint
                    ? { boxShadow: `inset 0 0 0 1px ${symbol.tint}, 0 0 16px ${symbol.tint}33` }
                    : undefined
                }
              >
                <span
                  className="symbol-mark"
                  style={symbol.disabled ? undefined : { color: symbol.tint ?? "#f0e2c4" }}
                >
                  {symbol.mark}
                </span>
                <span className="symbol-detail">{symbol.detail}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="reel-nudge">
        <button
          type="button"
          aria-label={`Previous ${label.toLowerCase()}`}
          onClick={() => engineRef.current?.step(-1)}
        >
          <span aria-hidden="true">▲</span>
        </button>
        <button
          type="button"
          aria-label={`Next ${label.toLowerCase()}`}
          onClick={() => engineRef.current?.step(1)}
        >
          <span aria-hidden="true">▼</span>
        </button>
      </div>
    </div>
  );
}
