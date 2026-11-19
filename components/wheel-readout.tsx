"use client";

import { useLayoutEffect, useRef, useState } from "react";

import {
  ODOMETER_STRIP,
  OVERSHOOT_EM,
  WHEEL_COUNT,
  WHEEL_STEP_DEG,
  layoutWheels,
  odometerCell,
  wheelDurationMs,
  wheelStaggerMs,
} from "@/lib/melt-wheels";

const RADIUS_EM = 0.935;
const PERSPECTIVE_EM = 5.5;
const MIN_LIGHT = 0.31;

function bezier(x1: number, y1: number, x2: number, y2: number) {
  const sample = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x: number) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i += 1) {
      const mid = (lo + hi) / 2;
      if (sample(x1, x2, mid) < x) lo = mid;
      else hi = mid;
    }
    return sample(y1, y2, (lo + hi) / 2);
  };
}

const EASE_IN = bezier(0.32, 0.02, 0.24, 1);
const EASE_SETTLE = bezier(0.4, 0, 0.3, 1);

function CurvedWheel({ char, slot }: { char: string; slot: number }) {
  const cell = odometerCell(char);
  const faces = useRef<(HTMLSpanElement | null)[]>([]);
  const ridges = useRef<(HTMLSpanElement | null)[]>([]);
  const wheel = useRef<HTMLSpanElement>(null);
  const cyl = useRef<HTMLSpanElement>(null);
  const nxGlow = useRef<HTMLSpanElement>(null);
  const nxFil = useRef<HTMLSpanElement>(null);
  const at = useRef(cell);
  const raf = useRef(0);

  const place = (el: HTMLSpanElement | null, angle: number) => {
    if (!el) return;
    if (Math.abs(angle) >= 89) {
      el.style.visibility = "hidden";
      return;
    }
    const cosine = Math.cos((angle * Math.PI) / 180);
    el.style.visibility = "visible";
    el.style.transform = `rotateX(${-angle}deg) translateZ(${RADIUS_EM}em)`;
    el.style.opacity = String(MIN_LIGHT + (1 - MIN_LIGHT) * cosine ** 1.6);
  };

  const apply = (position: number) => {
    at.current = position;
    const nearest = Math.round(position);
    const angle = ((nearest - position) * WHEEL_STEP_DEG * Math.PI) / 180;
    const cosine = Math.cos(angle);
    const text = ODOMETER_STRIP[nearest] ?? "";
    const transform = `translateY(${(RADIUS_EM * Math.sin(angle)).toFixed(4)}em) scaleY(${cosine.toFixed(4)})`;
    [nxGlow.current, nxFil.current].forEach((el, index) => {
      if (!el) return;
      if (el.textContent !== text) el.textContent = text;
      el.style.transform = transform;
      el.style.opacity = (cosine ** 8 * (index === 1 ? 0.72 : 1)).toFixed(3);
    });
    faces.current.forEach((el, index) => place(el, (index - position) * WHEEL_STEP_DEG));
    ridges.current.forEach((el, index) => place(el, (index - 0.5 - position) * WHEEL_STEP_DEG));
  };

  useLayoutEffect(() => {
    const from = at.current;
    cancelAnimationFrame(raf.current);
    const distance = Math.abs(cell - from);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || distance < 0.001) {
      apply(cell);
      return;
    }
    const direction = cell > from ? 1 : -1;
    const duration = wheelDurationMs(distance);
    const delay = wheelStaggerMs(slot);
    const blankDelay = char === "" ? `${Math.round(delay + duration * 0.8)}ms` : "0ms";
    if (cyl.current) cyl.current.style.transitionDelay = blankDelay;
    if (wheel.current) wheel.current.style.setProperty("--blank-delay", blankDelay);
    const start = performance.now() + delay;
    const tick = () => {
      const progress = Math.min(1, Math.max(0, (performance.now() - start) / duration));
      const over = cell + direction * OVERSHOOT_EM;
      const position = progress < 0.78
        ? from + (over - from) * EASE_IN(progress / 0.78)
        : over + (cell - over) * EASE_SETTLE((progress - 0.78) / 0.22);
      apply(position);
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [cell, slot, char]);

  return (
    <span
      ref={wheel}
      className="melt-wheel"
      data-blank={char === "" ? "true" : "false"}
      data-char={char}
      style={{ perspective: `${PERSPECTIVE_EM}em` }}
    >
      <span ref={nxGlow} className="melt-nx melt-nx-glow" aria-hidden="true" />
      <span ref={cyl} className="melt-cyl" style={{ transform: `translateZ(-${RADIUS_EM}em)` }}>
        {[...ODOMETER_STRIP, ""].map((_, index) => (
          <span key={`r${index}`} ref={(el) => { ridges.current[index] = el; }} className="melt-ridge" style={{ visibility: "hidden" }} />
        ))}
        {ODOMETER_STRIP.map((glyph, index) => (
          <span key={index} ref={(el) => { faces.current[index] = el; }} className="melt-face" style={{ visibility: "hidden" }}>
            <span className="melt-glyph">{glyph === "" ? "\u00a0" : glyph}</span>
          </span>
        ))}
      </span>
      <span ref={nxFil} className="melt-nx melt-nx-fil" aria-hidden="true" />
      <span className="melt-spec" aria-hidden="true" />
    </span>
  );
}

export function WheelReadout({ value }: { value: string }) {
  const [shown, setShown] = useState(value);
  useLayoutEffect(() => setShown(value), [value]);
  const chars = layoutWheels(shown, WHEEL_COUNT);
  return (
    <div className="gear-panel-nixie-live">
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <filter id="melt-fil-core" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feMorphology operator="erode" radius="0.9" />
          <feGaussianBlur stdDeviation="0.22" />
        </filter>
      </svg>
      <div className="nixie-bezel melt-wheels-bezel" aria-label={shown}>
        <div className="melt-wheels" data-value={shown} data-testid="melt-wheels">
          {chars.map((char, index) => (
            <CurvedWheel key={index} char={char} slot={index} />
          ))}
        </div>
      </div>
      <div className="nixie-glass" aria-hidden="true">
        <span className="rivet" data-corner="tl" />
        <span className="rivet" data-corner="tr" />
        <span className="rivet" data-corner="bl" />
        <span className="rivet" data-corner="br" />
      </div>
    </div>
  );
}
