import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

import { createReelEngine, type StretchFrame } from "@/components/reel";
import { REEL_SPEED_CAP } from "@/lib/drum";
import { settleReels } from "@/lib/haptics";
import { COUNTS, REEL_ITEM_HEIGHT } from "@/lib/metals";
import {
  LANDING_KNOCK_GAIN,
  LANDING_PAWL_GAIN,
  loadReelClick,
  resetReelClickForTests,
} from "@/lib/reel-click";
import {
  betweenFaceVisible,
  centerFaceOffset,
  guestWindow,
  STRETCH_HOLD_MS,
  type GuestCount,
} from "@/lib/stretch";

const queued: FrameRequestCallback[] = [];

function installFrame() {
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
    queued.push(callback);
    return queued.length;
  };
  globalThis.cancelAnimationFrame = () => {};
}

function flushFrames() {
  const batch = queued.splice(0, queued.length);
  const time = performance.now() + 400;
  for (const callback of batch) callback(time);
}

function harness(start = COUNTS.indexOf(20)) {
  let position = start;
  let velocity = 0;
  let moving = false;
  let guest: GuestCount | null = null;
  let frame: StretchFrame | null = null;
  const engine = createReelEngine({
    initialIndex: start,
    setKinetics(next, speed) {
      position = next;
      velocity = speed;
    },
    getCount: () => COUNTS.length,
    onIndex() {},
    onMotion(next) {
      const previous = [moving];
      moving = next;
      settleReels(previous, [moving]);
    },
    isReduced: () => false,
    isEnabled: () => true,
    getStretch: () => ({ stops: COUNTS, isValueEnabled: () => true }),
    onPieces() {},
    onStretchFrame(next) {
      frame = next;
    },
    onGuest(next) {
      guest = next;
    },
    alternatePullStops: () => false,
    speedCap: REEL_SPEED_CAP,
  });
  return {
    engine,
    read: () => ({ position, velocity, guest, frame }),
  };
}

function landingPairs(gains: number[]): number {
  let count = 0;
  for (let index = 0; index < gains.length - 1; index += 1) {
    if (gains[index] === LANDING_PAWL_GAIN && gains[index + 1] === LANDING_KNOCK_GAIN) count += 1;
  }
  return count;
}

type GainNode = { gain: { value: number }; connect: (target?: object) => void };

class FakeAudio {
  state: AudioContextState = "running";
  destination = {};
  currentTime = 0;
  gains: number[] = [];

  resume() {
    this.state = "running";
    return Promise.resolve();
  }

  decodeAudioData() {
    return Promise.resolve({ id: this.gains.length });
  }

  createGain(): GainNode {
    return {
      gain: { value: 1 },
      connect() {},
    };
  }

  createBiquadFilter() {
    return {
      type: "",
      Q: { value: 0 },
      frequency: {
        value: 20000,
        cancelScheduledValues() {},
        setValueAtTime() {},
        setTargetAtTime() {},
      },
      connect() {},
    };
  }

  createBufferSource() {
    const audio = this;
    const source = {
      buffer: null as object | null,
      playbackRate: { value: 1 },
      gainNode: null as GainNode | null,
      connect(node: GainNode) {
        source.gainNode = node;
      },
      start() {
        audio.gains.push(source.gainNode?.gain.value ?? -1);
      },
    };
    return source;
  }
}

function installAudio() {
  const fake = new FakeAudio();
  const host = globalThis as typeof globalThis & { window?: typeof globalThis };
  if (!host.window) {
    Object.defineProperty(host, "window", { configurable: true, writable: true, value: host });
  }
  Object.defineProperty(host.window ?? host, "AudioContext", {
    configurable: true,
    writable: true,
    value: function AudioContext() {
      return fake;
    },
  });
  host.fetch = (async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(8),
  })) as unknown as typeof fetch;
  return fake;
}

function coastUntilRest() {
  let now = performance.now();
  for (let frame = 0; frame < 400 && queued.length > 0; frame += 1) {
    const batch = queued.splice(0, queued.length);
    now += 16;
    for (const callback of batch) callback(now);
  }
}

