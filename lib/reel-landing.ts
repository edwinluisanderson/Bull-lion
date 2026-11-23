import { hapticClick } from "@/lib/haptics";
import { playReelClick } from "@/lib/reel-click";

/** A release slower than this coasts. At or above it, the flick owes a landing. */
export const FLICK_COAST_SPEED = 0.4;

export type LandingWatch = {
  /** A handle pull or a flick has not landed yet. */
  owed: boolean;
  /** The landing tick and knock already played for this motion. */
  played: boolean;
};

export function clearLandingWatch(): LandingWatch {
  return { owed: false, played: false };
}

export function armLandingWatch(): LandingWatch {
  return { owed: true, played: false };
}

/**
 * A flick owes a landing when it coasts, or when a short release actually
 * moves onto another stop. A release that is already sitting on its stop does not.
 */
export function flickOwesLanding(input: {
  speed: number;
  position: number;
  notch: number;
  committed: number;
  count: number;
}): boolean {
  if (Math.abs(input.speed) >= FLICK_COAST_SPEED) return true;
  const count = input.count;
  if (count <= 0) return Math.abs(input.position - input.notch) > 0.0001;
  const wrap = (value: number) => ((value % count) + count) % count;
  if (wrap(Math.round(input.notch)) !== wrap(input.committed)) return true;
  return Math.abs(input.position - input.notch) > 0.0001;
}

/**
 * A newly committed stop. The landing click plays here only when this commit
 * is the cam's final notch. A notch already committed during the coast is not
 * a new commit, so it cannot land here.
 */
export function commitReelStop(
  watch: LandingWatch,
  landingNotch: boolean,
): { watch: LandingWatch; playLanding: boolean } {
  if (!watch.owed || watch.played || !landingNotch) return { watch, playLanding: false };
  return { watch: { owed: false, played: true }, playLanding: true };
}

/**
 * The reel has reached idle. Plays the landing once when the coast, or a
 * guest-run return inside setPos, already consumed the final notch.
 */
export function settleReelLanding(watch: LandingWatch): { watch: LandingWatch; playLanding: boolean } {
  if (!watch.owed || watch.played) return { watch, playLanding: false };
  return { watch: { owed: false, played: true }, playLanding: true };
}

/** Landing pawl plus knock. Dry, and outside the tick cap and the 40ms gap. */
export function playSettledLanding(): void {
  hapticClick(true);
  playReelClick(false, false, true, true);
}
