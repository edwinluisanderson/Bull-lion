"use client";

import { useEffect, useRef, useState } from "react";

import {
  camPastNotch,
  commitIndex,
  cylinderPose,
  nearestEnabledNotch,
  shouldApplyGuard,
  STOP_DEGREES,
} from "@/lib/drum";
import { hapticClick } from "@/lib/haptics";
import { reelSnap, unlockReelClick } from "@/lib/reel-click";
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

const NOTCH_OVERSHOOT = 0.07;

function mod(value: number, count: number): number {
  if (count <= 0) return 0;
  return ((value % count) + count) % count;
}

function createEngine(options: {
  initialIndex: number;
  setKinetics: (position: number, velocity: number) => void;
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
  let camNotch: number | null = null;
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
    return nearestEnabledNotch(from, options.getCount(), options.isEnabled);
  }

  function setPos(next: number) {
    position = next;
    options.setKinetics(next, velocity);
    const index = commitIndex(next, options.getCount(), options.isEnabled);
    if (index === null || index === committed) return;
    committed = index;
    options.onIndex(index);
    reelSnap();
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

  function finishScript() {
    if (camNotch !== null) {
      const notch = camNotch;
      camNotch = null;
      animateTo(notch, options.isReduced() ? 0 : 160);
      return;
    }
    velocity = 0;
    options.setKinetics(position, 0);
    setPhase("idle");
  }

  function animateTo(target: number, duration: number) {
    stop();
    if (options.isReduced() || duration <= 0 || Math.abs(target - position) < 0.0001) {
      velocity = 0;
      setPos(target);
      if (camNotch !== null) {
        const notch = camNotch;
        camNotch = null;
        setPos(notch);
      }
      setPhase("idle");
      return;
    }
    animFrom = position;
    animTo = target;
    animStart = performance.now();
    animDur = duration;
    setPhase("script");
    schedule();
  }

  function camToNotch(notch: number, duration: number) {
    const past = camPastNotch(position, notch, NOTCH_OVERSHOOT);
    if (options.isReduced() || Math.abs(past - notch) < 0.0001) {
      camNotch = null;
      velocity = 0;
      setPos(notch);
      setPhase("idle");
      return;
    }
    camNotch = notch;
    animateTo(past, duration);
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
      if (Math.abs(nextVelocity) < 0.5) {
        camToNotch(nearestEnabledSlot(position), 180);
        return;
      }
    }

    if (phase === "snap" || phase === "script") {
      const progress = Math.min(1, (now - animStart) / animDur);
      const power = phase === "script" ? 4 : 3;
      const eased = 1 - (1 - progress) ** power;
      const next = progress >= 1 ? animTo : animFrom + (animTo - animFrom) * eased;
      velocity = (next - position) / Math.max(dt, 0.001);
      setPos(next);
      if (progress >= 1) {
        finishScript();
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
      hapticClick();
      const speed = options.isReduced() ? 0 : velocityFrom(samples);
      if (options.isReduced() || Math.abs(speed) < 0.4) {
        camToNotch(nearestEnabledSlot(position), 180);
        return;
      }
      velocity = speed;
      setPhase("coast");
      schedule();
    },
    step(direction) {
      hapticClick();
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
      hapticClick();
      const count = options.getCount();
      const target = enabledIndex(index) ? index : nearestEnabledSlot(index);
      const targetMod = mod(target, count);
      const currentMod = mod(position, count);
      let delta = targetMod - currentMod;
      if (delta > count / 2) delta -= count;
      if (delta < -count / 2) delta += count;
      animateTo(position + delta, options.isReduced() ? 0 : 320);
    },
    lever(order) {
      hapticClick();
      const count = options.getCount();
      const current = Math.round(position);
      const enabled: number[] = [];
      for (let index = 0; index < count; index += 1) {
        if (enabledIndex(index)) enabled.push(index);
      }
      const pool = enabled.length > 0 ? enabled : Array.from({ length: count }, (_, index) => index);
      const landIndex = pool[Math.floor(Math.random() * pool.length)] ?? 0;
      let down = (mod(current, count) - landIndex + count) % count;
      if (down === 0) down = count;
      const loops = options.isReduced() ? 0 : 3 + order;
      const notch = current - loops * count - down;
      camToNotch(notch, options.isReduced() ? 0 : 880 + order * 260);
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
  bendDegrees = 0,
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
  bendDegrees?: number;
  onIndex: (index: number) => void;
  onMotion: (moving: boolean) => void;
}) {
  const [kinetics, setKinetics] = useState({ position: initialIndex, velocity: 0 });
  const position = kinetics.position;
  const velocity = kinetics.velocity;
  const engineRef = useRef<Engine | null>(null);
  const appliedGuard = useRef(0);
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
      setKinetics: (next, speed) => setKinetics({ position: next, velocity: speed }),
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
    if (!shouldApplyGuard(guardToken, appliedGuard.current)) return;
    appliedGuard.current = guardToken;
    engineRef.current?.jump(guardIndex);
  }, [guardToken, guardIndex]);

  const count = items.length;
  const shown = position - bendDegrees / STOP_DEGREES;
  const base = Math.floor(shown);
  const fraction = shown - base;
  const active = mod(Math.round(position), count);
  const facing = mod(Math.round(shown), count);
  const activeSymbol = items[active];
  const rolling = Math.abs(velocity) > 1.2;
  const smear = rolling ? Math.min(8, Math.abs(velocity) * 0.16) : 0;

  return (
    <div className="reel-column" data-testid={`reel-${label.toLowerCase()}`}>
      <div className="reel-name">{label}</div>
      <div
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
        className={rolling ? "reel-viewport is-rolling" : "reel-viewport"}
        style={{ height: REEL_ITEM_HEIGHT * 3, touchAction: "none" }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          if (event.cancelable) event.preventDefault();
          unlockReelClick();
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
          unlockReelClick();
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
        <div className="reel-cylinder">
        {WINDOW.map((offset) => {
          const index = mod(base + offset, count);
          const symbol = items[index];
          if (!symbol) return null;
          const pose = cylinderPose(offset - fraction);
          const y = REEL_ITEM_HEIGHT * 1.5 + pose.shift * REEL_ITEM_HEIGHT - REEL_ITEM_HEIGHT / 2;
          const isActive = index === facing;
          const smearY = -Math.sign(velocity) * smear;
          return (
            <div
              key={offset}
              className="symbol"
              style={{
                height: REEL_ITEM_HEIGHT,
                transform: `translate3d(0, ${y}px, 0) scaleY(${pose.scaleY})`,
                filter: smear > 0.4 ? `blur(${smear * 0.22}px)` : undefined,
              }}
            >
              <div
                className={
                  symbol.disabled
                    ? "symbol-plate is-disabled"
                    : isActive
                      ? "symbol-plate is-active"
                      : "symbol-plate"
                }
                style={{
                  filter: `brightness(${pose.brightness})`,
                  boxShadow:
                    smear > 0.4
                      ? `0 ${smearY}px ${smear}px rgba(0, 0, 0, 0.35)`
                      : !symbol.disabled && isActive && symbol.tint
                        ? `inset 0 0 0 1px ${symbol.tint}, 0 0 16px ${symbol.tint}33`
                        : undefined,
                }}
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
