import { formatWholeDollars } from "@/lib/format";
import { presentMoney } from "@/lib/melt-abbrev";
import {
  FLAP_TOTAL_COLUMNS,
  FLAP_TOTAL_WORD_COLUMNS,
  flapText,
  padFlap,
  rightFlap,
} from "@/lib/split-flap";

export const TOTAL_WORD = "TOTAL";
export const STACK_EMPTY_MESSAGE = "Let's get stacking!";

export type TotalCopy = {
  top: string;
  bottom: string;
  topWidth: number;
  bottomWidth: number;
  /** The amount row is abbreviated. The exact whole dollars stay on `exact`. */
  rounded: boolean;
  exact: string;
};

function centerFlap(text: string, width: number): string {
  const clean = flapText(text).slice(0, width);
  const pad = Math.max(0, width - [...clean].length);
  const left = Math.floor(pad / 2);
  return `${" ".repeat(left)}${clean}${" ".repeat(pad - left)}`;
}

/** Whole dollars. Cents never reach a flap. */
export function formatTotalAmount(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return formatWholeDollars(value);
}

/**
 * Two full rows. With cards, TOTAL sits on the left and the amount on the right.
 * An empty stack centers the invitation, one line on each row.
 */
export function totalBoardCopy(lineCount: number, amount: string): TotalCopy {
  if (lineCount <= 0) {
    return {
      top: centerFlap("LET'S GET", FLAP_TOTAL_WORD_COLUMNS),
      bottom: centerFlap("STACKING!", FLAP_TOTAL_COLUMNS),
      topWidth: FLAP_TOTAL_WORD_COLUMNS,
      bottomWidth: FLAP_TOTAL_COLUMNS,
      rounded: false,
      exact: "",
    };
  }
  const numeric = Number(String(amount).replace(/[^0-9.-]/g, ""));
  const money = presentMoney(Number.isFinite(numeric) ? numeric : null, FLAP_TOTAL_COLUMNS);
  return {
    top: padFlap(TOTAL_WORD, FLAP_TOTAL_WORD_COLUMNS),
    bottom: rightFlap(money.text, FLAP_TOTAL_COLUMNS),
    topWidth: FLAP_TOTAL_WORD_COLUMNS,
    bottomWidth: FLAP_TOTAL_COLUMNS,
    rounded: money.rounded,
    exact: money.exact,
  };
}
