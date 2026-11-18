"use client";

import { useEffect } from "react";

import { settleSnap } from "@/lib/page-snap";

const GLIDE_MS = 220;

function snapPoints(root: Element): { points: number[]; maxScroll: number; viewport: number; top: number } {
  const top = root.scrollTop;
  const viewport = root.clientHeight;
  const maxScroll = Math.max(0, root.scrollHeight - viewport);
  const points = [...root.ownerDocument.querySelectorAll<HTMLElement>("[data-snap]")].map((node) => {
    const y = node.getBoundingClientRect().top + top;
    return Math.min(maxScroll, Math.max(0, y));
  });
  points.push(0, maxScroll);
  return { points, maxScroll, viewport, top };
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
    const eased = 1 - (1 - t) ** 3;
    root.scrollTop = from + (to - from) * eased;
    if (t < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

/** After a flick settles, catch the next plate or pull back. Tall sections stay readable. */
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
        viewport: measured.viewport,
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

    document.addEventListener("scrollend", finish);
    window.addEventListener("pointerdown", stop);
    return () => {
      stop();
      document.removeEventListener("scrollend", finish);
      window.removeEventListener("pointerdown", stop);
    };
  }, []);

  return null;
}
