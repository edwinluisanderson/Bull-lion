/**
 * A stop only catches a scroll that comes to rest inside this many pixels.
 * 48px is inside the 40–60px band: wide enough to feel like a rubber band on a
 * phone, narrow enough that a normal flick on a tall desktop window breaks free.
 * A share of the viewport would grow on a tall window and start grabbing scrolls
 * that should stay put.
 */
export const SNAP_RADIUS_PX = 48;
/**
 * Two catches must be at least this far apart, or the later one is dropped.
 * Twice the capture radius means the 48px bands touch at the midpoint and never overlap,
 * so a resting scroll belongs to one stop. A share of the viewport would drop real plates
 * on a short phone and keep them on a tall window.
 */
export const SNAP_MIN_GAP_PX = SNAP_RADIUS_PX * 2;
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
 * Stops measured after layout. Anything closer than {@link SNAP_MIN_GAP_PX} to an
 * already-kept stop is dropped. The page top is kept first and the page bottom
 * last, so a crowded neighbor loses to those ends.
 */
export function snapStops(points: readonly number[], maxScroll: number, minGap = SNAP_MIN_GAP_PX): number[] {
  const limit = Math.max(0, maxScroll);
  const sorted = points.map((point) => Math.min(limit, Math.max(0, point))).sort((a, b) => a - b);
  const stops: number[] = [0];
  for (const point of sorted) {
    if (point <= 0 || point >= limit) continue;
    const last = stops[stops.length - 1] ?? 0;
    if (point - last < minGap) continue;
    if (limit - point < minGap) continue;
    stops.push(point);
  }
  if (limit > 0) stops.push(limit);
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
