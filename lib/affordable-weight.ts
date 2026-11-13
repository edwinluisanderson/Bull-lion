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

/**
 * Piece-count stop to show for this weight.
 * Prefers the smallest enabled count at or above the current one, otherwise the nearest.
 * If no count reaches $1, the highest count is the fallback.
 */
export function nearestAffordableCountIndex(
  counts: readonly number[],
  currentIndex: number,
  grams: number,
  usdPerTroyOz: number,
): number {
  if (counts.length === 0) return 0;
  const current = counts[currentIndex] ?? counts[0];
  const enabled = counts
    .map((pieces, index) => ({ pieces, index }))
    .filter((entry) => weightShowsDollars(usdPerTroyOz, grams, entry.pieces));
  if (enabled.length === 0) return counts.length - 1;
  if (counts[currentIndex] !== undefined && weightShowsDollars(usdPerTroyOz, grams, counts[currentIndex])) {
    return currentIndex;
  }
  const atOrAbove = enabled.filter((entry) => entry.pieces >= current);
  if (atOrAbove.length > 0) {
    return atOrAbove.reduce((best, entry) => (entry.pieces < best.pieces ? entry : best)).index;
  }
  return enabled.reduce((best, entry) => {
    const distance = Math.abs(entry.pieces - current);
    const bestDistance = Math.abs(best.pieces - current);
    if (distance < bestDistance || (distance === bestDistance && entry.pieces > best.pieces)) return entry;
    return best;
  }).index;
}

export function affordableWeightIds(usdPerTroyOz: number, pieces = 1): string[] {
  return WEIGHTS.filter((weight) => weightShowsDollars(usdPerTroyOz, weight.grams, pieces)).map(
    (weight) => weight.id,
  );
}
