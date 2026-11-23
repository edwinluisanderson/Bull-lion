import { cylinderPose } from "@/lib/drum";
import { REEL_ITEM_HEIGHT } from "@/lib/metals";

/** Long-press a count, then pull. The near stop stays pinned; the pressed number moves with the finger. */

/** Release snap. Long enough to read as a mechanical ease, short of a second move. */
export const STRETCH_SNAP_MS = 110;

/**
 * Ease-out that passes the center by a little, then settles on it.
 * 0 and 1 are exact, so the face ends dead center.
 */
export function snapEase(progress: number): number {
  const t = Math.min(1, Math.max(0, progress));
  const overshoot = 0.85;
  const cubic = overshoot + 1;
  return 1 + cubic * (t - 1) ** 3 + overshoot * (t - 1) ** 2;
}

/** Position along a release snap. `center` is the integer slot of the chosen face. */
export function stretchSnap(from: number, center: number, progress: number): number {
  return from + (center - from) * snapEase(progress);
}

/** One landing cue per release. A second call in the same release stays quiet. */
export function stretchLandingGate(state: { played: boolean }): { state: { played: boolean }; play: boolean } {
  if (state.played) return { state, play: false };
  return { state: { played: true }, play: true };
}

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

/**
 * Whole numbers from the pressed value toward the stop on that side.
 * A custom `between` replaces the integer walk (the weight reel). Counts omit it.
 */
