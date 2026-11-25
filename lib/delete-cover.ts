/** How long the rows take to slide up over a deleted slot. */
export const COVER_SLIDE_MS = 520;
/**
 * The slide class is applied one frame after the transition is armed,
 * so the hold is a little longer than the CSS animation.
 */
export const COVER_FRAME_MS = 40;
/** Matches `.split-rows { gap: 8px }`. */
export const STACK_ROW_GAP_PX = 8;

export type CoverPhase = "shoot" | "slide";

export type DeleteCover = {
  id: string;
  index: number;
  phase: CoverPhase;
  /** How far the rows below travel: the slot plus the flex gap. */
  distance: number;
  /** Measured row height. The last slot collapses through this. */
  rowHeight: number;
  /**
   * Nothing sits below this row inside the list.
   * The slot collapses from the bottom instead of being covered by a card.
   */
  tail: boolean;
  /** The only card. The total collapses with the slot so the page does not jump. */
  solo: boolean;
  totalHeight: number;
};

export function coverDistance(rowHeight: number, gap = STACK_ROW_GAP_PX): number {
  const height = Number.isFinite(rowHeight) ? Math.max(0, rowHeight) : 0;
  return height + Math.max(0, gap);
}

export function coveringIndexes(count: number, remnantIndex: number): number[] {
  if (!Number.isInteger(count) || count < 1) return [];
  if (!Number.isInteger(remnantIndex) || remnantIndex < 0 || remnantIndex >= count) return [];
  return Array.from({ length: count - remnantIndex - 1 }, (_, offset) => remnantIndex + 1 + offset);
}

export function coverUsesTail(count: number, remnantIndex: number): boolean {
  return Number.isInteger(count) && count > 0 && remnantIndex === count - 1;
}

export function beginDeleteCover(
  id: string,
  index: number,
  count: number,
  rowHeight: number,
  totalHeight = 0,
): DeleteCover {
  const height = Number.isFinite(rowHeight) ? Math.max(0, rowHeight) : 0;
  const tail = coverUsesTail(count, index);
  return {
    id,
    index,
    phase: "shoot",
    distance: coverDistance(height),
    rowHeight: height,
    tail,
    solo: tail && count === 1,
    totalHeight: Number.isFinite(totalHeight) ? Math.max(0, totalHeight) : 0,
  };
}

/**
 * The shell stays through the shoot. The slide is what covers it.
 * Only the step after the slide removes it.
 */
export function advanceDeleteCover(cover: DeleteCover): DeleteCover | "remove" {
  if (cover.phase === "shoot") return { ...cover, phase: "slide" };
  return "remove";
}

export function isRemnantRow(cover: DeleteCover | null, id: string): boolean {
  return cover != null && cover.id === id;
}

/** Following cards cover the slot. A tail slot has no following card. */
export function isCoveringRow(cover: DeleteCover | null, index: number): boolean {
  if (!cover || cover.phase !== "slide" || cover.tail) return false;
  return index > cover.index;
}

/**
 * A last row that follows another row still owns a flex gap.
 * Pulling that gap closed as the height hits zero keeps the removal from jumping.
 * The only card in the list has no gap above it, so its margin stays put.
 */
export function collapseInset(tail: boolean, index: number, gap = STACK_ROW_GAP_PX): number {
  if (!tail || index <= 0) return 0;
  return gap;
}

/**
 * Only the row that is already shooting ignores a new swipe.
 * The cards below stay openable while that row is being covered.
 */
export function deleteRowLocked(
  shifting: boolean,
  blank: boolean,
  coverId: string | null,
  lineId: string | null,
): boolean {
  if (shifting || blank) return true;
  return coverId != null && lineId != null && coverId === lineId;
}

/**
 * Index keys reuse the deleted row's element for the card that slid into its slot.
 * That element still has the shoot-off transform. It must snap home, not transition,
 * or the card that just covered the hole flicks off to the side and back.
 * A new id in the same slot, or leaving ending, both mean the shoot-off is over.
 */
export function reusedSlotMustSnap(
  previousId: string | null,
  nextId: string,
  wasLeaving: boolean,
  leaving: boolean,
): boolean {
  if (wasLeaving && !leaving) return true;
  return previousId != null && previousId !== nextId;
}

/**
 * The empty plate is winched up behind whatever sits above it.
 * The top card goes behind the name plate. Any other card goes behind the card above.
 */
export function plateReelsBehind(index: number): "nameplate" | "card" {
  return index <= 0 ? "nameplate" : "card";
}

/** The plate is fully hidden once it has been pulled up by its own height. */
export function plateHidden(lift: number, rowHeight: number): boolean {
  if (!Number.isFinite(lift) || !Number.isFinite(rowHeight) || rowHeight <= 0) return false;
  return lift >= rowHeight;
}

/** One waiting delete. It starts after the active row is actually removed. */
export function queuedCoverId(activeId: string, queuedId: string | null): string | null {
  if (!queuedId || queuedId === activeId) return null;
  return queuedId;
}
