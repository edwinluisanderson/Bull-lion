import assert from "node:assert/strict";
import { test } from "node:test";

import { createReelEngine } from "@/components/reel";
import { holdAfterMotion, holdForPull, IDLE_COUNT_GUARD, type CountGuardHold } from "@/lib/count-guard";
import { REEL_SPEED_CAP } from "@/lib/drum";
import { settleReels } from "@/lib/haptics";
import { PULL_LIGHT_STOP_S, pullPose } from "@/lib/pull-spin";

const FACES = [5, 16, 8];

function mod(value: number, count: number): number {
  return ((value % count) + count) % count;
}

type Sample = { t: number; velocity: number[]; position: number[] };

/**
 * Three reels, one lever pull, and the last-reel landing callback.
 * `guardIndex` is the copper correction the count reel receives once every reel is idle.
 */
function pullAll(frames: number[], guardIndex: number | null): { samples: Sample[]; rests: number[] } {
  const queued: { callback: FrameRequestCallback; id: number }[] = [];
  let nextId = 1;
  const realFrame = globalThis.requestAnimationFrame;
  const realCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
    const id = nextId;
    nextId += 1;
    queued.push({ callback, id });
    return id;
  };
  globalThis.cancelAnimationFrame = (id: number) => {
    const index = queued.findIndex((entry) => entry.id === id);
    if (index >= 0) queued.splice(index, 1);
  };

  const motion = [false, false, false];
  let hold: CountGuardHold = holdForPull(IDLE_COUNT_GUARD);
  let releaseGuard = false;
  const state = FACES.map(() => ({ position: 0, velocity: 0 }));
  const engines = FACES.map((count, reel) =>
    createReelEngine({
      initialIndex: 0,
      setKinetics(position, velocity) {
        state[reel] = { position, velocity };
      },
      getCount: () => count,
      onIndex() {},
      onMotion(moving) {
        const previous = motion.slice();
        motion[reel] = moving;
        settleReels(previous, motion);
        const step = holdAfterMotion(hold, motion);
        hold = step.hold;
        if (!moving && previous[reel]) rests[reel] += 1;
        if (step.released) releaseGuard = true;
      },
      isReduced: () => false,
      isEnabled: () => true,
      getStretch: () => null,
      onPieces() {},
      onStretchFrame() {},
      onGuest() {},
      alternatePullStops: () => reel === 1,
      speedCap: REEL_SPEED_CAP,
    }),
  );

  const samples: Sample[] = [];
  const rests: number[] = [0, 0, 0];
  let now = 5_000;
  try {
    engines.forEach((engine, order) => engine.lever(order));
    for (let step = 0; step < 800 && queued.length > 0; step += 1) {
      const batch = queued.splice(0, queued.length);
      now += frames[step % frames.length];
      for (const entry of batch) entry.callback(now);
      samples.push({
        t: now,
        velocity: state.map((reel) => reel.velocity),
        position: state.map((reel) => reel.position),
      });
      if (releaseGuard && guardIndex !== null) {
        releaseGuard = false;
        engines[2].settleGuard(guardIndex);
        samples.push({
          t: now,
          velocity: state.map((reel) => reel.velocity),
          position: state.map((reel) => reel.position),
        });
      }
      if (motion.every((moving) => !moving) && queued.length === 0) break;
    }
  } finally {
    globalThis.requestAnimationFrame = realFrame;
    globalThis.cancelAnimationFrame = realCancel;
  }
  return { samples, rests };
}

function assertPull(frames: number[], guardIndex: number | null) {
  const { samples, rests } = pullAll(frames, guardIndex);
  assert.ok(samples.length > 3);
  const started = samples.findIndex((sample) => sample.velocity.some((speed) => speed !== 0));
  assert.ok(started >= 0);
  const origin = samples[started].t;
  for (const sample of samples) {
    for (const speed of sample.velocity) {
      assert.ok(Math.abs(speed) <= REEL_SPEED_CAP + 1e-6, `velocity spike ${speed}`);
    }
  }
  for (const order of [0, 1, 2] as const) {
    const rest = samples.find(
      (sample) => sample.t >= origin && sample.velocity[order] === 0 && sample.t - origin > 500,
    );
    assert.ok(rest, `reel ${order} never rested`);
    const dt = frames.reduce((max, frame) => Math.max(max, frame), 0);
    const slack = Math.max(50, dt);
    const elapsed = rest.t - origin;
    assert.ok(elapsed + 1 >= PULL_LIGHT_STOP_S[order] * 1000, `reel ${order} rested early at ${elapsed}`);
    assert.ok(elapsed - PULL_LIGHT_STOP_S[order] * 1000 <= slack + 1, `reel ${order} rested late at ${elapsed}`);
    const face = mod(Math.round(pullPose(0, order, PULL_LIGHT_STOP_S[order]).position), FACES[order]);
    const expected = order === 2 && guardIndex !== null ? mod(guardIndex, FACES[2]) : face;
    assert.equal(rests[order], 1);
    assert.equal(rest.velocity[order], 0);
    const settled = samples.filter((sample) => sample.t >= rest.t);
    assert.ok(settled.every((sample) => sample.velocity[order] === 0));
    assert.equal(mod(settled.at(-1)!.position[order], FACES[order]), expected);
  }
}

test("three reels rest together on a pull, including the last-reel guard", () => {
  assertPull([16.7], null);
  assertPull([16.7, 25, 24, 45, 90, 121], 6);
  assertPull([55, 80, 120, 180, 262], 6);
});

test("a jump during the pull does not take the count reel", () => {
  const queued: FrameRequestCallback[] = [];
  const realFrame = globalThis.requestAnimationFrame;
  const realCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
    queued.push(callback);
    return queued.length;
  };
  globalThis.cancelAnimationFrame = () => {
    queued.length = 0;
  };
  let velocity = 0;
  let position = 0;
  try {
    const engine = createReelEngine({
      initialIndex: 0,
      setKinetics(next, speed) {
        position = next;
        velocity = speed;
      },
      getCount: () => 8,
      onIndex() {},
      onMotion() {},
      isReduced: () => false,
      isEnabled: () => true,
      getStretch: () => null,
      onPieces() {},
      onStretchFrame() {},
      onGuest() {},
      alternatePullStops: () => false,
      speedCap: REEL_SPEED_CAP,
    });
    let now = 1_000;
    engine.lever(2);
    engine.pointerDown(10, now, 40, 200);
    for (let step = 0; step < 40; step += 1) {
      const batch = queued.splice(0, queued.length);
      now += 50;
      for (const callback of batch) callback(now);
      if (step === 10) engine.jump(3);
    }
    assert.ok(Math.abs(velocity) > 1);
    assert.ok(position < -5);
  } finally {
    globalThis.requestAnimationFrame = realFrame;
    globalThis.cancelAnimationFrame = realCancel;
  }
});
