import { WEIGHTS } from "@/lib/metals";
import { sameGrams, weightStretchBetween, weightStretchOrigin } from "@/lib/weight-stretch";

/** Degrees of empty arc at the bottom, between the lightest and heaviest stops. */
export const WEIGHT_DIAL_GAP_DEG = 28;

/** Lightest stop: straight down, just left of center. 0° is up, clockwise positive. */
export const WEIGHT_DIAL_MIN_DEG = 180 + WEIGHT_DIAL_GAP_DEG / 2;

/** Clockwise travel from the lightest stop to the heaviest. */
export const WEIGHT_DIAL_SWEEP_DEG = 360 - WEIGHT_DIAL_GAP_DEG;

/**
 * Needle angle for stop `index` in a dial of `count` stops.
 * Index 0 is the lightest. The last index is the heaviest, just right of center at the bottom.
 */
export function weightDialAngle(index: number, count: number): number {
  if (count <= 1) return WEIGHT_DIAL_MIN_DEG;
  const fraction = Math.min(1, Math.max(0, index / (count - 1)));
  return WEIGHT_DIAL_MIN_DEG + fraction * WEIGHT_DIAL_SWEEP_DEG;
}

function tempsFor(permanent: readonly number[], activeGrams: number): number[] {
  const origin = weightStretchOrigin(permanent, activeGrams);
  const rising = weightStretchBetween(origin.lower, origin.upper, "up");
  if (rising.some((grams) => sameGrams(grams, activeGrams))) return rising;
  const falling = weightStretchBetween(origin.upper, origin.lower, "down");
  if (falling.some((grams) => sameGrams(grams, activeGrams))) return falling;
  return [activeGrams];
}

/**
 * Permanent stops, plus the temporary stops in the active gap while one of them
 * is on the wheel. Sorted lightest to heaviest so the needle can walk clockwise.
 */
export function weightDialValues(permanent: readonly number[], activeGrams: number | null): number[] {
  const extras =
    activeGrams == null || permanent.some((grams) => sameGrams(grams, activeGrams))
      ? []
      : tempsFor(permanent, activeGrams);
  return [...permanent, ...extras].sort((left, right) => left - right);
}

export function weightDialIndex(values: readonly number[], grams: number): number {
  const index = values.findIndex((value) => sameGrams(value, grams));
  return index < 0 ? 0 : index;
}

export function permanentWeightGrams(): number[] {
  return WEIGHTS.map((weight) => weight.grams);
}
