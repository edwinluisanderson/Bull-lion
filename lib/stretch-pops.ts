/** Fractions of a row at which a stretching count pops. */
export const STRETCH_POP_FRACTIONS = [0.25, 0.5, 0.75, 1] as const;

/**
 * How many stretch pops are due for the current pull.
 * Each in-between count gets a pop at a quarter, half, three-quarters, and full lock.
 * Travel is pixels. An empty gap (adjacent stops) pops nothing.
 */
export function stretchPopCount(travel: number, itemHeight: number, sequenceLength: number): number {
  if (!(itemHeight > 0) || sequenceLength <= 0 || !(travel > 0)) return 0;
  let count = 0;
  for (let index = 0; index < sequenceLength; index += 1) {
    for (const fraction of STRETCH_POP_FRACTIONS) {
      if (travel < (index + fraction) * itemHeight) return count;
      count += 1;
    }
  }
  return count;
}

/** Pick a pop index, never the same one twice in a row when there is a choice. */
export function pickStretchPop(count: number, previous: number | null, random: () => number = Math.random): number {
  if (count <= 1) return 0;
  const avoid = previous !== null && previous >= 0 && previous < count;
  const span = avoid ? count - 1 : count;
  const roll = Math.floor(random() * span);
  if (!avoid) return Math.min(count - 1, Math.max(0, roll));
  return roll >= (previous as number) ? roll + 1 : roll;
}
