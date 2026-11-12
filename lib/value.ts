/** Grams in one troy ounce. Precious-metal spot is quoted on this ounce, not the 28.35 g avoirdupois ounce. */
export const TROY_OUNCE_GRAMS = 31.1034768;

/** Grams in one avoirdupois pound. COMEX copper (HG) is quoted per pound. */
export const AVOIRDUPOIS_POUND_GRAMS = 453.59237;

/** Troy ounces in one avoirdupois pound. */
export const TROY_OUNCES_PER_AVOIRDUPOIS_POUND =
  AVOIRDUPOIS_POUND_GRAMS / TROY_OUNCE_GRAMS;

export type QuotedUnit = "ozt" | "lb";

/** Normalize a market quote to USD per troy ounce. */
export function usdPerTroyOunce(quotedPrice: number, unit: QuotedUnit): number {
  if (unit === "lb") {
    return quotedPrice / TROY_OUNCES_PER_AVOIRDUPOIS_POUND;
  }
  return quotedPrice;
}

export function gramsToTroyOunces(grams: number): number {
  return grams / TROY_OUNCE_GRAMS;
}

/** Melt value = spot per troy ounce × weight in troy ounces × number of pieces. */
export function meltValue(
  usdPerTroyOz: number,
  grams: number,
  pieces: number,
): number {
  return usdPerTroyOz * gramsToTroyOunces(grams) * pieces;
}
