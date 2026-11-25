import { formatWholeDollars } from "@/lib/format";
import { meltValue } from "@/lib/value";

export const STACK_STORAGE_KEY = "bull-lion-stack";

export type StackLine = {
  id: string;
  symbol: string;
  /** Short mark painted on the metal flaps, such as AU. */
  mark: string;
  /** Weight label painted on the flaps, such as "1 oz". */
  weightLabel: string;
  grams: number;
  qty: number;
  description: string;
};

export type StackDraft = {
  symbol: string;
  mark: string;
  weightLabel: string;
  grams: number;
  qty: number;
  description: string;
};

export type AddProposal =
  | { status: "added"; lines: StackLine[] }
  | { status: "needs-choice"; lines: StackLine[]; matchId: string };

/** Metal plus weight when it fits the flaps. A long pair keeps the metal name. */
export function defaultLineDescription(metalName: string, weightLabel: string, width = 12): string {
  const full = `${metalName} ${weightLabel}`.replace(/\s+/g, " ").trim();
  if ([...full].length <= width) return full;
  const name = metalName.trim();
  return [...name].length <= width ? name : [...name].slice(0, width).join("");
}

export function createLineId(): string {
  return `line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sameWeight(left: number, right: number): boolean {
  return Math.abs(left - right) < 1e-6;
}

function lineFrom(draft: StackDraft, id: string): StackLine {
  return {
    id,
    symbol: draft.symbol,
    mark: draft.mark,
    weightLabel: draft.weightLabel,
    grams: draft.grams,
    qty: Math.max(1, Math.round(draft.qty)),
    description: draft.description.trim() || defaultLineDescription(draft.mark, draft.weightLabel),
  };
}

export function matchingLine(lines: readonly StackLine[], draft: Pick<StackDraft, "symbol" | "grams">): StackLine | undefined {
  return lines.find((line) => line.symbol === draft.symbol && sameWeight(line.grams, draft.grams));
}

/**
 * A new line always joins the top as its own card.
 * The same metal and weight do not merge, and ounce cards are not mixed into gram cards.
 */
export function proposeAdd(lines: readonly StackLine[], draft: StackDraft, newId = createLineId()): AddProposal {
  return { status: "added", lines: [lineFrom(draft, newId), ...lines] };
}

export function resolveAdd(
  lines: readonly StackLine[],
  draft: StackDraft,
  choice: "combine" | "separate",
  newId = createLineId(),
): StackLine[] {
  void choice;
  return [lineFrom(draft, newId), ...lines];
}

/** One face in the downward cascade. Null is the blank brass card. */
export type StackFace = StackLine | null;

/** How long each slot waits before the next card up starts flipping. */
export const STACK_CASCADE_MS = 340;

/**
 * Newest line lands on top. Frame 0 adds a blank card at the bottom.
 * Each later frame copies the card above into the lowest slot that has not
 * yet moved, so the bottom entry flips down first. The last frame puts the
 * new line in the top card.
 */
export function insertCascade(existing: readonly StackLine[], incoming: StackLine): StackFace[][] {
  const frames: StackFace[][] = [];
  let current: StackFace[] = [...existing, null];
  frames.push(current);
  for (let dest = existing.length; dest >= 1; dest -= 1) {
    const next = current.slice();
    next[dest] = current[dest - 1] ?? null;
    current = next;
    frames.push(current);
  }
  const landed = current.slice();
  landed[0] = incoming;
  frames.push(landed);
  return frames;
}

export function removeLine(lines: readonly StackLine[], id: string): StackLine[] {
  return lines.filter((line) => line.id !== id);
}

/** TEMP_CLEAR_ALL: drop every card. Remove with the scrap-plate button. */
export const TEMP_CLEAR_ALL = true;
export const CLEAR_STACK_EVENT = "bull-lion-clear-stack";

export function clearAllLines(): StackLine[] {
  return [];
}

export function renameLine(lines: readonly StackLine[], id: string, description: string): StackLine[] {
  const next = description.trim();
  if (!next) return [...lines];
  return lines.map((line) => (line.id === id ? { ...line, description: next } : line));
}

export function rowMelt(usdPerTroyOz: number | null, grams: number, qty: number): number | null {
  if (usdPerTroyOz == null || !Number.isFinite(usdPerTroyOz)) return null;
  return meltValue(usdPerTroyOz, grams, qty);
}

/** Sum of the rows that have a live price. Null when the board is empty. */
export function grandTotal(melts: readonly (number | null)[]): number | null {
  if (melts.length === 0) return null;
  return melts.reduce<number>((sum, melt) => sum + (melt == null ? 0 : Math.round(melt)), 0);
}

export function flapMoney(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return formatWholeDollars(value);
}

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function isLine(value: unknown): value is StackLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Partial<StackLine>;
  return (
    typeof line.id === "string" &&
    line.id.length > 0 &&
    typeof line.symbol === "string" &&
    line.symbol.length > 0 &&
    typeof line.mark === "string" &&
    typeof line.weightLabel === "string" &&
    typeof line.grams === "number" &&
    Number.isFinite(line.grams) &&
    line.grams > 0 &&
    typeof line.qty === "number" &&
    Number.isFinite(line.qty) &&
    line.qty > 0 &&
    typeof line.description === "string"
  );
}

export function parseStack(raw: string | null): StackLine[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLine).map((line) => ({ ...line, qty: Math.round(line.qty) }));
  } catch {
    return [];
  }
}

export function readStack(storage: StorageLike): StackLine[] {
  try {
    return parseStack(storage.getItem(STACK_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function writeStack(storage: StorageLike, lines: readonly StackLine[]): void {
  storage.setItem(STACK_STORAGE_KEY, JSON.stringify(lines));
}
