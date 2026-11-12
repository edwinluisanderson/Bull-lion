import { cacheLife } from "next/cache";

import { METAL_CATALOG, SAMPLE_STAMP, type MetalSpec } from "@/lib/metals";
import {
  metalQuote,
  samplePriceBook,
  type MetalQuote,
  type PriceBook,
} from "@/lib/price-book";

const GOLD_API = "https://api.gold-api.com/price";

const LIVE_NOTE =
  "Live spot from Gold API, cached on the server and refreshed about every 30 seconds. Precious metals are quoted per troy ounce. Copper is quoted per pound and converted before the math.";

/**
 * Live spot book. Gold API real-time prices need no key.
 * The result is cached for 30 seconds on the server (`revalidate`), held on the
 * client for 5 minutes (`stale`), and dropped after an hour without traffic.
 */
export async function getPriceBook(): Promise<PriceBook> {
  "use cache";
  cacheLife({
    stale: 5 * 60,
    revalidate: 30,
    expire: 60 * 60,
  });

  try {
    return await loadPriceBook();
  } catch (error) {
    console.error("Spot feed failed, using the sample card.", error);
    return samplePriceBook();
  }
}

async function loadPriceBook(): Promise<PriceBook> {
  const settled = await Promise.all(
    METAL_CATALOG.map(async (spec) => {
      try {
        return await fetchMetal(spec);
      } catch (error) {
        console.error(`Gold API ${spec.symbol} failed.`, error);
        return null;
      }
    }),
  );

  const metals = settled.map((quote, index) => {
    if (quote) return quote;
    const spec = METAL_CATALOG[index];
    return metalQuote(spec, spec.sampleQuotedPrice, SAMPLE_STAMP, true);
  });

  const liveCount = metals.filter((metal) => !metal.fallback).length;
  if (liveCount === 0) return samplePriceBook();

  const fetchedAt = latestStamp(metals);
  if (liveCount === metals.length) {
    return { source: "live", fetchedAt, note: LIVE_NOTE, metals };
  }

  const missing = metals
    .filter((metal) => metal.fallback)
    .map((metal) => metal.name)
    .join(", ");

  return {
    source: "partial",
    fetchedAt,
    note: `Some quotes failed to arrive (${missing}) and were filled from the workshop sample card. The rest are live from Gold API.`,
    metals,
  };
}

async function fetchMetal(spec: MetalSpec): Promise<MetalQuote> {
  const response = await fetch(`${GOLD_API}/${spec.symbol}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "BullionBandit/1.0",
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Gold API ${spec.symbol} responded ${response.status}`);
  }

  const payload: unknown = await response.json();
  const price = readPrice(payload);
  if (price == null) {
    throw new Error(`Gold API ${spec.symbol} did not return a price`);
  }

  return metalQuote(spec, price, readUpdatedAt(payload), false);
}

function readPrice(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const price = (payload as { price?: unknown }).price;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) return null;
  return price;
}

function readUpdatedAt(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const updatedAt = (payload as { updatedAt?: unknown }).updatedAt;
  if (typeof updatedAt !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(updatedAt)) return null;
  return updatedAt;
}

function latestStamp(metals: MetalQuote[]): string {
  let latest = "";
  for (const metal of metals) {
    if (!metal.updatedAt || metal.fallback) continue;
    if (latest === "" || metal.updatedAt > latest) latest = metal.updatedAt;
  }
  return latest || SAMPLE_STAMP;
}
