"use client";

import { useEffect } from "react";

import { hapticPageLand, hapticPageTick } from "@/lib/haptics";
import { pageLandClick, pagePassClick } from "@/lib/lever-sound";
import {
  ALWAYS_SNAP_NAMES,
  advanceOwnedGlide,
  beginPageGesture,
  gestureLift,
  magnetCaption,
  nearestStop,
  notePageScroll,
  notePageTouchMove,
  pageGestureVelocity,
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

/**
 * Kill Android Chrome's compositor fling, then hand scrollTop to the caller.
 * Overflow and touch-action stay locked for one frame so the fling cannot
 * start, then the owned glide writes scrollTop itself. Listeners stay passive,
 * so a pull at the top of the page can still refresh.
 */
function takeOverScroll(root: Element, start: (y: number) => void) {
  const node = root instanceof HTMLElement ? root : document.documentElement;
  const y = root.scrollTop;
  const previousOverflow = node.style.overflowY;
  const previousTouch = node.style.touchAction;
  node.style.overflowY = "hidden";
  node.style.touchAction = "none";
  node.scrollTop = y;
  node.scrollTo(0, y);
  return requestAnimationFrame(() => {
    node.style.overflowY = previousOverflow;
    node.style.touchAction = previousTouch;
    node.scrollTop = y;
    start(y);
  });
}

/**
 * Owned fling. Full release speed until the cushion, then catch, glide, and settle.
 * A drifted scrollTop from the native fling is ignored. A new touch, wheel, or
 * key is what stops the glide.
 */
function glide(
  root: Element,
  velocity: number,
  target: number,
  skipped: number | null,
  origin: number,
  onDone: () => void,
) {
  let state = startOwnedGlide(origin, velocity, target, skipped);
  let frame = 0;
  let last = performance.now();
  let stopped = false;
  const finishOnce = () => {
    if (stopped) return;
    stopped = true;
    onDone();
  };
  const step = (now: number) => {
    if (stopped) return;
    const dt = Math.max(0, (now - last) / 1000);
    last = now;
    const next = advanceOwnedGlide(state, dt, root.scrollTop);
    state = next.state;
    const limit = Math.max(0, root.scrollHeight - root.clientHeight);
    const y = Math.min(limit, Math.max(0, state.y));
    root.scrollTop = y;
    if (next.pass) passCue();
    if (next.landed) {
      root.scrollTop = Math.min(limit, Math.max(0, target));
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
 *
 * Once a touch pans, Chrome fires pointercancel and drops the pointer stream.
 * The finger is still down, so the gesture follows touchstart, touchmove,
 * touchend, and scroll positions. pointercancel is not a lift.
 */
export function PageSnap() {
  useEffect(() => {
    const root = document.scrollingElement;
    if (!root) return;
    let cancelGlide = () => {};
    let gliding = false;
    let gesture: PageGesture | null = null;
    let fingers = 0;
    let glideToken = 0;
    let takeoverFrame = 0;
    let lastDrag = root.scrollTop;

    const stop = () => {
      glideToken += 1;
      gliding = false;
      cancelAnimationFrame(takeoverFrame);
      cancelGlide();
      cancelGlide = () => {};
    };

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.changedTouches[0] ?? event.touches[0];
      if (!touch) return;
      fingers = event.touches.length;
      gesture = beginPageGesture(performance.now(), root.scrollTop, touch.clientY);
      lastDrag = root.scrollTop;
      stop();
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!gesture) return;
      const touch = event.touches[0];
      if (!touch) return;
      const now = performance.now();
      gesture = notePageTouchMove(gesture, now, touch.clientY);
      gesture = notePageScroll(gesture, now, root.scrollTop);
    };
    const onScroll = () => {
      if (!gesture || gliding) return;
      const y = root.scrollTop;
      gesture = notePageScroll(gesture, performance.now(), y);
      const measured = snapPoints(root);
      const stops = measured.points.map((point) => point.at);
      const passed = stopsPassed(lastDrag, y, stops);
      lastDrag = y;
      for (const _stop of passed) passCue();
    };
    const onLift = (event: TouchEvent) => {
      if (!gestureLift(event.type)) return;
      fingers = event.touches.length;
      if (fingers > 0) return;
      const current = gesture;
      gesture = null;
      if (!current) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const velocity = pageGestureVelocity(current);
      const measured = snapPoints(root);
      const plan = planFling({
        scrollTop: root.scrollTop,
        velocity,
        maxScroll: measured.maxScroll,
        points: measured.points,
        reduced,
      });
      if (plan.target == null) return;
      const token = glideToken;
      const committedTarget = plan.target;
      const committedSkip = plan.skipped;
      gliding = true;
      cancelAnimationFrame(takeoverFrame);
      takeoverFrame = takeOverScroll(root, (y) => {
        if (token !== glideToken) return;
        gliding = true;
        cancelGlide();
        cancelGlide = glide(root, velocity, committedTarget, committedSkip, y, () => {
          gliding = false;
          cancelGlide = () => {};
        });
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
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
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
