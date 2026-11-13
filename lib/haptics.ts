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
 * pulse before an Android motor can spin up. Pulses that arrive
 * while one is playing are kept and sent as the next pattern.
 */
export const HAPTIC_CLICK_MS = 40;

let queued = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

function patternFor(count: number): number | number[] {
  if (count <= 1) return HAPTIC_CLICK_MS;
  const pattern: number[] = [];
  for (let index = 0; index < count; index += 1) {
    if (index > 0) pattern.push(HAPTIC_CLICK_MS);
    pattern.push(HAPTIC_CLICK_MS);
  }
  return pattern;
}

function play(count: number): void {
  if (count <= 0) return;
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    navigator.vibrate(patternFor(count));
  } catch {
    /* Haptics are optional. */
  }
}

function flush(): void {
  timer = undefined;
  if (queued <= 0) return;
  const count = queued;
  queued = 0;
  play(count);
  const pulses = count * HAPTIC_CLICK_MS + Math.max(0, count - 1) * HAPTIC_CLICK_MS;
  timer = setTimeout(flush, pulses);
}

function clearQueue(): void {
  queued = 0;
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
}

export function resetHapticQueue(): void {
  clearQueue();
}

/** Stop the motor and drop any pattern still waiting to play. */
export function stopHaptics(): void {
  clearQueue();
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
  if (!wasMoving || moving) return false;
  stopHaptics();
  return true;
}

export function hapticClick(): void {
  queued += 1;
  if (timer !== undefined) return;
  const count = queued;
  queued = 0;
  play(count);
  const pulses = count * HAPTIC_CLICK_MS + Math.max(0, count - 1) * HAPTIC_CLICK_MS;
  timer = setTimeout(flush, pulses);
}
