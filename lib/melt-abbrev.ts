import { formatWholeDollars } from "@/lib/format";

/** Card melt row. The Total board does not use this width. */
export const MELT_FLAP_COLUMNS = 7;

/**
 * One decimal place, then the next suffix when rounding reaches 1000.0.
 * Whole grouped dollars stay when they fit. K, M, and B follow.
 * T is only the same promotion past 999.95B, so the row never prints 1000.0B.
 */
const MELT_UNITS = [
  { dollars: 1_000, mark: "K" },
  { dollars: 1_000_000, mark: "M" },
  { dollars: 1_000_000_000, mark: "B" },
  { dollars: 1_000_000_000_000, mark: "T" },
] as const;

function tenths(dollars: number, unit: number): number {
  return Math.round((dollars * 10) / unit);
}

function suffixed(negative: boolean, tenthsOfUnit: number, mark: string): string {
  const sign = negative ? "-" : "";
  return `${sign}$${(tenthsOfUnit / 10).toFixed(1)}${mark}`;
}

/**
 * Fit a melt on the 7-flap card row.
 * `$99,999` stays whole. `$100,000` becomes `$100.0K`.
 * `$999,950` becomes `$1.0M`, not `$1000.0K`.
 */
export function abbreviateMelt(value: number | null, width = MELT_FLAP_COLUMNS): string {
  if (value == null || !Number.isFinite(value) || width < 1) return "-";
  const full = formatWholeDollars(value);
  if ([...full].length <= width) return full;
  const negative = value < 0;
  const dollars = Math.abs(Math.round(value));
  for (const unit of MELT_UNITS) {
    const scaled = tenths(dollars, unit.dollars);
    if (scaled >= 10_000) continue;
    const text = suffixed(negative, scaled, unit.mark);
    if ([...text].length <= width) return text;
  }
  const last = MELT_UNITS[MELT_UNITS.length - 1];
  if (!last) return full.slice(0, width);
  const whole = Math.max(1, Math.round(dollars / last.dollars));
  const text = `${negative ? "-" : ""}$${whole}${last.mark}`;
  return [...text].length <= width ? text : text;
}

export const MONEY_OVER = "OVER";

export type MoneyFit = {
  /** What the flaps show. */
  text: string;
  /** True when `text` is not the exact whole-dollar figure. */
  rounded: boolean;
  /** Exact whole dollars, even when the flaps abbreviate. */
  exact: string;
};

/**
 * One formatter for every flap field and the melt plate.
 * Whole dollars when they fit. Otherwise K, M, B, or T.
 * OVER is only used when even the shortest suffix does not fit.
 */
export function presentMoney(value: number | null, width: number): MoneyFit {
  if (value == null || !Number.isFinite(value) || width < 1) {
    return { text: "-", rounded: false, exact: "-" };
  }
  const exact = formatWholeDollars(value);
  const short = abbreviateMelt(value, width);
  if ([...short].length <= width) {
    return { text: short, rounded: short !== exact, exact };
  }
  if ([...MONEY_OVER].length <= width) return { text: MONEY_OVER, rounded: true, exact };
  return { text: [...MONEY_OVER].slice(0, width).join(""), rounded: true, exact };
}
