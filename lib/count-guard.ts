import { nearestAffordableCountIndex, weightShowsDollars } from "@/lib/affordable-weight";
import { valueAfterRelease } from "@/lib/stretch";

/** A handle pull is in progress, so the copper count check has to wait. */
export type CountGuardHold = {
  holding: boolean;
  /** At least one reel has moved since the pull, so the next all-idle is the landing. */
  armed: boolean;
};

export const IDLE_COUNT_GUARD: CountGuardHold = { holding: false, armed: false };

export type CopperCountAdjustment = {
  countIndex: number;
  customPieces: number | null;
  /** True when the count reel should jump to the adjusted stop. */
  guard: boolean;
};

/** Start holding. A re-pull keeps the armed bit if the wheels are already moving. */
export function holdForPull(current: CountGuardHold): CountGuardHold {
  return { holding: true, armed: current.armed };
}

/**
 * Fold the latest motion flags into the hold.
 * `released` is the single moment all three wheels have landed.
 */
export function holdAfterMotion(
  hold: CountGuardHold,
  motion: readonly boolean[],
): { hold: CountGuardHold; released: boolean } {
  if (!hold.holding) return { hold, released: false };
  if (motion.some(Boolean)) return { hold: { holding: true, armed: true }, released: false };
  if (!hold.armed) return { hold, released: false };
  return { hold: IDLE_COUNT_GUARD, released: true };
}

/**
 * The pull has been handed to the reels. Reduced motion lands without ever
 * reporting motion, so an all-idle report means the wheels are already still.
 */
export function notePullStarted(hold: CountGuardHold, motion: readonly boolean[]): CountGuardHold {
  if (!hold.holding) return hold;
  if (motion.some(Boolean)) return { holding: true, armed: true };
  return IDLE_COUNT_GUARD;
}

/**
 * Copper affordability for the count reel.
 * While a pull is in progress this is a no-op. Otherwise it is the same
 * nearest-affordable adjustment the machine uses after a stop.
 */
export function copperCountAdjustment(input: {
  holding: boolean;
  metalSymbol: string | undefined;
  usdPerTroyOz: number;
  grams: number;
  countIndex: number;
  customPieces: number | null;
  counts: readonly number[];
}): CopperCountAdjustment {
  const unchanged: CopperCountAdjustment = {
    countIndex: input.countIndex,
    customPieces: input.customPieces,
    guard: false,
  };
  if (input.holding || input.metalSymbol !== "HG") return unchanged;

  const copper = input.usdPerTroyOz;
  const counts = input.counts;
  const enabled = (value: number) => {
    const marks = counts.map((count) => weightShowsDollars(copper, input.grams, count));
    if (!marks.some(Boolean)) return value === counts[counts.length - 1];
    return weightShowsDollars(copper, input.grams, value);
  };

  if (input.customPieces === null) {
    const next = nearestAffordableCountIndex(counts, input.countIndex, input.grams, copper);
    if (next === input.countIndex) return unchanged;
    return { countIndex: next, customPieces: null, guard: true };
  }

  if (enabled(input.customPieces)) return unchanged;
  const next = valueAfterRelease(input.customPieces, null, counts, enabled);
  const index = counts.indexOf(next);
  if (index >= 0) {
    if (index === input.countIndex) return { countIndex: input.countIndex, customPieces: null, guard: false };
    return { countIndex: index, customPieces: null, guard: true };
  }
  return { countIndex: input.countIndex, customPieces: next, guard: false };
}
