/**
 * Upper half-circle shared by the Metal and Stack gauges.
 * 0° is up and clockwise is positive, so the arc runs from the left end to the right end.
 */
export const METAL_DIAL_START_DEG = -90;
export const METAL_DIAL_SWEEP_DEG = 180;

/** Fraction of the half-circle, clamped so the needle stays on the arc ends. */
export function halfCircleNeedleAngle(fraction: number): number {
  const clamped = Math.min(1, Math.max(0, fraction));
  return METAL_DIAL_START_DEG + clamped * METAL_DIAL_SWEEP_DEG;
}

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
