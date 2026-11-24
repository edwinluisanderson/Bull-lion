/**
 * Spot-price cascade for the My Stack boards.
 *
 * One visible board turns at a time, top to bottom. The next starts
 * CASCADE_STAGGER_MS after the one above it has landed. Unchanged boards are
 * skipped. The total is last. Off-screen boards snap with no wait. A later
 * price sends boards that have not started straight to the newest value. A
 * board already turning steers onto that newest value instead of finishing its
 * first target. Reduced motion snaps every board.
 */

export const CASCADE_STAGGER_MS = 150;

/** The amount row. Line ids never use this value. */
export const TOTAL_BOARD_ID = "stack-total";
/** The word row above the amount. It stays on TOTAL while the amount flips. */
export const TOTAL_WORD_ID = "stack-total-word";

export type CascadeStatus = "idle" | "pending" | "flipping";

export type CascadeBoard = {
  id: string;
  /** Text the spot price wants on the board right now. */
  live: string;
  visible: boolean;
};

export type CascadeSlot = {
  id: string;
  /** Text already given to the flaps, including an in-flight target. */
  committed: string;
  live: string;
  visible: boolean;
  status: CascadeStatus;
  /** When a pending board should start. Null otherwise. */
  startAt: number | null;
  /** False paints `committed` with no drum and no flap tick. */
  animate: boolean;
};

export type CascadeEffect =
  | { type: "cancel"; id: string }
  | { type: "schedule"; id: string; at: number }
  | { type: "commit"; id: string; value: string; animate: boolean };

export type CascadeStep = {
  slots: CascadeSlot[];
  effects: CascadeEffect[];
};

export function rectIntersectsViewport(
  rect: { top: number; left: number; bottom: number; right: number; width: number; height: number },
  viewport: { width: number; height: number },
): boolean {
  if (rect.width <= 0 || rect.height <= 0) return false;
  return rect.bottom > 0 && rect.right > 0 && rect.top < viewport.height && rect.left < viewport.width;
}

export function seedCascade(boards: readonly CascadeBoard[]): CascadeSlot[] {
  return boards.map((board) => ({
    id: board.id,
    committed: board.live,
    live: board.live,
    visible: board.visible,
    status: "idle",
    startAt: null,
    animate: true,
  }));
}

function commit(effects: CascadeEffect[], slot: CascadeSlot, animate: boolean) {
  effects.push({ type: "commit", id: slot.id, value: slot.live, animate });
  slot.committed = slot.live;
  slot.animate = animate;
  slot.status = animate ? "flipping" : "idle";
  slot.startAt = null;
}

function stillOwes(slot: CascadeSlot): boolean {
  return slot.visible && slot.committed !== slot.live && slot.status !== "flipping";
}

/** Park every visible board that still owes a flip. Timers wait until it is next. */
function holdQueue(slots: CascadeSlot[], effects: CascadeEffect[]) {
  const flipping = slots.some((slot) => slot.status === "flipping");
  for (const slot of slots) {
    if (slot.status === "flipping") continue;
    if (!stillOwes(slot)) {
      if (slot.status === "pending" || slot.startAt != null) {
        if (slot.startAt != null) effects.push({ type: "cancel", id: slot.id });
        slot.status = "idle";
        slot.startAt = null;
      }
      continue;
    }
    if (flipping && slot.startAt != null) {
      effects.push({ type: "cancel", id: slot.id });
      slot.startAt = null;
    }
    slot.status = "pending";
    slot.animate = true;
  }
}

/**
 * Start the next waiting board, and only that one.
 * `gap` waits CASCADE_STAGGER_MS after a landing. A snap has no gap.
 */
function releaseNext(slots: CascadeSlot[], effects: CascadeEffect[], now: number, gap: boolean) {
  if (slots.some((slot) => slot.status === "flipping")) return;
  const next = slots.find((slot) => stillOwes(slot));
  for (const slot of slots) {
    if (slot.startAt == null) continue;
    if (next && slot.id === next.id && gap) continue;
    effects.push({ type: "cancel", id: slot.id });
    slot.startAt = null;
  }
  if (!next) return;
  if (!gap) {
    commit(effects, next, true);
    return;
  }
  if (next.startAt != null) return;
  const at = now + CASCADE_STAGGER_MS;
  next.status = "pending";
  next.animate = true;
  next.startAt = at;
  effects.push({ type: "schedule", id: next.id, at });
}

function snapOffscreen(slots: CascadeSlot[], effects: CascadeEffect[]) {
  for (const slot of slots) {
    if (slot.visible) continue;
    const inFlight = slot.status !== "idle";
    if (!inFlight && slot.committed === slot.live) continue;
    if (slot.status === "pending") effects.push({ type: "cancel", id: slot.id });
    commit(effects, slot, false);
  }
}

/** The drum is already moving, so the newest text replaces the old target in that same turn. */
function retargetInFlight(slots: CascadeSlot[], effects: CascadeEffect[]) {
  for (const slot of slots) {
    if (slot.status !== "flipping" || !slot.visible) continue;
    if (slot.committed === slot.live) continue;
    effects.push({ type: "commit", id: slot.id, value: slot.live, animate: true });
    slot.committed = slot.live;
    slot.animate = true;
  }
}

