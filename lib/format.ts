import { TROY_OUNCE_GRAMS } from "@/lib/value";

const NICE_TROY_OUNCES = [0.1, 0.25, 0.5, 1, 5, 10];

export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const absolute = Math.abs(value);
  const digits = absolute > 0 && absolute < 1 ? 4 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Nearest whole dollar, with grouping and no cents. */
export function formatWholeDollars(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function formatTroyOunces(grams: number): string {
  const ounces = grams / TROY_OUNCE_GRAMS;
  for (const nice of NICE_TROY_OUNCES) {
    if (Math.abs(ounces - nice) < 1e-8) {
      const label = Number.isInteger(nice) ? nice.toFixed(0) : String(nice);
      return `${label} oz t`;
    }
  }
  return `${ounces.toFixed(6)} oz t`;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Format an ISO timestamp without `Date`, so server and client render the same UTC stamp. */
export function formatStamp(iso: string | null): string {
  if (!iso) return "time unknown";
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!match) return "time unknown";
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return "time unknown";
  return `${match[4]}:${match[5]} UTC · ${Number(match[3])} ${month} ${match[1]}`;
}