afterEach(() => {
  resetReelClickForTests();
  mock.timers.reset();
});

function stretchCycle(engine: ReturnType<typeof createReelEngine>, time: number) {
  const y = 400;
  engine.pointerDown(y, time, 120, 258);
  mock.timers.tick(STRETCH_HOLD_MS);
  engine.pointerMove(y + 180, time + STRETCH_HOLD_MS + 40);
  engine.pointerUp();
  flushFrames();
}

test("after stretch releases, a drag moves the reel and a fling spins it", () => {
  installFrame();
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    for (const cycles of [1, 2, 3]) {
      const { engine, read } = harness();
      let time = 1_000;
      for (let cycle = 0; cycle < cycles; cycle += 1) {
        stretchCycle(engine, time);
        time += 1_000;
      }
      const rested = read().position;
      const y = 400;
      engine.pointerDown(y, time, 120, 258);
      engine.pointerMove(y + 70, time + 40);
      const dragged = read().position;
      assert.ok(Math.abs(dragged - rested) > 0.4, `drag after ${cycles} stretches did not move`);

      engine.pointerMove(y + 70, time + 80);
      engine.pointerMove(y + 160, time + 100);
      engine.pointerMove(y + 280, time + 120);
      const atRelease = read().position;
      engine.pointerUp();
      let spun = false;
      let now = performance.now();
      for (let frame = 0; frame < 6 && queued.length > 0; frame += 1) {
        const batch = queued.splice(0, queued.length);
        now += 16;
        for (const callback of batch) callback(now);
        if (Math.abs(read().position - atRelease) > 0.5) spun = true;
      }
      assert.equal(spun, true, `fling after ${cycles} stretches settled in place`);
      engine.destroy();
    }
  } finally {
    mock.timers.reset();
  }
});

function liftFaces(state: {
  position: number;
  guest: GuestCount | null;
  frame: StretchFrame | null;
}): number[] {
  const frame = state.frame;
  if (frame) {
    const rows = frame.rows
      .filter((row) => row.screenTop < REEL_ITEM_HEIGHT * 3 && row.screenTop + REEL_ITEM_HEIGHT > 0)
      .filter(
        (row) => row.role !== "between" || betweenFaceVisible(row.screenTop, REEL_ITEM_HEIGHT, frame.direction),
      )
      .sort((a, b) => a.screenTop - b.screenTop || a.value - b.value);
    const center = rows.findIndex((row) => row.centered);
    if (center >= 0) {
      return [center - 1, center, center + 1]
        .map((index) => rows[index]?.value)
        .filter((value): value is number => value !== undefined);
    }
  }
  return visibleFaces(state.position, state.guest);
}

function visibleFaces(position: number, guest: GuestCount | null): number[] {
  if (guest?.run?.length) return guestWindow(COUNTS, position, guest);
  const count = COUNTS.length;
  const center = Math.round(position);
  const at = (index: number) => COUNTS[((index % count) + count) % count];
  return [at(center - 1), at(center), at(center + 1)];
}

function settle(read: () => { position: number }) {
  let now = performance.now();
  for (let frame = 0; frame < 80 && queued.length > 0; frame += 1) {
    const batch = queued.splice(0, queued.length);
    now += 16;
    for (const callback of batch) callback(now);
  }
  return read().position;
}

