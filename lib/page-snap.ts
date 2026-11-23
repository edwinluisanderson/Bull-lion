/**
 * Optional stops must be at least this far from a stop already kept.
 * Always-stops are not dropped when a short screen packs them closer.
 */
export const SNAP_MIN_GAP_PX = 200;

/** A lift slower than this is not a fling. The page stays where the finger left it. */
export const FLING_MIN_PX_PER_SEC = 280;
/** At this speed and above, the fling skips exactly one stop. */
export const HARD_FLING_PX_PER_SEC = 2200;

/** Distance before the target where the cushion takes over from the fling. */
export const CUSHION_ZONE_PX = 120;
/** First stretch of the cushion. Ease from the fling speed down to the glide. */
export const CATCH_PX = 40;
/** Last stretch. Ease from the glide speed down to zero on the stop. */
export const SETTLE_PX = 15;
/** Middle of the cushion. The zone minus the catch and the settle. */
export const GLIDE_PX = CUSHION_ZONE_PX - CATCH_PX - SETTLE_PX;
/** Constant speed through the glide, in pixels per second. */
export const GLIDE_SPEED = 56;

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

function smoothstep(unit: number): number {
  const u = clamp01(unit);
  return u * u * (3 - 2 * u);
}

/** Speed from the last moments of a drag. Too short a sample is not a fling. */
export function releaseVelocity(samples: readonly { t: number; y: number }[]): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  let first = samples[0];
  for (let index = samples.length - 1; index >= 0; index -= 1) {
    first = samples[index];
    if (last.t - samples[index].t >= 70) break;
  }
  const dt = (last.t - first.t) / 1000;
  if (dt < 0.016) return 0;
  return (last.y - first.y) / dt;
}

export type FlingPlan = {
  /** Null when the page should stay exactly where the finger lifted. */
  target: number | null;
  /** The one stop a hard fling passes. Never more than one. */
  skipped: number | null;
  hard: boolean;
};

/**
 * Where a release is going.
 * No fling stays put. A normal fling takes the next stop in its direction.
 * A hard fling skips that stop and takes the one after, and never a further one.
 * Reduced motion never starts a glide.
 */
export function planFling(input: {
  scrollTop: number;
  velocity: number;
  maxScroll: number;
  points: readonly SnapMark[];
  reduced: boolean;
}): FlingPlan {
  const stay = { target: null, skipped: null, hard: false };
  if (input.reduced || Math.abs(input.velocity) < FLING_MIN_PX_PER_SEC) return stay;
  const limit = Math.max(0, input.maxScroll);
  const y = clampScroll(input.scrollTop, limit);
  const dir = input.velocity > 0 ? 1 : -1;
  const ahead = collectStops(input.points, limit)
    .map((stop) => stop.at)
    .filter((at) => (dir > 0 ? at > y + 0.5 : at < y - 0.5))
    .sort((a, b) => dir * (a - b));
  if (ahead.length === 0) return stay;
  const hard = Math.abs(input.velocity) >= HARD_FLING_PX_PER_SEC && ahead.length >= 2;
  if (!hard) return { target: ahead[0], skipped: null, hard: false };
  return { target: ahead[1], skipped: ahead[0], hard: true };
}

/**
 * Speed toward the stop, in px/s, from the distance still left.
 * Outside the cushion this is the fling speed. At the catch entrance it is
 * that same speed. The catch eases it to {@link GLIDE_SPEED}. The glide holds
 * 56. The settle eases to zero. `catchFrom` is the remaining distance where
 * this catch began, so a fling that starts mid-catch is continuous there.
 */
export function cushionSpeed(remainingPx: number, flingSpeed: number, catchFrom = CUSHION_ZONE_PX): number {
  const remaining = Math.max(0, remainingPx);
  const entry = Math.max(0, flingSpeed);
  if (remaining > CUSHION_ZONE_PX) return entry;
  const catchEnd = CUSHION_ZONE_PX - CATCH_PX;
  if (remaining > catchEnd) {
    const from = Math.min(CUSHION_ZONE_PX, Math.max(remaining, catchFrom));
    const span = Math.max(0.001, from - catchEnd);
    const u = (from - remaining) / span;
    return entry + (GLIDE_SPEED - entry) * smoothstep(u);
  }
  if (remaining > SETTLE_PX) return GLIDE_SPEED;
  const u = (SETTLE_PX - remaining) / SETTLE_PX;
  return GLIDE_SPEED * (1 - smoothstep(u));
}

/** Stops strictly between two scroll positions, in the direction of travel. */
export function stopsPassed(from: number, to: number, stops: readonly number[]): number[] {
  const dir = to >= from ? 1 : -1;
  return stops
    .filter((at) => (dir > 0 ? at > from + 0.5 && at < to - 0.5 : at < from - 0.5 && at > to + 0.5))
    .sort((a, b) => dir * (a - b));
}

export type PageCue = "pass" | "land";

/** Hard fling: one pass tick for the skipped stop, then one landing. A normal fling only lands. */
export function flingCues(hard: boolean): PageCue[] {
  return hard ? ["pass", "land"] : ["land"];
}

/** One pass cue for each stop a finger drags across. A drag does not land. */
export function dragCues(passed: number): PageCue[] {
  return Array.from({ length: Math.max(0, passed) }, () => "pass" as const);
}

/**
 * Words for the optional `?magnet=1` caption.
 */
export function magnetCaption(distancePx: number, stopName: string): string {
  const distance = Math.max(0, Math.round(distancePx));
  const zone = distance <= CUSHION_ZONE_PX ? "cushion" : "free";
  return `${distance}px from ${stopName} · ${zone}`;
}

/**
 * Stops measured after layout.
 * Always-stops are kept even when they sit closer than {@link SNAP_MIN_GAP_PX}.
 * If two stops land within half a pixel they are one stop. A My Stack that
 * shares that stop is named `stack/<other>`, so the caption shows both.
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
      if (name === "stack" && twin.name !== "stack" && !twin.name.startsWith("stack/")) {
        twin.name = twin.name ? `stack/${twin.name}` : "stack";
      } else if (!twin.name && name) twin.name = name;
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

