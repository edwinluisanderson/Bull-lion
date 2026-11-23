import {
  BRAKE_PRESETS,
  REEL_SPEED_CAPS,
  type BrakePreset,
  brakeDecel,
} from "@/lib/drum";

/** Nominal gap between reel stops, left to right, on the light brake. */
export const PULL_STAGGER_S = 0.4;
/**
 * Fixed opening speed of the left reel, in stops per second.
 * A pull is a trigger. How fast the lever moved does not change this.
 */
export const PULL_BASE_SPEED = 8;

/**
 * Keep every launch under its cap without flattening the stagger.
 * Equal caps: subtract the fastest reel's overshoot from all three, so that
 * reel sits on the cap and the gaps stay. Different caps: divide by the
 * largest speed/cap ratio, so the tightest reel sits on its cap and the
 * gaps shrink together instead of one reel being clipped.
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

/** Fixed launch speeds, left to right. Negative when read one reel at a time. */
export function pullLaunchSpeeds(decel = brakeDecel(), caps: readonly number[] = REEL_SPEED_CAPS): number[] {
  const ideal = [0, 1, 2].map((order) => PULL_BASE_SPEED + order * decel * PULL_STAGGER_S);
  return fitLaunchSpeeds(ideal, caps);
}

/**
 * Launch speed for one reel. Negative, so the wheel spins toward decreasing position.
 * Every pull of this brake is the same speed. Strength and jitter are not inputs.
 */
export function pullLaunchVelocity(input: { order: number; decel?: number; caps?: readonly number[] }): number {
  const order = Math.min(2, Math.max(0, Math.floor(input.order)));
  const decel = input.decel && input.decel > 0 ? input.decel : brakeDecel();
  const speeds = pullLaunchSpeeds(decel, input.caps ?? REEL_SPEED_CAPS);
  return -speeds[order];
}

/** Seconds until this launch speed has braked to zero, before the short settle. */
export function pullStopSeconds(speed: number, decel: number): number {
  if (decel <= 0) return 0;
  return Math.abs(speed) / decel;
}

/** Nominal stop time for a reel on the light brake, unless a preset is named. */
export function stillAtMs(order: number, preset: BrakePreset = "light"): number {
  const decel = BRAKE_PRESETS[preset];
  const speed = pullLaunchVelocity({ order, decel });
  return Math.round(pullStopSeconds(speed, decel) * 1000);
}
