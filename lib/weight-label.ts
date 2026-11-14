import { TROY_OUNCE_GRAMS } from "@/lib/value";
import type { WeightSpec } from "@/lib/metals";

const NICE_TROY = [
  { ounces: 0.1, amount: "1/10" },
  { ounces: 0.25, amount: "1/4" },
  { ounces: 0.5, amount: "1/2" },
  { ounces: 1, amount: "1" },
  { ounces: 2, amount: "2" },
  { ounces: 5, amount: "5" },
  { ounces: 10, amount: "10" },
] as const;

/** Quantity and unit, with troy used only for ounces. */
export function weightWords(weight: WeightSpec): { amount: string; unit: string } {
  const ounces = weight.grams / TROY_OUNCE_GRAMS;
  for (const nice of NICE_TROY) {
    if (Math.abs(ounces - nice.ounces) < 1e-8) {
      return {
        amount: nice.amount,
        unit: nice.ounces > 1 ? "ounces troy" : "ounce troy",
      };
    }
  }
  if (Math.abs(weight.grams - 1000) < 1e-6) return { amount: "1", unit: "kilogram" };
  if (Math.abs(weight.grams - 1) < 1e-6) return { amount: "1", unit: "gram" };
  return { amount: String(weight.grams), unit: "grams" };
}

export function formatWeightPhrase(weight: WeightSpec): string {
  const { amount, unit } = weightWords(weight);
  return `${amount} ${unit}`;
}

export function formatPiecePhrase(pieces: number): string {
  return pieces === 1 ? "1 piece" : `${pieces} pieces`;
}

/** "10 grams, 1 piece" */
export function formatStackPhrase(weight: WeightSpec, pieces: number): string {
  return `${formatWeightPhrase(weight)}, ${formatPiecePhrase(pieces)}`;
}
