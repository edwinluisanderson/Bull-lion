"use client";

import { useEffect } from "react";

import { hapticPageLand, hapticPageTick } from "@/lib/haptics";
import { pageLandClick, pagePassClick } from "@/lib/lever-sound";
import {
  ALWAYS_SNAP_NAMES,
  advanceOwnedGlide,
  aimedSpeed,
  beginPageGesture,
  gestureLift,
  magnetCaption,
  nearestStop,
  notePageScroll,
  notePageTouchMove,
  pageGestureVelocity,
  pageOwnsTouch,
  passStopPositions,
  planFling,
  startOwnedGlide,
  stopsPassed,
  type PageGesture,
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

/** Once, when the settle finishes. The click is not gated on the haptic gap. */
function landCue(): void {
  hapticPageLand();
  pageLandClick();
}

const HANDLED_DRAG = ".reel-column, .reel-viewport, .pull-ball, .stack-swipe, .stack-swipe-face";

/**
 * Owned fling. The finger already moved the page, so native momentum never
 * starts. The first frame steps from `origin` by the clamped speed times dt.
 */
function glide(
  root: Element,
  velocity: number,
  target: number,
  origin: number,
  maxScroll: number,
  onDone: (at: number) => void,
) {
  let state = startOwnedGlide(origin, velocity, target, maxScroll);
  let frame = 0;
  let last = performance.now();
  let stopped = false;
  const finishOnce = () => {
    if (stopped) return;
    stopped = true;
    onDone(state.y);
  };
  root.scrollTop = origin;
  const step = (now: number) => {
    if (stopped) return;
    const dt = Math.max(0, (now - last) / 1000);
    last = now;
    const next = advanceOwnedGlide(state, dt, state.y);
    state = next.state;
    root.scrollTop = state.y;
    if (state.done) {
      root.scrollTop = state.y;
      if (next.landed) landCue();
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
 * The page follows the finger one pixel per pixel, then flings on its own.
 * Native momentum never starts, so the first frames cannot fight it.
 * A pull down at the top, a sideways swipe, and the reel, handle, and cards
 * keep the browser's touch. A new touch, wheel, or scroll key stops the glide.
 */
export function PageSnap() {
  useEffect(() => {
    const root = document.scrollingElement;
    if (!root) return;
    let cancelGlide = () => {};
    let gliding = false;
    let gesture: PageGesture | null = null;
    let fingers = 0;
    let lastDrag = root.scrollTop;
    let originX = 0;
    let originY = 0;
    let lastY = 0;
    let owned: "undecided" | "own" | "native" = "native";

    const stop = () => {
      gliding = false;
      cancelGlide();
      cancelGlide = () => {};
    };

    const noteDrag = (y: number) => {
      if (gliding) return;
      const measured = snapPoints(root);
      const passed = stopsPassed(lastDrag, y, passStopPositions(measured.points, measured.maxScroll));
      lastDrag = y;
      for (const _stop of passed) passCue();
    };

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.changedTouches[0] ?? event.touches[0];
      if (!touch) return;
      stop();
      fingers = event.touches.length;
      originX = touch.clientX;
      originY = touch.clientY;
      lastY = touch.clientY;
      const target = event.target;
      const interactive =
        target instanceof Element && target.closest(HANDLED_DRAG) != null;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      owned = interactive || reduced ? "native" : "undecided";
      gesture = owned === "native" ? null : beginPageGesture(performance.now(), root.scrollTop, touch.clientY);
      lastDrag = root.scrollTop;
    };
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch || owned === "native") return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (owned === "undecided") {
        owned = pageOwnsTouch({
          reduced,
          interactive: false,
          scrollTop: root.scrollTop,
          originX,
          originY,
          x: touch.clientX,
          y: touch.clientY,
        })
          ? "own"
          : Math.hypot(touch.clientX - originX, touch.clientY - originY) >= 8
            ? "native"
            : "undecided";
        if (owned !== "own") return;
      }
      if (event.cancelable) event.preventDefault();
      const limit = Math.max(0, root.scrollHeight - root.clientHeight);
      const next = Math.min(limit, Math.max(0, root.scrollTop - (touch.clientY - lastY)));
      lastY = touch.clientY;
      root.scrollTop = next;
      const now = performance.now();
      if (gesture) {
        gesture = notePageTouchMove(gesture, now, touch.clientY);
        gesture = notePageScroll(gesture, now, next);
      }
      noteDrag(next);
    };
    const onScroll = () => {
      if (!gesture || gliding) return;
      const y = root.scrollTop;
      gesture = notePageScroll(gesture, performance.now(), y);
      noteDrag(y);
    };
    const onLift = (event: TouchEvent) => {
      if (!gestureLift(event.type)) return;
      fingers = event.touches.length;
      if (fingers > 0) return;
      const current = gesture;
      gesture = null;
      if (!current) return;
      if (owned !== "own") return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const velocity = pageGestureVelocity(current);
      const origin = root.scrollTop;
      const measured = snapPoints(root);
      const plan = planFling({
        scrollTop: origin,
        velocity,
        maxScroll: measured.maxScroll,
        points: measured.points,
        reduced,
      });
      if (plan.target == null) return;
      const speed = aimedSpeed(velocity, origin, plan.target);
      gliding = true;
      cancelGlide();
      cancelGlide = glide(root, speed, plan.target, origin, measured.maxScroll, () => {
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
    window.addEventListener("touchstart", onTouchStart, { passive: false });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onLift, { passive: true });
    window.addEventListener("touchcancel", onLift, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      stop();
      document.removeEventListener("scroll", onScroll);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onLift);
      window.removeEventListener("touchcancel", onLift);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => mountMagnetCaption(), []);

  return null;
}
