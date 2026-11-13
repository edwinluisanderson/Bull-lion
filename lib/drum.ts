/** Mechanical drum: 20 stops, 18 degrees each, on one shared shaft. */

export const CYLINDER_STOPS = 20;
export const STOP_DEGREES = 360 / CYLINDER_STOPS;

export const STAGE_A_END = 0.75;
export const STAGE_B_END = 0.85;

export type PullStage = "a" | "b" | "c";

export function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** 0–75% locked, 75–85% kicker, 85%+ free spin. */
export function pullStage(travel: number): PullStage {
  const t = clamp01(travel);
  if (t < STAGE_A_END) return "a";
  if (t < STAGE_B_END) return "b";
  return "c";
}

export function releaseCommitsSpin(travel: number): boolean {
  return pullStage(travel) === "c";
}

/**
 * A parent correction (copper count fallback) is a new token.
 * A flick that only changes the selected index must not jump the reel again.
 */
export function shouldApplyGuard(token: number, applied: number): boolean {
  return token > 0 && token !== applied;
}

/** Rounded stop while a reel is moving. Disabled stops return null so the reel keeps traveling. */
export function commitIndex(
  position: number,
  count: number,
  isEnabled: (index: number) => boolean,
): number | null {
  if (count <= 0) return null;
  const index = modStop(Math.round(position), count);
  return isEnabled(index) ? index : null;
}

/**
 * Stage A: at most a fraction of a degree of strain, not a stop of rotation.
 * Stage B: 2–5 degrees backward (negative). Stage C is the free spin, so the bend is 0.
 */
export function stageBendDegrees(travel: number): number {
  const t = clamp01(travel);
  if (t < STAGE_A_END) return t * 0.45;
  if (t < STAGE_B_END) {
    const across = (t - STAGE_A_END) / (STAGE_B_END - STAGE_A_END);
    return -(2 + across * 3);
  }
  return 0;
}

export function modStop(value: number, count: number): number {
  if (count <= 0) return 0;
  return ((value % count) + count) % count;
}

/** Nearest enabled integer stop. Ties keep the stop closer to `position`. */
export function nearestEnabledNotch(
  position: number,
  count: number,
  isEnabled: (index: number) => boolean,
): number {
  if (count <= 0) return 0;
  const enabled = (index: number) => isEnabled(modStop(index, count));
  const rounded = Math.round(position);
  if (enabled(rounded)) return rounded;
  for (let delta = 1; delta < count; delta += 1) {
    const ahead = rounded + delta;
    const behind = rounded - delta;
    const aheadOk = enabled(ahead);
    const behindOk = enabled(behind);
    if (aheadOk && behindOk) {
      return Math.abs(ahead - position) <= Math.abs(position - behind) ? ahead : behind;
    }
    if (aheadOk) return ahead;
    if (behindOk) return behind;
  }
  return rounded;
}

/**
 * Point just past the notch in the direction of travel, before the drum
 * eases back to the stop center.
 */
export function camPastNotch(position: number, notch: number, overshoot = 0.07): number {
  if (position === notch) return notch;
  const direction = Math.sign(notch - position) || 1;
  return notch + direction * overshoot;
}

const RADIUS_PER_HEIGHT = 1 / Math.sin((STOP_DEGREES * Math.PI) / 180);

export function cylinderPose(offsetStops: number): {
  scaleY: number;
  brightness: number;
  /** Symbol-heights from the payline. Edges are closer together than a flat strip. */
  shift: number;
} {
  const theta = offsetStops * STOP_DEGREES * (Math.PI / 180);
  const facing = Math.max(0, Math.cos(theta));
  return {
    scaleY: Math.max(0.5, facing ** 1.15),
    brightness: 0.2 + 0.8 * facing ** 1.35,
    shift: Math.sin(theta) * RADIUS_PER_HEIGHT,
  };
}
