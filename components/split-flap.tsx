"use client";

import { useEffect, useRef, useState } from "react";

import { playFlapSound } from "@/lib/flap-sound";
import { FLAP_STEP_MS, flapFrames, padFlap } from "@/lib/split-flap";

function Tile({ char }: { char: string }) {
  const shown = char === " " ? "" : char;
  return (
    <span className="flap-tile" aria-hidden="true">
      <span className="flap-top">
        <span>{shown}</span>
      </span>
      <span className="flap-bottom">
        <span>{shown}</span>
      </span>
      <span className="flap-leaf">
        <span>{shown}</span>
      </span>
    </span>
  );
}

/** A short split-flap word. Each character walks the drum until it lands. */
export function SplitFlap({ text, width }: { text: string; width: number }) {
  const target = padFlap(text, width);
  const [shown, setShown] = useState(() => padFlap("", width));
  const shownRef = useRef(shown);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer = 0;
    let cancelled = false;

    const go = (reduced: boolean) => {
      window.clearTimeout(timer);
      const frames = flapFrames(shownRef.current, target, reduced);
      if (frames.length === 0) return;
      let index = 0;
      const step = () => {
        if (cancelled) return;
        const frame = frames[index];
        if (!frame) return;
        if (!reduced) {
          const previous = shownRef.current;
          for (let place = 0; place < frame.length; place += 1) {
            if (frame[place] !== previous[place]) playFlapSound();
          }
        }
        shownRef.current = frame;
        setShown(frame);
        index += 1;
        if (index < frames.length) timer = window.setTimeout(step, reduced ? 0 : FLAP_STEP_MS);
      };
      step();
    };

    go(media.matches);
    const onChange = () => go(media.matches);
    media.addEventListener("change", onChange);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      media.removeEventListener("change", onChange);
    };
  }, [target]);

  return (
    <span className="split-flap" aria-hidden="true">
      {[...shown].map((char, index) => (
        <Tile key={`${index}-${char}`} char={char} />
      ))}
    </span>
  );
}
