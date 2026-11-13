"use client";

import { useEffect, useRef, useState } from "react";

import { pullStage, stageBendDegrees, type PullStage } from "@/lib/drum";
import { unlockReelClick, reelSnap } from "@/lib/reel-click";

export function PullBall({
  onCommit,
  onBend,
}: {
  onCommit: () => void;
  onBend: (degrees: number) => void;
}) {
  const [travel, setTravel] = useState(0);
  const [throwPx, setThrowPx] = useState(1);
  const [motion, setMotion] = useState<"rest" | "drag" | "spring" | "rocket">("rest");
  const ballRef = useRef<HTMLButtonElement>(null);
  const throwRef = useRef(1);
  const originY = useRef<number | null>(null);
  const travelRef = useRef(0);
  const stageRef = useRef<PullStage>("a");
  const committed = useRef(false);
  const dragged = useRef(false);
  const suppressClick = useRef(false);
  const frame = useRef(0);

  function reduced() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function measureThrow() {
    const ball = ballRef.current;
    const frame = ball?.closest(".playfield")?.querySelector(".window-frame");
    if (!ball || !frame) return throwRef.current;
    const ballBox = ball.getBoundingClientRect();
    const frameBox = frame.getBoundingClientRect();
    const restTop = ballBox.top - travelRef.current * throwRef.current;
    const distance = frameBox.bottom - (restTop + ballBox.height);
    const next = Math.max(1, distance);
    throwRef.current = next;
    setThrowPx(next);
    return next;
  }

  function setTravelValue(next: number) {
    const clamped = Math.min(1, Math.max(0, next));
    travelRef.current = clamped;
    setTravel(clamped);
    return clamped;
  }

  function dragTo(next: number) {
    const stage = pullStage(setTravelValue(next));
    onBend(stage === "c" ? 0 : stageBendDegrees(travelRef.current));
    noteStage(stage);
  }

  function noteStage(stage: PullStage) {
    const previous = stageRef.current;
    if (stage === previous) return;
    if (previous === "a" && (stage === "b" || stage === "c")) reelSnap();
    if (stage === "c" && !committed.current) {
      committed.current = true;
      onBend(0);
      onCommit();
    }
    stageRef.current = stage;
  }

  function stopFrame() {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
  }

  function glideHome(rocket: boolean) {
    stopFrame();
    const from = travelRef.current;
    const fromBend = rocket ? 0 : stageBendDegrees(from);
    const duration = reduced() ? 0 : rocket ? 280 : 460;
    setMotion(rocket ? "rocket" : "spring");
    const start = performance.now();
    const step = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      const eased = rocket ? 1 - (1 - t) ** 3 : 1 - (1 - t) ** 2;
      setTravelValue(from * (1 - eased));
      onBend(fromBend * (1 - eased));
      if (t < 1) {
        frame.current = requestAnimationFrame(step);
        return;
      }
      stageRef.current = "a";
      committed.current = false;
      setMotion("rest");
    };
    frame.current = requestAnimationFrame(step);
  }

  useEffect(() => {
    measureThrow();
    const onResize = () => measureThrow();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function fullPull() {
    unlockReelClick();
    if (committed.current) return;
    measureThrow();
    if (reduced()) {
      committed.current = true;
      onBend(0);
      onCommit();
      committed.current = false;
      stageRef.current = "a";
      return;
    }
    stopFrame();
    setMotion("drag");
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 420);
      dragTo(t);
      if (t < 1) {
        frame.current = requestAnimationFrame(step);
        return;
      }
      glideHome(true);
    };
    frame.current = requestAnimationFrame(step);
  }

  return (
    <button
      ref={ballRef}
      type="button"
      className={`pull-ball is-${motion}`}
      aria-label="Pull the ball to spin all three reels"
      data-stage={stageRef.current}
      data-throw={Math.round(throwPx)}
      style={{ transform: `translate3d(0, ${travel * throwPx}px, 0)` }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        if (event.cancelable) event.preventDefault();
        unlockReelClick();
        stopFrame();
        measureThrow();
        originY.current = event.clientY;
        dragged.current = false;
        setMotion("drag");
        const pointerId = event.pointerId;
        const onMove = (move: PointerEvent) => {
          if (move.pointerId !== pointerId || originY.current === null) return;
          if (move.cancelable) move.preventDefault();
          const dy = move.clientY - originY.current;
          if (dy > 6) dragged.current = true;
          dragTo(dy / throwRef.current);
        };
        const onUp = (up: PointerEvent) => {
          if (up.pointerId !== pointerId) return;
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onUp);
          originY.current = null;
          if (!dragged.current) {
            setMotion("rest");
            return;
          }
          suppressClick.current = true;
          glideHome(committed.current || pullStage(travelRef.current) === "c");
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        fullPull();
      }}
      onClick={() => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        fullPull();
      }}
    >
      <span>Pull</span>
    </button>
  );
}
