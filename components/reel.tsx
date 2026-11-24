"use client";

import { useEffect, useRef, useState } from "react";

import {
  camPastNotch,
  brakeDecel,
  COAST_SETTLE_SPEED,
  flingVelocity,
  flywheelAdvance,
  REEL_MAX_FRAME_DT,
  REEL_SPEED_CAPS,
  stopsCrossed,
  commitIndex,
  cylinderPose,
  glideSettleNotch,
  grayGlidePlan,
  nearestEnabledNotch,
  shouldApplyGuard,
  STOP_DEGREES,
} from "@/lib/drum";
import { hapticClick } from "@/lib/haptics";
import { noteReelSpinning, playReelClick, reelSnap, unlockReelClick } from "@/lib/reel-click";
import {
  armLandingWatch,
  clearLandingWatch,
  commitReelStop,
  FLICK_COAST_SPEED,
  flickOwesLanding,
  playSettledLanding,
  settleReelLanding,
  type LandingWatch,
} from "@/lib/reel-landing";
import { detentForStop } from "@/lib/spin-gate";
import { pullFrame, pullLaunchVelocity, pullStopSeconds } from "@/lib/pull-spin";
import { createReelMotion } from "@/lib/reel-motion";
import { setWheelLampSpeed } from "@/lib/wheel-lamp";
import { playStretchPop, unlockStretchPops } from "@/lib/stretch-pop";
import { stretchPopCount } from "@/lib/stretch-pops";
import { DRUM_WINDOW, REST_DRUM } from "@/lib/drum-housing";
import { REEL_ITEM_HEIGHT } from "@/lib/metals";
import {
  STRETCH_HOLD_MS,
  countRows,
  guestStillVisible,
  handoffPlacement,
  nextGestureMode,
  originFor,
  pressHitsCenter,
  projectGuest,
  guestWindow,
  originFromWindow,
  alignDevicePixel,
  canonicalNotch,
  releaseNotch,
  releasePlacement,
  rollGuestWindow,
  sequenceFrom,
  STRETCH_SNAP_MS,
  stretchLandingGate,
  stretchSnap,
  settledPlateStyle,
  stretchLayout,
  stretchRowClip,
  stretchRim,
  valueAfterRelease,
  visibleTriple,
  type GuestCount,
  type GestureMode,
  type StretchDirection,
  type StretchLayout,
  type StretchOrigin,
  type StretchRim,
} from "@/lib/stretch";

export type ReelSymbol = {
  key: string;
  mark: string;
  detail: string;
  tint?: string;
  disabled?: boolean;
};

type Phase = "idle" | "drag" | "coast" | "snap" | "script" | "ice";

export type StretchFrame = {
  direction: StretchDirection;
  rows: StretchLayout["rows"];
  centered: number;
  rim: StretchRim;
};

export type StretchFace = { mark: string; detail: string };

export type StretchConfig = {
  stops: readonly number[];
  isValueEnabled: (value: number) => boolean;
  /** When omitted, the gap is the whole numbers between the stops. */
  between?: (anchor: number, toward: number, direction: StretchDirection) => number[];
  /** When omitted, a value that is not a stop is placed by numeric order. */
  origin?: (stops: readonly number[], value: number) => StretchOrigin;
  /** When omitted, faces stay on the count reel's ×N / pieces. */
  label?: (value: number) => StretchFace;
};

function countFace(value: number): StretchFace {
  return { mark: `×${value}`, detail: value === 1 ? "piece" : "pieces" };
}

const WINDOW = [-2, -1, 0, 1, 2, 3];

function guestSymbol(
  items: ReelSymbol[],
  value: number,
  near: number,
  label?: (value: number) => StretchFace,
): ReelSymbol {
  const face = label?.(value) ?? countFace(value);
  return {
    key: `guest-${value}`,
    mark: face.mark,
    detail: face.detail,
    tint: items[near]?.tint ?? items[0]?.tint,
  };
}

function insertGuest(
  items: ReelSymbol[],
  guest: GuestCount,
  label?: (value: number) => StretchFace,
): ReelSymbol[] {
  const lower = guest.insertAfter ?? Math.floor(guest.slot);
  const values = guest.run?.length ? guest.run : [guest.value];
  const symbols = values.map((value) => guestSymbol(items, value, lower, label));
  return [...items.slice(0, lower + 1), ...symbols, ...items.slice(lower + 1)];
}

type Engine = {
  pointerDown: (y: number, time: number, localY?: number, height?: number) => void;
  pointerMove: (y: number, time: number) => void;
  pointerUp: () => void;
  step: (direction: number) => void;
  jump: (index: number) => void;
  /** Put the reel on `index` with no animation and no velocity. A pull already at rest stays still. */
  settleGuard: (index: number) => void;
  lever: (order: number) => void;
  destroy: () => void;
};

const NOTCH_OVERSHOOT = 0.07;

function mod(value: number, count: number): number {
  if (count <= 0) return 0;
  return ((value % count) + count) % count;
}

