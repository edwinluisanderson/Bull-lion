import { BRAKE_PRESETS, type BrakePreset, brakeDecel } from "@/lib/drum";

/** Nominal gap between reel stops, left to right. */
export const PULL_STAGGER_S = 0.4;
/** Opening speed of the left reel, in stops per second, before strength and jitter. */
export const PULL_BASE_SPEED = 20;
/** Each reel's launch speed wanders by this fraction. */
export const PULL_JITTER = 0.15;
/** A committed drag is at least this far; a full keyboard pull is 1. */
export const PULL_MIN_STRENGTH = 0.85;

let pullStrength = 1;

export function notePullStrength(travel: number): void {
  if (!Number.isFinite(travel)) {
    pullStrength = 1;
    return;
  }
  pullStrength = Math.min(1, Math.max(PULL_MIN_STRENGTH, travel));
}

export function currentPullStrength(): number {
  return pullStrength;
}

/**
 * Launch speed for one reel. Negative, so the wheel spins toward decreasing position.
 * Later reels are faster by `decel * PULL_STAGGER_S`, which is `PULL_STAGGER_S` seconds
 * of extra coast on this brake. `random` is 0..1; 0.5 is no jitter.
 */
export function pullLaunchVelocity(input: {
  order: number;
  decel?: number;
  strength?: number;
  random?: number;
}): number {
  const order = Math.min(2, Math.max(0, Math.floor(input.order)));
  const decel = input.decel && input.decel > 0 ? input.decel : brakeDecel();
  const strength = Math.min(1, Math.max(PULL_MIN_STRENGTH, input.strength ?? currentPullStrength()));
  const unit = input.random == null ? 0 : Math.min(1, Math.max(0, input.random)) * 2 - 1;
  const jitter = 1 + unit * PULL_JITTER;
  const speed = PULL_BASE_SPEED * (strength / PULL_MIN_STRENGTH) * jitter + order * decel * PULL_STAGGER_S;
  return -Math.abs(speed);
}

/** Seconds until this launch speed has braked to zero, before the short settle. */
export function pullStopSeconds(speed: number, decel: number): number {
  if (decel <= 0) return 0;
  return Math.abs(speed) / decel;
}

/** Nominal stop time for a reel, no jitter, full-strength pull, on the active brake. */
export function stillAtMs(order: number, preset: BrakePreset = "medium"): number {
  const decel = BRAKE_PRESETS[preset];
  const speed = pullLaunchVelocity({ order, decel, strength: 1, random: 0.5 });
  return Math.round(pullStopSeconds(speed, decel) * 1000);
}