test("a release keeps the centered face at the wrap and on a mixed window", () => {
  installFrame();
  mock.timers.enable({ apis: ["setTimeout"] });
  const y = 400;

  const wrap = harness(COUNTS.indexOf(100));
  wrap.engine.pointerDown(y, 1_000, 120, 258);
  mock.timers.tick(STRETCH_HOLD_MS);
  wrap.engine.pointerMove(y - 90, 1_000 + STRETCH_HOLD_MS + 300);
  wrap.engine.pointerMove(y - 94, 1_000 + STRETCH_HOLD_MS + 320);
  const wrapHeld = visibleFaces(wrap.read().position, wrap.read().guest);
  assert.deepEqual(wrapHeld, [100, 1, 2]);
  wrap.engine.pointerUp();
  settle(wrap.read);
  assert.deepEqual(visibleFaces(wrap.read().position, wrap.read().guest), [100, 1, 2]);
  wrap.engine.destroy();

  const mixed = harness(COUNTS.indexOf(20));
  mixed.engine.pointerDown(y, 2_000, 120, 258);
  mock.timers.tick(STRETCH_HOLD_MS);
  mixed.engine.pointerMove(y + 3 * 86, 2_000 + STRETCH_HOLD_MS + 200);
  mixed.engine.pointerUp();
  settle(mixed.read);
  assert.deepEqual(visibleFaces(mixed.read().position, mixed.read().guest), [10, 17, 18]);
  const from = mixed.read().position;
  mixed.engine.pointerDown(y, 4_000, 40, 258);
  mixed.engine.pointerMove(y - 86, 4_400);
  mixed.engine.pointerMove(y - 90, 4_420);
  assert.deepEqual(visibleFaces(mixed.read().position, mixed.read().guest), [17, 18, 20]);
  assert.ok(Math.abs(mixed.read().position - from) > 0.5);
  mixed.engine.pointerUp();
  settle(mixed.read);
  assert.deepEqual(visibleFaces(mixed.read().position, mixed.read().guest), [17, 18, 20]);
  mixed.engine.destroy();
});

test("a one-step stretch to 21 can be dragged and flung, and 22 never appears", () => {
  installFrame();
  mock.timers.enable({ apis: ["setTimeout"] });
  for (const cycle of [1, 2, 3]) {
    const { engine, read } = harness();
    const time = 1_000;
    const y = 400;
    engine.pointerDown(y, time, 120, 258);
    mock.timers.tick(STRETCH_HOLD_MS);
    engine.pointerMove(y - 96, time + STRETCH_HOLD_MS + 40);
    engine.pointerUp();
    flushFrames();
    const restedFaces = read();
    const guest = restedFaces.guest;
    if (!guest?.run?.length) assert.fail("the one-step face was not kept");
    const faces = guestWindow(COUNTS, restedFaces.position, guest);
    assert.equal(faces.includes(22), false, `cycle ${cycle} showed 22`);
    assert.equal(faces.includes(21), true);
    const rested = read().position;
    engine.pointerDown(y, time + 800, 40, 258);
    engine.pointerMove(y + 80, time + 840);
    assert.ok(Math.abs(read().position - rested) > 0.4, `drag after one-step stretch ${cycle} did not move`);
    engine.pointerMove(y + 170, time + 870);
    engine.pointerMove(y + 280, time + 900);
    const atRelease = read().position;
    engine.pointerUp();
    let spun = false;
    let now = performance.now();
    for (let frame = 0; frame < 8 && queued.length > 0; frame += 1) {
      const batch = queued.splice(0, queued.length);
      now += 16;
      for (const callback of batch) callback(now);
      if (Math.abs(read().position - atRelease) > 0.5) spun = true;
    }
    assert.equal(spun, true, `fling after one-step stretch ${cycle} settled in place`);
    const after = read();
    if (after.guest) {
      assert.equal(guestWindow(COUNTS, after.position, after.guest).includes(22), false);
    }
    engine.destroy();
  }
});

test("a stretch from rest 20 to x18 keeps the faces that cleared the pin", () => {
  installFrame();
  mock.timers.enable({ apis: ["setTimeout"] });
  const { engine, read } = harness();
  stretchCycle(engine, 1_000);
  const rested = read();
  const guest = rested.guest;
  if (!guest?.run?.length) assert.fail("stretch release dropped the visible run");
  assert.deepEqual(guestWindow(COUNTS, rested.position, guest), [10, 18, 19]);
  assert.equal(guestWindow(COUNTS, rested.position, guest).includes(17), false);
  engine.destroy();
});

