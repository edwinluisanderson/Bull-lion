"use client";

import { useEffect } from "react";

import { hapticClick, hapticPageTick } from "@/lib/haptics";
import { pageLandClick, pagePassClick } from "@/lib/lever-sound";
import {
  ALWAYS_SNAP_NAMES,
  CUSHION_ZONE_PX,
  cushionSpeed,
  magnetCaption,
  nearestStop,
  planFling,
  releaseVelocity,
  stopsPassed,
  type SnapMark,
} from "@/lib/page-snap";

const SCROLL_KEYS = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "]);

function snapPoints(root: Element): { points: SnapMark[]; maxScroll: number; top: number } {
  const top = root.scrollTop;
  const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
  const always = new Set<string>(ALWAYS_SNAP_NAMES);
  const points = [...root.ownerDocument.querySelectorAll<HTMLElement>("[data-snap]")].map((node) => ({
    // Unclamped. My Stack is a stop only when this offset is at most maxScroll.
    at: node.getBoundingClientRect().top + top,
    always: always.has(node.dataset.snap ?? ""),
    name: node.dataset.snap ?? "",
  }));
  points.push({ at: 0, always: true, name: "top" }, { at: maxScroll, always: true, name: "bottom" });
  return { points, maxScroll, top };
}

function passCue(): void {
  if (!hapticPageTick()) return;
  pagePassClick();
}

function landCue(): void {
  if (!hapticClick()) return;
  pageLandClick();
}

/**
 * Drop a native fling without touching the touch stream.
 * Writing scrollTop alone loses to Android Chrome's compositor fling.
 * Hiding overflow for one frame cancels that fling, then we own scrollTop.
 * Touch listeners stay passive, so a pull at the top can still refresh.
 */
function takeOverScroll(root: Element) {
  const y = root.scrollTop;
  const node = root instanceof HTMLElement ? root : document.documentElement;
  const previous = node.style.overflow;
  node.style.overflow = "hidden";
  void node.offsetHeight;
  node.style.overflow = previous;
  node.scrollTop = y;
}

/**
 * Owned fling. Full release speed until the cushion, then catch, glide, and settle.
 * A finger that moves the scroll out from under the glide stops it.
 */
function glide(
  root: Element,
  velocity: number,
  target: number,
  skipped: number | null,
  onDone: () => void,
) {
  let y = root.scrollTop;
  let speed = Math.abs(velocity);
  const dir = target >= y ? 1 : -1;
  let catchFrom: number | null = null;
  let passed = false;
  const startRemaining = Math.abs(target - y);
  if (startRemaining <= CUSHION_ZONE_PX) catchFrom = startRemaining;
  let frame = 0;
  let placed = y;
  let last = performance.now();
  let stopped = false;
  const finishOnce = () => {
    if (stopped) return;
    stopped = true;
    onDone();
  };
  const step = (now: number) => {
    if (stopped) return;
    const actual = root.scrollTop;
    if (Math.abs(actual - placed) > 3) {
      finishOnce();
      return;
    }
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const remaining = Math.abs(target - y);
    if (remaining <= 0.4) {
      root.scrollTop = target;
      placed = root.scrollTop;
      landCue();
      finishOnce();
      return;
    }
    const nextSpeed =
      remaining > CUSHION_ZONE_PX ? speed : cushionSpeed(remaining, speed, catchFrom ?? CUSHION_ZONE_PX);
    const next = y + dir * nextSpeed * dt;
    if (skipped != null && !passed && stopsPassed(y, next, [skipped]).length > 0) {
      passed = true;
      passCue();
    }
    const crossedTarget = (target - y) * (target - next) <= 0;
    const limit = Math.max(0, root.scrollHeight - root.clientHeight);
    y = crossedTarget ? target : Math.min(limit, Math.max(0, next));
    root.scrollTop = y;
    placed = root.scrollTop;
    if (crossedTarget || Math.abs(target - y) <= 0.4) {
      root.scrollTop = Math.min(limit, Math.max(0, target));
      placed = root.scrollTop;
      landCue();
      finishOnce();
      return;
    }
    frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
  };
}

/**
 * Distance label for a manual check. Off unless the URL has `?magnet=1`.
 * It does not take pointer events, so it cannot block a drag or a swipe.
 */
