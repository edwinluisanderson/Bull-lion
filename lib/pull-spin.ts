/**
 * A handle pull is 3 s of steady free spin, then the old brake.
 * Free-spin speed is about 40 stops/s. The old ease opened near 80, 250,
 * and 130 stops/s, and holding the weight wheel's opening speed for 3 s
 * would skip several faces every frame. Forty stops/s still streams, at
 * about two-thirds of a face per frame. Loop counts are what make that
 * speed land on the chosen stop: the brake's opening slope is 4 times
 * its distance over its duration, so the distance left at 3 s is
 * speed * brake / 4.
 */
export const PULL_ICE_MS = 3000;
export const PULL_ICE_S = PULL_ICE_MS / 1000;
export const PULL_BRAKE_MS = [880, 1140, 1400] as const;
export const PULL_LOOPS = [25, 8, 16] as const;
export const PULL_SETTLE_MS = 160;
export const PULL_OVERSHOOT = 0.07;

export type PullPlan = {
  reduced: boolean;
  notch: number;
  past: number;
  iceMs: number;
  brakeMs: number;
  /** Positive stops per second, toward decreasing position. */
  speed: number;
  start: number;
  handoff: number;
  /** Negative stops per second. */
  velocity: number;
};

function mod(value: number, count: number): number {
  return ((value % count) + count) % count;
}

/** Where a handle pull goes, and how fast the free spin has to be to arrive there. */
export function pullPlan(input: {
  order: number;
  count: number;
  position: number;
  landIndex: number;
  reduced: boolean;
}): PullPlan {
  const start = input.position;
  const count = input.count;
  const order = Math.min(2, Math.max(0, input.order));
  let down = (mod(Math.round(start), count) - input.landIndex + count) % count;
  if (down === 0) down = count;
  const loops = input.reduced ? 0 : PULL_LOOPS[order];
  const notch = Math.round(start) - loops * count - down;
  if (input.reduced) {
    return {
      reduced: true,
      notch,
      past: notch,
      iceMs: 0,
      brakeMs: 0,
      speed: 0,
      start,
      handoff: notch,
      velocity: 0,
    };
  }
  const past = notch - PULL_OVERSHOOT;
  const travel = start - past;
  const brakeS = PULL_BRAKE_MS[order] / 1000;
  const speed = travel / (PULL_ICE_S + brakeS / 4);
  const handoff = start - speed * PULL_ICE_S;
  return {
    reduced: false,
    notch,
    past,
    iceMs: PULL_ICE_MS,
    brakeMs: PULL_BRAKE_MS[order],
    speed,
    start,
    handoff,
    velocity: -speed,
  };
}

/** Opening slope of the quartic brake, in stops per second. */
export function brakeVelocityAt(plan: PullPlan, progress: number): number {
  const durationS = plan.brakeMs / 1000;
  return ((plan.past - plan.handoff) * 4 * (1 - progress) ** 3) / durationS;
}

export function stillAtMs(order: number): number {
  const index = Math.min(2, Math.max(0, order));
  return PULL_ICE_MS + PULL_BRAKE_MS[index] + PULL_SETTLE_MS;
}
