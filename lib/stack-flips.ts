import { rectIntersectsViewport } from "@/lib/stack-cascade";

/**
 * A card flips only when its own displayed fields change.
 * A new id flips in. A card that keeps its fields does not, even if its place in the list moves.
 * Removed ids are gone; they do not make the cards below them flip.
 */
export type FlapBoard = {
  id: string;
  fields: readonly string[];
};

function fieldKey(fields: readonly string[]): string {
  return fields.join("\u0000");
}

export function boardsThatFlip(before: readonly FlapBoard[], after: readonly FlapBoard[]): string[] {
  const prior = new Map(before.map((board) => [board.id, fieldKey(board.fields)]));
  return after.filter((board) => prior.get(board.id) !== fieldKey(board.fields)).map((board) => board.id);
}

/**
 * A card that just appeared flips in from blank unless its box is already
 * outside the viewport. A missing or not-yet-laid-out box is not off-screen.
 */
export function freshCardSnaps(
  rect: { top: number; left: number; bottom: number; right: number; width: number; height: number } | null,
  viewport: { width: number; height: number } | null,
): boolean {
  if (!rect || !viewport || rect.width <= 0 || rect.height <= 0) return false;
  return !rectIntersectsViewport(rect, viewport);
}
