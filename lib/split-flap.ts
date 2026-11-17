/** Train-board alphabet. Unknown marks fall back to a blank. */
export const FLAP_ALPHABET = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$.,/-+";

export const FLAP_METAL = 2;
export const FLAP_WEIGHT = 7;
export const FLAP_QTY = 3;
/** Short names share the melt row. Longer copy drops to its own row. */
export const FLAP_DESCRIPTION_INLINE = 9;
export const FLAP_DESCRIPTION_LONG = 16;
export const FLAP_MELT = 7;
/** One mechanical step. Long enough to read, short enough for a row. */
export const FLAP_STEP_MS = 70;

export function flapIndex(char: string): number {
  const found = FLAP_ALPHABET.indexOf(char.toUpperCase());
  return found === -1 ? 0 : found;
}

export function flapText(text: string): string {
  const clean = text.toUpperCase().replaceAll("—", "-");
  return [...clean].filter((char) => FLAP_ALPHABET.includes(char)).join("");
}

export function padFlap(text: string, width: number): string {
  return flapText(text).slice(0, width).padEnd(width, " ");
}

/** A description that does not fit beside the melt value gets its own flap row. */
export function descriptionNeedsOwnRow(description: string, inline = FLAP_DESCRIPTION_INLINE): boolean {
  return flapText(description).length > inline;
}

/** One click forward. The board only travels in one direction, like a drum. */
export function advanceFlap(char: string): string {
  return FLAP_ALPHABET[(flapIndex(char) + 1) % FLAP_ALPHABET.length] ?? " ";
}

/**
 * Boards after the current one, ending on the target.
 * Reduced motion is a single jump. An unchanged line is empty.
 */
export function flapFrames(from: string, to: string, reduced = false): string[] {
  const width = Math.max(from.length, to.length);
  const target = padFlap(to, width);
  const start = padFlap(from, width);
  if (reduced) return start === target ? [] : [target];
  const frames: string[] = [];
  let current = start;
  for (let step = 0; step < FLAP_ALPHABET.length && current !== target; step += 1) {
    current = [...current].map((char, index) => (char === target[index] ? char : advanceFlap(char))).join("");
    frames.push(current);
  }
  return frames;
}
