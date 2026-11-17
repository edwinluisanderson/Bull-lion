import { priceParts } from "@/lib/price-reels";

/** Warm neon core. The halo around it is the same hue at low opacity. */
export const NIXIE_ORANGE = "#ff7a1a";
/** Same roll the melt-plate digits use, so the two displays settle together. */
export const NIXIE_IGNITE_MS = 620;
export const NIXIE_STAGGER_MS = 50;

export const NIXIE_DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/**
 * Wire cathodes in a 24×64 tube. The plate window shows roughly y 15–49,
 * so the numerals stay inside the hole and the capsule ends stay empty glass.
 */
export const NIXIE_GLYPH: Record<(typeof NIXIE_DIGITS)[number], string> = {
  0: "M12 23.2c-3.3 0-5.5 3.5-5.5 9s2.2 9 5.5 9 5.5-3.5 5.5-9-2.2-9-5.5-9z",
  1: "M8.2 27.4 10.4 23.2v18.2h2.6v-18.2",
  2: "M7.1 26.6c.2-2.8 9.8-3.6 9.8 1 0 3.6-8.6 4-9.2 8.2h9.6",
  3: "M7.6 25.4c3.6-2.2 8.8-1 8.6 2.2-.2 2.2-2.8 3-4.8 3 2.4.3 5.2 1.6 5.2 4.4 0 3.2-5.4 4.4-9 2.2",
  4: "M15.8 23.2v18.2M6.6 23.6 6.4 32.4h11.4",
  5: "M16.4 23.4H7.6v7.4h6.2c3.4.2 3.8 6.4-1.2 7.4-2.8.6-5.6-.2-5.8-2.4",
  6: "M15.4 25.2C13 22.6 7.2 24 6.8 29.2c-.5 5.4 3.6 8.8 7.4 8.2 3.2-.6 4.4-3.4 4-5.6-.5-2.6-4.6-3.4-7.6-2.4",
  7: "M6.8 23.6h10.4L9.2 41.2",
  8: "M12 32.1c-3.1 0-5.2-1.9-5.2-4.4s2.1-4.5 5.2-4.5 5.2 2 5.2 4.5-2.1 4.4-5.2 4.4zm0 0c-3.5 0-5.8 2.1-5.8 4.8s2.3 4.9 5.8 4.9 5.8-2.2 5.8-4.9-2.3-4.8-5.8-4.8z",
  9: "M8.6 39c2.4 2.6 8.2 1.2 8.6-4 0.5-5.4-3.6-8.8-7.4-8.2-3.2.6-4.4 3.4-4 5.6.5 2.6 4.6 3.4 7.6 2.4",
};

export const NIXIE_DOLLAR = "M14.4 21.6v20.6M8.4 27.2c.1-3 7.8-3.5 7.8.1 0 2.5-3.2 3.3-6 4.1-2.8.8-4.2 2-4.2 4.1 0 3.1 7.6 3.5 8.4.3";
export const NIXIE_COMMA = "M13.4 34.2c.4 3.4-1.8 5.4-3.8 7.6";
export const NIXIE_DASH = "M8 32.2h8";

export type NixieColumn =
  | { kind: "digit"; key: string; digit: number; order: number }
  | { kind: "dollar"; key: string }
  | { kind: "comma"; key: string }
  | { kind: "dot"; key: string }
  | { kind: "mark"; key: string; char: string };

/** The same parts as the melt plate, named for the tube each one needs. */
export function nixieColumns(formatted: string): NixieColumn[] {
  return priceParts(formatted).map((part) => {
    if (part.kind === "digit") {
      return { kind: "digit", key: part.key, digit: part.digit, order: part.order };
    }
    if (part.char === "$") return { kind: "dollar", key: part.key };
    if (part.char === ",") return { kind: "comma", key: part.key };
    if (part.char === ".") return { kind: "dot", key: part.key };
    return { kind: "mark", key: part.key, char: part.char };
  });
}

/** Inside a digit tube, only the cathode for the current numeral is lit. */
export function litDigit(column: NixieColumn): number | null {
  return column.kind === "digit" ? column.digit : null;
}
