export type PricePart =
  | { kind: "digit"; key: string; digit: number; order: number }
  | { kind: "mark"; key: string; char: string };

/**
 * Split a formatted price into stable parts.
 * Digits are keyed from the right, so "$0" and "$3,927" share the ones place.
 */
export function priceParts(formatted: string): PricePart[] {
  const pivot = formatted.indexOf(".");
  const parts: PricePart[] = [];
  let digitOrder = 0;

  for (let index = 0; index < formatted.length; index += 1) {
    const char = formatted[index] ?? "";
    if (char >= "0" && char <= "9") {
      const key =
        pivot === -1
          ? `d-${formatted.length - index}`
          : index < pivot
            ? `i-${pivot - index}`
            : `f-${index - pivot}`;
      parts.push({ kind: "digit", key, digit: Number(char), order: digitOrder });
      digitOrder += 1;
      continue;
    }

    const key =
      char === "."
        ? "dot"
        : char === "$"
          ? "dollar"
          : char === ","
            ? `comma-${pivot === -1 ? formatted.length - index : Math.abs(pivot - index)}`
            : `mark-${index}`;
    parts.push({ kind: "mark", key, char });
  }

  return parts;
}