export function createReelEngine(options: {
  initialIndex: number;
  setKinetics: (position: number, velocity: number) => void;
  getCount: () => number;
  onIndex: (index: number) => void;
  onMotion: (moving: boolean) => void;
  /** Motion from a finger, fling, or pull. A guard jump does not count. */
  onGestureMotion?: (moving: boolean) => void;
  isReduced: () => boolean;
  isEnabled: (index: number) => boolean;
  getStretch: () => StretchConfig | null;
  onPieces: (pieces: number) => void;
  onStretchFrame: (frame: StretchFrame | null) => void;
  onGuest: (guest: GuestCount | null) => void;
  alternatePullStops: () => boolean;
  speedCap: number;
}): Engine {
  let position = options.initialIndex;
  let phase: Phase = "idle";
  let velocity = 0;
  let committed = options.initialIndex;
  let raf = 0;
  let last = 0;
  let animFrom = position;
  let animTo = position;
  let animStart = 0;
  let animDur = 1;
  let camNotch: number | null = null;
  let drag: {
    originY: number;
    originPos: number;
    originTime: number;
    samples: { t: number; y: number }[];
  } | null = null;
  let gesture: GestureMode = "drag";
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let anchorIndex = options.initialIndex;
  let stretchOrigin: StretchOrigin | null = null;
  let slideDirection: StretchDirection | null = null;
  let stretchTravel = 0;
  /** This drag began as a stretch that ran out of in-between faces. */
  let handedOff = false;
  let guest: GuestCount | null = null;
  let popDirection: StretchDirection | null = null;
  let popsPlayed = 0;
  let audioSpin = false;
  let pullSpin = false;
  let pullOrder = 0;
  let pullOrigin = 0;
  /** Wall-clock start of the pull, on the animation-frame clock. */
  let pullStarted = 0;
  let pullClock = false;
  let pullSettled = false;
  let pullRestNotified = false;
  let alternated = 0;
  let landingWatch: LandingWatch = clearLandingWatch();
  let glideTarget: number | null = null;
  let iceFrom = 0;
  let iceVelocity = 0;
  let iceHandoff = 0;
  let iceSeconds = 0;
  let brakeNotch = 0;
  let brakeMs = 0;

  function setAudioSpin(next: boolean) {
    if (audioSpin === next) return;
    audioSpin = next;
    noteReelSpinning(next);
  }

  function syncStretchPops(direction: StretchDirection, travel: number) {
    if (popDirection !== direction) {
      popDirection = direction;
      popsPlayed = 0;
    }
    const length = stretchOrigin ? sequenceNow(stretchOrigin, direction).length : 0;
    const due = stretchPopCount(travel, REEL_ITEM_HEIGHT, length);
    while (popsPlayed < due) {
      playStretchPop();
      popsPlayed += 1;
    }
  }

  const motion = createReelMotion((moving) => options.onMotion(moving));
  let jumping = false;
  let gestureAnnounced = false;

  function emitGesture(moving: boolean) {
    if (gestureAnnounced === moving) return;
    gestureAnnounced = moving;
    options.onGestureMotion?.(moving);
  }

  function setPhase(next: Phase) {
    if (next === "idle") jumping = false;
    emitGesture(next !== "idle" && !jumping);
    const changed = motion.set(phase, next);
    if (!changed) return;
    phase = next;
    if (next === "idle") {
      setAudioSpin(false);
      pullSpin = false;
    }
  }

  function reelCount(): number {
    if (guest?.run?.length) return options.getCount() + guest.run.length;
    return options.getCount();
  }

  /** A stretch-made face is a real stop. Permanent faces keep their enabled flag. */
  function enabledExpanded(index: number): boolean {
    const count = reelCount();
    const at = mod(index, count);
    if (guest?.run?.length && guest.insertAfter != null) {
      const first = guest.insertAfter + 1;
      const last = first + guest.run.length - 1;
      if (at >= first && at <= last) return true;
      const permanent = at > last ? at - guest.run.length : at;
      return options.isEnabled(mod(permanent, options.getCount()));
    }
    return options.isEnabled(mod(at, options.getCount()));
  }

  function enabledIndex(index: number): boolean {
    return enabledExpanded(index);
  }

  function nearestEnabledSlot(from: number): number {
    return nearestEnabledNotch(from, reelCount(), enabledExpanded);
  }

  function publishCommitted(index: number) {
    if (guest?.run?.length && guest.insertAfter != null) {
      const count = reelCount();
      const at = mod(index, count);
      const first = guest.insertAfter + 1;
      const last = first + guest.run.length - 1;
      if (at >= first && at <= last) {
        const value = guest.run[at - first];
        if (value !== undefined) options.onPieces(value);
        return;
      }
      const permanent = at > last ? at - guest.run.length : at;
      options.onIndex(mod(permanent, options.getCount()));
      return;
    }
    options.onIndex(index);
  }

  function setPos(next: number) {
    const previous = position;
    position = next;
    options.setKinetics(next, velocity);
    const stops = options.getStretch()?.stops;
    if (phase === "snap" && guest?.run?.length && guest.insertAfter != null) {
      const first = guest.insertAfter + 1;
      const centered = Math.round(next);
      if (centered >= first && centered < first + guest.run.length) {
        const value = guest.run[centered - first];
        if (value !== undefined) options.onPieces(value);
      }
      return;
    }
    if (guest && stops && !guest.run?.length) {
      if (!guestStillVisible(position, stops, guest)) {
        guest = null;
        options.onGuest(null);
        const landed = commitIndex(position, options.getCount(), options.isEnabled);
        if (landed !== null) {
          const value = stops[mod(landed, stops.length)];
          if (value !== undefined) options.onPieces(value);
        }
      } else {
        const center = visibleTriple(position, countRows(stops, guest))[1];
        if (center === guest.value) {
          options.onPieces(guest.value);
          return;
        }
      }
    }
    for (const stop of stopsCrossed(previous, next)) {
      if (!enabledIndex(stop)) playReelClick(audioSpin, true);
    }
    const count = reelCount();
    const index = commitIndex(position, count, enabledExpanded);
    const landingNotch =
      camNotch !== null &&
      index !== null &&
      Math.abs(position - camNotch) < 0.5 &&
      index === mod(Math.round(camNotch), count);
    if (index === null || index === committed) {
      if (landingNotch && landingWatch.owed && !landingWatch.played) {
        const noted = commitReelStop(landingWatch, true);
        landingWatch = noted.watch;
        setAudioSpin(false);
        pullSpin = false;
        if (noted.playLanding) playSettledLanding();
      }
      return;
    }
    const noted = commitReelStop(landingWatch, landingNotch);
    landingWatch = noted.watch;
    const detent = detentForStop({
      pullSpin,
      alternate: options.alternatePullStops(),
      elapsedMs: performance.now() - pullStarted,
      landing: landingNotch,
      alternated,
    });
    alternated = detent.alternated;
    if (landingNotch && !(pullClock && !pullSettled)) {
      setAudioSpin(false);
      pullSpin = false;
      committed = index;
      publishCommitted(index);
      if (noted.playLanding) playSettledLanding();
      return;
    }
    committed = index;
    publishCommitted(index);
    if (detent.haptic) hapticClick(false);
    if (detent.sound) playReelClick(audioSpin, false, false, false);
  }

  function settleLanding() {
    const noted = settleReelLanding(landingWatch);
    landingWatch = noted.watch;
    if (!noted.playLanding) return;
    setAudioSpin(false);
    pullSpin = false;
    playSettledLanding();
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function schedule() {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function finishScript() {
    if (camNotch !== null) {
      const notch = camNotch;
      camNotch = null;
      animateTo(notch, options.isReduced() ? 0 : 160);
      return;
    }
    velocity = 0;
    parkSettledPosition();
    options.setKinetics(position, 0);
    setAudioSpin(false);
    setPhase("idle");
    settleLanding();
  }

  /**
   * A wrap leaves the index outside the main list (10 is the same face as 2).
   * Park on that main index once the snap has arrived, without scrolling the
   * extra revolutions that separate the two numbers.
   */
  function parkSettledPosition() {
    const count = reelCount();
    if (!(count > 0)) return;
    const rounded = Math.round(position);
    if (Math.abs(position - rounded) > 1e-4) return;
    const parked = canonicalNotch(rounded, count);
    if (parked === position) return;
    position = parked;
    options.setKinetics(parked, 0);
  }

  function animateTo(target: number, duration: number) {
    stop();
    if (options.isReduced() || duration <= 0 || Math.abs(target - position) < 0.0001) {
      velocity = 0;
      setPos(target);
      if (camNotch !== null) {
        const notch = camNotch;
        camNotch = null;
        setPos(notch);
      }
      parkSettledPosition();
      setPhase("idle");
      settleLanding();
      return;
    }
    animFrom = position;
    animTo = target;
    animStart = performance.now();
    animDur = duration;
    setPhase("script");
    schedule();
  }

  function camToNotch(notch: number, duration: number) {
    const past = camPastNotch(position, notch, NOTCH_OVERSHOOT);
    if (options.isReduced() || Math.abs(past - notch) < 0.0001) {
      camNotch = notch;
      velocity = 0;
      setPos(notch);
      camNotch = null;
      parkSettledPosition();
      setPhase("idle");
      settleLanding();
      return;
    }
    camNotch = notch;
    animateTo(past, duration);
  }

  function animateSnap(target: number) {
    stop();
    if (options.isReduced() || Math.abs(target - position) < 0.0001) {
      velocity = 0;
      position = target;
      options.setKinetics(target, 0);
      parkSettledPosition();
      setPhase("idle");
      return;
    }
    animFrom = position;
    animTo = target;
    animStart = performance.now();
    animDur = STRETCH_SNAP_MS;
    setPhase("snap");
    schedule();
  }

  /** The pull has reached its scheduled stop. Velocity is 0 and the landing fires once. */
  function finishPull(notch: number) {
    const count = reelCount();
    const parked = canonicalNotch(Math.round(notch), count);
    pullSettled = true;
    pullSpin = false;
    velocity = 0;
    position = parked;
    glideTarget = null;
    camNotch = parked;
    setPos(parked);
    camNotch = null;
    velocity = 0;
    position = parked;
    options.setKinetics(parked, 0);
    setAudioSpin(false);
    pullClock = false;
    setPhase("idle");
    if (!pullRestNotified) {
      pullRestNotified = true;
      settleLanding();
    }
  }

  function tick(now: number) {
    raf = 0;
    try {
    if (pullClock && !pullSettled && pullStarted > 0 && now >= pullStarted + pullStopSeconds(pullOrder) * 1000) {
      const frame = pullFrame({
        origin: pullOrigin,
        order: pullOrder,
        elapsedS: (now - pullStarted) / 1000,
        count: reelCount(),
        isEnabled: enabledExpanded,
        locked: glideTarget,
      });
      finishPull(frame.position);
      return;
    }
    if (pullClock && !pullSettled && phase !== "coast") phase = "coast";
    if (phase === "idle" || phase === "drag") return;
    const dt = Math.min(REEL_MAX_FRAME_DT, Math.max(0, (now - last) / 1000));
    last = now;

    if (phase === "ice") {
      const elapsed = (now - animStart) / 1000;
      if (elapsed >= iceSeconds) {
        velocity = iceVelocity;
        setPos(iceHandoff);
        camToNotch(brakeNotch, brakeMs);
        return;
      }
      velocity = iceVelocity;
      setPos(iceFrom + iceVelocity * elapsed);
      raf = requestAnimationFrame(tick);
      return;
    }

    if (phase === "coast") {
      const count = reelCount();
      if (pullClock && !pullSettled) {
        if (pullStarted === 0) pullStarted = now;
        const elapsed = Math.max(0, (now - pullStarted) / 1000);
        const frame = pullFrame({
          origin: pullOrigin,
          order: pullOrder,
          elapsedS: elapsed,
          count,
          isEnabled: enabledExpanded,
          locked: glideTarget,
        });
        glideTarget = frame.locked;
        if (frame.resting) {
          finishPull(frame.position);
          return;
        }
        velocity = frame.velocity;
        pullSpin = true;
        setPos(frame.position);
      } else {
        const decel = brakeDecel();
        const glide = grayGlidePlan({
          position,
          velocity,
          decel,
          count,
          isEnabled: enabledExpanded,
          locked: glideTarget,
        });
        glideTarget = glide.fallback ? null : glide.target;
        const step = flywheelAdvance(position, velocity, dt, glide.fallback ? decel : glide.decel, options.speedCap);
        velocity = step.velocity;
        setPos(step.position);
        if (Math.abs(velocity) < COAST_SETTLE_SPEED) {
          camToNotch(nearestEnabledSlot(position), 180);
          return;
        }
      }
    }

    if (phase === "snap" || phase === "script") {
      const progress = Math.min(1, (now - animStart) / animDur);
      const power = phase === "script" ? 4 : 3;
      const next =
        progress >= 1
          ? animTo
          : phase === "snap"
            ? stretchSnap(animFrom, animTo, progress)
            : animFrom + (animTo - animFrom) * (1 - (1 - progress) ** power);
      const frameDt = dt > 0 ? dt : REEL_MAX_FRAME_DT;
      const stepSpeed = (next - position) / frameDt;
      const cap = options.speedCap;
      velocity = Math.max(-cap, Math.min(cap, stepSpeed));
      setPos(next);
      if (progress >= 1) {
        finishScript();
        return;
      }
    }

    if (phase === "coast" || phase === "snap" || phase === "script") {
      raf = requestAnimationFrame(tick);
    }
    } finally {
      if (pullClock && !pullSettled && raf === 0) raf = requestAnimationFrame(tick);
    }
  }

  function velocityFrom(samples: { t: number; y: number }[]) {
    return flingVelocity(samples, REEL_ITEM_HEIGHT, options.speedCap);
  }

  function clearHold() {
    if (holdTimer !== undefined) clearTimeout(holdTimer);
    holdTimer = undefined;
  }

  /** Stretch is over. The next drag or fling is an ordinary reel gesture. */
  function handBack() {
    handedOff = false;
    gesture = "drag";
    slideDirection = null;
    stretchTravel = 0;
    stretchOrigin = null;
    drag = null;
    camNotch = null;
    glideTarget = null;
    clearHold();
    publishStretch(null);
  }

  function publishStretch(frame: StretchFrame | null) {
    options.onStretchFrame(frame);
  }

  function sequenceNow(origin: StretchOrigin, direction: StretchDirection) {
    return sequenceFrom(origin, direction, options.getStretch()?.between);
  }

  function originNow(stops: readonly number[], value: number) {
    return options.getStretch()?.origin?.(stops, value) ?? originFor(stops, value);
  }

  function layoutNow(direction: StretchDirection, travel: number): StretchLayout | null {
    const origin = stretchOrigin;
    if (!origin) return null;
    const pin = direction === "down" ? origin.lower : origin.upper;
    const pushed = direction === "down" ? origin.upper : origin.lower;
    return stretchLayout({
      direction,
      anchor: origin.anchor,
      pin,
      pushed,
      sequence: sequenceNow(origin, direction),
      travel,
      itemHeight: REEL_ITEM_HEIGHT,
    });
  }

  function showLayout(layout: StretchLayout, direction: StretchDirection, travel: number) {
    publishStretch({
      direction,
      rows: layout.rows,
      centered: layout.centered,
      rim: stretchRim(direction, travel, REEL_ITEM_HEIGHT),
    });
    options.onPieces(layout.centered);
  }

  function engageStretch() {
    const config = options.getStretch();
    if (!drag || !config) return;
    gesture = "stretch";
    const stops = config.stops;
    const fromRun =
      guest?.run?.length && guest.insertAfter != null
        ? guest.run[Math.round(position) - (guest.insertAfter + 1)]
        : undefined;
    const centeredGuest =
      fromRun ??
      (guest && visibleTriple(position, countRows(stops, guest))[1] === guest.value ? guest.value : null);
    if (centeredGuest == null) {
      anchorIndex = mod(Math.round(position), stops.length);
      stretchOrigin = originNow(stops, stops[anchorIndex] ?? anchorIndex);
      setPos(anchorIndex);
    } else if (guest) {
      const [above, center, below] = guestWindow(stops, position, guest);
      const insertAfter = guest.insertAfter ?? Math.floor(guest.slot);
      stretchOrigin =
        center === centeredGuest
          ? originFromWindow({
              above,
              center,
              below,
              insertAfter,
              upperIndex: insertAfter + 1,
            })
          : originNow(stops, centeredGuest);
      anchorIndex = stretchOrigin.lowerIndex;
    } else {
      stretchOrigin = originNow(stops, centeredGuest);
      anchorIndex = stretchOrigin.lowerIndex;
    }
    slideDirection = null;
    stretchTravel = 0;
    velocity = 0;
    popDirection = null;
    popsPlayed = 0;
    playStretchPop();
    const layout = layoutNow("down", 0);
    if (layout) showLayout(layout, "down", 0);
  }

  function moveStretch(y: number, time: number) {
    const current = drag;
    if (!current || !options.getStretch()) return;
    const dy = y - current.originY;
    if (slideDirection === null) {
      if (Math.abs(dy) < 2) return;
      slideDirection = dy > 0 ? "down" : "up";
    }
    let along = slideDirection === "down" ? dy : -dy;
    if (along < 0) {
      slideDirection = slideDirection === "down" ? "up" : "down";
      along = -along;
    }
    stretchTravel = along;
    const layout = layoutNow(slideDirection, along);
    if (!layout) return;
    syncStretchPops(slideDirection, along);
    if (!layout.handoff || !stretchOrigin) {
      showLayout(layout, slideDirection, along);
      return;
    }
    const sequence = sequenceNow(stretchOrigin, slideDirection);
    if (sequence.length === 0 && guest?.run?.length) {
      const rolled = rollGuestWindow({
        position,
        guest,
        direction: slideDirection,
        travel: layout.remainderPx,
        itemHeight: REEL_ITEM_HEIGHT,
      });
      guest = rolled.guest;
      const nextPos = rolled.position;
      handedOff = true;
      gesture = "drag";
      slideDirection = null;
      stretchTravel = 0;
      publishStretch(null);
      current.originY = y;
      current.originPos = nextPos;
      current.samples = [{ t: time, y }];
      setPos(nextPos);
      return;
    }
    const placed = handoffPlacement({
      direction: slideDirection,
      anchorIndex,
      origin: stretchOrigin,
      sequence,
      stops: options.getStretch()?.stops ?? [],
      remainderPx: layout.remainderPx,
      itemHeight: REEL_ITEM_HEIGHT,
    });
    if (placed.guest) {
      guest = placed.guest;
      options.onGuest(placed.guest);
    }
    const nextPos = placed.position;
    // The finger is still in the stretch gesture, including a wrap whose
    // sequence is empty (100 → 1, or 1 → 100). Release snaps to the face
    // on screen instead of coasting on the stretch speed.
    handedOff = true;
    gesture = "drag";
    slideDirection = null;
    stretchTravel = 0;
    publishStretch(null);
    current.originY = y;
    current.originPos = nextPos;
    current.samples = [{ t: time, y }];
    committed = anchorIndex;
    setPos(nextPos);
  }

  function releaseStretch() {
    const config = options.getStretch();
    const stops = config?.stops ?? [];
    const origin = stretchOrigin;
    const anchor = origin?.anchor ?? stops[anchorIndex] ?? anchorIndex;
    const direction = slideDirection ?? "down";
    const travel = stretchTravel;
    const layout = layoutNow(direction, travel);
    const centered = layout?.centered ?? anchor;
    const enabled = config?.isValueEnabled ?? (() => true);
    if (!enabled(centered)) {
      const fallback = valueAfterRelease(anchor, centered, stops, enabled);
      const index = stops.indexOf(fallback);
      guest = null;
      options.onGuest(null);
      if (index >= 0) {
        committed = index;
        position = index;
        velocity = 0;
        options.setKinetics(index, 0);
        options.onPieces(fallback);
        options.onIndex(index);
      }
      handBack();
      setPhase("idle");
      return;
    }
    const sequence = origin ? sequenceNow(origin, direction) : [];
    const placed =
      origin && layout
        ? releasePlacement({
            direction,
            origin,
            sequence,
            stops,
            travel,
            itemHeight: REEL_ITEM_HEIGHT,
            centered,
          })
        : null;
    if (!placed && !sequence.includes(centered)) {
      velocity = 0;
      if (typeof anchor === "number" && stops.includes(anchor)) {
        guest = null;
        options.onGuest(null);
      }
      options.onPieces(anchor);
      handBack();
      setPhase("idle");
      return;
    }
    if (placed) {
      guest = placed.guest;
      position = placed.position;
    } else {
      const slot =
        origin?.slot ??
        (direction === "down" ? (origin?.lowerIndex ?? anchorIndex) + 0.5 : anchorIndex + 0.5);
      guest = { value: centered, slot };
      position = slot;
    }
    velocity = 0;
    options.setKinetics(position, 0);
    options.onPieces(centered);
    options.onGuest(guest);
    const snapTo = placed ? placed.center : null;
    handBack();
    const cue = stretchLandingGate({ played: false });
    if (cue.play) playSettledLanding();
    if (snapTo != null) {
      animateSnap(snapTo);
      return;
    }
    setPhase("idle");
  }

  return {
    pointerDown(y, time, localY = 0, height = 0) {
      if (pullClock && !pullSettled) return;
      pullSpin = false;
      landingWatch = clearLandingWatch();
      camNotch = null;
      glideTarget = null;
      stop();
      handedOff = false;
      clearHold();
      velocity = 0;
      setPhase("drag");
      publishStretch(null);
      drag = {
        originY: y,
        originPos: position,
        originTime: time,
        samples: [{ t: time, y }],
      };
      gesture = "drag";
      const stretch = options.getStretch();
      if (stretch && pressHitsCenter(localY, height)) {
        gesture = "pending";
        holdTimer = setTimeout(() => {
          if (!drag || gesture !== "pending") return;
          engageStretch();
        }, STRETCH_HOLD_MS);
      }
    },
    pointerMove(y, time) {
      if (phase !== "drag" || !drag) return;
      if (gesture === "stretch") {
        moveStretch(y, time);
        return;
      }
      if (gesture === "pending") {
        const travel = Math.abs(y - drag.originY);
        const elapsed = time - drag.originTime;
        const next = nextGestureMode(gesture, elapsed, travel);
        if (next === "stretch") {
          clearHold();
          engageStretch();
          moveStretch(y, time);
          return;
        }
        if (next === "drag") {
          gesture = "drag";
          clearHold();
        }
      }
      setPos(drag.originPos - (y - drag.originY) / REEL_ITEM_HEIGHT);
      drag.samples.push({ t: time, y });
      const cutoff = time - 100;
      while (drag.samples.length > 2 && drag.samples[0].t < cutoff) {
        drag.samples.shift();
      }
    },
    pointerUp() {
      clearHold();
      if (gesture === "stretch") {
        releaseStretch();
        return;
      }
      if (handedOff && phase === "drag" && drag) {
        const notch = releaseNotch(position);
        handBack();
        const cue = stretchLandingGate({ played: false });
        if (cue.play) playSettledLanding();
        animateSnap(notch);
        return;
      }
      handedOff = false;
      if (phase !== "drag" || !drag) return;
      const samples = drag.samples;
      drag = null;
      hapticClick();
      const speed = options.isReduced() ? 0 : velocityFrom(samples);
      const count = reelCount();
      if (options.isReduced() || Math.abs(speed) < FLICK_COAST_SPEED) {
        const notch = nearestEnabledSlot(position);
        if (flickOwesLanding({ speed, position, notch, committed, count })) {
          landingWatch = armLandingWatch();
        }
        camToNotch(notch, 180);
        return;
      }
      landingWatch = armLandingWatch();
      glideTarget = null;
      velocity = speed;
      setAudioSpin(true);
      setPhase("coast");
      schedule();
    },
    step(direction) {
      pullSpin = false;
      landingWatch = clearLandingWatch();
      hapticClick();
      const count = reelCount();
      const start = Math.round(position);
      for (let delta = 1; delta <= count; delta += 1) {
        const candidate = start + direction * delta;
        if (enabledIndex(candidate)) {
          animateTo(candidate, options.isReduced() ? 0 : 180);
          return;
        }
      }
    },
    settleGuard(index) {
      if (pullSpin) return;
      const count = options.getCount();
      if (!(count > 0)) return;
      const picked = enabledIndex(index) ? index : nearestEnabledSlot(index);
      const target = mod(picked, count);
      stop();
      velocity = 0;
      position = target;
      committed = target;
      camNotch = null;
      glideTarget = null;
      pullSpin = false;
      pullClock = false;
      options.setKinetics(target, 0);
      if (options.onIndex) options.onIndex(target);
      setPhase("idle");
    },
    jump(index) {
      if (pullSpin) return;
      jumping = true;
      pullSpin = false;
      landingWatch = clearLandingWatch();
      guest = null;
      options.onGuest(null);
      hapticClick();
      const count = options.getCount();
      const target = enabledIndex(index) ? index : nearestEnabledSlot(index);
      const targetMod = mod(target, count);
      const currentMod = mod(position, count);
      let delta = targetMod - currentMod;
      if (delta > count / 2) delta -= count;
      if (delta < -count / 2) delta += count;
      animateTo(position + delta, options.isReduced() ? 0 : 320);
    },
    lever(order) {
      guest = null;
      options.onGuest(null);
      hapticClick();
      landingWatch = armLandingWatch();
      glideTarget = null;
      pullSpin = true;
      pullClock = true;
      pullSettled = false;
      pullRestNotified = false;
      pullStarted = 0;
      alternated = 0;
      setAudioSpin(true);
      const count = options.getCount();
      if (options.isReduced()) {
        const direction = -1;
        camToNotch(glideSettleNotch(position, direction, count, options.isEnabled), 0);
        return;
      }
      stop();
      pullOrder = order;
      pullOrigin = position;
      velocity = pullLaunchVelocity({ order });
      setPhase("coast");
      schedule();
    },
    destroy() {
      pullSpin = false;
      landingWatch = clearLandingWatch();
      setAudioSpin(false);
      clearHold();
      stop();
      drag = null;
      setPhase("idle");
    },
  };
}

export function Reel({
  label,
  items,
  initialIndex,
  spinToken,
  spinOrder,
  guardToken = 0,
  guardIndex = 0,
  bendDegrees = 0,
  onIndex,
  onMotion,
  onGestureMotion,
  onPieces,
  stretch = null,
  centerPieces = null,
  alternatePullStops = false,
  lampIndex,
}: {
  label: string;
  items: ReelSymbol[];
  initialIndex: number;
  spinToken: number;
  spinOrder: number;
  guardToken?: number;
  guardIndex?: number;
  bendDegrees?: number;
  onIndex: (index: number) => void;
  onMotion: (moving: boolean) => void;
  onGestureMotion?: (moving: boolean) => void;
  onPieces?: (pieces: number) => void;
  stretch?: StretchConfig | null;
  centerPieces?: number | null;
  /** Weight, during a handle pull, sounds every other stop after the ice. */
  alternatePullStops?: boolean;
  /** Which wheel lamp follows this reel's speed. */
  lampIndex?: number;
}) {
  const [kinetics, setKinetics] = useState({ position: initialIndex, velocity: 0 });
  const position = kinetics.position;
  const velocity = kinetics.velocity;
  const engineRef = useRef<Engine | null>(null);
  const appliedGuard = useRef(0);
  const countRef = useRef(items.length);
  const itemsRef = useRef(items);
  const listenerRef = useRef({
    onIndex,
    onMotion,
    onGestureMotion,
    onPieces,
    onStretchFrame: (_frame: StretchFrame | null) => {},
    onGuest: (_guest: GuestCount | null) => {},
  });
  const stretchRef = useRef<StretchConfig | null>(stretch);
  const alternateRef = useRef(alternatePullStops);
  alternateRef.current = alternatePullStops;
  const lampIndexRef = useRef(lampIndex);
  lampIndexRef.current = lampIndex;
  const [stretchFrame, setStretchFrame] = useState<StretchFrame | null>(null);
  const [guestDraw, setGuestDraw] = useState<GuestCount | null>(null);
  itemsRef.current = items;
  stretchRef.current = stretch;
  listenerRef.current.onStretchFrame = setStretchFrame;
  listenerRef.current.onGuest = setGuestDraw;

  useEffect(() => {
    countRef.current = items.length;
  }, [items.length]);

  useEffect(() => {
    listenerRef.current.onIndex = onIndex;
    listenerRef.current.onMotion = onMotion;
    listenerRef.current.onGestureMotion = onGestureMotion;
    listenerRef.current.onPieces = onPieces;
  }, [onIndex, onMotion, onGestureMotion, onPieces]);

  useEffect(() => {
    const engine = createReelEngine({
      initialIndex,
      setKinetics: (next, speed) => {
        setKinetics({ position: next, velocity: speed });
        const index = lampIndexRef.current;
        if (index !== undefined) setWheelLampSpeed(index, speed);
      },
      getCount: () => countRef.current,
      onIndex: (index) => listenerRef.current.onIndex(index),
      onMotion: (moving) => listenerRef.current.onMotion(moving),
      onGestureMotion: (moving) => listenerRef.current.onGestureMotion?.(moving),
      isReduced: () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      isEnabled: (index) => {
        const list = itemsRef.current;
        return !list[mod(index, list.length)]?.disabled;
      },
      getStretch: () => stretchRef.current,
      onPieces: (pieces) => listenerRef.current.onPieces?.(pieces),
      onStretchFrame: (frame) => listenerRef.current.onStretchFrame?.(frame),
      onGuest: (next) => listenerRef.current.onGuest?.(next),
      alternatePullStops: () => alternateRef.current,
      speedCap: REEL_SPEED_CAPS[spinOrder] ?? REEL_SPEED_CAPS[0],
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      const index = lampIndexRef.current;
      if (index !== undefined) setWheelLampSpeed(index, 0);
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, [initialIndex]);

  useEffect(() => {
    if (spinToken === 0) return;
    engineRef.current?.lever(spinOrder);
  }, [spinToken, spinOrder]);

  useEffect(() => {
    if (!shouldApplyGuard(guardToken, appliedGuard.current)) return;
    appliedGuard.current = guardToken;
    engineRef.current?.settleGuard(guardIndex);
  }, [guardToken, guardIndex]);

  const drawingGuest = Boolean(guestDraw) && !stretchFrame && stretch;
  const viewItems = drawingGuest && guestDraw ? insertGuest(items, guestDraw, stretch?.label) : items;
  const viewPosition =
    drawingGuest && guestDraw
      ? guestDraw.run?.length
        ? position
        : projectGuest(position, guestDraw)
      : position;
  const count = viewItems.length;
  const shown = viewPosition - bendDegrees / STOP_DEGREES;
  const base = Math.floor(shown);
  const fraction = shown - base;
  const active = mod(Math.round(viewPosition), count);
  const facing = mod(Math.round(shown), count);
  const activeSymbol = viewItems[active];
  const rolling = Math.abs(velocity) > 1.2;
  const smear = rolling ? Math.min(8, Math.abs(velocity) * 0.16) : 0;
  const runIndex =
    guestDraw?.run?.length && guestDraw.insertAfter != null
      ? Math.round(position) - (guestDraw.insertAfter + 1)
      : -1;
  const runValue = runIndex >= 0 ? guestDraw?.run?.[runIndex] : undefined;
  const guestCenter = guestDraw?.run?.length
    ? (runValue ?? null)
    : guestDraw && stretch
      ? visibleTriple(position, countRows(stretch.stops, guestDraw))[1]
      : null;
  const spoken = stretchFrame ? stretchFrame.centered : guestCenter != null ? guestCenter : centerPieces;
  const spokenFace = spoken != null ? (stretch?.label?.(spoken) ?? countFace(spoken)) : null;
  const valueText = spokenFace
    ? `${spokenFace.mark} ${spokenFace.detail}`
    : activeSymbol
      ? `${activeSymbol.mark} ${activeSymbol.detail}`
      : label;

  return (
    <div className="reel-column" data-testid={`reel-${label.toLowerCase()}`}>
      <div className="reel-name">{label}</div>
      <div
        role="slider"
        tabIndex={0}
        aria-label={`${label} reel`}
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, count - 1)}
        aria-valuenow={spoken ?? active}
        aria-valuetext={valueText}
        data-count={spoken ?? activeSymbol?.mark ?? ""}
        data-stretching={stretchFrame ? "true" : "false"}
        className={
          stretchFrame
            ? "reel-viewport is-stretching"
            : rolling
              ? "reel-viewport is-rolling"
              : "reel-viewport"
        }
        style={{ height: REEL_ITEM_HEIGHT * 3, touchAction: "none" }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          if (event.cancelable) event.preventDefault();
          unlockReelClick();
          unlockStretchPops();
          const viewport = event.currentTarget;
          viewport.focus({ preventScroll: true });
          const bounds = viewport.getBoundingClientRect();
          const pointerId = event.pointerId;
          let closed = false;
          const endGesture = () => {
            if (closed) return;
            closed = true;
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);
            window.removeEventListener("lostpointercapture", onUp);
            if (viewport.hasPointerCapture?.(pointerId)) {
              try {
                viewport.releasePointerCapture(pointerId);
              } catch {
                /* The pointer is already gone. */
              }
            }
            engineRef.current?.pointerUp();
            viewport.blur();
          };
          const onMove = (moveEvent: PointerEvent) => {
            if (moveEvent.pointerId !== pointerId) return;
            if (moveEvent.cancelable) moveEvent.preventDefault();
            engineRef.current?.pointerMove(moveEvent.clientY, moveEvent.timeStamp);
          };
          const onUp = (upEvent: PointerEvent) => {
            if (upEvent.pointerId !== pointerId) return;
            endGesture();
          };
          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
          window.addEventListener("pointercancel", onUp);
          window.addEventListener("lostpointercapture", onUp);
          try {
            viewport.setPointerCapture(pointerId);
          } catch {
            /* Capture is optional. The window listeners still follow the finger. */
          }
          engineRef.current?.pointerDown(
            event.clientY,
            event.timeStamp,
            event.clientY - bounds.top,
            bounds.height,
          );
        }}
        onKeyDown={(event) => {
          unlockReelClick();
          unlockStretchPops();
          if (event.key === "ArrowDown" || event.key === "ArrowRight") {
            event.preventDefault();
            engineRef.current?.step(1);
          } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
            event.preventDefault();
            engineRef.current?.step(-1);
          } else if (event.key === "Home") {
            event.preventDefault();
            engineRef.current?.jump(0);
          } else if (event.key === "End") {
            event.preventDefault();
            engineRef.current?.jump(count - 1);
          }
        }}
      >
        <div className="reel-drum" style={{ top: REST_DRUM.top, height: REST_DRUM.height }} />
        <div className="reel-drum-band" style={{ top: REST_DRUM.top, height: REST_DRUM.height }}>
        <div className="reel-cylinder" style={{ top: -REST_DRUM.top, height: DRUM_WINDOW, bottom: "auto" }}>
        {stretchFrame
          ? stretchFrame.rows.map((row) => {
              const clip = stretchRowClip(row.screenTop, REEL_ITEM_HEIGHT, stretchFrame.direction, row.role);
              const clipPath =
                clip.clipTop > 0 || clip.clipBottom > 0
                  ? `inset(${clip.clipTop}px 0px ${clip.clipBottom}px 0px)`
                  : undefined;
              return (
              <div
                key={`${row.role}-${row.value}`}
                className="symbol"
                style={{
                  height: REEL_ITEM_HEIGHT,
                  zIndex: row.role === "pin" ? 8 : 3,
                  opacity: clip.opacity,
                  background: "#120e0a",
                  clipPath,
                  transform: `translate3d(0, ${row.screenTop}px, 0)`,
                }}
              >
                <div
                  className={row.centered ? "symbol-plate is-active" : "symbol-plate"}
                  style={{
                    opacity: 1,
                    background: "#1a130e",
                    boxShadow: row.centered
                      ? "inset 0 0 0 1px color-mix(in srgb, var(--melt-digit) 95%, transparent), 0 0 16px var(--melt-digit-glow)"
                      : "inset 0 0 0 1px rgba(198, 161, 90, 0.38)",
                  }}
                >
                  <span className="symbol-mark" style={{ color: row.centered ? "var(--melt-digit)" : "#f0e2c4" }}>
                    {(stretch?.label?.(row.value) ?? countFace(row.value)).mark}
                  </span>
                  <span className="symbol-detail">
                    {(stretch?.label?.(row.value) ?? countFace(row.value)).detail}
                  </span>
                  {row.role === "pin" && stretchFrame.rim.opacity > 0 ? (
                    <span
                      className="stretch-rim"
                      data-edge={stretchFrame.rim.edge}
                      style={{ opacity: stretchFrame.rim.opacity }}
                    />
                  ) : null}
                </div>
              </div>
              );
            })
          : WINDOW.map((offset) => {
          const index = mod(base + offset, count);
          const symbol = viewItems[index];
          if (!symbol) return null;
          const pose = cylinderPose(offset - fraction);
          const y = alignDevicePixel(
            REEL_ITEM_HEIGHT * 1.5 + pose.shift * REEL_ITEM_HEIGHT - REEL_ITEM_HEIGHT / 2,
            typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
          );
          const isActive = index === facing;
          const override = !drawingGuest && centerPieces != null && offset === 0;
          const customFace = override ? (stretch?.label?.(centerPieces) ?? countFace(centerPieces)) : null;
          const mark = customFace ? customFace.mark : symbol.mark;
          const detail = customFace ? customFace.detail : symbol.detail;
          const smearY = -Math.sign(velocity) * smear;
          return (
            <div
              key={offset}
              className="symbol"
              style={{
                height: REEL_ITEM_HEIGHT,
                transform: `translate3d(0, ${y}px, 0) scaleY(${pose.scaleY})`,
                filter: smear > 0.4 ? `blur(${smear * 0.22}px)` : undefined,
              }}
            >
              <div
                className={
                  !override && symbol.disabled
                    ? "symbol-plate is-disabled"
                    : isActive || override
                      ? "symbol-plate is-active"
                      : "symbol-plate"
                }
                style={{
                  filter: `brightness(${pose.brightness})`,
                  ...(settledPlateStyle() ?? {}),
                  boxShadow:
                    smear > 0.4
                      ? `0 ${smearY}px ${smear}px rgba(0, 0, 0, 0.35)`
                      : !symbol.disabled && isActive && symbol.tint
                        ? `inset 0 0 0 1px ${symbol.tint}, 0 0 16px color-mix(in srgb, ${symbol.tint} 20%, transparent)`
                        : undefined,
                }}
              >
                <span
                  className="symbol-mark"
                  style={symbol.disabled && !override ? undefined : { color: symbol.tint ?? "#f0e2c4" }}
                >
                  {mark}
                </span>
                <span className="symbol-detail">{detail}</span>
              </div>
            </div>
          );
        })}
        </div>
        </div>
        <div className="reel-drum-shade" style={{ top: REST_DRUM.top, height: REST_DRUM.height }} />
      </div>
      <div className="reel-nudge">
        <button
          type="button"
          aria-label={`Previous ${label.toLowerCase()}`}
          onClick={() => engineRef.current?.step(-1)}
        >
          <span aria-hidden="true">▲</span>
        </button>
        <button
          type="button"
          aria-label={`Next ${label.toLowerCase()}`}
          onClick={() => engineRef.current?.step(1)}
        >
          <span aria-hidden="true">▼</span>
        </button>
      </div>
    </div>
  );
}
