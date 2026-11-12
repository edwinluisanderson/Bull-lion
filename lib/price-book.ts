import { METAL_CATALOG, SAMPLE_STAMP, type MetalSpec } from "@/lib/metals";
import { usdPerTroyOunce, type QuotedUnit } from "@/lib/value";

export const LIVE_SPOT_NOTE =
  "Live spot from Gold API, cached on the server and refreshed about every 30 seconds. Precious metals are quoted per troy ounce. Copper is quoted per pound and converted before the math.";

export type PriceSource = "live" | "sample" | "partial";

export type MetalQuote = {
  symbol: string;
  name: string;
  mark: string;
  tint: string;
  quotedPrice: number;
  quotedUnit: QuotedUnit;
  usdPerTroyOz: number;
  updatedAt: string | null;
  fallback: boolean;
};

export type PriceBook = {
  source: PriceSource;
  fetchedAt: string;
  note: string;
  metals: MetalQuote[];
};

export function metalQuote(
  spec: MetalSpec,
  quotedPrice: number,
  updatedAt: string | null,
  fallback: boolean,
): MetalQuote {
  return {
    symbol: spec.symbol,
    name: spec.name,
    mark: spec.mark,
    tint: spec.tint,
    quotedPrice,
    quotedUnit: spec.quotedUnit,
    usdPerTroyOz: usdPerTroyOunce(quotedPrice, spec.quotedUnit),
    updatedAt,
    fallback,
  };
}

export function samplePriceBook(note?: string): PriceBook {
  return {
    source: "sample",
    fetchedAt: SAMPLE_STAMP,
    note:
      note ??
      "Sample workshop card stamped 12 Nov 2026. The Gold API feed did not answer, so these standing figures stay on the glass until it does.",
    metals: METAL_CATALOG.map((spec) =>
      metalQuote(spec, spec.sampleQuotedPrice, SAMPLE_STAMP, true),
    ),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseMetal(entry: unknown): MetalQuote | null {
  if (!isRecord(entry)) return null;
  if (typeof entry.symbol !== "string") return null;
  const spec = METAL_CATALOG.find((metal) => metal.symbol === entry.symbol);
  if (!spec) return null;
  if (typeof entry.quotedPrice !== "number" || !Number.isFinite(entry.quotedPrice)) {
    return null;
  }
  if (entry.quotedPrice <= 0) return null;
  const updatedAt = typeof entry.updatedAt === "string" ? entry.updatedAt : null;
  const fallback = entry.fallback === true;
  return metalQuote(spec, entry.quotedPrice, updatedAt, fallback);
}

/** Accept a route payload and recompute troy-ounce prices from the quoted unit. */
export function parsePriceBook(input: unknown): PriceBook | null {
  if (!isRecord(input)) return null;
  if (input.source !== "live" && input.source !== "sample" && input.source !== "partial") {
    return null;
  }
  if (typeof input.fetchedAt !== "string" || typeof input.note !== "string") return null;
  if (!Array.isArray(input.metals)) return null;

  const bySymbol = new Map<string, MetalQuote>();
  for (const entry of input.metals) {
    const quote = parseMetal(entry);
    if (!quote) return null;
    bySymbol.set(quote.symbol, quote);
  }

  const metals: MetalQuote[] = [];
  for (const spec of METAL_CATALOG) {
    const found = bySymbol.get(spec.symbol);
    if (!found) return null;
    metals.push(found);
  }

  return {
    source: input.source,
    fetchedAt: input.fetchedAt,
    note: input.note.slice(0, 500),
    metals,
  };
}
