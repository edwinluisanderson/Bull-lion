/**
 * Magnetic field around a stop, in pixels.
 * A scroll that comes to rest inside this distance is drawn onto the stop.
 * At this distance and beyond, the page stays exactly where it was left.
 * A fixed pixel radius, not a share of the viewport: a tall window must not
 * start grabbing scrolls that should stay put.
 */
export const SNAP_RADIUS_PX = 100;
/**
 * Optional stops must be at least this far from a stop already kept.
 * Twice the field radius: the 100px zones meet at a single point where the
 * pull is already zero, so two fields never both claim the same resting
 * position. Always-stops are not dropped when a short screen packs them closer.
 */
export const SNAP_MIN_GAP_PX = SNAP_RADIUS_PX * 2;
/** Already on the stop. Don't start another ease. */
export const SNAP_SLOP_PX = 8;
/**
 * How long the ease takes at full strength (right on the stop) and at a
 * strength that has only just cleared zero (the rim of the field).
 */
export const GLIDE_MS_NEAR = 280;
export const GLIDE_MS_FAR = 1200;

/** Page top, melt plate, wheel window, and page bottom are never removed. */
export const ALWAYS_SNAP_NAMES = ["top", "melt", "wheels", "bottom"] as const;

export type SnapMark = {
  at: number;
  always: boolean;
  name?: string;
};

export type SnapSettle = {
  scrollTop: number;
  maxScroll: number;
  points: readonly SnapMark[];
  reduced: boolean;
};

export type MagneticPull = {
  target: number;
  distance: number;
  strength: number;
  name: string;
};

type Stop = {
  at: number;
  name: string;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function clampScroll(point: number, limit: number): number {
  return Math.min(limit, Math.max(0, point));
}

/**
 * Smoothstep falloff. `t` is distance / radius, and strength is `1 - (3t² - 2t³)`.
 * The slope is zero at the stop, so a hard pull does not give way in the first
 * few pixels, and zero again at the radius, so the field fades out with no kink
 * and matches the no-pull region past it. A plain `(1 - t)²` curve is steepest
 * at the stop, and `1 - t²` stays strong and then ends in a corner at the rim.
 * Strength is 1 on the stop and 0 at the radius and beyond.
 */
export function magneticStrength(distancePx: number, radius = SNAP_RADIUS_PX): number {
  if (!Number.isFinite(distancePx) || !Number.isFinite(radius) || radius <= 0) return 0;
  if (distancePx <= 0) return 1;
  if (distancePx >= radius) return 0;
  const t = distancePx / radius;
  return 1 - t * t * (3 - 2 * t);
}

/**
 * Closer rests finish sooner. Strength 1 takes {@link GLIDE_MS_NEAR}.
 * A strength that has only just cleared zero takes {@link GLIDE_MS_FAR}.
 * Strength 0 is not an ease; the page stays put.
 */
export function glideDuration(strength: number): number {
  const pull = clamp01(strength);
  return GLIDE_MS_FAR + (GLIDE_MS_NEAR - GLIDE_MS_FAR) * pull;
}

/**
 * Strong pull: ease-out with a small overshoot, so a rest near the stop moves
 * immediately. Weak pull: smoothstep, so a rest near the rim drifts in.
 * Strength 0 is pure smoothstep. The mix is 0 at the start and 1 at the end.
 */
export function magneticEase(progress: number, strength: number): number {
  const p = clamp01(progress);
  const pull = clamp01(strength);
  const c1 = 1.1 * pull;
  const back = 1 + (c1 + 1) * (p - 1) ** 3 + c1 * (p - 1) ** 2;
  const smooth = p * p * (3 - 2 * p);
  return back * pull + smooth * (1 - pull);
}

/**
 * Words for the optional `?magnet=1` caption. The pull itself is the smoothstep
 * curve, not these bands. The bands only name what a viewer is seeing.
 */
export function magnetCaption(distancePx: number, stopName: string): string {
  const distance = Math.max(0, Math.round(distancePx));
  let feel = "gentle pull";
  if (distance >= SNAP_RADIUS_PX) feel = "no pull";
  else if (distance <= SNAP_SLOP_PX) feel = "on stop";
  else if (distance <= 30) feel = "strong snap";
  else if (distance <= 70) feel = "medium pull";
  return `${distance}px from ${stopName} · ${feel}`;
}

/**
 * Stops measured after layout.
 * Always-stops are kept even when they sit closer than {@link SNAP_MIN_GAP_PX}.
 * If two of them land on the same scroll offset they are one stop.
 * An optional stop, such as My Stack, is kept only when it clears that gap
 * from every stop already kept, including the page bottom.
 */
export function collectStops(points: readonly SnapMark[], maxScroll: number, minGap = SNAP_MIN_GAP_PX): Stop[] {
  const limit = Math.max(0, maxScroll);
  const always: Stop[] = [
    { at: 0, name: "top" },
    { at: limit, name: "bottom" },
  ];
  const optional: Stop[] = [];
  for (const point of points) {
    const at = clampScroll(point.at, limit);
    const name = point.name ?? "";
    if (point.always) always.push({ at, name });
    else optional.push({ at, name });
  }
  const stops: Stop[] = [];
  for (const mark of always.sort((a, b) => a.at - b.at)) {
    const last = stops[stops.length - 1];
    if (last !== undefined && Math.abs(mark.at - last.at) <= 0.5) {
      if (!last.name && mark.name) last.name = mark.name;
      continue;
    }
    stops.push({ at: mark.at, name: mark.name });
  }
  for (const mark of optional.sort((a, b) => a.at - b.at)) {
    if (stops.every((stop) => Math.abs(stop.at - mark.at) >= minGap)) stops.push({ ...mark });
  }
  stops.sort((a, b) => a.at - b.at);
  return stops;
}

export function snapStops(points: readonly SnapMark[], maxScroll: number, minGap = SNAP_MIN_GAP_PX): number[] {
  return collectStops(points, maxScroll, minGap).map((stop) => stop.at);
}

/** Nearest kept stop. A tie keeps the earlier stop (the one higher on the page). */
export function nearestStop(
  scrollTop: number,
  points: readonly SnapMark[],
  maxScroll: number,
): { at: number; distance: number; name: string } {
  const limit = Math.max(0, maxScroll);
  const y = clampScroll(scrollTop, limit);
  const stops = collectStops(points, limit);
  let nearest = stops[0] ?? { at: 0, name: "top" };
  let best = Math.abs(y - nearest.at);
  for (const stop of stops) {
    const distance = Math.abs(y - stop.at);
    if (distance < best) {
      nearest = stop;
      best = distance;
    }
  }
  return { at: nearest.at, distance: best, name: nearest.name || "stop" };
}

/**
 * The stop to ease onto, or null when the page should stay exactly where it landed.
 * Pull strength follows {@link magneticStrength}: full on the stop, zero at
 * {@link SNAP_RADIUS_PX} and beyond. Reduced motion never moves the scroll.
 */
export function settleSnap(input: SnapSettle): MagneticPull | null {
  if (input.reduced) return null;
  const nearest = nearestStop(input.scrollTop, input.points, input.maxScroll);
  if (nearest.distance <= SNAP_SLOP_PX) return null;
  const strength = magneticStrength(nearest.distance);
  if (strength <= 0) return null;
  return {
    target: nearest.at,
    distance: nearest.distance,
    strength,
    name: nearest.name,
  };
}
