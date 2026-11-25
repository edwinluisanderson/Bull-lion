/**
 * How far a card slides to uncover the delete lever.
 * This is the caution-stripe width. The board's left edge starts at the
 * same inset as the stripes, so the swipe stops on their right edge.
 */
export const SWIPE_REVEAL_PX = 76;
/** Movement below this stays undecided so a vertical scroll can win. */
export const SWIPE_AXIS_SLOP = 8;
/** Ignore a lever click that is really the pointerup ending a drag. */
export const LEVER_TAP_GUARD_MS = 400;

export type SwipeAxis = "undecided" | "scroll" | "drag";
export type SwipeEnd = "shut" | "open";

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
 * Past halfway stays open. Anything shorter snaps shut.
 * Speed never deletes; the lever is the only swipe control that removes a card.
 */
export function settleSwipe(offset: number, reveal = SWIPE_REVEAL_PX): SwipeEnd {
  if (clampSwipe(offset, reveal) >= reveal / 2) return "open";
  return "shut";
}

/** A later tap on the lever deletes. The pointerup that ends the drag does not. */
export function leverTapDeletes(msSinceDragEnd: number, guard = LEVER_TAP_GUARD_MS): boolean {
  return msSinceDragEnd >= guard;
}

/** The brass detent sits at halfway. Play the click once each time it is crossed. */
export function crossedDetent(previous: number, next: number, reveal = SWIPE_REVEAL_PX): boolean {
  const mid = reveal / 2;
  return (previous < mid && next >= mid) || (previous >= mid && next < mid);
}
