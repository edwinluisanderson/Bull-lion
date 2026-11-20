/**
 * Detent click for a reel stop.
 * Silent when the Vibration API is missing.
 *
 * Reduced motion is intentionally not checked. Android reports
 * `prefers-reduced-motion: reduce` when "Remove animations" is on,
 * and that setting should not mute the detent click.
 *
 * A new vibrate() call cancels the one in progress. Stops during a
 * fast spin arrive closer together than 40ms, which restarts the
 * pulse before an Android motor can spin up. Those late ticks are
 * dropped. Nothing is queued, so a stopped wheel cannot keep buzzing.
 * The landing tap is forced and is not cancelled by the stop that follows it.
 */
export const HAPTIC_CLICK_MS = 40;

let lastAt = Number.NEGATIVE_INFINITY;
let protectUntil = Number.NEGATIVE_INFINITY;
let ticksOpen = true;

export function reelTicksOpen(): boolean {
  return ticksOpen;
}

export function setReelTicksOpen(open: boolean): void {
  ticksOpen = open;
}

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function play(): void {
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    navigator.vibrate(HAPTIC_CLICK_MS);
  } catch {
    /* Haptics are optional. */
  }
}

export function resetHapticQueue(): void {
  lastAt = Number.NEGATIVE_INFINITY;
  protectUntil = Number.NEGATIVE_INFINITY;
  ticksOpen = true;
}

/** Stop the motor. A landing tap that just started is left to finish. */
export function stopHaptics(): void {
  if (nowMs() < protectUntil) return;
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    navigator.vibrate(0);
  } catch {
    /* Haptics are optional. */
  }
}

/**
 * Call when a reel reports motion. Cancels haptics only on the transition
 * from "something is moving" to "every reel is idle".
 */
export function settleReels(previous: readonly boolean[], next: readonly boolean[]): boolean {
  const wasMoving = previous.some(Boolean);
  const moving = next.some(Boolean);
  if (!wasMoving && moving) {
    setReelTicksOpen(true);
    return false;
  }
  if (!wasMoving || moving) return false;
  setReelTicksOpen(false);
  stopHaptics();
  return true;
}

/** One pulse. A tick closer than 40ms is dropped. `force` is the landing tap. */
export function hapticClick(force = false): void {
  const now = nowMs();
  if (!force && now - lastAt < HAPTIC_CLICK_MS) return;
  lastAt = now;
  if (force) protectUntil = now + HAPTIC_CLICK_MS;
  play();
}
