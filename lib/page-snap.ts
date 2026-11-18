/**
 * A stop only catches a scroll that comes to rest inside this many pixels.
 * 48px is inside the 40–60px band: wide enough to feel like a rubber band on a
 * phone, narrow enough that a normal flick on a tall desktop window breaks free.
 * A share of the viewport would grow on a tall window and start grabbing scrolls
 * that should stay put.
 */
export const SNAP_RADIUS_PX = 48;
/**
 * Optional stops must be at least this far from a stop already kept.
 * Twice the capture radius means the 48px bands touch at the midpoint and never overlap.
 * Always-stops are not dropped when they land closer than this.
 */
export const SNAP_MIN_GAP_PX = SNAP_RADIUS_PX * 2;
/** Already on the stop. Don't start another spring. */
export const SNAP_SLOP_PX = 8;

/** Page top, melt plate, wheel window, and page bottom are never removed. */
export const ALWAYS_SNAP_NAMES = ["top", "melt", "wheels", "bottom"] as const;

export type SnapMark = {
  at: number;
  always: boolean;
};

export type SnapSettle = {
  scrollTop: number;
  maxScroll: number;
  points: readonly SnapMark[];
  reduced: boolean;
};

/**
 * Stops measured after layout.
 * Always-stops are kept even when they sit closer than {@link SNAP_MIN_GAP_PX}.
 * If two of them land on the same scroll offset they are one stop.
 * An optional stop, such as My Stack, is kept only when it clears that gap
 * from every stop already kept, including the page bottom.
 */
export function snapStops(points: readonly SnapMark[], maxScroll: number, minGap = SNAP_MIN_GAP_PX): number[] {
  const limit = Math.max(0, maxScroll);
  const clamp = (point: number) => Math.min(limit, Math.max(0, point));
  const always: number[] = [0, limit];
  const optional: number[] = [];
  for (const point of points) {
    const at = clamp(point.at);
    if (point.always) always.push(at);
    else optional.push(at);
  }
  const stops: number[] = [];
  for (const at of always.sort((a, b) => a - b)) {
    const last = stops[stops.length - 1];
    if (last !== undefined && Math.abs(at - last) <= 0.5) continue;
    stops.push(at);
  }
  for (const at of optional.sort((a, b) => a - b)) {
    if (stops.every((stop) => Math.abs(stop - at) >= minGap)) stops.push(at);
  }
  stops.sort((a, b) => a - b);
  return stops;
}

/**
 * The stop to spring back to, or null when the page should stay exactly where it landed.
 * Only a rest inside the capture radius is caught. Past that, scrolling is left alone.
 * Reduced motion never moves the scroll.
 */
export function settleSnap(input: SnapSettle): number | null {
  if (input.reduced) return null;
  const limit = Math.max(0, input.maxScroll);
  const y = Math.min(limit, Math.max(0, input.scrollTop));
  const stops = snapStops(input.points, limit);
  let nearest = stops[0] ?? 0;
  let best = Math.abs(y - nearest);
  for (const stop of stops) {
    const distance = Math.abs(y - stop);
    if (distance < best) {
      nearest = stop;
      best = distance;
    }
  }
  if (best <= SNAP_SLOP_PX) return null;
  if (best <= SNAP_RADIUS_PX) return nearest;
  return null;
}
