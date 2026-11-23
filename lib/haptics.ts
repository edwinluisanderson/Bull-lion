/**
 * Detent click for a reel stop.
 * Silent when the Vibration API is missing.
 *
 * Reduced motion is intentionally not checked. Android reports
 * `prefers-reduced-motion: reduce` when "Remove animations" is on,
 * and that setting should not mute the detent click.
 *
 * A new vibrate() call cancels the one in progress. Stops during a
 * fast spin arrive closer together than the gap, which restarts the
 * pulse before an Android motor can spin up. Those late ticks are
 * dropped. Nothing is queued, so a stopped wheel cannot keep buzzing.
 * The landing tap is forced and is not cancelled by the stop that follows it.
 * Gray stops never call this.
 */
/** Lit reel stop. */
export const HAPTIC_STOP_MS = 15;
/** Minimum time between ordinary stops. Reel-click gating uses the same gap. */
export const HAPTIC_MIN_GAP_MS = 40;
/** Landing and the stretch-release snap: buzz, pause, buzz. */
export const HAPTIC_LANDING_PATTERN = [40, 40, 40] as const;
/** Whole landing pattern, pause included, so a settle cannot cut it off. */
export const HAPTIC_LANDING_MS = HAPTIC_LANDING_PATTERN.reduce((sum, step) => sum + step, 0);

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

function play(pattern: number | readonly number[]): void {
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    navigator.vibrate(pattern as number | number[]);
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

/** One pulse. A tick closer than the gap is dropped. `force` is the landing thump. */
export function hapticClick(force = false): void {
  const now = nowMs();
  if (!force && now - lastAt < HAPTIC_MIN_GAP_MS) return;
  lastAt = now;
  if (force) protectUntil = now + HAPTIC_LANDING_MS;
  play(force ? HAPTIC_LANDING_PATTERN : HAPTIC_STOP_MS);
}
