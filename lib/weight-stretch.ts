import { WEIGHTS } from "@/lib/metals";
import { originFor, type StretchDirection, type StretchOrigin } from "@/lib/stretch";
import { TROY_OUNCE_GRAMS } from "@/lib/value";

/** Pulling up from 1 kg offers 2 kg through 10 kg, and nothing above. */
export const WEIGHT_KG_MAX = 10;

const OZ = TROY_OUNCE_GRAMS;
const GRAM_STOPS = [1, 2.5, 5, 10, 20, 25, 50, 100, 1000];

export function sameGrams(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-6 * Math.max(1, Math.abs(left), Math.abs(right));
}

function isKg(value: number): boolean {
  return value >= 1000 && Math.abs(value / 1000 - Math.round(value / 1000)) < 1e-8;
}

function isGramFamily(value: number): boolean {
  if (GRAM_STOPS.some((stop) => sameGrams(stop, value))) return true;
  if (Number.isInteger(value) && value >= 1 && value <= 100) return true;
  return isKg(value);
}

function ounceOf(value: number): number {
  return value / OZ;
}

function isTroyFamily(value: number): boolean {
  const ounces = ounceOf(value);
  const known = [1 / 25, 1 / 20, 1 / 10, 1 / 5, 1 / 4, 1 / 2, 3 / 4, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return known.some((target) => Math.abs(ounces - target) < 1e-8);
}

function wholeGrams(from: number, to: number): number[] {
  if (from > 100 || to > 100) return [];
  const step = to > from ? 1 : -1;
  const values: number[] = [];
  let grams = step > 0 ? Math.floor(from) + 1 : Math.ceil(from) - 1;
  while ((step > 0 && grams < to && grams > from) || (step < 0 && grams > to && grams < from)) {
    values.push(grams);
    grams += step;
    if (values.length > 400) break;
  }
  return values;
}

function wholeOunces(from: number, to: number): number[] {
  const fromOz = ounceOf(from);
  const toOz = ounceOf(to);
  if (fromOz < 1 || toOz < 1 || fromOz > 10 || toOz > 10) return [];
  const step = toOz > fromOz ? 1 : -1;
  const values: number[] = [];
  let ounces = step > 0 ? Math.floor(fromOz) + 1 : Math.ceil(fromOz) - 1;
  while ((step > 0 && ounces < toOz && ounces > fromOz) || (step < 0 && ounces > toOz && ounces < fromOz)) {
    values.push(ounces * OZ);
    ounces += step;
    if (values.length > 20) break;
  }
  return values;
}

function kilogramsAbove(fromKg: number): number[] {
  const values: number[] = [];
  for (let kg = fromKg + 1; kg <= WEIGHT_KG_MAX; kg += 1) {
    values.push(kg * 1000);
  }
  return values;
}

function kilogramsDownToOne(fromKg: number): number[] {
  const values: number[] = [];
  for (let kg = fromKg - 1; kg > 1; kg -= 1) {
    values.push(kg * 1000);
  }
  return values;
}

/** Temporary weights between the pressed stop and the neighbor, in pull order. */
export function weightStretchBetween(
  anchor: number,
  toward: number,
  _direction: StretchDirection,
): number[] {
  if (isKg(anchor) && sameGrams(toward, OZ / 10)) return kilogramsAbove(Math.round(anchor / 1000));
  if (isKg(anchor) && anchor > 1000 && sameGrams(toward, 1000)) return kilogramsDownToOne(Math.round(anchor / 1000));
  if (sameGrams(anchor, OZ / 10) && sameGrams(toward, 1000)) return [OZ / 20, OZ / 25];
  if (sameGrams(anchor, OZ / 20) && sameGrams(toward, 1000)) return [OZ / 25];
  if (sameGrams(anchor, OZ / 25) && sameGrams(toward, OZ / 10)) return [OZ / 20];
  if (sameGrams(anchor, OZ / 25) && sameGrams(toward, 1000)) return [];
  if (sameGrams(anchor, OZ / 20) && sameGrams(toward, OZ / 10)) return [];

  const fifth = OZ / 5;
  const threeQuarter = OZ * 0.75;
  if (
    (sameGrams(anchor, OZ / 10) && sameGrams(toward, OZ / 4)) ||
    (sameGrams(anchor, OZ / 4) && sameGrams(toward, OZ / 10))
  ) {
    return [fifth];
  }
  if (sameGrams(anchor, fifth) && (sameGrams(toward, OZ / 10) || sameGrams(toward, OZ / 4))) return [];
  if (
    (sameGrams(anchor, OZ / 2) && sameGrams(toward, OZ)) ||
    (sameGrams(anchor, OZ) && sameGrams(toward, OZ / 2))
  ) {
    return [threeQuarter];
  }
  if (sameGrams(anchor, threeQuarter) && (sameGrams(toward, OZ / 2) || sameGrams(toward, OZ))) return [];

  if (isTroyFamily(anchor) && isTroyFamily(toward)) return wholeOunces(anchor, toward);
  if (isGramFamily(anchor) && isGramFamily(toward)) return wholeGrams(anchor, toward);
  return [];
}

function stopIndex(stops: readonly number[], grams: number): number {
  return stops.findIndex((stop) => sameGrams(stop, grams));
}

function gapFor(stops: readonly number[], value: number): { lower: number; upper: number } | null {
  const pairs: [number, number][] = [
    [1, 2.5],
    [2.5, 5],
    [5, 10],
    [10, 20],
    [20, 25],
    [25, 50],
    [50, 100],
    [1000, OZ / 10],
    [OZ / 10, OZ / 4],
    [OZ / 2, OZ],
    [OZ * 2, OZ * 5],
    [OZ * 5, OZ * 10],
  ];
  for (const [lowerGrams, upperGrams] of pairs) {
    const inGrams =
      !isTroyFamily(value) &&
      !isKg(value) &&
      value > lowerGrams &&
      value < upperGrams &&
      upperGrams <= 100;
    const inTroy =
      (sameGrams(lowerGrams, 1000) &&
        sameGrams(upperGrams, OZ / 10) &&
        (sameGrams(value, OZ / 20) || sameGrams(value, OZ / 25))) ||
      (sameGrams(lowerGrams, OZ / 10) && sameGrams(upperGrams, OZ / 4) && sameGrams(value, OZ / 5)) ||
      (sameGrams(lowerGrams, OZ / 2) && sameGrams(upperGrams, OZ) && sameGrams(value, OZ * 0.75));
    const inOunces =
      isTroyFamily(value) &&
      isTroyFamily(lowerGrams) &&
      isTroyFamily(upperGrams) &&
      ounceOf(value) > ounceOf(lowerGrams) &&
      ounceOf(value) < ounceOf(upperGrams);
    const inKg = isKg(value) && value > 1000 && sameGrams(lowerGrams, 1000);
    if (!inGrams && !inTroy && !inOunces && !inKg) continue;
    const lower = stopIndex(stops, lowerGrams);
    const upper = stopIndex(stops, upperGrams);
    if (lower < 0 || upper < 0) return null;
    return { lower, upper };
  }
  return null;
}

export function weightStretchOrigin(stops: readonly number[], value: number): StretchOrigin {
  const index = stopIndex(stops, value);
  if (index >= 0) return originFor(stops, stops[index] ?? value);
  const gap = gapFor(stops, value);
  if (!gap) return originFor(stops, value);
  return {
    anchor: value,
    anchorIndex: null,
    lower: stops[gap.lower] ?? value,
    upper: stops[gap.upper] ?? value,
    lowerIndex: gap.lower,
    upperIndex: gap.upper,
    slot: gap.lower + 0.5,
  };
}

export function weightStretchLabel(grams: number): { mark: string; detail: string } {
  const listed = WEIGHTS.find((weight) => sameGrams(weight.grams, grams));
  if (listed) return { mark: listed.face, detail: listed.detail };
  if (isKg(grams)) {
    const kg = Math.round(grams / 1000);
    return { mark: `${kg} kg`, detail: kg === 1 ? "kilogram" : "kilograms" };
  }
  const ounces = ounceOf(grams);
  const fractions: [number, string][] = [
    [1 / 25, "1/25 oz"],
    [1 / 20, "1/20 oz"],
    [1 / 5, "1/5 oz"],
    [0.75, "3/4 oz"],
  ];
  for (const [amount, mark] of fractions) {
    if (Math.abs(ounces - amount) < 1e-8) return { mark, detail: "troy" };
  }
  if (Math.abs(ounces - Math.round(ounces)) < 1e-8 && ounces >= 1 && ounces <= 10) {
    return { mark: `${Math.round(ounces)} oz`, detail: "troy" };
  }
  const whole = Math.round(grams);
  return { mark: `${whole} g`, detail: whole === 1 ? "gram" : "grams" };
}
