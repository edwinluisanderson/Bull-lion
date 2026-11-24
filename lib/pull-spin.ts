import { REEL_SPEED_CAP, REEL_SPEED_CAPS } from "@/lib/drum";

/** Time between reel stops, left to right, on the light brake. */
export const PULL_STAGGER_S = 0.4;
/**
 * How long each reel takes to brake from the cap on the light preset.
 * Deceleration is the cap divided by these times: 10, 8.33, and 7.14 stops/s².
 */
export const PULL_LIGHT_STOP_S = [2, 2.4, 2.8] as const;

/**
 * Keep a set of launch speeds under their caps without clipping one reel flat.
 * Equal caps: subtract the fastest reel's overshoot from all three.
 * Different caps: divide by the largest speed/cap ratio.
 */
export function fitLaunchSpeeds(speeds: readonly number[], caps: readonly number[]): number[] {
  const values = speeds.map((speed) => Math.abs(speed));
  const limits = caps.map((cap) => Math.abs(cap));
  const equal = limits.every((cap) => Math.abs(cap - limits[0]) < 1e-9);
  if (equal) {
    let fastest = 0;
    for (let index = 1; index < values.length; index += 1) {
      if (values[index] > values[fastest]) fastest = index;
    }
    const overshoot = values[fastest] - limits[fastest];
    if (overshoot <= 0) return values;
    const shifted = values.map((speed) => speed - overshoot);
    if (shifted.every((speed, index) => speed > 0 && speed <= limits[index] + 1e-9)) return shifted;
  }
  const ratio = Math.max(1, ...values.map((speed, index) => speed / limits[index]));
  return values.map((speed) => speed / ratio);
}

/** Every reel leaves a pull at the cap. The stagger is in the brakes, not here. */
export function pullLaunchSpeeds(caps: readonly number[] = REEL_SPEED_CAPS): number[] {
  return fitLaunchSpeeds([REEL_SPEED_CAP, REEL_SPEED_CAP, REEL_SPEED_CAP], caps);
}

/** Negative, so the wheel spins toward decreasing position. The same for every reel. */
export function pullLaunchVelocity(input?: { order?: number; caps?: readonly number[] }): number {
  const order = Math.min(2, Math.max(0, Math.floor(input?.order ?? 0)));
  const speeds = pullLaunchSpeeds(input?.caps ?? REEL_SPEED_CAPS);
  return -speeds[order];
}

/** Stop time for this reel. Locked to the light brake. */
export function pullStopSeconds(order: number): number {
  const index = Math.min(2, Math.max(0, Math.floor(order)));
  return PULL_LIGHT_STOP_S[index];
}

/** This reel's pull brake. The left reel is the strongest so it stops first. */
export function pullDecel(order: number): number {
  return REEL_SPEED_CAP / pullStopSeconds(order);
}

/** Nominal stop time for a reel on the light brake. */
export function stillAtMs(order: number): number {
  return Math.round(pullStopSeconds(order) * 1000);
}
