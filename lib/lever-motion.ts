/**
 * Jackpot lever geometry and timing.
 *
 * The arm pivots on a hub at the reel midline. The ball travels from its rest spot
 * down to the bottom of the window frame (the existing throw), so the arm's
 * projected length is `gap - drop`: upright at rest, pointing at the viewer at the
 * midline, hanging down past it. The arm is drawn at its rest length and scaled.
 */

/** Pull animation for a tap or Enter. Unchanged from the ball-and-bar lever. */
export const LEVER_PULL_MS = 420;
/** Pause at the bottom so the clunk reads before the return. */
export const LEVER_CLUNK_HOLD_MS = 90;
/** Return to rest, including the single overshoot bounce. */
export const LEVER_RETURN_MS = 520;
/** Overshoot above rest, as a fraction of the throw (about 8px on a 272px throw). */
export const LEVER_OVERSHOOT = 0.03;
/** Ratchet teeth across stage A (0 to 75% travel). */
export const LEVER_TEETH = 8;
/** Travel at which the arm hits the stop and clunks. */
export const LEVER_CLUNK_AT = 0.985;
/** Drum radius used to scroll the ribs with the arm angle. */
export const DRUM_RIB_RADIUS_PX = 18;
/** How far the ball rolls forward at the bottom. 80 degrees leaves a sliver of PULL at the lower edge. */
export const ROLL_MAX_DEG = 80;
/** Sphere radius in the 100-unit legend viewBox (22.1px on the 48px ball). */
export const ROLL_RADIUS = 46;

/** Return progress left, 1 at release to 0 at rest. Dips to -LEVER_OVERSHOOT once. */
export function leverReturnCurve(t: number): number {
  if (t <= 0) return 1;
  if (t >= 1) return 0;
  if (t < 0.6) {
    const u = t / 0.6;
    return 1 - (1 + LEVER_OVERSHOOT) * (1 - (1 - u) ** 3);
  }
  const u = (t - 0.6) / 0.4;
  const eased = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
  return -LEVER_OVERSHOOT * (1 - eased);
}

/** Arm projection and drum rib scroll for a ball drop of `drop` px. */
export function armPose(gap: number, drop: number): { scaleY: number; ribShift: number; toward: number } {
  const g = Math.max(1, gap);
  const scaleY = (g - drop) / g;
  const toward = Math.sqrt(Math.max(0, 1 - Math.min(1, scaleY * scaleY)));
  return { scaleY, ribShift: (drop / g) * (Math.PI / 2) * DRUM_RIB_RADIUS_PX, toward };
}

/**
 * The ball rolls with the pull; the lighting does not. Only the legend moves.
 * phi = ROLL_MAX_DEG * progress. Orthographic sphere, legend on the equator.
 */
export function legendRoll(progress: number): { phi: number; shift: number; scaleY: number; opacity: number } {
  const phi = ((ROLL_MAX_DEG * Math.PI) / 180) * progress;
  const c = Math.cos(phi);
  return { phi, shift: ROLL_RADIUS * Math.sin(phi), scaleY: c, opacity: 0.5 + 0.5 * c };
}

/** Ratchet tooth reached at `travel`. Teeth stop at the end of stage A. */
export function ratchetTooth(travel: number): number {
  return Math.floor(Math.min(Math.max(travel, 0), 0.74) * (LEVER_TEETH / 0.75));
}
