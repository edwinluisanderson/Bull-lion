/** How far toward the next catch you must travel before it holds. */
export const SNAP_COMMIT = 0.45;
/** A gap taller than this share of the screen is read freely in the middle. */
export const SNAP_TALL_VIEWPORTS = 0.92;
/** Near a catch inside a tall gap, still stick. Capped so the two edges never meet. */
export const SNAP_EDGE_VIEWPORT = 0.16;
export const SNAP_EDGE_CAP_PX = 96;
export const SNAP_SLOP_PX = 8;
export const SNAP_MERGE_PX = 2;

export type SnapSettle = {
  scrollTop: number;
  maxScroll: number;
  /** Document offsets that catch, including the top and the bottom when wanted. */
  points: readonly number[];
  viewport: number;
  reduced: boolean;
};

/** Clamp every catch into the scroll range and drop ones that land on each other. */
export function snapStops(points: readonly number[], maxScroll: number, mergePx = SNAP_MERGE_PX): number[] {
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
  const end = stops[stops.length - 1];
  if (end === undefined || limit - end > mergePx) stops.push(limit);
  return stops;
}

/**
 * Where a settled scroll should rest.
 * Short gaps pull back until the push passes the commit line, then catch the next plate.
 * A gap taller than the screen leaves the middle alone so that section can be read.
 * Reduced motion never moves the scroll.
 * Returns null when the page should stay where it is.
 */
export function settleSnap(input: SnapSettle): number | null {
  if (input.reduced) return null;
  const limit = Math.max(0, input.maxScroll);
  const y = Math.min(limit, Math.max(0, input.scrollTop));
  const stops = snapStops(input.points, limit);
  let prev = stops[0] ?? 0;
  let next = stops[stops.length - 1] ?? limit;
  for (const stop of stops) {
    if (stop <= y) prev = stop;
    if (stop >= y) {
      next = stop;
      break;
    }
  }
  if (Math.abs(y - prev) <= SNAP_SLOP_PX || Math.abs(y - next) <= SNAP_SLOP_PX) return null;
  const gap = next - prev;
  if (gap <= SNAP_SLOP_PX) return null;
  const viewport = Math.max(1, input.viewport);
  if (gap > viewport * SNAP_TALL_VIEWPORTS) {
    const edge = Math.min(SNAP_EDGE_CAP_PX, viewport * SNAP_EDGE_VIEWPORT, gap / 2 - 1);
    if (y - prev <= edge) return prev;
    if (next - y <= edge) return next;
    return null;
  }
  const progress = (y - prev) / gap;
  return progress < SNAP_COMMIT ? prev : next;
}
