/**
 * The two brass lines between the reels. The bright gold is #f0d78c,
 * the same color as the old focus ring. Rest is that gold, slightly softer.
 */
export const DIVIDER_COLOR = "#f0d78c";
export const DIVIDER_BRIGHT = 1;
export const DIVIDER_DIM = 0.6;

export type DividerLevels = { left: number; right: number };

/** Left reel lights the left line, right reel the right line, and the middle reel lights both. */
export function dividerLevels(moving: readonly boolean[]): DividerLevels {
  const left = Boolean(moving[0]);
  const middle = Boolean(moving[1]);
  const right = Boolean(moving[2]);
  return {
    left: left || middle ? DIVIDER_BRIGHT : DIVIDER_DIM,
    right: middle || right ? DIVIDER_BRIGHT : DIVIDER_DIM,
  };
}
