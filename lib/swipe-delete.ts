/** How far a card slides to uncover the delete lever. */
export const SWIPE_REVEAL_PX = 88;
/** Movement below this stays undecided so a vertical scroll can win. */
export const SWIPE_AXIS_SLOP = 8;
/** A hard fling, in CSS pixels per millisecond. */
export const SWIPE_FLING_PX_PER_MS = 0.65;

export type SwipeAxis = "undecided" | "scroll" | "drag";
export type SwipeEnd = "shut" | "open" | "delete";

/** Horizontal intent drags the card. A taller move keeps the page scrolling. */
export function lockSwipeAxis(dx: number, dy: number, slop = SWIPE_AXIS_SLOP): SwipeAxis {
  if (Math.abs(dx) < slop && Math.abs(dy) < slop) return "undecided";
  return Math.abs(dx) > Math.abs(dy) ? "drag" : "scroll";
}

/** Rightward travel only, and never past the end of the track. */
export function clampSwipe(dx: number, reveal = SWIPE_REVEAL_PX): number {
  if (!Number.isFinite(dx)) return 0;
  return Math.min(reveal, Math.max(0, dx));
}

/**
 * Past halfway stays open. A short drag shuts. A hard fling that reaches the
 * end of the track deletes.
 */
export function settleSwipe(offset: number, velocity: number, reveal = SWIPE_REVEAL_PX): SwipeEnd {
  const place = clampSwipe(offset, reveal);
  const flung = velocity >= SWIPE_FLING_PX_PER_MS && place >= reveal * 0.9;
  if (flung) return "delete";
  if (place >= reveal / 2) return "open";
  return "shut";
}

/** The brass detent sits at halfway. Play the click once each time it is crossed. */
export function crossedDetent(previous: number, next: number, reveal = SWIPE_REVEAL_PX): boolean {
  const mid = reveal / 2;
  return (previous < mid && next >= mid) || (previous >= mid && next < mid);
}