function snapAll(slots: CascadeSlot[], effects: CascadeEffect[]) {
  for (const slot of slots) {
    if (slot.status === "pending") effects.push({ type: "cancel", id: slot.id });
    if (slot.status === "idle" && slot.committed === slot.live) continue;
    commit(effects, slot, false);
  }
}

/**
 * Apply a spot change.
 * `boards` is top to bottom, with the total last when the stack has cards.
 */
export function priceCascade(
  previous: readonly CascadeSlot[],
  boards: readonly CascadeBoard[],
  now: number,
  reduced: boolean,
): CascadeStep {
  const prior = new Map(previous.map((slot) => [slot.id, slot]));
  const effects: CascadeEffect[] = [];
  const slots: CascadeSlot[] = boards.map((board) => {
    const existing = prior.get(board.id);
    if (!existing) {
      return {
        id: board.id,
        committed: board.live,
        live: board.live,
        visible: board.visible,
        status: "idle" as const,
        startAt: null,
        animate: board.visible,
      };
    }
    return { ...existing, live: board.live, visible: board.visible };
  });

  for (const slot of previous) {
    if (!priorStillThere(boards, slot.id) && slot.status === "pending") {
      effects.push({ type: "cancel", id: slot.id });
    }
  }

  if (reduced) {
    snapAll(slots, effects);
    return { slots, effects };
  }

  // Off-screen work snaps. A board already turning on screen steers onto the newest text.
  snapOffscreen(slots, effects);
  retargetInFlight(slots, effects);
  holdQueue(slots, effects);
  releaseNext(slots, effects, now, false);
  return { slots, effects };
}

function priorStillThere(boards: readonly CascadeBoard[], id: string): boolean {
  return boards.some((board) => board.id === id);
}

/** A pending board's timer fired. Off-screen and reduced motion snap to the newest text. */
export function startCascade(
  previous: readonly CascadeSlot[],
  id: string,
  now: number,
  visible: boolean,
  reduced: boolean,
): CascadeStep {
  const slots = previous.map((slot) => ({ ...slot }));
  const effects: CascadeEffect[] = [];
  const slot = slots.find((entry) => entry.id === id);
  if (!slot || slot.status !== "pending") return { slots, effects };
  slot.visible = visible;
  if (reduced || !visible) {
    if (slot.committed !== slot.live) commit(effects, slot, false);
    else {
      slot.status = "idle";
      slot.startAt = null;
    }
    releaseNext(slots, effects, now, false);
    return { slots, effects };
  }
  if (slot.committed === slot.live) {
    slot.status = "idle";
    slot.startAt = null;
    releaseNext(slots, effects, now, false);
    return { slots, effects };
  }
  commit(effects, slot, true);
  return { slots, effects };
}

/**
 * An on-screen flip landed. The next visible board waits CASCADE_STAGGER_MS,
 * then starts. Boards still waiting keep the newest text for their one turn.
 */
export function settleCascade(
  previous: readonly CascadeSlot[],
  id: string,
  now: number,
  reduced: boolean,
  boards: readonly CascadeBoard[],
): CascadeStep {
  const slots = previous.map((slot) => ({ ...slot }));
  const effects: CascadeEffect[] = [];
  const slot = slots.find((entry) => entry.id === id);
  if (!slot || slot.status !== "flipping") return { slots, effects };

  const listed = new Map(boards.map((board) => [board.id, board]));
  for (const entry of slots) {
    const board = listed.get(entry.id);
    if (!board) continue;
    entry.live = board.live;
    entry.visible = board.visible;
  }
  slot.status = "idle";
  slot.startAt = null;

  if (reduced) {
    snapAll(slots, effects);
    return { slots, effects };
  }

  snapOffscreen(slots, effects);
  holdQueue(slots, effects);
  releaseNext(slots, effects, now, true);
  return { slots, effects };
}

/** Qty and weight edits. Not a spot cascade: idle boards adopt the new text together. */
export function syncCascadeLines(previous: readonly CascadeSlot[], boards: readonly CascadeBoard[]): CascadeStep {
  const prior = new Map(previous.map((slot) => [slot.id, slot]));
  const effects: CascadeEffect[] = [];
  const slots: CascadeSlot[] = boards.map((board) => {
    const existing = prior.get(board.id);
    if (!existing) {
      return {
        id: board.id,
        committed: board.live,
        live: board.live,
        visible: board.visible,
        status: "idle" as const,
        startAt: null,
        animate: board.visible,
      };
    }
    const slot: CascadeSlot = { ...existing, live: board.live, visible: board.visible };
    if (!slot.visible && (slot.status !== "idle" || slot.committed !== slot.live)) {
      if (slot.status === "pending") effects.push({ type: "cancel", id: slot.id });
      commit(effects, slot, false);
      return slot;
    }
    // A qty or weight edit is not a spot cascade. The flap still walks, then sits idle.
    if (slot.status === "idle" && slot.committed !== slot.live) {
      effects.push({ type: "commit", id: slot.id, value: slot.live, animate: true });
      slot.committed = slot.live;
      slot.animate = true;
    }
    return slot;
  });

  for (const slot of previous) {
    if (!priorStillThere(boards, slot.id) && slot.status === "pending") {
      effects.push({ type: "cancel", id: slot.id });
    }
  }
  return { slots, effects };
}
