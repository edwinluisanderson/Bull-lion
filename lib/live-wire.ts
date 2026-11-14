/** A successful live check this fresh stays green. */
export const LIVE_WIRE_GREEN_MS = 30 * 60 * 1000;

/** Older than green, up to this age, is yellow. Beyond it the lamp is red. */
export const LIVE_WIRE_YELLOW_MS = 2 * 60 * 60 * 1000;

/** How often the lamp re-reads the clock so a fresh check can age without a reload. */
export const LIVE_WIRE_TICK_MS = 45_000;

export type LiveWireState = "green" | "yellow" | "red";

/**
 * Lamp tint from the last successful live spot check.
 * Sample or fallback prices, and a missing or unreadable stamp, are red.
 * Exactly 30 minutes is still green. Exactly 2 hours is still yellow.
 */
export function liveWireState(
  lastCheckedAt: string | null,
  now: number,
  isSample: boolean,
): LiveWireState {
  if (isSample) return "red";
  if (!lastCheckedAt) return "red";
  const checked = Date.parse(lastCheckedAt);
  if (!Number.isFinite(checked)) return "red";
  const age = now - checked;
  if (age <= LIVE_WIRE_GREEN_MS) return "green";
  if (age <= LIVE_WIRE_YELLOW_MS) return "yellow";
  return "red";
}
