import { WEIGHTS } from "@/lib/metals";
import { sameGrams } from "@/lib/weight-stretch";

/** Degrees of empty arc at the bottom, between the lightest and heaviest stops. */
export const WEIGHT_DIAL_GAP_DEG = 28;

/** Lightest stop: straight down, just left of center. 0° is up, clockwise positive. */
export const WEIGHT_DIAL_MIN_DEG = 180 + WEIGHT_DIAL_GAP_DEG / 2;

/** Clockwise travel from the lightest stop to the heaviest. */
export const WEIGHT_DIAL_SWEEP_DEG = 360 - WEIGHT_DIAL_GAP_DEG;

/** Painted marks only. The needle still uses every permanent stop. */
export const WEIGHT_DIAL_TICK_COUNT = 7;

/** Seven marks from the lightest end of the arc to the heaviest. */
export function weightDialTickAngles(count = WEIGHT_DIAL_TICK_COUNT): number[] {
  return Array.from({ length: count }, (_, index) => weightDialAngle(index, count));
}

/**
 * Needle angle for stop `index` in a dial of `count` stops.
 * Index 0 is the lightest. The last index is the heaviest, just right of center at the bottom.
 */
export function weightDialAngle(index: number, count: number): number {
  if (count <= 1) return WEIGHT_DIAL_MIN_DEG;
  const fraction = Math.min(1, Math.max(0, index / (count - 1)));
  return WEIGHT_DIAL_MIN_DEG + fraction * WEIGHT_DIAL_SWEEP_DEG;
}

/** The dial scale is only the permanent stops, lightest to heaviest. */
export function weightDialValues(permanent: readonly number[]): number[] {
  return [...permanent].sort((left, right) => left - right);
}

/**
 * Stop the needle uses for this many grams.
 * An exact permanent stop stays there. A temporary weight uses the nearest
 * permanent stop by absolute grams. An equal distance keeps the heavier stop.
 */
export function nearestPermanentIndex(values: readonly number[], grams: number): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  values.forEach((value, index) => {
    const distance = Math.abs(value - grams);
    const heavierTie = distance === bestDistance && value > (values[best] ?? 0);
    if (distance < bestDistance || heavierTie) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

export function weightDialIndex(values: readonly number[], grams: number): number {
  const exact = values.findIndex((value) => sameGrams(value, grams));
  return exact >= 0 ? exact : nearestPermanentIndex(values, grams);
}

export function permanentWeightGrams(): number[] {
  return WEIGHTS.map((weight) => weight.grams);
}
