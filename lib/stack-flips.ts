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
