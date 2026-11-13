/** Long-press the selected count, then slide whole numbers out from behind the neighboring stop. */

export const STRETCH_HOLD_MS = 400;
export const STRETCH_SLOP_PX = 10;
export const STRETCH_SLOT_PX = 72;

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
 * Whole numbers between the pressed stop and its neighbor.
 * Down walks toward the stop above (the previous, lower count).
 * Up walks toward the stop below (the next, higher count).
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

export type SlidePlate = {
  value: number;
  /** Distance the plate has traveled out from the pinned stop. Frozen plates keep this. */
  offsetPx: number;
  reveal: number;
  frozen: boolean;
};

export type SlideReading = {
  direction: StretchDirection;
  frozen: SlidePlate[];
  sliding: SlidePlate | null;
  /** The one highlighted value. The newest number that has started to appear. */
  highlight: number;
  handoff: boolean;
  remainderPx: number;
};

/**
 * `distancePx` is how far the finger has pulled in `direction`.
 * Each slot slides one whole number out from behind the previous one.
 * After the last in-between number, further travel is `remainderPx` and the
 * original stop moves with the finger.
 */
export function readSlide(
  distancePx: number,
  direction: StretchDirection,
  sequence: readonly number[],
  anchor: number,
  slotPx = STRETCH_SLOT_PX,
): SlideReading {
  const distance = Math.max(0, distancePx);
  if (sequence.length === 0 || slotPx <= 0) {
    return {
      direction,
      frozen: [],
      sliding: null,
      highlight: anchor,
      handoff: distance > 0,
      remainderPx: distance,
    };
  }
  const frozen: SlidePlate[] = [];
  let sliding: SlidePlate | null = null;
  for (let index = 0; index < sequence.length; index += 1) {
    const into = distance - index * slotPx;
    if (into <= 0) break;
    const nextStarted = distance > (index + 1) * slotPx;
    const reveal = nextStarted ? 1 : Math.min(1, into / slotPx);
    const lastAndDone = index === sequence.length - 1 && into >= slotPx;
    const plate: SlidePlate = {
      value: sequence[index],
      offsetPx: (index + reveal) * slotPx,
      reveal,
      frozen: nextStarted || lastAndDone,
    };
    if (plate.frozen) frozen.push(plate);
    else sliding = plate;
  }
  const highlight = sliding?.value ?? frozen[frozen.length - 1]?.value ?? anchor;
  const handoff = distance >= sequence.length * slotPx;
  return {
    direction,
    frozen,
    sliding,
    highlight,
    handoff,
    remainderPx: handoff ? distance - sequence.length * slotPx : 0,
  };
}

/**
 * Keep the value under the finger. A gray count falls back to the nearest
 * real stop that is still allowed. Ties prefer the higher stop.
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

/** Extra travel after the in-between numbers, in reel stops. Down lowers the index. */
export function handoffShift(direction: StretchDirection, remainderPx: number, itemHeight: number): number {
  if (itemHeight <= 0) return 0;
  const stops = remainderPx / itemHeight;
  return direction === "down" ? -stops : stops;
}
