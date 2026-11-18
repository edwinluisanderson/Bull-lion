"use client";

import { useEffect } from "react";

import { settleSnap } from "@/lib/page-snap";

const GLIDE_MS = 280;

function snapPoints(root: Element): { points: number[]; maxScroll: number; top: number } {
  const top = root.scrollTop;
  const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
  const points = [...root.ownerDocument.querySelectorAll<HTMLElement>("[data-snap]")].map((node) => {
    const y = node.getBoundingClientRect().top + top;
    return Math.min(maxScroll, Math.max(0, y));
  });
  points.push(0, maxScroll);
  return { points, maxScroll, top };
}

function glide(root: Element, to: number, reduced: boolean) {
  const from = root.scrollTop;
  if (Math.abs(to - from) < 1 || reduced) {
    root.scrollTop = to;
    return () => {};
  }
  const start = performance.now();
  let frame = 0;
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / GLIDE_MS);
    const c1 = 1.15;
    const c3 = c1 + 1;
    const eased = 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
    const limit = Math.max(0, root.scrollHeight - root.clientHeight);
    const next = from + (to - from) * eased;
    root.scrollTop = Math.min(limit, Math.max(0, next));
    if (t < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

/** After a flick settles, spring onto a nearby stop. Anywhere else, stay put. */
export function PageSnap() {
  useEffect(() => {
    const root = document.scrollingElement;
    if (!root) return;
    let cancelGlide = () => {};
    let gliding = false;

    const finish = () => {
      if (gliding) {
        gliding = false;
        return;
      }
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const measured = snapPoints(root);
      const target = settleSnap({
        scrollTop: measured.top,
        maxScroll: measured.maxScroll,
        points: measured.points,
        reduced,
      });
      if (target == null || Math.abs(target - root.scrollTop) < 1) return;
      gliding = true;
      cancelGlide();
      cancelGlide = glide(root, target, reduced);
    };

    const stop = () => {
      gliding = false;
      cancelGlide();
      cancelGlide = () => {};
    };

    let touching = 0;
    let resizeFrame = 0;
    const onDown = () => {
      touching += 1;
      stop();
    };
    const onUp = () => {
      touching = Math.max(0, touching - 1);
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
    window.addEventListener("resize", onLayout);
    return () => {
      stop();
      cancelAnimationFrame(resizeFrame);
      observer.disconnect();
      document.removeEventListener("scrollend", finish);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("resize", onLayout);
    };
  }, []);

  return null;
}