test("a fling after 1, 2, and 3 stretches lands with the pawl and knock", async () => {
  installFrame();
  const fake = installAudio();
  await loadReelClick();
  mock.timers.enable({ apis: ["setTimeout"] });
  for (const cycles of [1, 2, 3]) {
    fake.gains.length = 0;
    const { engine } = harness();
    let time = 1_000;
    for (let cycle = 0; cycle < cycles; cycle += 1) {
      stretchCycle(engine, time);
      time += 1_000;
    }
    const afterRelease = landingPairs(fake.gains);
    assert.equal(afterRelease, cycles, `release landing missing after ${cycles} stretches`);
    const y = 400;
    engine.pointerDown(y, time, 120, 258);
    engine.pointerMove(y + 70, time + 40);
    engine.pointerMove(y + 160, time + 70);
    engine.pointerMove(y + 280, time + 100);
    engine.pointerUp();
    coastUntilRest();
    assert.equal(
      landingPairs(fake.gains),
      cycles + 1,
      `fling landing missing after ${cycles} stretches`,
    );
    assert.equal(queued.length, 0);
    engine.destroy();
  }
});

test("wrap stretches keep the lift faces and rest on an exact notch", () => {
  installFrame();
  mock.timers.enable({ apis: ["setTimeout"] });
  const cases: { start: number; sign: number; steps: number; extra?: number }[] = [
    { start: 100, sign: -1, steps: 1 },
    { start: 100, sign: -1, steps: 2 },
    { start: 100, sign: -1, steps: 3 },
    { start: 100, sign: 1, steps: 1 },
    { start: 100, sign: 1, steps: 2 },
    { start: 100, sign: 1, steps: 3 },
    { start: 1, sign: 1, steps: 1 },
    { start: 1, sign: 1, steps: 2 },
    { start: 1, sign: 1, steps: 3 },
    { start: 100, sign: -1, steps: 1, extra: 5 },
  ];
  for (const item of cases) {
    const { engine, read } = harness(COUNTS.indexOf(item.start));
    const y0 = 400;
    let time = 5_000;
    engine.pointerDown(y0, time, 120, 258);
    mock.timers.tick(STRETCH_HOLD_MS);
    time += STRETCH_HOLD_MS;
    const travel = item.sign * (item.steps * REEL_ITEM_HEIGHT + (item.extra ?? 0));
    const moves = 8;
    for (let step = 1; step <= moves; step += 1) {
      time += 16;
      engine.pointerMove(y0 + (travel * step) / moves, time);
    }
    const held = liftFaces(read());
    engine.pointerUp();
    settle(read);
    const rested = read();
    const label = `${item.start} ${item.sign < 0 ? "up" : "down"} ${item.steps}${item.extra ? `+${item.extra}px` : ""}`;
    assert.deepEqual(visibleFaces(rested.position, rested.guest), held, label);
    assert.ok(Math.abs(centerFaceOffset(rested.position)) < 1e-9, `${label} offset`);
    assert.ok(Math.abs(rested.position - Math.round(rested.position)) < 1e-9, `${label} notch`);
    engine.destroy();
  }
});

test("a one-step stretch from 50 to 49 keeps 25 and then sits still", () => {
  installFrame();
  mock.timers.enable({ apis: ["setTimeout"] });
  const { engine, read } = harness(COUNTS.indexOf(50));
  const y = 400;
  const time = 8_000;
  engine.pointerDown(y, time, 120, 258);
  mock.timers.tick(STRETCH_HOLD_MS);
  engine.pointerMove(y + REEL_ITEM_HEIGHT * 1.5, time + STRETCH_HOLD_MS + 300);
  const held = read().frame?.rows.find((row) => row.centered)?.value;
  assert.equal(held, 49);
  engine.pointerUp();
  settle(read);
  const rested = read();
  assert.deepEqual(visibleFaces(rested.position, rested.guest), [25, 49, 50]);
  const parked = rested.position;
  settle(read);
  assert.equal(read().position, parked);
  assert.deepEqual(visibleFaces(read().position, read().guest), [25, 49, 50]);
  engine.destroy();
});
