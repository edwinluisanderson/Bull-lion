"use client";

import { useEffect, useRef, useState } from "react";

import { pullStage, stageBendDegrees, type PullStage } from "@/lib/drum";
import {
  LEVER_PULL_MS,
  LEVER_RETURN_MS,
  armPose,
  legendRoll,
  leverReturnCurve,
  ratchetTooth,
} from "@/lib/lever-motion";
import { leverRelease, leverTick } from "@/lib/lever-sound";
import { PULL_WORD_PATH } from "@/lib/pull-word";
import { unlockReelClick, reelSnap } from "@/lib/reel-click";
import { armSpinOverlay } from "@/lib/spin-overlay";

export function PullBall({
  onCommit,
  onBend,
}: {
  onCommit: () => void;
  onBend: (degrees: number) => void;
}) {
  /** Ball progress, 0 at rest to 1 at the bottom. Dips below 0 during the return bounce. */
  const [progress, setProgress] = useState(0);
  const [throwPx, setThrowPx] = useState(1);
  const [midlineGap, setMidlineGap] = useState(0);
  const [motion, setMotion] = useState<"rest" | "drag" | "return">("rest");
  const [stageAttr, setStageAttr] = useState<PullStage>("a");
  const ballRef = useRef<HTMLButtonElement>(null);
  const throwRef = useRef(1);
  const originY = useRef<number | null>(null);
  const travelRef = useRef(0);
  const stageRef = useRef<PullStage>("a");
  const committed = useRef(false);
  const dragged = useRef(false);
  const frame = useRef(0);
  const toothRef = useRef(0);

  function reduced() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function measureThrow() {
    const ball = ballRef.current;
    const playfield = ball?.closest(".playfield");
    const frame = playfield?.querySelector(".window-frame");
    const wheel = playfield?.querySelector(".reel-viewport");
    if (!ball || !frame || !wheel) return throwRef.current;
    const ballBox = ball.getBoundingClientRect();
    const frameBox = frame.getBoundingClientRect();
    const wheelBox = wheel.getBoundingClientRect();
    const shift = travelRef.current * throwRef.current;
    const restTop = ballBox.top - shift;
    const distance = frameBox.bottom - (restTop + ballBox.height);
    const gapNow = wheelBox.top + wheelBox.height / 2 - (restTop + ballBox.height / 2);
    // MOCKUP (compact): cap the throw at ratio x arm length so a shorter arm keeps the same swing shape.
    const ratio = parseFloat(getComputedStyle(ball).getPropertyValue("--pull-throw-ratio"));
    const next = Math.max(1, Number.isFinite(ratio) && ratio > 0 ? Math.min(distance, ratio * gapNow) : distance);
    throwRef.current = next;
    setThrowPx(next);
    setMidlineGap(gapNow);
    return next;
  }

  function setTravelValue(next: number) {
    const clamped = Math.min(1, Math.max(0, next));
    travelRef.current = clamped;
    setProgress(clamped);
    return clamped;
  }

  function dragTo(next: number) {
    const reached = pullStage(setTravelValue(next));
    noteRatchet(travelRef.current);
    onBend(reached === "c" ? 0 : stageBendDegrees(travelRef.current));
    noteStage(reached);
  }

  function noteRatchet(travel: number) {
    const tooth = ratchetTooth(travel);
    if (tooth > toothRef.current) leverTick();
    toothRef.current = Math.max(toothRef.current, tooth);
  }

  function noteStage(stage: PullStage) {
    const previous = stageRef.current;
    if (stage === previous) return;
    if (previous === "a" && (stage === "b" || stage === "c")) reelSnap();
    stageRef.current = stage;
    setStageAttr(stage);
    if (stage === "c" && dragged.current) commitSpin();
  }

  function commitSpin() {
    if (committed.current) return;
    committed.current = true;
    onBend(0);
    leverRelease();
    onCommit();
  }

  function stopFrame() {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
  }

  function settleAtRest() {
    stageRef.current = "a";
    setStageAttr("a");
    committed.current = false;
    toothRef.current = 0;
    setMotion("rest");
  }

  function glideHome(afterCommit: boolean) {
    stopFrame();
    const from = travelRef.current;
    const fromBend = afterCommit ? 0 : stageBendDegrees(from);
    const duration = reduced() ? 0 : LEVER_RETURN_MS;
    setMotion("return");
    const start = performance.now();
    const step = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      const left = leverReturnCurve(t);
      setTravelValue(from * left);
      setProgress(from * left);
      onBend(fromBend * Math.max(0, left));
      if (t < 1) {
        frame.current = requestAnimationFrame(step);
        return;
      }
      setProgress(0);
      settleAtRest();
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
    armSpinOverlay();
    if (committed.current) return;
    dragged.current = false;
    measureThrow();
    if (reduced()) {
      commitSpin();
      committed.current = false;
      stageRef.current = "a";
      setTravelValue(0);
      setMotion("rest");
      return;
    }
    stopFrame();
    setMotion("drag");
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / LEVER_PULL_MS);
      dragTo(t);
      if (t >= 1) {
        commitSpin();
        glideHome(true);
        return;
      }
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }

  const drop = progress * throwPx;
  const gap = Math.max(1, midlineGap);
  const arm = armPose(gap, drop);
  const roll = legendRoll(progress);
  const collarSide = arm.scaleY >= 0 ? 1 : -1;
  const collarReach = Math.abs(arm.scaleY);

  return (
    <>
      <div className="pull-rig" aria-hidden="true" style={{ ["--pull-gap" as string]: `${gap}px` }}>
        <span className="pull-slot" style={{ height: Math.max(0, throwPx - gap) }} />
        <span className="pull-mount">
          <i data-rivet="t" />
          <i data-rivet="b" />
        </span>
        <span className="pull-drum" style={{ ["--rib-shift" as string]: `${arm.ribShift.toFixed(2)}px` }} />
        <span className="pull-arm" style={{ transform: `translateX(-50%) scaleY(${arm.scaleY.toFixed(4)})` }}>
          <span className="pull-arm-glint" style={{ opacity: 0.55 + 0.45 * arm.toward }} />
        </span>
        <span className="pull-cap" />
      </div>
      <div className="pull-handle" style={{ transform: `translate3d(0, ${drop}px, 0)` }}>
        <span
          className="pull-collar"
          aria-hidden="true"
          style={{
            transform: `translate(-50%, -50%) translateY(${(collarSide * 25 * collarReach).toFixed(2)}px) scaleY(${Math.max(0.3, collarReach).toFixed(3)})`,
            opacity: collarReach < 0.12 ? 0 : 1,
          }}
        />
        <button
          ref={ballRef}
          type="button"
          className={`pull-ball is-${motion}`}
          aria-label="Pull the ball to spin all three reels"
          data-stage={stageAttr}
          data-throw={Math.round(throwPx)}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            if (event.cancelable) event.preventDefault();
            unlockReelClick();
            armSpinOverlay();
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
              if (travelRef.current > 0) glideHome(committed.current);
              else setMotion("rest");
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
        >
          <span className="pull-gloss" aria-hidden="true" />
          <svg className="pull-word" viewBox="0 0 100 100" aria-hidden="true">
            <defs>
              <linearGradient id="pull-legend-ink" x1="0" x2="0" y1="0.3" y2="0.7">
                <stop offset="0" stopColor="#fff4d2" />
                <stop offset="0.55" stopColor="#f3d488" />
                <stop offset="1" stopColor="#c4963e" />
              </linearGradient>
              <clipPath id="pull-legend-clip">
                <circle cx="50" cy="50" r="48" />
              </clipPath>
            </defs>
            <g clipPath="url(#pull-legend-clip)">
              <g
                opacity={roll.opacity.toFixed(3)}
                transform={`translate(0 ${roll.shift.toFixed(2)}) translate(50 50) scale(1 ${roll.scaleY.toFixed(4)}) translate(-50 -50)`}
              >
                <g transform="translate(50 51) scale(0.8) translate(-50 -50)">
                  <path d={PULL_WORD_PATH} fill="none" style={{ stroke: "var(--pull-legend-edge, #021a1c)" }} strokeWidth="6" strokeLinejoin="round" opacity="0.9" />
                  <path d={PULL_WORD_PATH} fill="url(#pull-legend-ink)" fillRule="nonzero" />
                </g>
              </g>
            </g>
          </svg>
        </button>
      </div>
    </>
  );
}
