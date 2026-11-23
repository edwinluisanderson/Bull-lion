/**
 * The two brass lines between the reels.
 * Bright is the seam as it renders while a reel is moving: #c6a15a at 0.35.
 * Rest sits just under that, still clearly on.
 */
export const DIVIDER_BRIGHT = 0.35;
export const DIVIDER_DIM = 0.32;

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
