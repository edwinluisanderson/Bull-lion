"use client";

import { useEffect, useRef } from "react";

import { SteampunkLight } from "@/components/steampunk-light";
import { WHEEL_LAMP_COUNT } from "@/lib/steampunk-light";
import {
  applyLampEnergy,
  decayWheelLamps,
  subscribeWheelLamps,
  wheelLampEnergy,
} from "@/lib/wheel-lamp";

/** Reduced motion holds every wheel lamp at full, with no pulses. */
const REDUCED_LEVEL = 1;

export function WheelLamps() {
  const refs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const nodes = () => refs.current;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let last = performance.now();
    nodes().forEach((node, index) => applyLampEnergy(node, media.matches ? REDUCED_LEVEL : wheelLampEnergy(index)));

    const paintAll = () => {
      nodes().forEach((node, index) => applyLampEnergy(node, wheelLampEnergy(index)));
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const levels = decayWheelLamps(dt);
      let alive = false;
      nodes().forEach((node, index) => {
        const level = levels[index] ?? 0;
        applyLampEnergy(node, level);
        if (level > 0) alive = true;
      });
      raf = alive ? requestAnimationFrame(frame) : 0;
    };

    const start = () => {
      if (media.matches || raf) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const syncReduced = () => {
      if (!media.matches) return;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      nodes().forEach((node) => applyLampEnergy(node, REDUCED_LEVEL));
    };

    syncReduced();
    const unsubscribe = subscribeWheelLamps(() => {
      if (media.matches) {
        syncReduced();
        return;
      }
      paintAll();
      start();
    });
    media.addEventListener("change", syncReduced);
    return () => {
      unsubscribe();
      media.removeEventListener("change", syncReduced);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="wheel-lamps">
      {Array.from({ length: WHEEL_LAMP_COUNT }, (_, index) => (
        <span
          key={index}
          className="wheel-lamp"
          ref={(node) => {
            refs.current[index] = node;
          }}
        >
          <SteampunkLight driven />
        </span>
      ))}
    </div>
  );
}
