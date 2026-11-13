/**
 * One short click when a reel settles on the next stop.
 * Silent when the Vibration API is missing.
 *
 * Reduced motion is intentionally not checked. Android reports
 * `prefers-reduced-motion: reduce` when "Remove animations" is on,
 * and that setting should not mute the detent click.
 */
const HAPTIC_CLICK_MS = 40;

export function hapticClick(): void {
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    // A 10ms pulse is valid but many Android motors never spin up for it.
    navigator.vibrate(HAPTIC_CLICK_MS);
  } catch {
    /* Haptics are optional. */
  }
}
