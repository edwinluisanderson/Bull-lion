/** Train-board alphabet. Unknown marks fall back to a blank. */
export const FLAP_ALPHABET = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$.,/-+'!";

export const FLAP_METAL = 2;
export const FLAP_WEIGHT = 7;
export const FLAP_QTY = 3;
export const FLAP_MELT = 7;
/** One shared grid. Row 2 uses the same columns as metal, weight, qty, and melt. */
export const FLAP_BOARD_COLUMNS = FLAP_METAL + FLAP_WEIGHT + FLAP_QTY + FLAP_MELT;
/** Descriptions stay on row 2. Letters past the grid are cut, not given another row. */
export const FLAP_DESCRIPTION = FLAP_BOARD_COLUMNS;
/**
 * Amount row on the Total board. Thirteen cells hold $9,999,999.99.
 * Wider totals drop commas, then show the largest value that fits.
 */
export const FLAP_TOTAL_COLUMNS = 13;
/**
 * Small flaps that fit across that amount row at a 320px viewport.
 * The empty message splits onto however many of these the words need.
 */
export const FLAP_TOTAL_WORD_COLUMNS = 16;
/** Advance width of Cinzel 700, in ems, so a tile can match its glyph. */
const FLAP_EM: Record<string, number> = {
  " ": 0.25,
  A: 0.717,
  B: 0.674,
  C: 0.78,
  D: 0.828,
  E: 0.631,
  F: 0.595,
  G: 0.837,
  H: 0.861,
  I: 0.386,
  J: 0.384,
  K: 0.757,
  L: 0.616,
  M: 0.953,
  N: 0.865,
  O: 0.879,
  P: 0.656,
  Q: 0.882,
  R: 0.747,
  S: 0.578,
  T: 0.666,
  U: 0.821,
  V: 0.728,
  W: 0.971,
  X: 0.729,
  Y: 0.703,
  Z: 0.661,
  "0": 0.653,
  "1": 0.392,
  "2": 0.617,
  "3": 0.563,
  "4": 0.619,
  "5": 0.555,
  "6": 0.63,
  "7": 0.544,
  "8": 0.603,
  "9": 0.63,
  $: 0.558,
  ".": 0.222,
  ",": 0.23,
  "/": 0.426,
  "-": 0.38,
  "+": 0.481,
  "'": 0.28,
  "!": 0.4,
};

export function flapEm(char: string): number {
  return FLAP_EM[char.toUpperCase()] ?? FLAP_EM.W;
}
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

/** Digits sit on the right of a fixed field. Leading blanks keep the field width. */
export function rightFlap(text: string, width: number): string {
  return flapText(text).slice(-width).padStart(width, " ");
}

/**
 * Right-align a money total.
 * Commas stay when they fit. If not, they drop. If the digits still do not fit,
 * the field shows the largest amount it can: a dollar sign and nines.
 */
export function fitFlapMoney(text: string, width: number): string {
  const grouped = flapText(text);
  if (grouped.length <= width) return grouped.padStart(width, " ");
  const plain = grouped.replaceAll(",", "");
  if (plain.length <= width) return plain.padStart(width, " ");
  const digits = Math.max(0, width - 1);
  return ("$" + "9".repeat(digits)).slice(0, width);
}

/** The letters painted on the description row. Extra characters are dropped. */
export function flapDescription(description: string, columns = FLAP_DESCRIPTION): string {
  return padFlap(description, columns);
}

/** Sum of glyph advances for a padded flap word, in ems. */
export function flapAdvance(text: string, width: number): number {
  return [...padFlap(text, width)].reduce((sum, char) => sum + flapEm(char), 0);
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
