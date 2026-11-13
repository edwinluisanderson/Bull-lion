/** Long-press a count, then pull. The near stop stays pinned; the pressed number moves with the finger. */

export const STRETCH_HOLD_MS = 400;
export const STRETCH_SLOP_PX = 10;

export type GestureMode = "pending" | "drag" | "stretch";
export type StretchDirection = "down" | "up";

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
 * Whole numbers between the pressed stop and the one it is stretching toward.
 * Down walks toward the stop above. Up walks toward the stop below.
 * A wrap, or two adjacent stops, has nothing to slide out.
 */
export function stretchSequence(
  stops: readonly number[],
  index: number,
  direction: StretchDirection,
): number[] {
  const count = stops.length;
  const from = stops[index];
  if (count === 0 || from === undefined) return [];
  const neighborIndex = direction === "down" ? index - 1 : index + 1;
  const neighbor = stops[(neighborIndex + count) % count];
  if (neighbor === undefined) return [];
  if (direction === "down" && neighbor >= from) return [];
  if (direction === "up" && neighbor <= from) return [];
  return gapIntegers(from, neighbor);
}

export type StretchRole = "pin" | "between" | "anchor" | "pushed";

export type StretchRow = {
  value: number;
  screenTop: number;
  role: StretchRole;
  centered: boolean;
};

export type StretchLayout = {
  rows: StretchRow[];
  centered: number;
  handoff: boolean;
  remainderPx: number;
};

/**
 * Flat three-row window. `travel` is how far the finger has pulled.
 * The pin does not move. The pressed number and the far stop move with it.
 * In-between counts slide out from behind the pin, one row at a time.
 * The highlighted value is whichever row contains the center line.
 * After the last in-between has reached that line, further travel is a normal drag.
 */
export function stretchLayout(input: {
  direction: StretchDirection;
  anchor: number;
  pin: number;
  pushed: number;
  sequence: readonly number[];
  travel: number;
  itemHeight: number;
}): StretchLayout {
  const { direction, anchor, pin, pushed, sequence, itemHeight } = input;
  const travel = Math.max(0, input.travel);
  const sign = direction === "down" ? 1 : -1;
  const pinTop = direction === "down" ? 0 : itemHeight * 2;
  const anchorTop = itemHeight + sign * travel;
  const pushedTop = direction === "down" ? itemHeight * 2 + travel : -travel;
  const payline = itemHeight * 1.5;
  const handoff = sequence.length === 0 ? travel > 0 : travel >= sequence.length * itemHeight;
  const remainderPx = sequence.length === 0 ? travel : Math.max(0, travel - sequence.length * itemHeight);

  const rows: Omit<StretchRow, "centered">[] = [
    { value: pin, screenTop: pinTop, role: "pin" },
    { value: anchor, screenTop: anchorTop, role: "anchor" },
    { value: pushed, screenTop: pushedTop, role: "pushed" },
  ];
  sequence.forEach((value, index) => {
    if (travel <= index * itemHeight) return;
    const screenTop = anchorTop - sign * (index + 1) * itemHeight;
    if (screenTop >= itemHeight * 3 || screenTop + itemHeight <= 0) return;
    rows.push({ value, screenTop, role: "between" });
  });

  let centeredIndex = 0;
  let best = Number.POSITIVE_INFINITY;
  rows.forEach((row, index) => {
    const center = row.screenTop + itemHeight / 2;
    const distance = Math.abs(center - payline);
    const contains = row.screenTop <= payline && payline < row.screenTop + itemHeight;
    const score = contains ? distance : distance + itemHeight;
    if (score < best) {
      best = score;
      centeredIndex = index;
    }
  });
  const laid = rows.map((row, index) => ({ ...row, centered: index === centeredIndex }));
  return {
    rows: laid,
    centered: laid[centeredIndex]?.value ?? anchor,
    handoff,
    remainderPx,
  };
}

/** Extra travel once the in-betweens are done. Down moves the reel toward lower indexes. */
export function handoffShift(direction: StretchDirection, remainderPx: number, itemHeight: number): number {
  if (itemHeight <= 0) return 0;
  const stops = remainderPx / itemHeight;
  return direction === "down" ? -stops : stops;
}

export type CountRow = { slot: number; value: number };
export type GuestCount = { value: number; slot: number };

/** Real stops, plus at most one temporary count inserted between them. */
export function countRows(stops: readonly number[], guest: GuestCount | null): CountRow[] {
  const rows = stops.map((value, index) => ({ slot: index, value }));
  if (guest) rows.push({ slot: guest.slot, value: guest.value });
  rows.sort((a, b) => a.slot - b.slot || a.value - b.value);
  return rows;
}

/** The top, center, and bottom numbers for the current scroll position. */
export function visibleTriple(position: number, rows: readonly CountRow[]): number[] {
  if (rows.length === 0) return [];
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  rows.forEach((row, index) => {
    const distance = Math.abs(row.slot - position);
    const realTie = distance === bestDistance && Number.isInteger(row.slot) && !Number.isInteger(rows[best]?.slot);
    if (distance < bestDistance || realTie) {
      best = index;
      bestDistance = distance;
    }
  });
  return [-1, 0, 1].map((delta) => rows[(best + delta + rows.length) % rows.length]?.value ?? rows[best].value);
}

export function guestStillVisible(
  position: number,
  stops: readonly number[],
  guest: GuestCount | null,
): boolean {
  if (!guest) return false;
  return visibleTriple(position, countRows(stops, guest)).includes(guest.value);
}

/**
 * Keep a valid centered count. A gray one falls back to the nearest real stop.
 * Ties prefer the higher stop.
 */
export function valueAfterRelease(
  anchor: number,
  ended: number | null,
  stops: readonly number[],
  isEnabled: (value: number) => boolean,
): number {
  const value = ended ?? anchor;
  if (isEnabled(value)) return value;
  let best: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const stop of stops) {
    if (!isEnabled(stop)) continue;
    const distance = Math.abs(stop - value);
    if (distance < bestDistance || (distance === bestDistance && best !== null && stop > best)) {
      best = stop;
      bestDistance = distance;
    }
  }
  return best ?? anchor;
}
