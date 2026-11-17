"use client";

import { useLayoutEffect, useState, type TransitionEvent } from "react";

import { foldMetalNamePosition, nextMetalNamePosition } from "@/lib/metal-name-wheel";

export function MetalNameWheel({
  metals,
  index,
}: {
  metals: readonly { symbol: string; name: string }[];
  index: number;
}) {
  const count = metals.length;
  const safeIndex = count === 0 ? 0 : ((index % count) + count) % count;
  const [position, setPosition] = useState(safeIndex);
  const [motion, setMotion] = useState<"off" | "on">("off");
  const name = metals[safeIndex]?.name ?? "";

  useLayoutEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPosition((current) => {
      const stepped = nextMetalNamePosition(current, safeIndex, count);
      return reduce ? foldMetalNamePosition(stepped, count) : stepped;
    });
    setMotion(reduce ? "off" : "on");
  }, [safeIndex, count]);

  useLayoutEffect(() => {
    if (motion === "on") return;
    const frame = requestAnimationFrame(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      setMotion("on");
    });
    return () => cancelAnimationFrame(frame);
  }, [motion, position]);

  if (count === 0) return null;

  const copies = [0, 1, 2];
  const onTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== "transform") return;
    const folded = foldMetalNamePosition(position, count);
    if (folded === position) return;
    setMotion("off");
    setPosition(folded);
  };

  return (
    <div
      className={motion === "on" ? "metal-name-wheel is-animated" : "metal-name-wheel"}
      data-testid="metal-name-wheel"
      data-metal={name}
      data-index={safeIndex}
      role="img"
      aria-label={name}
    >
      <div
        className="metal-name-drum"
        style={{ transform: `translate3d(0, calc(${-(count + position)} * var(--metal-name-row)), 0)` }}
        onTransitionEnd={onTransitionEnd}
      >
        {copies.flatMap((copy) =>
          metals.map((metal) => (
            <span className="metal-name-face" key={`${copy}-${metal.symbol}`}>
              {metal.name}
            </span>
          )),
        )}
      </div>
      <div className="metal-name-glass" aria-hidden="true" />
    </div>
  );
}
