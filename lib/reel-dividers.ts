/**
 * The two brass lines between the reels. The bright gold is #f0d78c,
 * the same color as the old focus ring. Rest is that gold, slightly softer.
 */
export const DIVIDER_COLOR = "#f0d78c";
export const DIVIDER_BRIGHT = 1;
export const DIVIDER_DIM = 0.6;
/** Soft rise while the adjacent reel is moving. */
export const DIVIDER_FADE_IN_MS = 250;
/** Ease-out after that reel stops. */
export const DIVIDER_FADE_OUT_MS = 600;

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

/** Outside edges. The first reel lights the left one, and the last reel lights the right one. */
export function outerDividerLevels(moving: readonly boolean[]): DividerLevels {
  const first = Boolean(moving[0]);
  const last = moving.length > 0 ? Boolean(moving[moving.length - 1]) : false;
  return {
    left: first ? DIVIDER_BRIGHT : DIVIDER_DIM,
    right: last ? DIVIDER_BRIGHT : DIVIDER_DIM,
  };
}
