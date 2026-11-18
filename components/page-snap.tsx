"use client";

import { useEffect } from "react";

import {
  ALWAYS_SNAP_NAMES,
  magnetCaption,
  nearestStop,
  settleSnap,
  softCloseAt,
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

/**
 * Soft-close drawer. The page cruises, then cushions to a stop. A scroll that
 * moves out from under the glide is left alone so a finger can interrupt it.
 */
function glide(root: Element, to: number, onDone: () => void) {
  const from = root.scrollTop;
  const offset0 = from - to;
  if (Math.abs(offset0) < 1) {
    root.scrollTop = to;
    onDone();
    return () => {};
  }
  const start = performance.now();
  let frame = 0;
  let placed = from;
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
    const elapsed = (now - start) / 1000;
    const sample = softCloseAt(elapsed, offset0);
    const limit = Math.max(0, root.scrollHeight - root.clientHeight);
    const next = Math.min(limit, Math.max(0, to + sample.offset));
    root.scrollTop = next;
    placed = root.scrollTop;
    const settled = Math.abs(sample.offset) < 0.35 && Math.abs(sample.velocity) < 6;
    if (!settled && elapsed < 8) frame = requestAnimationFrame(step);
    else {
      root.scrollTop = Math.min(limit, Math.max(0, to));
      placed = root.scrollTop;
      finishOnce();
    }
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
 * After a drag or a fling comes to rest, ease onto a nearby stop.
 * The finger path and the fling stay native. Android Chrome composites that
 * scroll, and writing `scrollTop` while the fling is in flight fights it.
 * `scrollend` is the moment the fling lets go, including one that slowed to
 * rest near a stop. The glide is a soft-close drawer: a calm cruise, then a
 * cushion that arrives with almost no speed. A closer rest is not grabbier.
 * A rest at the field radius or farther is left exactly where it landed. A new
 * touch, wheel, or scroll key cancels the ease. Touch listeners leave the
 * event alone, so a pull down at the top stays a native overscroll and
 * Android Chrome can refresh.
 */
export function PageSnap() {
  useEffect(() => {
    const root = document.scrollingElement;
    if (!root) return;
    let cancelGlide = () => {};
    let gliding = false;
    let touching = 0;

    const finish = () => {
      if (gliding) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const measured = snapPoints(root);
      const pull = settleSnap({
        scrollTop: measured.top,
        maxScroll: measured.maxScroll,
        points: measured.points,
        reduced,
      });
      if (pull == null || Math.abs(pull.target - root.scrollTop) < 1) return;
      gliding = true;
      cancelGlide();
      cancelGlide = glide(root, pull.target, () => {
        gliding = false;
        cancelGlide = () => {};
      });
    };

    const stop = () => {
      gliding = false;
      cancelGlide();
      cancelGlide = () => {};
    };

    let resizeFrame = 0;
    const onDown = () => {
      touching += 1;
      stop();
    };
    const onUp = () => {
      touching = Math.max(0, touching - 1);
    };
    const onWheel = () => {
      stop();
    };
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']")) return;
      if (SCROLL_KEYS.has(event.key)) stop();
    };
    const onLayout = () => {
      if (touching || gliding) return;
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(finish);
    };
    const observer = new ResizeObserver(onLayout);
    observer.observe(document.body);
    document.addEventListener("scrollend", finish);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onLayout);
    return () => {
      stop();
      cancelAnimationFrame(resizeFrame);
      observer.disconnect();
      document.removeEventListener("scrollend", finish);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onLayout);
    };
  }, []);

  useEffect(() => mountMagnetCaption(), []);

  return null;
}
