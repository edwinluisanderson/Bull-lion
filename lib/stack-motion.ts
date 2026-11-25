/** How far the chains sit in from each card edge, just inside the swipe zones. */
export const CHAIN_INSET_PX = 96;

/** The hidden reel pays out, then the blank card is allowed to flip. */
export const CHAIN_PAY_MS = 520;

export type PayPhase = "drop" | "flip";

/** Flaps stay blank until the new card has finished sliding out from behind the plate. */
export function arrivalShowsBlank(phase: PayPhase | null): boolean {
  return phase === "drop";
}
