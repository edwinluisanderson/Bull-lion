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
 * Natural frequency of the critically damped glide, in radians per second.
 * Closer rests use a slightly higher frequency. Both are low: the page glides
 * instead of jumping, even right next to a stop.
 */
export const SPRING_OMEGA_NEAR = 3.6;
export const SPRING_OMEGA_FAR = 2.4;
/**
 * Initial acceleration of a rest-start glide stays at or under this many
 * pixels per second squared. A short distance cannot pick a frequency that
 * would snap.
 */
export const GLIDE_MAX_ACCEL = 400;

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
 * Whether a rest is inside the field. The value is a gentle even engagement,
 * not a magnet that is strongest on the stop. It stays flat through the field
 * and fades to zero across the outer 15 percent, so a rest near 100px still
 * starts a close and the field meets the no-pull region without a corner.
 */
export function magneticStrength(distancePx: number, radius = SNAP_RADIUS_PX): number {
  if (!Number.isFinite(distancePx) || !Number.isFinite(radius) || radius <= 0) return 0;
  if (distancePx >= radius) return 0;
  const t = Math.max(0, distancePx) / radius;
  const fadeStart = 0.85;
  const engagement = 0.45;
  if (t <= fadeStart) return engagement;
  const u = (t - fadeStart) / (1 - fadeStart);
  const smooth = u * u * (3 - 2 * u);
  return engagement * (1 - smooth);
}

/** Cruise speed of a soft-close, in pixels per second. The same for every stop. */
export const SOFT_CLOSE_SPEED = 56;
/**
 * How long the cushion lasts. A gap shorter than {@link SOFT_CLOSE_CUSHION_PX}
 * uses this same time, so a close rest is slower instead of grabbier.
 */
export const SOFT_CLOSE_CUSHION_SEC = 1.05;
/** Distance covered while the cushion bleeds the cruise speed down to zero. */
export const SOFT_CLOSE_CUSHION_PX = (SOFT_CLOSE_SPEED * SOFT_CLOSE_CUSHION_SEC) / 2;

export function glideDuration(distancePx: number): number {
  const distance = Math.max(0, Math.abs(distancePx));
  const cushionPx = Math.min(SOFT_CLOSE_CUSHION_PX, distance);
  const cruiseSec = (distance - cushionPx) / SOFT_CLOSE_SPEED;
  return (cruiseSec + SOFT_CLOSE_CUSHION_SEC) * 1000;
}

/**
 * Soft-close drawer. Offset is the signed gap still left to the stop.
 * A long gap cruises at {@link SOFT_CLOSE_SPEED}, then a cosine taper brings
 * the speed to zero. A short gap uses only the taper, at a lower entry speed,
 * over the same cushion time. The offset stays on its starting side of the stop.
 */
export function softCloseAt(elapsedSec: number, distancePx: number): { offset: number; velocity: number } {
  const distance = Math.abs(distancePx);
  const sign = distancePx < 0 ? -1 : 1;
  if (distance === 0) return { offset: 0, velocity: 0 };
  const cushionPx = Math.min(SOFT_CLOSE_CUSHION_PX, distance);
  const cruiseSec = (distance - cushionPx) / SOFT_CLOSE_SPEED;
  const entry = (2 * cushionPx) / SOFT_CLOSE_CUSHION_SEC;
  const t = Math.max(0, elapsedSec);
  if (t >= cruiseSec + SOFT_CLOSE_CUSHION_SEC) return { offset: 0, velocity: 0 };
  if (cruiseSec > 0 && t <= cruiseSec) {
    return { offset: sign * (distance - SOFT_CLOSE_SPEED * t), velocity: -sign * SOFT_CLOSE_SPEED };
  }
  const u = (t - cruiseSec) / SOFT_CLOSE_CUSHION_SEC;
  const covered = (entry / 2) * (t - cruiseSec + (SOFT_CLOSE_CUSHION_SEC / Math.PI) * Math.sin(Math.PI * u));
  const offset = Math.max(0, cushionPx - covered);
  const velocity = -entry * (1 + Math.cos(Math.PI * u)) / 2;
  return { offset: sign * offset, velocity: sign * velocity };
}

