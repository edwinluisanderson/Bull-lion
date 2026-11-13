import { WEIGHTS, type WeightSpec } from "@/lib/metals";
import { meltValue } from "@/lib/value";

/** True when this size, at the given piece count, rounds to at least $1. */
export function weightShowsDollars(
  usdPerTroyOz: number,
  grams: number,
  pieces = 1,
): boolean {
  if (!Number.isFinite(usdPerTroyOz) || usdPerTroyOz <= 0) return false;
  if (!Number.isFinite(pieces) || pieces <= 0) return false;
  return Math.round(meltValue(usdPerTroyOz, grams, pieces)) >= 1;
}

/**
 * Closest affordable stop by grams. Ties keep the heavier stop.
 * If every stop rounds to $0, the current index stays.
 */
export function nearestAffordableWeightIndex(
  weights: readonly WeightSpec[],
  currentIndex: number,
  usdPerTroyOz: number,
  pieces = 1,
): number {
  const current = weights[currentIndex] ?? weights[0];
  if (!current) return 0;
  if (weightShowsDollars(usdPerTroyOz, current.grams, pieces)) return currentIndex;

  let best = currentIndex;
  let bestDistance = Number.POSITIVE_INFINITY;
  weights.forEach((weight, index) => {
    if (!weightShowsDollars(usdPerTroyOz, weight.grams, pieces)) return;
    const distance = Math.abs(weight.grams - current.grams);
    const heavierTie = distance === bestDistance && weight.grams > (weights[best]?.grams ?? 0);
    if (distance < bestDistance || heavierTie) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

export function affordableWeightIds(usdPerTroyOz: number, pieces = 1): string[] {
  return WEIGHTS.filter((weight) => weightShowsDollars(usdPerTroyOz, weight.grams, pieces)).map(
    (weight) => weight.id,
  );
}
