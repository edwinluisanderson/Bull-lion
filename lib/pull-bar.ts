/** Solid round shaft, a third of the ball diameter. */
export const PULL_BAR_WIDTH_RATIO = 0.33;

/** Same ink as the plate titles and the other dark writing. */
export const PULL_BALL_INK = "#3a2710";

export type PullBarSpan = {
  /** Pixels between the ball center and the wheel midline. */
  length: number;
  /** The free end. Down while the ball is above the midline. */
  end: "down" | "up" | "none";
};

/**
 * The bar is the segment from the ball's center to the wheel midline.
 * `midlineGap` is how far the midline sits below the ball's rest center.
 * `drop` is how far the ball center has moved down from rest.
 */
export function pullBarSpan(midlineGap: number, drop: number): PullBarSpan {
  const gap = midlineGap - drop;
  if (Math.abs(gap) < 0.5) return { length: 0, end: "none" };
  return { length: Math.abs(gap), end: gap > 0 ? "down" : "up" };
}