/**
 * Frequency for a critically damped glide. Strength raises it, so a closer
 * rest finishes sooner, and {@link GLIDE_MAX_ACCEL} lowers it when ω² × distance
 * would otherwise jump. Distance is the absolute gap to the stop, in pixels.
 */
export function springOmega(strength: number, distancePx: number): number {
  const pull = clamp01(strength);
  const wanted = SPRING_OMEGA_FAR + (SPRING_OMEGA_NEAR - SPRING_OMEGA_FAR) * pull;
  const distance = Math.max(distancePx, 1);
  const capped = Math.sqrt(GLIDE_MAX_ACCEL / distance);
  return Math.min(wanted, capped);
}

/**
 * Critically damped spring, offset from the stop. `velocityPxPerSec` is the
 * offset's velocity (same sign as scrollTop velocity when offset is
 * `scrollTop - stop`). With a zero start velocity the first derivative is 0,
 * so the glide eases in. It does not overshoot when that velocity is 0.
 */
export function criticallyDamped(
  elapsedSec: number,
  omega: number,
  offsetPx: number,
  velocityPxPerSec: number,
): { offset: number; velocity: number } {
  const w = Math.max(omega, 0.001);
  const t = Math.max(0, elapsedSec);
  const A = offsetPx;
  const B = velocityPxPerSec + w * A;
  const decay = Math.exp(-w * t);
  return {
    offset: (A + B * t) * decay,
    velocity: (B - w * (A + B * t)) * decay,
  };
}

/**
 * Words for the optional `?magnet=1` caption. The close itself is the drawer
 * curve, not these bands. The bands only name what a viewer is seeing.
 */
export function magnetCaption(distancePx: number, stopName: string): string {
  const distance = Math.max(0, Math.round(distancePx));
  let feel = "soft close";
  if (distance >= SNAP_RADIUS_PX) feel = "no pull";
  else if (distance <= SNAP_SLOP_PX) feel = "on stop";
  else if (distance <= SOFT_CLOSE_CUSHION_PX) feel = "cushion";
  return `${distance}px from ${stopName} · ${feel}`;
}

/**
 * Stops measured after layout.
 * Always-stops are kept even when they sit closer than {@link SNAP_MIN_GAP_PX}.
 * If two stops land within half a pixel they are one stop.
 * My Stack is kept when its top can be scrolled to the top of the screen,
 * which is when its unclamped offset is at most `maxScroll`. It is not dropped
 * for sitting near the wheels or the page bottom. An offset past `maxScroll`
 * means the page bottoms out first, so that stack is not a stop.
 * Any other optional stop still has to clear {@link SNAP_MIN_GAP_PX}.
 */
export function collectStops(points: readonly SnapMark[], maxScroll: number, minGap = SNAP_MIN_GAP_PX): Stop[] {
  const limit = Math.max(0, maxScroll);
  const always: Stop[] = [
    { at: 0, name: "top" },
    { at: limit, name: "bottom" },
  ];
  const optional: { raw: number; name: string }[] = [];
  for (const point of points) {
    const name = point.name ?? "";
    if (point.always) always.push({ at: clampScroll(point.at, limit), name });
    else optional.push({ raw: point.at, name });
  }
  const stops: Stop[] = [];
  const absorb = (at: number, name: string) => {
    const twin = stops.find((stop) => Math.abs(stop.at - at) <= 0.5);
    if (twin) {
      if (!twin.name && name) twin.name = name;
      return true;
    }
    return false;
  };
  for (const mark of always.sort((a, b) => a.at - b.at)) {
    if (absorb(mark.at, mark.name)) continue;
    stops.push({ at: mark.at, name: mark.name });
  }
  for (const mark of optional.sort((a, b) => a.raw - b.raw)) {
    if (!(mark.raw <= limit)) continue;
    const at = clampScroll(mark.raw, limit);
    if (absorb(at, mark.name)) continue;
    const stack = mark.name === "stack";
    if (!stack && stops.some((stop) => Math.abs(stop.at - at) < minGap)) continue;
    stops.push({ at, name: mark.name });
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
 * Inside the field the page soft-closes. Strength is even, not strongest at
 * the stop, and zero at {@link SNAP_RADIUS_PX} and beyond. Reduced motion
 * never moves the scroll.
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
