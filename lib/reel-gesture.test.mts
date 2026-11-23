import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

import { createReelEngine } from "@/components/reel";
import { REEL_SPEED_CAP } from "@/lib/drum";
import { settleReels } from "@/lib/haptics";
import { COUNTS } from "@/lib/metals";
import {
  LANDING_KNOCK_GAIN,
  LANDING_PAWL_GAIN,
  loadReelClick,
  resetReelClickForTests,
} from "@/lib/reel-click";
import { guestWindow, STRETCH_HOLD_MS, type GuestCount } from "@/lib/stretch";

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

function harness() {
  let position = COUNTS.indexOf(20);
  let velocity = 0;
  let moving = false;
  let guest: GuestCount | null = null;
  const engine = createReelEngine({
    initialIndex: position,
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
    onStretchFrame() {},
    onGuest(next) {
      guest = next;
    },
    alternatePullStops: () => false,
    speedCap: REEL_SPEED_CAP,
  });
  return {
    engine,
    read: () => ({ position, velocity, guest }),
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

test("a stretch from rest 20 to x18 keeps 17, 18, and 19", () => {
  installFrame();
  mock.timers.enable({ apis: ["setTimeout"] });
  const { engine, read } = harness();
  stretchCycle(engine, 1_000);
  const rested = read();
  const guest = rested.guest;
  if (!guest?.run?.length) assert.fail("stretch release dropped the visible run");
  assert.deepEqual(guestWindow(COUNTS, rested.position, guest), [17, 18, 19]);
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
