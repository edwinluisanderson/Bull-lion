/** The metal gauge arc, matching the existing partial dial. 0° is up, clockwise positive. */
export const METAL_DIAL_START_DEG = -120;
export const METAL_DIAL_SWEEP_DEG = 240;

/** One tick per metal, including both ends of the arc. */
export function metalDialTickAngles(count: number): number[] {
  if (count <= 1) return [METAL_DIAL_START_DEG];
  const step = METAL_DIAL_SWEEP_DEG / (count - 1);
  return Array.from({ length: count }, (_, index) => METAL_DIAL_START_DEG + index * step);
}

/** The needle sits on the tick for this metal. */
export function metalDialNeedleAngle(index: number, count: number): number {
  const ticks = metalDialTickAngles(Math.max(1, count));
  const clamped = Math.min(ticks.length - 1, Math.max(0, index));
  return ticks[clamped] ?? METAL_DIAL_START_DEG;
}
