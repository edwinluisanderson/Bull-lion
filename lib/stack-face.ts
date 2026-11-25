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

/** Weight token, then the description, on the 14 flaps after the metal cell. */
export function cardDetail(weightLabel: string, description: string, width = FLAP_DETAIL): string {
  const weight = compactWeight(weightLabel);
  const words = flapText(description);
  const joined = weight && words ? `${weight} ${words}` : weight || words;
  return padFlap(joined, width);
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
