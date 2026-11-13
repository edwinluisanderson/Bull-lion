/** Long-press the selected count, then pull the gap open toward the next stop. */

export const STRETCH_HOLD_MS = 400;
export const STRETCH_SLOP_PX = 10;
export const STRETCH_RUBBER_PX = 36;
export const STRETCH_SLOT_PX = 48;

export type GestureMode = "pending" | "drag" | "stretch";

export function nextGestureMode(
  mode: GestureMode,
  elapsedMs: number,
  travelPx: number,
): GestureMode {
  if (mode !== "pending") return mode;
  if (travelPx > STRETCH_SLOP_PX) return "drag";
  if (elapsedMs >= STRETCH_HOLD_MS) return "stretch";
  return "pending";
}

/** The selected number sits in the middle third of the reel window. */
export function pressHitsCenter(localY: number, height: number): boolean {
  if (height <= 0) return false;
  const band = height / 3;
  return localY >= band && localY < band * 2;
}

/** Integers strictly between two stops, walking from `from` toward `to`. */
export function gapIntegers(from: number, to: number): number[] {
  if (to === from) return [];
  const step = to > from ? 1 : -1;
  const values: number[] = [];
  for (let value = from + step; value !== to; value += step) {
    values.push(value);
    if (values.length > 400) break;
  }
  return values;
}

/**
 * Detents from the stop after `index` through the next real stop.
 * Gray values are left out. A wrap (100 back to 1) has no integers between.
 */
export function stretchDetents(
  stops: readonly number[],
  index: number,
  direction: 1 | -1,
  isEnabled: (value: number) => boolean,
): number[] {
  const count = stops.length;
  const from = stops[index];
  if (count === 0 || from === undefined) return [];
  const next = stops[(index + direction + count) % count];
  if (next === undefined) return [];
  const wraps = direction === 1 ? next <= from : next >= from;
  const sequence = wraps ? [next] : [...gapIntegers(from, next), next];
  return sequence.filter((value) => isEnabled(value));
}

export type StretchMove = {
  committed: number[];
  active: number | null;
  rubber: boolean;
  handoff: boolean;
  openPx: number;
  remainderPx: number;
};

/**
 * `dy` grows as the finger moves down.
 * The first rubber band moves the art but commits nothing.
 * Each later slot commits the next detent. Landing on the real stop
 * hands off, and any extra travel is `remainderPx` for a normal drag.
 */
export function readStretch(
  dy: number,
  detents: readonly number[],
  terminal: number | null,
): StretchMove {
  const down = Math.max(0, dy);
  const resisted = Math.min(down, STRETCH_RUBBER_PX) * 0.35;
  if (down <= STRETCH_RUBBER_PX || detents.length === 0) {
    return {
      committed: [],
      active: null,
      rubber: true,
      handoff: false,
      openPx: resisted,
      remainderPx: 0,
    };
  }
  const past = down - STRETCH_RUBBER_PX;
  const reached = Math.min(detents.length, Math.floor(past / STRETCH_SLOT_PX) + 1);
  const committed = detents.slice(0, reached);
  const last = committed[committed.length - 1] ?? null;
  const handoff = terminal !== null && last === terminal && reached === detents.length;
  const shown = handoff ? Math.max(0, reached - 1) : reached;
  const remainderPx = handoff ? past - (detents.length - 1) * STRETCH_SLOT_PX : 0;
  return {
    committed,
    active: last,
    rubber: false,
    handoff,
    openPx: resisted + shown * STRETCH_SLOT_PX,
    remainderPx: Math.max(0, remainderPx),
  };
}

/** After the finger lifts, keep a valid in-between count or the nearest valid one. */
export function valueAfterRelease(
  anchor: number,
  active: number | null,
  stops: readonly number[],
  isEnabled: (value: number) => boolean,
): number {
  const value = active ?? anchor;
  if (isEnabled(value)) return value;
  if (stops.length === 0) return value;
  const min = Math.min(...stops);
  const max = Math.max(...stops);
  let best: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let candidate = min; candidate <= max; candidate += 1) {
    if (!isEnabled(candidate)) continue;
    const distance = Math.abs(candidate - value);
    if (distance < bestDistance || (distance === bestDistance && best !== null && candidate > best)) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best ?? max;
}

/** Normal drag continues down from the real stop the stretch just reached. */
export function handoffPosition(nextIndex: number, remainderPx: number, itemHeight: number): number {
  if (itemHeight <= 0) return nextIndex;
  return nextIndex - remainderPx / itemHeight;
}
