import { cylinderPose } from "@/lib/drum";
import { REEL_ITEM_HEIGHT } from "@/lib/metals";

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
export type StretchOrigin = {
  anchor: number;
  /** Set when the anchor is a real stop. */
  anchorIndex: number | null;
  lower: number;
  upper: number;
  lowerIndex: number;
  upperIndex: number;
  /** Set when the anchor sits between two real stops. */
  slot: number | null;
};

/** The real stops on either side of a pressed value, wrapping at the ends of the list. */
export function originFor(stops: readonly number[], value: number): StretchOrigin {
  const count = stops.length;
  const index = stops.indexOf(value);
  if (index >= 0) {
    const lowerIndex = (index - 1 + count) % count;
    const upperIndex = (index + 1) % count;
    return {
      anchor: value,
      anchorIndex: index,
      lower: stops[lowerIndex] ?? value,
      upper: stops[upperIndex] ?? value,
      lowerIndex,
      upperIndex,
      slot: null,
    };
  }
  let lowerIndex = -1;
  for (let i = 0; i < count; i += 1) {
    if ((stops[i] ?? Infinity) < value) lowerIndex = i;
  }
  const upperIndex = lowerIndex + 1;
  return {
    anchor: value,
    anchorIndex: null,
    lower: stops[lowerIndex] ?? value,
    upper: stops[upperIndex] ?? value,
    lowerIndex,
    upperIndex,
    slot: lowerIndex + 0.5,
  };
}

/** Whole numbers from the pressed value toward the stop on that side. */
export function sequenceFrom(origin: StretchOrigin, direction: StretchDirection): number[] {
  const toward = direction === "down" ? origin.lower : origin.upper;
  if (direction === "down" && toward >= origin.anchor) return [];
  if (direction === "up" && toward <= origin.anchor) return [];
  return gapIntegers(origin.anchor, toward);
}

export function stretchSequence(
  stops: readonly number[],
  index: number,
  direction: StretchDirection,
): number[] {
  const from = stops[index];
  if (from === undefined) return [];
  return sequenceFrom(originFor(stops, from), direction);
}

/**
 * Where a released in-between sits on the cylinder.
 * Real-stop coordinates stay put; the face is inserted just after the lower stop.
 */
export function projectGuest(position: number, guest: GuestCount): number {
  const lower = Math.floor(guest.slot);
  if (position <= lower) return position;
  if (position >= lower + 1) return position + 1;
  return lower + (position - lower) * 2;
}

/** Screen top of a cylinder face, in reel pixels. Offset 0 is the center row. */
export function faceTop(offset: number, itemHeight = REEL_ITEM_HEIGHT): number {
  const pose = cylinderPose(offset);
  return itemHeight * 1.5 + pose.shift * itemHeight - itemHeight / 2;
}

/**
 * Settled faces use the shared reel plate.
 * Stretch fills and clips belong only to the stretch overlay.
 */
export function settledPlateStyle(): null {
  return null;
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

/**
 * The pinned stop covers its whole row at full opacity.
 * An emerging count is clipped to the area outside that row, so the part
 * still behind the pin is hidden and the part in the center slot is solid.
 */
export function stretchRowClip(
  screenTop: number,
  itemHeight: number,
  direction: StretchDirection,
  role: StretchRole = "between",
): { opacity: 1; clipTop: number; clipBottom: number } {
  if (role !== "between") return { opacity: 1, clipTop: 0, clipBottom: 0 };
  const pinTop = direction === "down" ? 0 : itemHeight * 2;
  const pinBottom = pinTop + itemHeight;
  if (direction === "down") {
    return { opacity: 1, clipTop: Math.max(0, pinBottom - screenTop), clipBottom: 0 };
  }
  return { opacity: 1, clipTop: 0, clipBottom: Math.max(0, screenTop + itemHeight - pinTop) };
}

export type StretchRim = { edge: "top" | "bottom"; opacity: number };

/**
 * Ice-blue rim on the pinned count, along the edge the next number leaves.
 * Full strength as a reveal starts, gone once that number is fully in view.
 * A released stretch has no rim.
 */
export function stretchRim(
  direction: StretchDirection,
  travel: number,
  itemHeight: number,
): StretchRim {
  const edge = direction === "down" ? "bottom" : "top";
  if (!(itemHeight > 0) || travel < 0) return { edge, opacity: 0 };
  if (travel === 0) return { edge, opacity: 1 };
  const into = travel % itemHeight;
  const opacity = into === 0 ? 0 : 1 - into / itemHeight;
  return { edge, opacity };
}

export function activeStretchRim(
  stretching: boolean,
  direction: StretchDirection,
  travel: number,
  itemHeight: number,
): StretchRim | null {
  if (!stretching) return null;
  return stretchRim(direction, travel, itemHeight);
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
  _stops: readonly number[],
  guest: GuestCount | null,
): boolean {
  if (!guest) return false;
  const offset = Math.floor(guest.slot) + 1 - projectGuest(position, guest);
  const top = faceTop(offset);
  return top + REEL_ITEM_HEIGHT > 0 && top < REEL_ITEM_HEIGHT * 3;
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
