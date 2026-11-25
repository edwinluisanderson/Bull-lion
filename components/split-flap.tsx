"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { playFlapSound, trackFlippingFlap } from "@/lib/flap-sound";
import { FLAP_STEP_MS, flapEm, flapFrames, padFlap } from "@/lib/split-flap";

function Tile({ char, index, cursor }: { char: string; index: number; cursor: boolean }) {
  const shown = char === " " ? "" : char;
  return (
    <span
      className={cursor ? "flap-tile is-cursor" : "flap-tile"}
      data-flap-index={index}
      style={{ "--flap-em": flapEm(char) } as React.CSSProperties}
      aria-hidden="true"
    >
      <span className="flap-top">
        <span>{shown}</span>
      </span>
      <span className="flap-bottom">
        <span>{shown}</span>
      </span>
      <span className="flap-leaf">
        <span>{shown}</span>
      </span>
      <span className="flap-stack" aria-hidden="true" />
    </span>
  );
}

function changedPlaces(previous: string, next: string): number[] {
  const count = Math.max(previous.length, next.length);
  const places: number[] = [];
  for (let index = 0; index < count; index += 1) {
    if (previous[index] !== next[index]) places.push(index);
  }
  return places;
}

/** A short split-flap word. Each character walks the drum until it lands. */
export function SplitFlap({
  text,
  width,
  instant = false,
  cursor = null,
  onSettled,
}: {
  text: string;
  width: number;
  /** Jump to the text. No drum and no tick. */
  instant?: boolean;
  /** Outline this one flap. Null leaves every flap plain. */
  cursor?: number | null;
  /** Fires after a drum walk lands. Snaps do not call it. */
  onSettled?: () => void;
}) {
  const target = padFlap(text, width);
  const [shown, setShown] = useState(() => padFlap("", width));
  const shownRef = useRef(shown);
  const rootRef = useRef<HTMLSpanElement>(null);
  const pendingSound = useRef<number[]>([]);
  const quietJump = useRef(false);
  const onSettledRef = useRef(onSettled);
  useEffect(() => {
    onSettledRef.current = onSettled;
  });

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer = 0;
    let cancelled = false;
    let generation = 0;

    const go = (reduced: boolean) => {
      window.clearTimeout(timer);
      generation += 1;
      const run = generation;
      if (instant || reduced) {
        if (shownRef.current !== target) {
          quietJump.current = true;
          shownRef.current = target;
          setShown(target);
        }
        if (reduced && !instant) onSettledRef.current?.();
        return;
      }
      const frames = flapFrames(shownRef.current, target, false);
      if (frames.length === 0) {
        onSettledRef.current?.();
        return;
      }
      let index = 0;
      const step = () => {
        if (cancelled || run !== generation) return;
        const frame = frames[index];
        if (!frame) return;
        pendingSound.current = changedPlaces(shownRef.current, frame);
        shownRef.current = frame;
        setShown(frame);
        index += 1;
        if (index < frames.length) {
          timer = window.setTimeout(step, FLAP_STEP_MS);
          return;
        }
        onSettledRef.current?.();
      };
      step();
    };

    go(instant || media.matches);
    const onChange = () => go(media.matches);
    media.addEventListener("change", onChange);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      media.removeEventListener("change", onChange);
    };
  }, [target, instant]);

  useLayoutEffect(() => {
    if (quietJump.current) {
      quietJump.current = false;
      pendingSound.current = [];
      return;
    }
    const places = pendingSound.current;
    pendingSound.current = [];
    const root = rootRef.current;
    if (!root || places.length === 0) return;
    const tiles = root.querySelectorAll<HTMLElement>(".flap-tile");
    const stops: Array<() => void> = [];
    for (const place of places) {
      const tile = tiles[place];
      if (tile) stops.push(trackFlippingFlap(tile));
    }
    for (let count = 0; count < places.length; count += 1) playFlapSound();
    const release = window.setTimeout(() => {
      for (const stop of stops) stop();
    }, FLAP_STEP_MS);
    return () => {
      window.clearTimeout(release);
      for (const stop of stops) stop();
    };
  }, [shown]);

  return (
    <span ref={rootRef} className={instant ? "split-flap is-instant" : "split-flap"} aria-hidden="true">
      {[...shown].map((char, index) => (
        <Tile key={`${index}-${char}`} char={char} index={index} cursor={cursor === index} />
      ))}
    </span>
  );
}
