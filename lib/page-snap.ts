/**
 * A stop only catches a scroll that comes to rest inside this many pixels.
 * 48px is inside the 40–60px band: wide enough to feel like a rubber band on a
 * phone, narrow enough that a normal flick on a tall desktop window breaks free.
 * A share of the viewport would grow on a tall window and start grabbing scrolls
 * that should stay put.
 */
export const SNAP_RADIUS_PX = 48;
/** Already on the stop. Don't start another spring. */
export const SNAP_SLOP_PX = 8;

export type SnapSettle = {
  scrollTop: number;
  maxScroll: number;
  /** Document offsets that can catch, including the top and the bottom. */
  points: readonly number[];
  reduced: boolean;
};

/**
 * Clamp catches into the scroll range. Stops closer than the capture radius
 * become one stop, so the page top and the main plate (about 20px apart) are
 * a single rubber band instead of two detents.
 */
export function snapStops(points: readonly number[], maxScroll: number, mergePx = SNAP_RADIUS_PX): number[] {
  const limit = Math.max(0, maxScroll);
  const sorted = points
    .map((point) => Math.min(limit, Math.max(0, point)))
    .sort((a, b) => a - b);
  const stops: number[] = [];
  for (const point of sorted) {
    const last = stops[stops.length - 1];
    if (last === undefined || point - last > mergePx) stops.push(point);
  }
  if (stops.length === 0 || stops[0] > mergePx) stops.unshift(0);
  else stops[0] = 0;
  const end = stops[stops.length - 1];
  if (end === undefined || limit - end > mergePx) stops.push(limit);
  else stops[stops.length - 1] = limit;
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
