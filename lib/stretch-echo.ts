/** Mechanical bounce on a stretch pop. No feedback, so it stays a tap instead of a room. */
export const STRETCH_ECHO_TAPS = [
  { delayMs: 50, gain: 0.45 },
  { delayMs: 95, gain: 0.25 },
  { delayMs: 140, gain: 0.12 },
] as const;

/** Highpass on the taps only, so the repeats are thinner and more metallic than the dry pop. */
export const STRETCH_ECHO_HIGHPASS_HZ = 2400;

/** Audible body of a pop clip. The files are longer because of encoder padding. */
export const STRETCH_POP_BODY_MS = 70;

/** Last echo plus the pop body. Must die inside a quarter second. */
export function stretchEchoTailMs(
  taps: readonly { delayMs: number }[] = STRETCH_ECHO_TAPS,
  bodyMs = STRETCH_POP_BODY_MS,
): number {
  const last = taps.reduce((max, tap) => Math.max(max, tap.delayMs), 0);
  return last + bodyMs;
}
