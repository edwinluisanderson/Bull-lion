/**
 * Optional stops must be at least this far from a stop already kept.
 * Always-stops are not dropped when a short screen packs them closer.
 */
export const SNAP_MIN_GAP_PX = 200;

/** A lift slower than this is not a fling. The page stays where the finger left it. */
export const FLING_MIN_PX_PER_SEC = 280;
/**
 * At this speed and above, the fling skips exactly one stop.
 * A deliberate flick on a phone lands around 1600–2000 px/s.
 */
export const HARD_FLING_PX_PER_SEC = 1600;

/** Distance before the target where the cushion takes over from the fling. */
export const CUSHION_ZONE_PX = 120;
/** First stretch of the cushion. Ease from the fling speed down to the glide. */
export const CATCH_PX = 40;
/** Last stretch. Ease from the glide speed down to zero on the stop. */
export const SETTLE_PX = 15;
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
  /** The one stop a hard fling passes. Never more than one. */
  skipped: number | null;
  hard: boolean;
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
  const dir: 1 | -1 = input.velocity > 0 ? 1 : -1;
  const ahead = clusterStops(collectStops(input.points, limit).map((stop) => stop.at))
    .map((cluster) => clusterTarget(cluster, y, dir))
    .filter((at): at is number => at != null)
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

/**
 * Stops strictly between two scroll positions, in the direction of travel.
 * A coincident cluster counts once, at the edge the finger reaches first.
 */
export function stopsPassed(from: number, to: number, stops: readonly number[]): number[] {
  const dir = to >= from ? 1 : -1;
  const hits: number[] = [];
  for (const cluster of clusterStops(stops)) {
    const edge = dir > 0 ? cluster.from : cluster.to;
    const crossed =
      dir > 0 ? edge > from + 0.5 && edge < to - 0.5 : edge < from - 0.5 && edge > to + 0.5;
    if (crossed) hits.push(edge);
  }
  return hits.sort((a, b) => dir * (a - b));
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
  skipped: number | null;
  passed: boolean;
  done: boolean;
  /** Commanded speed of the latest slice, for the catch continuity check. */
  pace: number;
  /** Set when the settle phase begins. The phase runs to the target on its own clock. */
  settleFrom: number | null;
  settleTotal: number;
  settleElapsed: number;
};

export function startOwnedGlide(
  y: number,
  velocity: number,
  target: number,
  skipped: number | null,
): OwnedGlide {
  const remaining = Math.abs(target - y);
  const inside = remaining <= CUSHION_ZONE_PX;
  return {
    y,
    speed: Math.abs(velocity),
    entrySpeed: inside ? Math.abs(velocity) : null,
    dir: target >= y ? 1 : -1,
    target,
    catchFrom: inside ? remaining : CUSHION_ZONE_PX,
    skipped,
    passed: false,
    done: false,
    pace: Math.abs(velocity),
    settleFrom: null,
    settleTotal: 0,
    settleElapsed: 0,
  };
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
): { state: OwnedGlide; pass: boolean; landed: boolean } {
  void observed;
  if (state.done) return { state, pass: false, landed: false };
  const stepDt = Math.min(GLIDE_MAX_FRAME_SEC, Math.max(0, dt));
  if (Math.abs(state.target - state.y) <= LAND_EPS_PX) {
    return { state: { ...state, y: state.target, done: true, pace: 0 }, pass: false, landed: true };
  }
  let y = state.y;
  let entrySpeed = state.entrySpeed;
  let catchFrom = state.catchFrom;
  let passed = state.passed;
  let pass = false;
  let pace = state.pace;
  let settleFrom = state.settleFrom;
  let settleTotal = state.settleTotal;
  let settleElapsed = state.settleElapsed;
  let left = stepDt;
  const slice = 0.004;
  const finish = (didPass: boolean) => ({
    state: {
      ...state,
      y: state.target,
      entrySpeed,
      catchFrom,
      passed,
      done: true,
      pace: 0,
      settleFrom,
      settleTotal,
      settleElapsed: settleTotal,
    },
    pass: didPass,
    landed: true,
  });
  while (left > 1e-6) {
    const remaining = Math.abs(state.target - y);
    if (remaining <= LAND_EPS_PX) return finish(pass);
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
      if (!passed && state.skipped != null && stopsPassed(y, next, [state.skipped]).length > 0) {
        passed = true;
        pass = true;
      }
      if (u >= 1 || Math.abs(state.target - next) <= LAND_EPS_PX) return finish(pass);
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
      y += state.dir * toZone;
      left -= state.speed > 0 ? toZone / state.speed : step;
      entrySpeed = state.speed;
      catchFrom = CUSHION_ZONE_PX;
      pace = state.speed;
      continue;
    }
    const next = y + state.dir * dist;
    if (!passed && state.skipped != null && stopsPassed(y, next, [state.skipped]).length > 0) {
      passed = true;
      pass = true;
    }
    const crossed = (state.target - y) * (state.target - next) <= 0;
    if (crossed || Math.abs(state.target - next) <= LAND_EPS_PX) return finish(pass);
    y = next;
    pace = speed;
    left -= step;
  }
  return {
    state: { ...state, y, entrySpeed, catchFrom, passed, pace, settleFrom, settleTotal, settleElapsed },
    pass,
    landed: false,
  };
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

