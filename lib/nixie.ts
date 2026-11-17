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

/** An S crossed by a vertical stroke, not a closed bowl. */
export const NIXIE_DOLLAR = "M12 22.4V42.4M16.2 26.2C16.2 23.2 7.6 23.4 7.8 27.6C8 31.2 16.4 30.8 16.2 35C16 39.2 7.4 38.6 7.6 42";
export const NIXIE_COMMA = "M13.4 34.2c.4 3.4-1.8 5.4-3.8 7.6";
export const NIXIE_DASH = "M8 32.2h8";

/** Ones through the millions, so the row can show $9,999,999. */
export const NIXIE_DIGIT_PLACES = 7;
/** How fast the cathodes step while the reels are spinning. */
export const NIXIE_CYCLE_MS = 60;

export type NixieColumn =
  | { kind: "digit"; key: string; digit: number | null; order: number; place?: number }
  | { kind: "dollar"; key: string; lit: boolean }
  | { kind: "comma"; key: string; lit: boolean }
  | { kind: "dot"; key: string; lit: boolean }
  | { kind: "mark"; key: string; char: string };

/** The same parts as the melt plate, named for the tube each one needs. */
export function nixieColumns(formatted: string): NixieColumn[] {
  return priceParts(formatted).map((part) => {
    if (part.kind === "digit") {
      return { kind: "digit", key: part.key, digit: part.digit, order: part.order };
    }
    if (part.char === "$") return { kind: "dollar", key: part.key, lit: true };
    if (part.char === ",") return { kind: "comma", key: part.key, lit: true };
    if (part.char === ".") return { kind: "dot", key: part.key, lit: true };
    return { kind: "mark", key: part.key, char: part.char };
  });
}

/**
 * A fixed row wide enough for $9,999,999. Leading places stay in the row
 * with every cathode dark. A longer value keeps its extra places.
 * A decimal is added only when the formatted value actually has one.
 */
export function nixieBank(formatted: string): NixieColumn[] {
  const parts = nixieColumns(formatted);
  const hasDollar = parts.some((part) => part.kind === "dollar");
  const digits = parts.filter((part) => part.kind === "digit");
  if (!hasDollar && digits.length === 0) return parts;

  const dotAt = parts.findIndex((part) => part.kind === "dot");
  const integer = dotAt === -1 ? digits : digits.filter((part) => parts.indexOf(part) < dotAt);
  const fraction = dotAt === -1 ? [] : digits.filter((part) => parts.indexOf(part) > dotAt);
  const places = Math.max(NIXIE_DIGIT_PLACES, integer.length);
  const columns: NixieColumn[] = [{ kind: "dollar", key: "dollar", lit: hasDollar }];

  for (let place = places; place >= 1; place -= 1) {
    if (place < places && place % 3 === 0) {
      columns.push({ kind: "comma", key: `comma-${place}`, lit: integer.length > place });
    }
    const source = integer[integer.length - place];
    columns.push({
      kind: "digit",
      key: `d-${place}`,
      digit: source?.digit ?? null,
      order: source?.order ?? 0,
    });
  }

  if (dotAt !== -1) {
    columns.push({ kind: "dot", key: "dot", lit: true });
    fraction.forEach((part, index) => {
      columns.push({
        kind: "digit",
        key: `f-${index + 1}`,
        digit: part.digit,
        order: part.order,
      });
    });
  }

  return columns;
}

/** Inside a digit tube, only the cathode for the current numeral is lit. */
export function litDigit(column: NixieColumn): number | null {
  return column.kind === "digit" ? column.digit : null;
}

/** A centered row keeps only the tubes the current value uses. */
export function nixieShows(column: NixieColumn): boolean {
  if (column.kind === "digit") return column.digit !== null;
  if (column.kind === "mark") return true;
  return column.lit;
}

export function nixieCentered(formatted: string): NixieColumn[] {
  return nixieBank(formatted).filter(nixieShows);
}

/** Tube width over height. The centered row keeps this shape while filling its window. */
export const NIXIE_TUBE_ASPECT = 0.375;

/** How many equal tubes fill a window of this width at the current tube height. */
export function nixieTubeCount(windowWidth: number, tubeHeight: number): number {
  if (!(windowWidth > 0) || !(tubeHeight > 0)) return NIXIE_DIGIT_PLACES + 6;
  return Math.max(1, Math.round(windowWidth / (tubeHeight * NIXIE_TUBE_ASPECT)));
}

/**
 * Park the value's characters in the middle of a fixed tube grid.
 * When the character count and the tube count have different parity, the
 * group sits half a tube left of center (one more dark tube on the right).
 * A value longer than the grid keeps every character.
 */
export function nixieSlots(formatted: string, tubeCount: number): NixieColumn[] {
  const needed = nixieCentered(formatted);
  const count = Math.max(1, Math.trunc(tubeCount) || 1, needed.length);
  const start = Math.floor((count - needed.length) / 2);
  return Array.from({ length: count }, (_, index) => {
    const source = index >= start && index < start + needed.length ? needed[index - start] : null;
    if (!source || source.kind !== "digit") {
      if (source) return { ...source, key: `slot-${index}` };
      return { kind: "digit" as const, key: `slot-${index}`, digit: null, order: 0 };
    }
    const place = Number(source.key.slice(2));
    return {
      ...source,
      key: `slot-${index}`,
      place: Number.isFinite(place) ? place : index,
    };
  });
}

/** The cathode a tube shows while the reels are spinning. Each place is offset. */
export function cyclingDigit(place: number, tick: number): number {
  const step = Math.trunc(tick) + Math.trunc(place);
  return ((step % 10) + 10) % 10;
}
