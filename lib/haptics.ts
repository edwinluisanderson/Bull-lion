/** One short click when a reel settles on the next stop. Optional and silent when unsupported. */
export function hapticClick(): void {
  try {
    if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    navigator.vibrate(10);
  } catch {
    /* Haptics are optional. */
  }
}
