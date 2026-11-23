/**
 * Optional stops must be at least this far from a stop already kept.
 * Always-stops are not dropped when a short screen packs them closer.
 */
export const SNAP_MIN_GAP_PX = 200;

/** A lift slower than this is not a fling. The page stays where the finger left it. */
export const FLING_MIN_PX_PER_SEC = 280;

/** Distance before the target where the cushion takes over from the fling. */
export const CUSHION_ZONE_PX = 60;
/** First stretch of the cushion. Ease from the fling speed down to the glide. */
export const CATCH_PX = 20;
/** Last stretch. Ease from the glide speed down to zero on the stop. */
export const SETTLE_PX = 10;
/** The page never travels faster than this, in either direction. */
export const FLING_SPEED_CAP = 1500;
/**
 * The owned glide has arrived. A device pixel can round scrollTop a full
 * pixel off a fractional stop, so the settle ends here rather than on equality.
 */
export const LAND_EPS_PX = 1;
/** A hitch longer than this is clamped so one late frame cannot jump the catch. */
export const GLIDE_MAX_FRAME_SEC = 0.032;
/** Middle of the cushion. The zone minus the catch and the settle. */
export const GLIDE_PX = CUSHION_ZONE_PX - CATCH_PX - SETTLE_PX;
/** Constant speed through the glide, in pixels per second. */
export const GLIDE_SPEED = 56;

/**
 * Release speed uses the last moments of the finger, inside this window.
 * Long enough to be a real flick, short enough to ignore the slow start.
 */
export const RELEASE_SAMPLE_MS = 90;

/**
 * Always-stops closer than this are one stop for targeting and pass ticks.
 * A short screen can park the wheels and the page bottom a few pixels apart.
 */
export const COINCIDENT_STOP_PX = 8;

/** The melt plate is the only content stop that is always measured. */
export const ALWAYS_SNAP_NAMES = ["melt"] as const;

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

/** Speed from the last moments of a drag. `y` grows as the page moves down. Too short a sample is not a fling. */
export function releaseVelocity(samples: readonly { t: number; y: number }[]): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  let first = samples[0];
  for (let index = samples.length - 1; index >= 0; index -= 1) {
    first = samples[index];
    if (last.t - samples[index].t >= RELEASE_SAMPLE_MS) break;
  }
  const dt = (last.t - first.t) / 1000;
  if (dt < 0.016) return 0;
  return (last.y - first.y) / dt;
}

/**
 * Finger samples. `y` is clientY, so a finger moving up is a downward fling.
 * The window is the same {@link RELEASE_SAMPLE_MS} as a scroll sample.
 */
export function touchScrollVelocity(samples: readonly { t: number; y: number }[]): number {
  return releaseVelocity(samples.map((sample) => ({ t: sample.t, y: -sample.y })));
}

export type PageGesture = {
  /** The finger is still down. A pointercancel does not clear this. */
  active: boolean;
  scrollSamples: { t: number; y: number }[];
  /** `y` is clientY. */
  touchSamples: { t: number; y: number }[];
};

const SAMPLE_KEEP_MS = 140;

function remember(samples: readonly { t: number; y: number }[], sample: { t: number; y: number }) {
  const next = [...samples, sample];
  const cutoff = sample.t - SAMPLE_KEEP_MS;
  while (next.length > 2 && next[0].t < cutoff) next.shift();
  return next;
}

function sampleSpan(samples: readonly { t: number; y: number }[]): number {
  if (samples.length < 2) return 0;
  return samples[samples.length - 1].t - samples[0].t;
}

function sampleTravel(samples: readonly { t: number; y: number }[]): number {
  if (samples.length < 2) return 0;
  return Math.abs(samples[samples.length - 1].y - samples[0].y);
}

export function beginPageGesture(t: number, scrollTop: number, clientY: number): PageGesture {
  return {
    active: true,
    scrollSamples: [{ t, y: scrollTop }],
    touchSamples: [{ t, y: clientY }],
  };
}

