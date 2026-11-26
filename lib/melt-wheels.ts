import { formatWholeDollars } from "@/lib/format";
import { presentMoney } from "@/lib/melt-abbrev";

/** Fixed odometer. The ones place is always the last wheel. */
export const WHEEL_COUNT = 10;
/** Whole dollars. $9,999,999 fills every wheel; anything past that clamps. */
export const MELT_WHEEL_MAX = 9_999_999;
/** Rightmost wheel leads. Each wheel to its left waits another 55ms. */
export const STAGGER_MS = 55;
/** Settle past the face, in em, then come back. */
export const OVERSHOOT_EM = 0.14;
/** Curve 3. A neighbour one step away is about 0.48 of the front height. */
export const WHEEL_STEP_DEG = 61.3;

/**
 * Faces around the drum. Two spare blanks sit above the blank face.
 * A 9 sits above 0, and a 0 sits below 9.
 */
export const ODOMETER_STRIP = ["", "", "", "$", ",", "9", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] as const;

export function odometerCell(char: string): number {
  if (char === "") return 2;
  if (char === "$") return 3;
  if (char === ",") return 4;
  const digit = Number(char);
  return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? 6 + digit : 2;
}

export function odometerNeighbours(char: string): { above: string; below: string } {
  const index = odometerCell(char);
  return {
    above: ODOMETER_STRIP[index - 1] ?? "",
    below: ODOMETER_STRIP[index + 1] ?? "",
  };
}

/** Right-locked slots. Unused wheels on the left stay blank. The row never recentres. */
export function layoutWheels(value: string, count = WHEEL_COUNT): string[] {
  const chars = value === "—" ? [] : [...value].filter((char) => /[0-9$,]/.test(char));
  const len = Math.min(chars.length, count);
  const shown = chars.slice(chars.length - len);
  const start = count - len;
  return Array.from({ length: count }, (_, index) => (index >= start && index < start + len ? (shown[index - start] ?? "") : ""));
}

export function clampMeltDollars(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.min(MELT_WHEEL_MAX, Math.max(0, Math.round(value)));
}

/** The string the wheels show while the figure still fits. Past the clamp, the plate abbreviates. */
export function meltWheelLabel(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const dollars = Math.max(0, Math.round(value));
  if (dollars <= MELT_WHEEL_MAX) return formatWholeDollars(dollars);
  return presentMoney(dollars, "$9,999,999".length).text;
}

/** True when the melt plate must leave the wheels and show the abbreviated figure. */
export function meltPlateRounded(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  return Math.round(value) > MELT_WHEEL_MAX;
}

/** Delay before wheel `slot` starts. Slot 0 is the left end and waits the longest. */
export function wheelStaggerMs(slot: number, count = WHEEL_COUNT): number {
  return (count - 1 - slot) * STAGGER_MS;
}

/** Longer trips take longer. Distance is in drum faces. */
export function wheelDurationMs(distance: number): number {
  return 460 + Math.abs(distance) * 42;
}
