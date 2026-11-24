import { grayGlidePlan, REEL_SPEED_CAP, REEL_SPEED_CAPS } from "@/lib/drum";

/** Time between reel stops, left to right, on the light brake. */
export const PULL_STAGGER_S = 0.4;
/**
 * Full-speed coast after a lever pull, before the brake. The same on every reel.
 */
export const PULL_FREE_SPIN_S = 1.5;
/**
 * Total time from launch to stop, left to right.
 * The brake is whatever is left after {@link PULL_FREE_SPIN_S}: 1.0, 1.4, and 1.8s.
 */
export const PULL_LIGHT_STOP_S = [2.5, 2.9, 3.3] as const;

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

/** Seconds of braking after the free spin. Derived so the total stop time is unchanged. */
export function pullBrakeSeconds(order: number): number {
  return Math.max(0, pullStopSeconds(order) - PULL_FREE_SPIN_S);
}

/**
 * Pull brake, stops per second squared.
 * Cap divided by the brake time: 20, 20/1.4, and 20/1.8 on the light schedule.
 */
export function pullDecel(order: number): number {
  const brake = pullBrakeSeconds(order);
  if (!(brake > 0)) return REEL_SPEED_CAP;
  return REEL_SPEED_CAP / brake;
}

/** True while a pull is still in its free spin. Decel is zero until this ends. */
export function pullFreeSpinning(elapsedS: number): boolean {
  return elapsedS < PULL_FREE_SPIN_S;
}

export type PullSample = { position: number; velocity: number };

/**
 * Where a pull is after `elapsedS` seconds of wall-clock time.
 * Free spin at the cap, then the constant brake. Frame spacing does not change it.
 */
export function pullPose(origin: number, order: number, elapsedS: number): PullSample {
  const speed = Math.abs(pullLaunchVelocity({ order }));
  const direction = -1;
  const elapsed = Math.max(0, elapsedS);
  const free = PULL_FREE_SPIN_S;
  const decel = pullDecel(order);
  const coasted = speed * Math.min(elapsed, free);
  if (elapsed <= free || !(decel > 0)) {
    return { position: origin + direction * coasted, velocity: direction * speed };
  }
  const brakeSpan = pullBrakeSeconds(order);
  const brakeT = Math.min(elapsed - free, brakeSpan);
  const done = brakeT >= brakeSpan - 1e-12;
  const traveled = done ? (speed * speed) / (2 * decel) : speed * brakeT - 0.5 * decel * brakeT * brakeT;
  const remaining = done ? 0 : speed - decel * brakeT;
  return {
    position: origin + direction * (coasted + traveled),
    velocity: direction * remaining,
  };
}

/** Constant brake from a known handoff, measured in wall-clock seconds. */
export function brakePose(
  handoff: PullSample,
  decel: number,
  brakeS: number,
): PullSample {
  const speed = Math.abs(handoff.velocity);
  const direction = Math.sign(handoff.velocity) || -1;
  const t = Math.max(0, brakeS);
  if (!(speed > 0)) return { position: handoff.position, velocity: 0 };
  if (!(decel > 0)) return { position: handoff.position + direction * speed * t, velocity: handoff.velocity };
  const span = speed / decel;
  if (t >= span) {
    return { position: handoff.position + direction * ((speed * speed) / (2 * decel)), velocity: 0 };
  }
  return {
    position: handoff.position + direction * (speed * t - 0.5 * decel * t * t),
    velocity: direction * (speed - decel * t),
  };
}

export type PullFrame = PullSample & {
  locked: number | null;
  /** True only at the scheduled stop. The snap has finished and the reel is at rest. */
  resting: boolean;
};

/**
 * One displayed sample of a lever pull, including the landing snap.
 * Position and velocity are the closed form at `elapsedS`. A 25ms frame or a
 * 200ms hitch jumps to that pose. The reel is at rest at {@link pullStopSeconds},
 * not when the brake merely drops under the coast threshold.
 * A gray landing retargets once from the free-spin handoff, then eases onto
 * that face so the rest still falls on the scheduled stop.
 */
export function pullFrame(input: {
  origin: number;
  order: number;
  elapsedS: number;
  count: number;
  isEnabled: (index: number) => boolean;
  locked: number | null;
}): PullFrame {
  const { origin, order, elapsedS, count, isEnabled } = input;
  const stop = pullStopSeconds(order);
  if (pullFreeSpinning(elapsedS)) {
    return { ...pullPose(origin, order, elapsedS), locked: null, resting: false };
  }
  const handoff = pullPose(origin, order, PULL_FREE_SPIN_S);
  const decel = pullDecel(order);
  const glide = grayGlidePlan({
    position: handoff.position,
    velocity: handoff.velocity,
    decel,
    count,
    isEnabled,
    locked: input.locked,
  });
  const locked = glide.fallback ? null : glide.target;
  const natural = pullPose(origin, order, stop);
  const notch = locked ?? Math.round(natural.position);
  if (elapsedS >= stop) return { position: notch, velocity: 0, locked, resting: true };
  if (locked === null) return { ...pullPose(origin, order, elapsedS), locked: null, resting: false };
  const span = Math.abs(handoff.velocity) / Math.max(glide.decel, 1e-6);
  const finish = PULL_FREE_SPIN_S + span;
  const brakeT = elapsedS - PULL_FREE_SPIN_S;
  if (elapsedS <= finish) return { ...brakePose(handoff, glide.decel, brakeT), locked, resting: false };
  const aim = brakePose(handoff, glide.decel, span).position;
  const remain = Math.max(1e-4, stop - finish);
  const u = Math.min(1, Math.max(0, (elapsedS - finish) / remain));
  const direction = Math.sign(handoff.velocity) || -1;
  return {
    position: aim + (notch - aim) * u,
    velocity: direction * (Math.abs(notch - aim) / remain) * (1 - u),
    locked,
    resting: false,
  };
}

/** Nominal stop time for a reel on the light brake. */
export function stillAtMs(order: number): number {
  return Math.round(pullStopSeconds(order) * 1000);
}
