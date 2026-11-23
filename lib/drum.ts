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

export type PointerPullEnd = "release" | "cancel";

/**
 * A finger or mouse button adds a card only when a real drag is released
 * at stage C. A tap, a click, and a scroll cancel add nothing.
 */
export function pointerPullCommits(dragged: boolean, travel: number, end: PointerPullEnd): boolean {
  if (end !== "release" || !dragged) return false;
  return releaseCommitsSpin(travel);
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

/**
 * One stop is the pattern period. At the payline the cylinder moves
 * `paylineSpacing()` symbol heights per stop, which is just over 1
 * (d(sin θ)/d(stop) at the facing angle, θ = 18°). A frame that travels
 * a whole stop looks frozen. Half a stop is the Nyquist point, where the
 * wheel can read as stopped or spinning backward.
 *
 * That half-stop limit is 30 stops/s at 60Hz, 45 at 90Hz, and 60 at 120Hz.
 * The cap is a third of a stop per 60Hz frame (20 stops/s). The same reel
 * then travels 0.222 stops/frame at 90Hz and 0.167 at 120Hz, all safely
 * under half a stop, so the faces keep rolling toward the viewer.
 */
export const REEL_ALIAS_FRACTION = 0.5;
export const REEL_CAP_FRACTION = 1 / 3;
export const REEL_REFERENCE_HZ = 60;
export const REEL_CHECK_HZ = [60, 90, 120] as const;
export const REEL_SPEED_CAP = REEL_CAP_FRACTION * REEL_REFERENCE_HZ;
/** Heavy flywheel. A launch at the cap takes half a second to get there. */
export const REEL_SPINUP_ACCEL = REEL_SPEED_CAP / 0.5;

/** Symbol heights the payline travels per stop, measured on the facing face. */
export function paylineSpacing(): number {
  const radians = (STOP_DEGREES * Math.PI) / 180;
  return radians / Math.sin(radians);
}

/** Stops per second at which one frame covers `fraction` of a stop. */
export function stopsPerSecond(fraction: number, hz: number): number {
  return fraction * hz;
}

export function reelAliasSpeed(hz: number): number {
  return stopsPerSecond(REEL_ALIAS_FRACTION, hz);
}

/** Constant deceleration, stops per second squared. Same brake on every reel and every stop. */
export const BRAKE_PRESETS = { light: 8, medium: 16, heavy: 32 } as const;
export type BrakePreset = keyof typeof BRAKE_PRESETS;
export const COAST_SETTLE_SPEED = 0.5;

let brakePreset: BrakePreset = "light";

export function brakeDecel(preset: BrakePreset = brakePreset): number {
  return BRAKE_PRESETS[preset];
}

export function getBrakePreset(): BrakePreset {
  return brakePreset;
}

export function setBrakePreset(next: BrakePreset): void {
  if (next !== "light" && next !== "medium" && next !== "heavy") return;
  brakePreset = next;
}

/** The integer stop whose half-stop basin contains `position`. */
export function basinIndex(position: number): number {
  return Math.floor(position + 0.5);
}

/**
 * Advance a coast by `dt` seconds under constant deceleration.
 * Gray stops have the same friction as lit ones. Speed never reverses.
 * `isEnabled` is unused; it stays so callers can pass the stop mask.
 */
export function coastAdvance(
  position: number,
  velocity: number,
  dt: number,
  _isEnabled: (index: number) => boolean,
  count: number,
  decel = brakeDecel(),
): { position: number; velocity: number } {
  if (count <= 0 || dt <= 0 || velocity === 0 || decel <= 0) return { position, velocity };
  const sign = Math.sign(velocity);
  const speed = Math.abs(velocity);
  const drop = decel * dt;
  if (drop >= speed) {
    return { position: position + sign * ((0.5 * speed * speed) / decel), velocity: 0 };
  }
  const distance = speed * dt - 0.5 * decel * dt * dt;
  return { position: position + sign * distance, velocity: sign * (speed - drop) };
}

/**
 * Spin up toward `target` at a limited acceleration, then brake.
 * The target is already inside the speed cap. A release does not jump there.
 */
export function flywheelAdvance(
  position: number,
  velocity: number,
  target: number,
  dt: number,
  decel = brakeDecel(),
  accel = REEL_SPINUP_ACCEL,
): { position: number; velocity: number; target: number } {
  if (dt <= 0) return { position, velocity, target };
  const goal = Math.min(REEL_SPEED_CAP, Math.abs(target));
  const sign = target === 0 ? Math.sign(velocity) : Math.sign(target);
  const speed = Math.abs(velocity);
  const winding =
    goal > 0 &&
    sign !== 0 &&
    (velocity === 0 || Math.sign(velocity) === sign) &&
    speed < goal - 1e-9 &&
    accel > 0;
  if (winding) {
    const next = Math.min(goal, speed + accel * dt);
    const distance = ((speed + next) / 2) * dt;
    return {
      position: position + sign * distance,
      velocity: sign * next,
      target: next >= goal ? 0 : sign * goal,
    };
  }
  const braked = coastAdvance(position, velocity, dt, () => true, 1, decel);
  return { position: braked.position, velocity: braked.velocity, target: 0 };
}

/**
 * The next lit stop in the direction of travel.
 * Never rounds backward, never stops on a gray face, never stops halfway.
 */
export function glideSettleNotch(
  position: number,
  velocity: number,
  count: number,
  isEnabled: (index: number) => boolean,
): number {
  if (count <= 0) return 0;
  const direction = velocity < 0 ? -1 : 1;
  const epsilon = 1e-6;
  const nearest = Math.round(position);
  if (Math.abs(position - nearest) <= epsilon && isEnabled(modStop(nearest, count))) return nearest;
  let cursor = direction > 0 ? Math.ceil(position - epsilon) : Math.floor(position + epsilon);
  if (Math.abs(cursor - position) <= epsilon) cursor += direction;
  for (let step = 0; step <= count; step += 1) {
    const candidate = cursor + direction * step;
    if (isEnabled(modStop(candidate, count))) return candidate;
  }
  return cursor;
}

/** Integer stops the wheel moved onto between two positions. */
export function stopsCrossed(previous: number, next: number): number[] {
  if (next === previous) return [];
  const direction = next > previous ? 1 : -1;
  const stops: number[] = [];
  let cursor = direction > 0 ? Math.floor(previous) + 1 : Math.ceil(previous) - 1;
  const last = direction > 0 ? Math.floor(next) : Math.ceil(next);
  while ((direction > 0 ? cursor <= last : cursor >= last) && stops.length < 12) {
    stops.push(cursor);
    cursor += direction;
  }
  return stops;
}

/** Time-weighted average of the last few pointer segments. Endpoints alone twitch. */
export function flingVelocity(
  samples: { t: number; y: number }[],
  itemHeight: number,
  max = REEL_SPEED_CAP,
): number {
  if (samples.length < 2 || itemHeight <= 0) return 0;
  const recent = samples.slice(-5);
  let weighted = 0;
  let time = 0;
  for (let i = 1; i < recent.length; i += 1) {
    const dt = recent[i].t - recent[i - 1].t;
    if (dt < 4 || dt > 80) continue;
    const slots = -((recent[i].y - recent[i - 1].y) / dt) * (1000 / itemHeight);
    weighted += slots * dt;
    time += dt;
  }
  if (time < 12) return 0;
  const speed = weighted / time;
  return Math.min(max, Math.max(-max, speed));
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
