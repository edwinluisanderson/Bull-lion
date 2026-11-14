"use client";

import type { ReactElement } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LIVE_SPOT_NOTE } from "@/lib/price-book";

export function AssayInfoIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="12.2" fill="#2a1c10" stroke="#e6cb82" strokeWidth="1.7" />
      <circle cx="16" cy="16" r="9.3" fill="none" stroke="#6e5318" strokeWidth="0.9" />
      <circle cx="16" cy="11.15" r="1.35" fill="#f0d78c" />
      <path
        d="M16 14.35v7.15"
        fill="none"
        stroke="#f0d78c"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AssayDialog({
  formula,
  trigger,
}: {
  formula?: string;
  trigger: ReactElement;
}) {
  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent className="assay-dialog max-h-[min(85dvh,42rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="assay-dialog-title">
            <span className="assay-dialog-mark">
              <AssayInfoIcon />
            </span>
            <span className="sr-only">Assay notes</span>
          </DialogTitle>
          <DialogDescription>
            How the three reels turn a spot price into a melt value.
          </DialogDescription>
        </DialogHeader>
        <div className="assay-copy">
          <h3>The third reel is a piece count</h3>
          <p>
            Reel 1 is the metal. Reel 2 is the weight of one piece. Reel 3 is how
            many of those pieces are in the stack: 1, 2, 5, 10, 20, 25, 50, or 100.
            That matches the question the glass is built to answer, such as ten
            1 oz coins or a single kilo bar.
          </p>
          <p>
            Purity stays at fine metal. Spot times weight is the melt of .999 and
            better. A karat reel would bury that answer under jewelry math, so it
            is not on the machine.
          </p>
          <h3>The sum</h3>
          <p>{LIVE_SPOT_NOTE}</p>
          <p>
            Drag or flick a reel. It coasts and snaps. Pull the lever to throw all
            three, or use the arrows and the keyboard.
          </p>
          <p>Melt value = spot per troy ounce × weight in troy ounces × pieces.</p>
          {formula ? <p>{formula}</p> : null}
          <p>
            A troy ounce is 31.1034768 grams. The 1/10 oz, 1/4 oz, 1/2 oz, 1 oz,
            2 oz, 5 oz, and 10 oz stops use that ounce. Gram and kilo stops are metric,
            then converted before they are multiplied.
          </p>
          <h3>Copper</h3>
          <p>
            Gold, silver, platinum, and palladium arrive as USD per troy ounce.
            Copper arrives as USD per avoirdupois pound, the COMEX HG quote. One
            pound is 14.5833 troy ounces. The machine converts copper before the
            reels multiply, and the readout shows both figures.
          </p>
          <h3>Where the numbers come from</h3>
          <p>
            Live prices come from{" "}
            <a href="https://gold-api.com" target="_blank" rel="noreferrer">
              Gold API
            </a>
            , which serves real-time quotes with no key. The server caches them
            for about 30 seconds. If the feed fails, the cabinet keeps a labeled
            sample card stamped 12 Nov 2026 so the reels still turn.
          </p>
          <p>
            This is spot only. Dealer premium, fabrication, and tax are not in
            the window.
          </p>
          <h3>Working the reels</h3>
          <p>
            Drag or flick a reel. It coasts, slows, and snaps to a stop. The
            lever throws all three. Arrow keys step the focused reel. If the
            system asks for reduced motion, the reels jump straight to the stop
            and the gears stay still.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