export function sequenceFrom(
  origin: StretchOrigin,
  direction: StretchDirection,
  between?: (anchor: number, toward: number, direction: StretchDirection) => number[],
): number[] {
  const toward = direction === "down" ? origin.lower : origin.upper;
  if (between) return between(origin.anchor, toward, direction);
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

/** Pixels the center face sits off the payline. An exact notch is 0. */
export function centerFaceOffset(position: number, itemHeight = REEL_ITEM_HEIGHT): number {
  if (!Number.isFinite(position) || !(itemHeight > 0)) return 0;
  const fraction = position - Math.floor(position);
  return faceTop(-fraction, itemHeight) + itemHeight / 2 - itemHeight * 1.5;
}

/** Snap a painted offset onto the device-pixel grid so a notch cannot sit a fraction off the bar. */
export function alignDevicePixel(value: number, devicePixelRatio = 1): number {
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.round(value * ratio) / ratio;
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

function emergedScreenTop(
  direction: StretchDirection,
  index: number,
  travel: number,
  itemHeight: number,
): number {
  const sign = direction === "down" ? 1 : -1;
  const anchorTop = itemHeight + sign * travel;
  return anchorTop - sign * (index + 1) * itemHeight;
}

/**
 * An in-between face is on screen when at least half its row is outside the pin.
 * A few pixels peeking past the pin is not a face the release should keep.
 */
export function betweenFaceVisible(
  screenTop: number,
  itemHeight: number,
  direction: StretchDirection,
): boolean {
  if (!(itemHeight > 0)) return false;
  if (screenTop >= itemHeight * 3 || screenTop + itemHeight <= 0) return false;
  const clip = stretchRowClip(screenTop, itemHeight, direction, "between");
  const visible = itemHeight - clip.clipTop - clip.clipBottom;
  return visible >= itemHeight / 2;
}

function rowOnScreen(screenTop: number, itemHeight: number): boolean {
  return screenTop < itemHeight * 3 && screenTop + itemHeight > 0;
}

/**
 * Faces the stretch is painting, top to bottom.
 * A neighbor that has left the window is absent.
 */
export function visibleStretchFaces(input: {
  direction: StretchDirection;
  origin: StretchOrigin;
  sequence: readonly number[];
  travel: number;
  itemHeight: number;
}): number[] {
  const { direction, origin, sequence, travel, itemHeight } = input;
  if (!(itemHeight > 0)) return [];
  const sign = direction === "down" ? 1 : -1;
  const anchorTop = itemHeight + sign * travel;
  const pushedTop = direction === "down" ? itemHeight * 2 + travel : -travel;
  const pushed = direction === "down" ? origin.upper : origin.lower;
  const painted: { value: number; top: number }[] = [];
  const pinTop = direction === "down" ? 0 : itemHeight * 2;
  if (rowOnScreen(pinTop, itemHeight)) painted.push({ value: direction === "down" ? origin.lower : origin.upper, top: pinTop });
  sequence.forEach((value, index) => {
    if (travel <= index * itemHeight) return;
    const top = emergedScreenTop(direction, index, travel, itemHeight);
    if (!betweenFaceVisible(top, itemHeight, direction)) return;
    painted.push({ value, top });
  });
  if (rowOnScreen(anchorTop, itemHeight)) painted.push({ value: origin.anchor, top: anchorTop });
  if (pushed !== origin.anchor && rowOnScreen(pushedTop, itemHeight)) painted.push({ value: pushed, top: pushedTop });
  painted.sort((a, b) => a.top - b.top || a.value - b.value);
  return painted.map((row) => row.value);
}

/**
 * Resting stretch whose pin, center, and pushed face are the ones already on screen.
 * Further travel still reveals the integers hidden behind the pin.
 */
export function originFromWindow(input: {
  above: number;
  center: number;
  below: number;
  insertAfter: number;
  upperIndex: number;
}): StretchOrigin {
  return {
    anchor: input.center,
    anchorIndex: null,
    lower: input.above,
    upper: input.below,
    lowerIndex: input.insertAfter,
    upperIndex: input.upperIndex,
    slot: null,
  };
}

/**
 * Keep the in-between faces that are on screen when the finger lets go.
 * The run is pin-side first, and `position` leaves the centered value centered.
 * Faces that have already left the window are not kept.
 */
export function releasePlacement(input: {
  direction: StretchDirection;
  origin: StretchOrigin;
  sequence: readonly number[];
  stops: readonly number[];
  travel: number;
  itemHeight: number;
  centered: number;
}): { position: number; center: number; guest: GuestCount } | null {
  const { direction, origin, sequence, stops, travel, itemHeight, centered } = input;
  if (!(itemHeight > 0)) return null;
  const sign = direction === "down" ? 1 : -1;
  const anchorTop = itemHeight + sign * travel;
  const painted = visibleStretchFaces({ direction, origin, sequence, travel, itemHeight });
  const permanent = (value: number) => stops.includes(value);
  const pushedValue = direction === "down" ? origin.upper : origin.lower;
  const pushedTop = direction === "down" ? itemHeight * 2 + travel : -travel;
  const pinValue = direction === "down" ? origin.lower : origin.upper;
  const pinTop = direction === "down" ? 0 : itemHeight * 2;
  const topOf = (value: number): number | null => {
    if (value === origin.anchor) return anchorTop;
    if (value === pushedValue) return pushedTop;
    if (value === pinValue) return pinTop;
    const index = sequence.indexOf(value);
    if (index >= 0) return emergedScreenTop(direction, index, travel, itemHeight);
    return null;
  };
  const centeredTop = topOf(centered) ?? anchorTop;
  // The pin stays the outer face. A number still coming out behind it is not
  // the neighbor yet, so release must not swap the pin for that next face.
  const run = painted.filter((value) => {
    if (permanent(value)) return false;
    if (value === centered) return true;
    const top = topOf(value);
    if (top == null) return false;
    return direction === "down" ? top >= centeredTop - 0.5 : top <= centeredTop + 0.5;
  });
  const at = run.indexOf(centered);
  if (at < 0 || run.length === 0) return null;
  const insertAfter = direction === "down" ? origin.lowerIndex : (origin.anchorIndex ?? origin.lowerIndex);
  if (insertAfter == null) return null;
  const payline = itemHeight * 1.5;
  const delta = (centeredTop + itemHeight / 2 - payline) / itemHeight;
  const center = insertAfter + 1 + at;
  return {
    position: center - delta,
    center,
    guest: {
      value: centered,
      slot: origin.slot ?? (direction === "down" ? origin.lowerIndex + 0.5 : insertAfter + 0.5),
      run,
      insertAfter,
    },
  };
}

/** The three cylinder faces around `position` after a guest run is inserted. */
export function guestWindow(stops: readonly number[], position: number, guest: GuestCount): number[] {
  const items = stops.slice();
  const at = (guest.insertAfter ?? Math.floor(guest.slot)) + 1;
  const run = guest.run?.length ? [...guest.run] : [guest.value];
  items.splice(at, 0, ...run);
  const center = Math.round(position);
  return [-1, 0, 1].map((delta) => {
    const index = center + delta;
    return items[((index % items.length) + items.length) % items.length] ?? items[0];
  });
}

/**
 * Nearest index of the faces on screen. Release snaps here and does not
 * step onward in the drag direction, and it does not wrap the index.
 */
export function releaseNotch(position: number): number {
  if (!Number.isFinite(position)) return 0;
  return Math.round(position);
}

/**
 * Main-list index of an unwrapped position.
 * A stretch that crosses 100 → 1 (or 1 → 100) keeps counting past the seam,
 * so three steps up from ×100 sit at index 10. That is the same face as
 * index 2. Folding whole revolutions maps it back; adding the seam again
 * would land two stops further on.
 */
export function canonicalNotch(position: number, count: number): number {
  if (!(count > 0) || !Number.isFinite(position)) return 0;
  const rounded = Math.round(position);
  return ((rounded % count) + count) % count;
}

/**
 * Slide a resting run when the visible faces are already consecutive.
 * The run stays; travel only changes which face is centered.
 */
export function rollGuestWindow(input: {
  position: number;
  guest: GuestCount;
  direction: StretchDirection;
  travel: number;
  itemHeight: number;
}): { position: number; guest: GuestCount } {
  return {
    position: input.position + handoffShift(input.direction, input.travel, input.itemHeight),
    guest: input.guest,
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

/** Lowest the stretch glow gets after the finger has started to move. */
export const STRETCH_RIM_FLOOR = 0.18;

export type StretchRim = { edge: "top" | "bottom"; opacity: number };

/**
 * Soft glow on the pinned count, along the edge the next number leaves.
 * A held press with no travel has none. The first movement lights it,
 * it eases toward a floor as that number comes into view, and a release removes it.
 */
export function stretchRim(
  direction: StretchDirection,
  travel: number,
  itemHeight: number,
): StretchRim {
  const edge = direction === "down" ? "bottom" : "top";
  if (!(itemHeight > 0) || !(travel > 0)) return { edge, opacity: 0 };
  const into = travel % itemHeight;
  const revealed = into === 0 ? 1 : into / itemHeight;
  const opacity = STRETCH_RIM_FLOOR + (1 - STRETCH_RIM_FLOOR) * (1 - revealed);
  return { edge, opacity };
}

export function activeStretchRim(
  stretching: boolean,
  direction: StretchDirection,
  travel: number,
  itemHeight: number,
): StretchRim | null {
  if (!stretching || !(travel > 0)) return null;
  return stretchRim(direction, travel, itemHeight);
}

export type CountRow = { slot: number; value: number };
export type GuestCount = {
  value: number;
  slot: number;
  /** Temporary rows in the gap, pin-side first. Includes `value`. */
  run?: readonly number[];
  /** Permanent index the run is inserted after. Position is then an index in that expanded list. */
  insertAfter?: number;
};

/**
 * Cylinder position when the stretch overlay hands off to the reel.
 * Every revealed temporary stays in the gap, pin-side first, so the row
 * that was centered stays centered. Further finger travel is the remainder.
 * An empty sequence keeps the old base and only applies that remainder.
 */
export function handoffPlacement(input: {
  direction: StretchDirection;
  anchorIndex: number;
  origin: StretchOrigin;
  sequence: readonly number[];
  stops: readonly number[];
  remainderPx: number;
  itemHeight: number;
}): { position: number; guest: GuestCount | null } {
  const shift = handoffShift(input.direction, input.remainderPx, input.itemHeight);
  const base = input.origin.slot ?? input.origin.anchorIndex ?? input.anchorIndex;
  const sequence = input.sequence;
  if (sequence.length === 0) {
    return { position: base + shift, guest: null };
  }
  const emerged = sequence[sequence.length - 1] ?? null;
  const permanent =
    emerged != null &&
    input.stops.some(
      (stop) => Math.abs(stop - emerged) <= 1e-6 * Math.max(1, Math.abs(stop), Math.abs(emerged)),
    );
  if (emerged == null || permanent) {
    const towardPin = input.direction === "down" ? -sequence.length : sequence.length;
    return { position: base + towardPin + shift, guest: null };
  }
  const insertAfter = input.direction === "down" ? input.origin.lowerIndex : (input.origin.anchorIndex ?? input.anchorIndex);
  const run = input.direction === "down" ? [...sequence].reverse() : [...sequence];
  const centeredIndex = input.direction === "down" ? insertAfter + 1 : insertAfter + sequence.length;
  const slot =
    input.origin.slot ??
    (input.direction === "down" ? input.origin.lowerIndex + 0.5 : insertAfter + 0.5);
  return {
    position: centeredIndex + shift,
    guest: { value: emerged, slot, run, insertAfter },
  };
}

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
