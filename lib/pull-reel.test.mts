import assert from "node:assert/strict";
import { test } from "node:test";

import { createReelEngine } from "@/components/reel";
import { holdAfterMotion, holdForPull, IDLE_COUNT_GUARD, type CountGuardHold } from "@/lib/count-guard";
import { REEL_SPEED_CAP } from "@/lib/drum";
import { settleReels } from "@/lib/haptics";
import { REEL_ITEM_HEIGHT } from "@/lib/metals";
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
function pullAll(
  frames: number[],
  guardIndex: number | null,
): { samples: Sample[]; rests: number[]; releasedAt: number } {
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
      pullRandom: () => 0,
    }),
  );

  const samples: Sample[] = [];
  const rests: number[] = [0, 0, 0];
  let now = 5_000;
  const realNow = performance.now.bind(performance);
  Object.defineProperty(performance, "now", { configurable: true, value: () => now });
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
    Object.defineProperty(performance, "now", { configurable: true, value: realNow });
  }
  return { samples, rests, releasedAt: 5_000 };
}

function assertPull(frames: number[], guardIndex: number | null) {
  const { samples, rests } = pullAll(frames, guardIndex);
  assert.ok(samples.length > 3);
  const origin = samples[0].t;
  for (const order of [0, 1, 2] as const) {
    assert.equal(samples[0].velocity[order], -REEL_SPEED_CAP);
    assert.equal(samples[0].position[order], 0);
  }
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

test("a 135ms frame spanning the stop leaves every reel at rest with velocity 0", () => {
  for (const order of [0, 1, 2] as const) {
    const stop = PULL_LIGHT_STOP_S[order] * 1000;
    const frames = [16];
    let cursor = 16;
    while (cursor < stop - 24) {
      frames.push(16);
      cursor += 16;
    }
    frames.push(135, 16, 16, 16, 16);
    const { samples, rests } = pullAll(frames, null);
    const origin = samples[0].t;
    const resting = samples.find((sample) => sample.t > origin + 500 && sample.velocity[order] === 0);
    assert.ok(resting, `reel ${order} never rested`);
    const elapsed = resting.t - origin;
    assert.ok(elapsed + 1 >= stop, `reel ${order} rested early at ${elapsed}`);
    assert.ok(elapsed - stop <= 135 + 20, `reel ${order} rested late at ${elapsed}`);
    assert.ok(samples.filter((sample) => sample.t >= resting.t).every((sample) => sample.velocity[order] === 0));
    assert.equal(rests[order], 1);
    assert.equal(resting.velocity[order], 0);
    const face = Math.round(pullPose(0, order, PULL_LIGHT_STOP_S[order]).position);
    const after = samples.filter((sample) => sample.t >= resting.t);
    assert.ok(after.length >= 4);
    for (const sample of after) {
      assert.equal(sample.position[order], face);
      assert.equal(sample.velocity[order], 0);
    }
  }
});

test("a commit lag does not start the clock before the first moving paint", () => {
  for (const lag of [54, 96, 193]) {
    const frames = [lag, ...Array.from({ length: 400 }, () => 16.7)];
    const { samples } = pullAll(frames, null);
    const anchor = samples[0].t;
    for (const order of [0, 1, 2] as const) {
      assert.equal(samples[0].position[order], 0, `lag ${lag} jumped reel ${order}`);
      assert.equal(samples[0].velocity[order], -REEL_SPEED_CAP);
      const stop = PULL_LIGHT_STOP_S[order] * 1000;
      const resting = samples.find((sample) => sample.t > anchor + 500 && sample.velocity[order] === 0);
      assert.ok(resting, `reel ${order} never rested after a ${lag}ms lag`);
      const elapsed = resting.t - anchor;
      assert.ok(elapsed + 1 >= stop, `reel ${order} rested early at ${elapsed} after a ${lag}ms lag`);
      assert.ok(elapsed - stop <= 16.7 + 1, `reel ${order} rested late at ${elapsed} after a ${lag}ms lag`);
      const face = Math.round(pullPose(0, order, PULL_LIGHT_STOP_S[order]).position);
      for (const sample of samples.filter((item) => item.t >= resting.t)) {
        assert.equal(sample.position[order], face);
        assert.equal(sample.velocity[order], 0);
      }
    }
  }
});

test("throttled frames land within one frame of the first moving paint", () => {
  const frames = [55, 80, 120, 180, 262];
  const { samples } = pullAll(frames, null);
  const anchor = samples[0].t;
  const slack = Math.max(...frames);
  for (const order of [0, 1, 2] as const) {
    assert.equal(samples[0].position[order], 0);
    assert.equal(samples[0].velocity[order], -REEL_SPEED_CAP);
    const stop = PULL_LIGHT_STOP_S[order] * 1000;
    const resting = samples.find((sample) => sample.t > anchor + 500 && sample.velocity[order] === 0);
    assert.ok(resting, `reel ${order} never rested`);
    const elapsed = resting.t - anchor;
    assert.ok(elapsed + 1 >= stop, `reel ${order} rested early at ${elapsed}`);
    assert.ok(elapsed - stop <= slack + 1, `reel ${order} rested late at ${elapsed}`);
    const face = Math.round(pullPose(0, order, PULL_LIGHT_STOP_S[order]).position);
    for (const sample of samples.filter((item) => item.t >= resting.t)) {
      assert.equal(sample.position[order], face);
      assert.equal(sample.velocity[order], 0);
    }
  }
});

function withReel(order: number, run: (reel: {
  engine: ReturnType<typeof createReelEngine>;
  read: () => { position: number; velocity: number };
  pump: (ms: number) => void;
  queued: { length: number };
}) => void) {
  const queued: { callback: FrameRequestCallback; id: number }[] = [];
  let nextId = 1;
  const realFrame = globalThis.requestAnimationFrame;
  const realCancel = globalThis.cancelAnimationFrame;
  const realNow = performance.now.bind(performance);
  let now = 8_000;
  Object.defineProperty(performance, "now", { configurable: true, value: () => now });
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
  let position = 0;
  let velocity = 0;
  const engine = createReelEngine({
    initialIndex: 0,
    setKinetics(next, speed) {
      position = next;
      velocity = speed;
    },
    getCount: () => FACES[order],
    onIndex() {},
    onMotion() {},
    isReduced: () => false,
    isEnabled: () => true,
    getStretch: () => null,
    onPieces() {},
    onStretchFrame() {},
    onGuest() {},
    alternatePullStops: () => order === 1,
    speedCap: REEL_SPEED_CAP,
    pullRandom: () => 0,
  });
  const pump = (ms: number) => {
    const batch = queued.splice(0, queued.length);
    now += ms;
    for (const entry of batch) entry.callback(now);
  };
  const read = () => ({ position, velocity });
  try {
    run({ engine, read, pump, queued });
  } finally {
    globalThis.requestAnimationFrame = realFrame;
    globalThis.cancelAnimationFrame = realCancel;
    Object.defineProperty(performance, "now", { configurable: true, value: realNow });
  }
}

function landPull(order: number, reel: {
  engine: ReturnType<typeof createReelEngine>;
  read: () => { position: number; velocity: number };
  pump: (ms: number) => void;
  queued: { length: number };
}) {
  reel.engine.lever(order);
  for (let step = 0; step < 800 && reel.queued.length > 0; step += 1) {
    reel.pump(16);
    if (reel.read().velocity === 0 && step > 10) break;
  }
  assert.equal(reel.read().velocity, 0, `reel ${order} did not land`);
}

test("after a pull lands, a drag and a flick move every reel", () => {
  for (const order of [0, 1, 2] as const) {
    withReel(order, (reel) => {
      landPull(order, reel);
      const face = reel.read().position;
      assert.equal(face, Math.round(face));
      const y = 400;
      const time = 20_000;
      reel.engine.pointerDown(y, time, 40, 200);
      reel.engine.pointerMove(y + REEL_ITEM_HEIGHT * 2, time + 40);
      const dragged = reel.read().position;
      assert.ok(Math.abs(dragged - face) > 0.5, `drag did not move reel ${order}`);
      reel.engine.pointerMove(y + REEL_ITEM_HEIGHT * 2, time + 80);
      reel.engine.pointerMove(y + REEL_ITEM_HEIGHT * 5, time + 100);
      reel.engine.pointerMove(y + REEL_ITEM_HEIGHT * 9, time + 120);
      const atRelease = reel.read().position;
      reel.engine.pointerUp();
      let spun = false;
      for (let frame = 0; frame < 8 && reel.queued.length > 0; frame += 1) {
        reel.pump(16);
        if (Math.abs(reel.read().position - atRelease) > 0.5 || Math.abs(reel.read().velocity) > 1) spun = true;
      }
      assert.equal(spun, true, `flick did not spin reel ${order}`);
    });
  }
});

test("a re-pull and a second pull both take the reel", () => {
  for (const order of [0, 1, 2] as const) {
    withReel(order, (reel) => {
      reel.engine.lever(order);
      reel.pump(16);
      assert.equal(reel.read().velocity, -REEL_SPEED_CAP);
      for (let step = 0; step < 12; step += 1) reel.pump(16);
      const mid = reel.read().position;
      assert.ok(mid < -1, `reel ${order} had not moved before the re-pull`);
      reel.engine.lever(order);
      reel.pump(16);
      assert.equal(reel.read().velocity, -REEL_SPEED_CAP);
      assert.ok(Math.abs(reel.read().position - mid) < 1e-6, `re-pull jumped reel ${order}`);
      reel.pump(16);
      assert.ok(reel.read().position < mid - 0.1, `re-pull did not spin reel ${order}`);
      landPull(order, reel);
      const face = reel.read().position;
      reel.engine.lever(order);
      reel.pump(16);
      assert.equal(reel.read().velocity, -REEL_SPEED_CAP);
      assert.ok(Math.abs(reel.read().position - face) < 1e-6, `second pull jumped reel ${order}`);
      reel.pump(16);
      assert.ok(reel.read().position < face - 0.1);
      landPull(order, reel);
      const again = reel.read().position;
      const y = 400;
      reel.engine.pointerDown(y, 40_000, 40, 200);
      reel.engine.pointerMove(y + REEL_ITEM_HEIGHT * 2, 40_040);
      assert.ok(Math.abs(reel.read().position - again) > 0.5, `drag after the second pull did not move reel ${order}`);
    });
  }
});

test("a finger takes the reel once the stop time has arrived", () => {
  withReel(0, (reel) => {
    reel.engine.lever(0);
    reel.pump(16);
    const spinning = reel.read().position;
    reel.engine.pointerDown(400, 8_016 + 100, 40, 200);
    reel.engine.pointerMove(400 + REEL_ITEM_HEIGHT * 2, 8_016 + 140);
    assert.equal(reel.read().position, spinning);
    const landedTime = 8_016 + PULL_LIGHT_STOP_S[0] * 1000 + 30;
    reel.engine.pointerDown(400, landedTime, 40, 200);
    reel.engine.pointerMove(400 + REEL_ITEM_HEIGHT * 2, landedTime + 40);
    assert.ok(Math.abs(reel.read().position - spinning) > 0.5);
    assert.equal(reel.engine.debugState().owner, "finger");
    assert.equal(reel.engine.debugState().pullClock, false);
  });
});

test("a jittered launch still lands with velocity 0", () => {
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
  let position = 0;
  let velocity = 0;
  let now = 9_000;
  const realNow = performance.now.bind(performance);
  Object.defineProperty(performance, "now", { configurable: true, value: () => now });
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
      pullRandom: () => 1,
    });
    engine.lever(2);
    const batch = queued.splice(0, queued.length);
    now += 16;
    for (const entry of batch) entry.callback(now);
    assert.equal(velocity, -REEL_SPEED_CAP * 0.96);
    for (let step = 0; step < 800 && queued.length > 0; step += 1) {
      const next = queued.splice(0, queued.length);
      now += 16;
      for (const entry of next) entry.callback(now);
      if (velocity === 0 && step > 10) break;
    }
    assert.equal(velocity, 0);
    assert.equal(position, Math.round(position));
    assert.equal(engine.debugState().pullClock, false);
    assert.equal(engine.debugState().pullSettled, false);
  } finally {
    globalThis.requestAnimationFrame = realFrame;
    globalThis.cancelAnimationFrame = realCancel;
    Object.defineProperty(performance, "now", { configurable: true, value: realNow });
  }
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
  let now = 1_000;
  const realNow = performance.now.bind(performance);
  Object.defineProperty(performance, "now", { configurable: true, value: () => now });
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
      pullRandom: () => 0,
    });
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
    Object.defineProperty(performance, "now", { configurable: true, value: realNow });
  }
});
