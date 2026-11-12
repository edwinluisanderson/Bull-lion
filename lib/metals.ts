import { TROY_OUNCE_GRAMS, type QuotedUnit } from "@/lib/value";

export type MetalSpec = {
  symbol: string;
  name: string;
  mark: string;
  tint: string;
  quotedUnit: QuotedUnit;
  /** Standing quote used only when the live feed is missing this metal. */
  sampleQuotedPrice: number;
};

/**
 * Snapshot taken from Gold API on 12 Nov 2026, used only as a labeled fallback.
 * XAU, XAG, XPT, and XPD are USD per troy ounce. HG copper is USD per pound.
 */
export const METAL_CATALOG: readonly MetalSpec[] = [
  {
    symbol: "XAU",
    name: "Gold",
    mark: "Au",
    tint: "#f0c14a",
    quotedUnit: "ozt",
    sampleQuotedPrice: 3987.2,
  },
  {
    symbol: "XAG",
    name: "Silver",
    mark: "Ag",
    tint: "#d9e2ea",
    quotedUnit: "ozt",
    sampleQuotedPrice: 51.85,
  },
  {
    symbol: "XPT",
    name: "Platinum",
    mark: "Pt",
    tint: "#e7eef3",
    quotedUnit: "ozt",
    sampleQuotedPrice: 1545,
  },
  {
    symbol: "XPD",
    name: "Palladium",
    mark: "Pd",
    tint: "#d5e2ee",
    quotedUnit: "ozt",
    sampleQuotedPrice: 1059,
  },
  {
    symbol: "HG",
    name: "Copper",
    mark: "Cu",
    tint: "#e08a56",
    quotedUnit: "lb",
    sampleQuotedPrice: 6.3,
  },
];

export type WeightSpec = {
  id: string;
  face: string;
  detail: string;
  grams: number;
};

export const WEIGHTS: readonly WeightSpec[] = [
  { id: "1g", face: "1 g", detail: "gram", grams: 1 },
  { id: "5g", face: "5 g", detail: "grams", grams: 5 },
  { id: "10g", face: "10 g", detail: "grams", grams: 10 },
  { id: "1/10", face: "1/10 oz", detail: "troy", grams: TROY_OUNCE_GRAMS / 10 },
  { id: "1/4", face: "1/4 oz", detail: "troy", grams: TROY_OUNCE_GRAMS / 4 },
  { id: "1/2", face: "1/2 oz", detail: "troy", grams: TROY_OUNCE_GRAMS / 2 },
  { id: "1oz", face: "1 oz", detail: "troy", grams: TROY_OUNCE_GRAMS },
  { id: "5oz", face: "5 oz", detail: "troy", grams: TROY_OUNCE_GRAMS * 5 },
  { id: "10oz", face: "10 oz", detail: "troy", grams: TROY_OUNCE_GRAMS * 10 },
  { id: "100g", face: "100 g", detail: "grams", grams: 100 },
  { id: "1kg", face: "1 kg", detail: "kilogram", grams: 1000 },
];

/** How many identical pieces of the weight on reel 2. Purity is assumed fine. */
export const COUNTS: readonly number[] = [1, 2, 5, 10, 20, 25, 50, 100];

export const DEFAULT_METAL_INDEX = 0;
export const DEFAULT_WEIGHT_INDEX = WEIGHTS.findIndex((weight) => weight.id === "1oz");
export const DEFAULT_COUNT_INDEX = 0;

export const SAMPLE_STAMP = "2026-11-12T02:15:33.000Z";

export const REEL_ITEM_HEIGHT = 86;