function mountMagnetCaption(): () => void {
  const params = new URLSearchParams(window.location.search);
  if (params.get("magnet") !== "1") return () => {};
  const root = document.scrollingElement;
  if (!root) return () => {};
  const label = document.createElement("div");
  label.dataset.magnetCaption = "";
  label.style.cssText = [
    "position:fixed",
    "left:50%",
    "bottom:12px",
    "transform:translateX(-50%)",
    "z-index:80",
    "pointer-events:none",
    "box-sizing:border-box",
    "max-width:calc(100vw - 16px)",
    "background:#140e0a",
    "color:#f3e2ad",
    "border:2px solid #c6a15a",
    "border-radius:999px",
    "padding:8px 14px",
    "font:600 16px/1.3 var(--font-readout), ui-monospace, monospace",
    "white-space:nowrap",
    "text-align:center",
    "box-shadow:0 8px 24px rgba(0,0,0,0.45)",
  ].join(";");
  document.body.appendChild(label);

  let heldUntil = 0;
  let heldScroll = -1;
  let heldTarget = -1;
  const reading = () => {
    const measured = snapPoints(root);
    return nearestStop(measured.top, measured.points, measured.maxScroll);
  };
  const easingTowardHold = (y: number) => {
    if (heldScroll < 0) return false;
    const span = heldTarget - heldScroll;
    const progressed = y - heldScroll;
    return span * progressed >= -1 && Math.abs(y - heldTarget) <= Math.abs(span) + 8;
  };
  const onScroll = () => {
    const nearest = reading();
    if (performance.now() < heldUntil && easingTowardHold(root.scrollTop)) return;
    heldUntil = 0;
    label.textContent = `${Math.round(nearest.distance)}px from ${nearest.name}`;
  };
  const onEnd = () => {
    const now = performance.now();
    const nearest = reading();
    // A glide writes scrollTop, and Chrome can emit scrollend for each write.
    // Keep the distance from the rest that started the ease until a new scroll
    // leaves that path.
    if (now < heldUntil && easingTowardHold(root.scrollTop)) return;
    heldScroll = root.scrollTop;
    heldTarget = nearest.at;
    heldUntil = now + 3600;
    label.textContent = magnetCaption(nearest.distance, nearest.name);
  };

  onScroll();
  document.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("scrollend", onEnd);
  return () => {
    document.removeEventListener("scroll", onScroll);
    document.removeEventListener("scrollend", onEnd);
    label.remove();
  };
}

/**
 * A drag that lifts stays put. A fling is taken over from the finger's
 * velocity so Android Chrome's native fling cannot fight scrollTop.
 * Full speed until 120px before the target, then catch, glide, and settle.
 * A new touch, wheel, or scroll key stops the glide. Touch listeners stay
 * passive, so a pull down at the top can still refresh.
 */
export function PageSnap() {
  useEffect(() => {
    const root = document.scrollingElement;
    if (!root) return;
    let cancelGlide = () => {};
    let gliding = false;
    let touching = 0;
    let samples: { t: number; y: number }[] = [];
    let lastDrag = root.scrollTop;

    const stop = () => {
      gliding = false;
      cancelGlide();
      cancelGlide = () => {};
    };

    const onDown = () => {
      touching += 1;
      samples = [{ t: performance.now(), y: root.scrollTop }];
      lastDrag = root.scrollTop;
      stop();
    };
    const onScroll = () => {
      if (!touching || gliding) return;
      const y = root.scrollTop;
      samples.push({ t: performance.now(), y });
      if (samples.length > 12) samples.shift();
      const measured = snapPoints(root);
      const stops = measured.points.map((point) => point.at);
      const passed = stopsPassed(lastDrag, y, stops);
      lastDrag = y;
      for (const _stop of passed) passCue();
    };
    const onUp = () => {
      touching = Math.max(0, touching - 1);
      if (touching > 0) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const velocity = releaseVelocity(samples);
      samples = [];
      const measured = snapPoints(root);
      const plan = planFling({
        scrollTop: root.scrollTop,
        velocity,
        maxScroll: measured.maxScroll,
        points: measured.points,
        reduced,
      });
      if (plan.target == null) return;
      takeOverScroll(root);
      gliding = true;
      cancelGlide();
      cancelGlide = glide(root, velocity, plan.target, plan.skipped, () => {
        gliding = false;
        cancelGlide = () => {};
      });
    };
    const onWheel = () => {
      stop();
    };
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']")) return;
      if (SCROLL_KEYS.has(event.key)) stop();
    };
    document.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      stop();
      document.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => mountMagnetCaption(), []);

  return null;
}