export function notePageTouchMove(gesture: PageGesture, t: number, clientY: number): PageGesture {
  if (!gesture.active) return gesture;
  return { ...gesture, touchSamples: remember(gesture.touchSamples, { t, y: clientY }) };
}

export function notePageScroll(gesture: PageGesture, t: number, scrollTop: number): PageGesture {
  if (!gesture.active) return gesture;
  return { ...gesture, scrollSamples: remember(gesture.scrollSamples, { t, y: scrollTop }) };
}

/** Chrome fires this mid-pan. The finger is still down, so the gesture stays open. */
export function notePagePointerCancel(gesture: PageGesture): PageGesture {
  return gesture;
}

/** Only the touch stream ends the gesture. pointerup and pointercancel do not. */
export function gestureLift(type: string): boolean {
  return type === "touchend" || type === "touchcancel";
}

/**
 * Page speed at lift.
 * A finger that never moved the page (a reel, the lever) is not a fling.
 * Touch samples cover the last 90ms when the browser kept delivering them.
 * When a pan cancels those and only scroll positions remain, the scroll deltas win.
 */
export function pageGestureVelocity(gesture: PageGesture): number {
  if (sampleTravel(gesture.scrollSamples) <= 1) return 0;
  if (sampleSpan(gesture.touchSamples) >= 80) return touchScrollVelocity(gesture.touchSamples);
  return releaseVelocity(gesture.scrollSamples);
}

export type FlingPlan = {
  /** Null when the page should stay exactly where the finger lifted. */
  target: number | null;
};

export type StopCluster = { from: number; to: number };

/** Stops a few pixels apart are one cluster. The pair is not two targets. */
export function clusterStops(stops: readonly number[], gap = COINCIDENT_STOP_PX): StopCluster[] {
  const sorted = [...stops].filter((at) => Number.isFinite(at)).sort((a, b) => a - b);
  const clusters: StopCluster[] = [];
  for (const at of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && at - last.to <= gap) {
      last.to = at;
      continue;
    }
    clusters.push({ from: at, to: at });
  }
  return clusters;
}

/** The edge of a cluster still ahead of `y`. Null when the whole cluster is behind. */
export function clusterTarget(cluster: StopCluster, y: number, dir: 1 | -1): number | null {
  if (dir > 0) {
    if (cluster.to <= y + 0.5) return null;
    return cluster.from > y + 0.5 ? cluster.from : cluster.to;
  }
  if (cluster.from >= y - 0.5) return null;
  return cluster.to < y - 0.5 ? cluster.to : cluster.from;
}

/**
 * Where a release is going.
 * No fling stays put. Every fling, however hard, takes the next stop in its
 * direction. Nothing is skipped. With no stop ahead, the page goes to the
 * edge it is already heading toward.
 * The choice is made once, from the release velocity, and is not revised.
 * Reduced motion never starts a glide.
 */
export function planFling(input: {
  scrollTop: number;
  velocity: number;
  maxScroll: number;
  points: readonly SnapMark[];
  reduced: boolean;
}): FlingPlan {
  const stay = { target: null };
  if (input.reduced || Math.abs(input.velocity) < FLING_MIN_PX_PER_SEC) return stay;
  const limit = Math.max(0, input.maxScroll);
  const y = clampScroll(input.scrollTop, limit);
  const dir: 1 | -1 = input.velocity > 0 ? 1 : -1;
  const ahead = clusterStops(collectStops(input.points, limit).map((stop) => stop.at))
    .map((cluster) => clusterTarget(cluster, y, dir))
    .filter((at): at is number => at != null)
    .sort((a, b) => dir * (a - b));
  if (ahead.length > 0) return { target: ahead[0] };
  const edge = dir > 0 ? limit : 0;
  if (Math.abs(y - edge) <= 0.5) return stay;
  return { target: edge };
}

/**
 * Speed cap inside the cushion for a fling that is already heading toward the stop.
 * About 600px/s at 30px out, and the glide speed in the last {@link SETTLE_PX}.
 */
