import { presentMoney, type MoneyFit } from "@/lib/melt-abbrev";
import { FLAP_DETAIL, flapText, padFlap } from "@/lib/split-flap";

/** Flat paint for the double-wide metal cell. No sheen. */
export type MetalTone = "gold" | "silver" | "platinum" | "palladium" | "copper";

const METAL_TONE: Record<string, MetalTone> = {
  AU: "gold",
  AG: "silver",
  PT: "platinum",
  PD: "palladium",
  CU: "copper",
};

export function metalTone(mark: string): MetalTone {
  return METAL_TONE[mark.trim().toUpperCase()] ?? "silver";
}

/**
 * The reel's weight, packed onto the description row.
 * The space before the unit letter is dropped: "12.5 g" becomes "12.5G".
 */
export function compactWeight(label: string): string {
  const clean = label.trim().replace(/\s+/g, " ");
  const match = /^(.*?)\s+(g|kg|oz)$/i.exec(clean);
  if (!match) return flapText(clean.replaceAll(" ", ""));
  return flapText(`${match[1] ?? ""}${match[2] ?? ""}`);
}

/** A trailing purity mark, such as 90% or 99.9%. The rest of the line is the editable name. */
const TRAILING_PURITY = /^(.*?)(?:\s+)(\d+(?:\.\d+)?%)$/;

export function splitDetailWords(description: string): { words: string; purity: string } {
  const clean = flapText(description).trim();
  const match = TRAILING_PURITY.exec(clean);
  if (!match) return { words: clean, purity: "" };
  return { words: (match[1] ?? "").trim(), purity: match[2] ?? "" };
}

export type FlapSpan = { start: number; length: number };

export type DetailLayout = {
  weight: string;
  /** Name flaps that fit. Longer stored text stays in `descriptionSource`. */
  description: string;
  descriptionSource: string;
  purity: string;
  /** Flaps left for the name after the metal cell, weight, purity, and their gaps. */
  descriptionCap: number;
  weightSpan: FlapSpan | null;
  leadGap: FlapSpan | null;
  descriptionSpan: FlapSpan | null;
  tailGap: FlapSpan | null;
  puritySpan: FlapSpan | null;
  row: string;
};

function take(col: { at: number }, length: number): FlapSpan | null {
  if (length <= 0) return null;
  const start = col.at;
  col.at += length;
  return { start, length };
}

/**
 * Flaps the name may use on the 14-column detail row.
 * Weight, a gap, the name, a gap, and the purity share that row.
 * The 2-column metal cell is already outside it, so 16 columns is the ceiling.
 */
export function descriptionCap(weightLabel: string, description: string, width = FLAP_DETAIL): number {
  const weight = compactWeight(weightLabel);
  const { purity } = splitDetailWords(description);
  const separators = (weight ? 1 : 0) + (purity ? 1 : 0);
  return Math.max(0, width - [...weight].length - [...purity].length - separators);
}

/** Keep a typed or pasted name inside the flap budget. */
export function clampDescription(value: string, cap: number): string {
  if (cap <= 0) return "";
  return [...flapText(value)].slice(0, Math.max(0, cap)).join("");
}

/** Put the locked purity back on a name the editor just committed. */
export function composeDescription(words: string, purity: string, cap: number): string {
  const name = clampDescription(words, cap);
  if (!purity) return name;
  return name ? `${name} ${purity}` : purity;
}

/**
 * Save an edit without throwing away a stored name that was already longer than the row.
 * An unchanged field keeps that stored line. A real edit is capped and keeps the purity.
 */
export function commitDescription(original: string, typed: string, cap: number): string {
  const { words, purity } = splitDetailWords(original);
  const shown = [...words].slice(0, cap).join("");
  const next = clampDescription(typed, cap);
  if (next === shown && [...words].length > cap) return flapText(original).trim();
  return composeDescription(next, purity, cap);
}

export function detailLayout(weightLabel: string, description: string, width = FLAP_DETAIL): DetailLayout {
  const weight = compactWeight(weightLabel);
  const { words, purity } = splitDetailWords(description);
  const cap = descriptionCap(weightLabel, description, width);
  const shown = [...words].slice(0, cap).join("");
  const col = { at: 1 };
  const weightSpan = take(col, [...weight].length);
  const leadGap = weight ? take(col, 1) : null;
  const descriptionSpan = cap > 0 ? take(col, cap) : null;
  const tailGap = purity && cap > 0 ? take(col, 1) : null;
  const puritySpan = take(col, [...purity].length);
  const pieces = [weight, shown, purity].filter((part) => part.length > 0);
  return {
    weight,
    description: shown,
    descriptionSource: words,
    purity,
    descriptionCap: cap,
    weightSpan,
    leadGap,
    descriptionSpan,
    tailGap,
    puritySpan,
    row: padFlap(pieces.join(" "), width),
  };
}

/** Weight token, then the description, on the 14 flaps after the metal cell. */
export function cardDetail(weightLabel: string, description: string, width = FLAP_DETAIL): string {
  return detailLayout(weightLabel, description, width).row;
}

/** Quantity on the left, melt on the right, blanks between them. */
export function cardBottom(qty: number, melt: string, width = FLAP_DETAIL): string {
  const left = flapText(String(Math.max(0, Math.round(qty))));
  const right = flapText(melt);
  if (left.length + right.length > width) {
    const room = Math.max(0, width - right.length);
    return `${left.slice(0, room)}${right}`.slice(-width).padStart(width, " ");
  }
  return `${left}${" ".repeat(width - left.length - right.length)}${right}`;
}

/** The bottom row of a card. The melt abbreviates when the quantity leaves too little room. */
export function cardMoneyRow(qty: number, melt: number | null, width = FLAP_DETAIL): MoneyFit & { text: string } {
  const left = String(Math.max(0, Math.round(qty)));
  const room = Math.max(1, width - [...left].length - (left ? 1 : 0));
  const money = presentMoney(melt, room);
  return { ...money, text: cardBottom(qty, money.text, width) };
}
