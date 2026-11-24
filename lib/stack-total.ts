import { formatWholeDollars } from "@/lib/format";
import {
  FLAP_TOTAL_COLUMNS,
  FLAP_TOTAL_WORD_COLUMNS,
  fitFlapMoney,
  flapText,
} from "@/lib/split-flap";

export const TOTAL_WORD = "TOTAL";
export const STACK_EMPTY_MESSAGE = "Let's get stacking!";

export type TotalCopy = {
  top: string;
  bottom: string;
  topWidth: number;
  bottomWidth: number;
};

/** Put as many leading words as fit on the top row. The rest land on the bottom. */
export function splitFlapRows(
  message: string,
  topColumns: number,
  bottomColumns: number,
): { top: string; bottom: string } {
  const words = flapText(message).split(" ").filter((word) => word.length > 0);
  if (words.length === 0 || topColumns < 1 || bottomColumns < 1) return { top: "", bottom: "" };
  const top: string[] = [];
  let index = 0;
  while (index < words.length) {
    const next = top.length === 0 ? words[index] : `${top.join(" ")} ${words[index]}`;
    if ([...next].length > topColumns) break;
    top.push(words[index] ?? "");
    index += 1;
  }
  if (top.length === 0) {
    top.push([...(words[0] ?? "")].slice(0, topColumns).join(""));
    index = 1;
  }
  const rest = words.slice(index).join(" ");
  return { top: top.join(" "), bottom: [...rest].slice(0, bottomColumns).join("") };
}

function centerFlap(text: string, width: number): string {
  const clean = flapText(text).slice(0, width);
  const pad = Math.max(0, width - [...clean].length);
  const left = Math.floor(pad / 2);
  return `${" ".repeat(left)}${clean}${" ".repeat(pad - left)}`;
}

/**
 * Currency with cents. Whole dollars come from the shared formatter, then the cents join on.
 * Negative totals keep the sign in front of the dollar mark.
 */
export function formatTotalAmount(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  const rounded = Math.round(value * 100) / 100;
  const negative = rounded < 0;
  const absolute = Math.abs(rounded);
  const dollars = Math.trunc(absolute);
  const cents = Math.round((absolute - dollars) * 100);
  const body = `${formatWholeDollars(dollars)}.${String(cents).padStart(2, "0")}`;
  return negative ? `-${body}` : body;
}

/** The two rows hanging under My Stack. Empty stacks keep the invitation. */
export function totalBoardCopy(lineCount: number, amount: string): TotalCopy {
  if (lineCount <= 0) {
    const rows = splitFlapRows(STACK_EMPTY_MESSAGE, FLAP_TOTAL_WORD_COLUMNS, FLAP_TOTAL_COLUMNS);
    return {
      top: rows.top,
      bottom: centerFlap(rows.bottom, FLAP_TOTAL_COLUMNS),
      topWidth: Math.max(1, [...rows.top].length),
      bottomWidth: FLAP_TOTAL_COLUMNS,
    };
  }
  return {
    top: TOTAL_WORD,
    bottom: fitFlapMoney(amount, FLAP_TOTAL_COLUMNS),
    topWidth: [...TOTAL_WORD].length,
    bottomWidth: FLAP_TOTAL_COLUMNS,
  };
}