export function zoneEntryCap(remainingPx: number): number {
  const remaining = Math.max(0, remainingPx);
  if (remaining >= CUSHION_ZONE_PX) return FLING_SPEED_CAP;
  if (remaining <= SETTLE_PX) return GLIDE_SPEED;
  const u = (remaining - SETTLE_PX) / (CUSHION_ZONE_PX - SETTLE_PX);
  const shaped = u ** 1.065;
  return GLIDE_SPEED + (FLING_SPEED_CAP - GLIDE_SPEED) * shaped;
}

/**
 * Release speed. Never faster than {@link FLING_SPEED_CAP}.
 * Inside the cushion and heading toward the stop, the sliding cap applies.
 * Heading away keeps the full cap and the plan's next stop.
 */
export function aimedSpeed(velocity: number, scrollTop: number, target: number): number {
  const magnitude = Math.min(FLING_SPEED_CAP, Math.abs(velocity));
  const sign = Math.sign(velocity) || (target >= scrollTop ? 1 : -1);
  const remaining = Math.abs(target - scrollTop);
  const toward = (target - scrollTop) * sign >= -0.5;
  if (toward && remaining < CUSHION_ZONE_PX) {
    return sign * Math.min(magnitude, zoneEntryCap(remaining));
  }
  return sign * magnitude;
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

/** A stop counts as crossed when the rounded scroll positions pass it. */
export const PASS_TOLERANCE_PX = 1;

/**
 * Stops the finger dragged across, in travel order.
 * Integer scrollTop values still count when they straddle a fractional stop.
 * A coincident cluster counts once.
 */
export function stopsPassed(from: number, to: number, stops: readonly number[]): number[] {
  if (!(Math.abs(to - from) > 0.01)) return [];
  const dir = to >= from ? 1 : -1;
  const hits: number[] = [];
  for (const cluster of clusterStops(stops)) {
    const edge = dir > 0 ? cluster.from : cluster.to;
    const before = Math.round(from);
    const after = Math.round(to);
    const at = Math.round(edge);
    const rounded = dir > 0 ? before < at && after >= at : before > at && after <= at;
    const spanned =
      dir > 0
        ? from < edge && to >= edge - PASS_TOLERANCE_PX
        : from > edge && to <= edge + PASS_TOLERANCE_PX;
    if (rounded || spanned) hits.push(edge);
  }
  return hits.sort((a, b) => dir * (a - b));
}

/**
 * Drag-pass ticks use only the active stops that sit inside the page.
 * The natural top, the bottom edge, and marks such as the wheel window do not.
 */
export function passStopPositions(points: readonly SnapMark[], maxScroll: number): number[] {
  const limit = Math.max(0, maxScroll);
  return collectStops(points, limit)
    .map((stop) => stop.at)
    .filter((at) => at > PASS_TOLERANCE_PX && at < limit - PASS_TOLERANCE_PX);
}

/** A finish on the natural top is an edge, not a stop, so it does not land. */
export function landsOnStop(y: number, target: number): boolean {
  return target > LAND_EPS_PX && Math.abs(y - target) <= LAND_EPS_PX;
}

/** How far the finger must travel before the gesture is vertical, horizontal, or a pull. */
export const PAGE_GESTURE_SLOP_PX = 8;

/**
 * Whether this touch should move the page itself.
 * Pull-to-refresh (already at the top, finger moving down), a horizontal
 * swipe, reduced motion, and controls that drag on their own stay native.
 */
export function pageOwnsTouch(input: {
  reduced: boolean;
  interactive: boolean;
  scrollTop: number;
  originX: number;
  originY: number;
  x: number;
  y: number;
}): boolean {
  if (input.reduced || input.interactive) return false;
  const dx = input.x - input.originX;
  const dy = input.y - input.originY;
  if (Math.hypot(dx, dy) < PAGE_GESTURE_SLOP_PX) return false;
  if (Math.abs(dx) > Math.abs(dy)) return false;
  if (input.scrollTop <= 0 && dy > 0) return false;
  return true;
}

export type OwnedGlide = {
  y: number;
  /** Release speed. Kept for the free stretch; the catch does not speed back up to it. */
  speed: number;
  /** Speed locked on the frame the cushion is entered. */
  entrySpeed: number | null;
  dir: 1 | -1;
  /** Chosen once at release. A later sample must not replace it. */
  target: number;
  catchFrom: number;
  done: boolean;
  /** Commanded speed of the latest slice, for the catch continuity check. */
  pace: number;
  /** Set when the settle phase begins. The phase runs to the target on its own clock. */
  settleFrom: number | null;
  settleTotal: number;
  settleElapsed: number;
  /** Bottom edge. Touching it, or the top, ends the glide and holds there. */
  maxScroll: number;
};

export function startOwnedGlide(
  y: number,
  velocity: number,
  target: number,
  maxScroll = Number.POSITIVE_INFINITY,
): OwnedGlide {
  const aimed = aimedSpeed(velocity, y, target);
  const remaining = Math.abs(target - y);
  const inside = remaining <= CUSHION_ZONE_PX && (target - y) * aimed >= -0.5;
  const speed = Math.abs(aimed);
  return {
    y,
    speed,
    entrySpeed: inside ? speed : null,
    dir: target >= y ? 1 : -1,
    target,
    catchFrom: inside ? remaining : CUSHION_ZONE_PX,
    done: false,
    pace: speed,
    settleFrom: null,
    settleTotal: 0,
    settleElapsed: 0,
    maxScroll,
  };
}

function edgeHit(from: number, to: number, maxScroll: number): number | null {
  if (from > 0 && to <= 0) return 0;
  if (Number.isFinite(maxScroll) && from < maxScroll && to >= maxScroll) return maxScroll;
  return null;
}

function settleEase(unit: number): number {
  const t = clamp01(unit);
  return 1 - (1 - t) ** 3;
}

function sliceSpeed(state: OwnedGlide, remaining: number): number {
  if (remaining > CUSHION_ZONE_PX) return state.speed;
  return cushionSpeed(remaining, state.entrySpeed ?? state.speed, state.catchFrom);
}

/**
 * One owned frame. Full release speed until the cushion, then catch, glide, and settle.
 * The plan's target stays put. `observed` is the scroller's scrollTop and may be an
 * integer a pixel off the stop; it does not move `y` or end the glide.
 * Landing is the settle finishing, once, within {@link LAND_EPS_PX} of the target.
 * A long frame is clamped, then the catch is integrated in short slices so the
 * speed on entry is the speed of the slice that reached the zone.
 */
export function advanceOwnedGlide(
  state: OwnedGlide,
  dt: number,
  observed: number,
): { state: OwnedGlide; landed: boolean } {
  void observed;
  if (state.done) return { state, landed: false };
  const stepDt = Math.min(GLIDE_MAX_FRAME_SEC, Math.max(0, dt));
  if (Math.abs(state.target - state.y) <= LAND_EPS_PX) {
    return { state: { ...state, y: state.target, done: true, pace: 0 }, landed: true };
  }
  let y = state.y;
  let entrySpeed = state.entrySpeed;
  let catchFrom = state.catchFrom;
  let pace = state.pace;
  let settleFrom = state.settleFrom;
  let settleTotal = state.settleTotal;
  let settleElapsed = state.settleElapsed;
  let left = stepDt;
  const slice = 0.004;
  const finishAt = (at: number, landed: boolean) => ({
    state: {
      ...state,
      y: at,
      entrySpeed,
      catchFrom,
      done: true,
      pace: 0,
      settleFrom,
      settleTotal,
      settleElapsed: settleTotal,
    },
    landed,
  });
  const finish = () => finishAt(state.target, landsOnStop(state.target, state.target));
  const holdEdge = (from: number, to: number) => {
    const edge = edgeHit(from, to, state.maxScroll);
    if (edge == null) return null;
    return finishAt(edge, landsOnStop(edge, state.target));
  };
  while (left > 1e-6) {
    const remaining = Math.abs(state.target - y);
    if (remaining <= LAND_EPS_PX) return finish();
    if (settleFrom != null || remaining <= SETTLE_PX) {
      if (settleFrom == null) {
        settleFrom = y;
        settleTotal = Math.max(0.05, (3 * remaining) / GLIDE_SPEED);
        settleElapsed = 0;
      }
      const step = Math.min(left, slice);
      settleElapsed += step;
      const u = settleTotal > 0 ? Math.min(1, settleElapsed / settleTotal) : 1;
      const next = settleFrom + (state.target - settleFrom) * settleEase(u);
      if (u >= 1 || Math.abs(state.target - next) <= LAND_EPS_PX) return finish();
      const held = holdEdge(y, next);
      if (held) return held;
      const previous = y;
      y = next;
      pace = step > 0 ? Math.abs(y - previous) / step : 0;
      left -= step;
      continue;
    }
    const outside = remaining > CUSHION_ZONE_PX;
    const speed = outside ? state.speed : sliceSpeed({ ...state, entrySpeed, catchFrom }, remaining);
    const step = Math.min(left, slice);
    const dist = speed * step;
    if (outside && remaining - dist <= CUSHION_ZONE_PX) {
      const toZone = remaining - CUSHION_ZONE_PX;
      const boundary = y + state.dir * toZone;
      const held = holdEdge(y, boundary);
      if (held) return held;
      y = boundary;
      left -= state.speed > 0 ? toZone / state.speed : step;
      entrySpeed = state.speed;
      catchFrom = CUSHION_ZONE_PX;
      pace = state.speed;
      continue;
    }
    const next = y + state.dir * Math.min(dist, remaining);
    const crossed = (state.target - y) * (state.target - next) <= 0;
    if (crossed || Math.abs(state.target - next) <= LAND_EPS_PX) return finish();
    const held = holdEdge(y, next);
    if (held) return held;
    y = next;
    pace = speed;
    left -= step;
  }
  return {
    state: { ...state, y, entrySpeed, catchFrom, pace, settleFrom, settleTotal, settleElapsed },
    landed: false,
  };
}

export type PageCue = "pass" | "land";

/** A fling only lands. Dragging past a stop is the pass tick; nothing is skipped. */
export function flingCues(): PageCue[] {
  return ["land"];
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
 * Two stops only. The melt plate, and My Stack or the bottom edge, whichever
 * the finger reaches first. The page top and the wheel window are not stops.
 * A stack past `maxScroll` cannot be reached, so the bottom edge is the stop.
 */
export function collectStops(points: readonly SnapMark[], maxScroll: number, _minGap = SNAP_MIN_GAP_PX): Stop[] {
  const limit = Math.max(0, maxScroll);
  let melt: number | null = null;
  let stack: number | null = null;
  for (const point of points) {
    const name = point.name ?? "";
    if (name === "melt" || (point.always && name === "melt")) melt = point.at;
    if (name === "stack") stack = point.at;
  }
  const stops: Stop[] = [];
  const push = (at: number, name: string) => {
    const twin = stops.find((stop) => Math.abs(stop.at - at) <= 0.5);
    if (twin) {
      if (name && !twin.name.includes(name)) twin.name = twin.name ? `${name}/${twin.name}` : name;
      return;
    }
    stops.push({ at, name });
  };
  if (melt != null && Number.isFinite(melt)) push(clampScroll(melt, limit), "melt");
  const stackReachable = stack != null && stack <= limit + 0.5;
  if (stackReachable && stack != null) {
    const at = clampScroll(stack, limit);
    push(at, Math.abs(at - limit) <= 0.5 ? "stack/bottom" : "stack");
  } else if (limit > 0) {
    push(limit, "bottom");
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

