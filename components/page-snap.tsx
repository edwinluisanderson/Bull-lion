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

/**
 * Stop the compositor fling, then read scrollTop. The read is the position
 * the owned glide starts from; nothing is allowed to move the page between
 * the kill and that read. Overflow stays locked until the glide ends, then
 * the final position is pinned again so a landing cannot drift.
 */
function sealScroll(root: Element): { y: number; unlock: (at: number) => void } {
  const node = root instanceof HTMLElement ? root : document.documentElement;
  const overflow = node.style.overflowY;
  const touch = node.style.touchAction;
  node.style.overflowY = "hidden";
  node.style.touchAction = "none";
  void node.offsetHeight;
  const y = node.scrollTop;
  node.scrollTop = y;
  return {
    y,
    unlock(at: number) {
      node.scrollTop = at;
      node.style.overflowY = overflow;
      node.style.touchAction = touch;
      node.scrollTop = at;
    },
  };
}

/**
 * Owned fling. The first frame steps from `origin` by the clamped speed times
 * the real dt. It never catches up to an earlier position and never reads
 * scrollTop back into the integrator.
 */
function glide(
  root: Element,
  velocity: number,
  target: number,
  skipped: number | null,
  origin: number,
  maxScroll: number,
  onDone: (at: number) => void,
) {
  let state = startOwnedGlide(origin, velocity, target, skipped, maxScroll);
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
    if (next.pass) passCue();
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
    let lastDrag = root.scrollTop;
    let releaseSeal: ((at: number) => void) | null = null;

    const stop = () => {
      gliding = false;
      cancelGlide();
      cancelGlide = () => {};
      if (releaseSeal) {
        releaseSeal(root.scrollTop);
        releaseSeal = null;
      }
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
      gesture = beginPageGesture(performance.now(), root.scrollTop, touch.clientY);
      lastDrag = root.scrollTop;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!gesture) return;
      const touch = event.touches[0];
      if (!touch) return;
      const now = performance.now();
      gesture = notePageTouchMove(gesture, now, touch.clientY);
      gesture = notePageScroll(gesture, now, root.scrollTop);
      noteDrag(root.scrollTop);
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
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const velocity = pageGestureVelocity(current);
      const sealed = sealScroll(root);
      const origin = sealed.y;
      const measured = snapPoints(root);
      const plan = planFling({
        scrollTop: origin,
        velocity,
        maxScroll: measured.maxScroll,
        points: measured.points,
        reduced,
      });
      if (plan.target == null) {
        sealed.unlock(origin);
        return;
      }
      const committedTarget = plan.target;
      const committedSkip = plan.skipped;
      const speed = aimedSpeed(velocity, origin, committedTarget);
      gliding = true;
      releaseSeal = sealed.unlock;
      cancelGlide();
      cancelGlide = glide(root, speed, committedTarget, committedSkip, origin, measured.maxScroll, (at) => {
        gliding = false;
        cancelGlide = () => {};
        if (releaseSeal) {
          releaseSeal(at);
          releaseSeal = null;
        }
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
