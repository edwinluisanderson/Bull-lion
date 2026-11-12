"use client";

import { useRef, useState } from "react";

export function Lever({ onPull }: { onPull: () => void }) {
  const [yank, setYank] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const pulledByDrag = useRef(false);

  function pull() {
    setYank((count) => count + 1);
    onPull();
  }

  return (
    <div className="lever-bay">
      <button
        type="button"
        className="lever"
        aria-label="Pull the lever to spin all three reels"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          start.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={(event) => {
          const origin = start.current;
          start.current = null;
          if (!origin) return;
          const dragged =
            event.clientY - origin.y > 28 || event.clientX - origin.x > 28;
          if (!dragged) return;
          pulledByDrag.current = true;
          pull();
        }}
        onClick={() => {
          if (pulledByDrag.current) {
            pulledByDrag.current = false;
            return;
          }
          pull();
        }}
      >
        <span key={yank} className={yank > 0 ? "lever-arm yank" : "lever-arm"}>
          <span className="lever-shaft" />
          <span className="lever-collar" />
          <span className="lever-grip">
            <span>Pull</span>
          </span>
        </span>
      </button>
    </div>
  );
}
