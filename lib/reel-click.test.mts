import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { resetHapticQueue, setReelTicksOpen, settleReels } from "@/lib/haptics";
import {
  KNOCK_GAIN,
  LANDING_KNOCK_GAIN,
  LANDING_PAWL_GAIN,
  LANDING_RATE_MAX,
  LANDING_RATE_MIN,
  PAWL_GAIN,
  PAWL_RATE_MAX,
  PAWL_RATE_MIN,
  PAWL_URLS,
  REEL_CLICK_DULL,
  SPIN_FILTER_RAMP_S,
  SPIN_LOWPASS_HZ,
  SPIN_LOWPASS_Q,
  SPIN_OPEN_HZ,
  loadReelClick,
  noteReelSpinning,
  pickPawlIndex,
  playReelClick,
  reelSnap,
  resetReelClickForTests,
  unlockReelClick,
} from "@/lib/reel-click";

type GainNode = { gain: { value: number }; connect: (target?: object) => void };

class FakeAudio {
  state: AudioContextState = "running";
  destination = {};
  currentTime = 0;
  resumeCalls = 0;
  starts = 0;
  gains: number[] = [];
  rates: number[] = [];
  buffers: object[] = [];
  routes: string[] = [];
  filterTargets: number[] = [];
  filterType = "";
  filterQ = 0;
  rampTau = 0;

  resume() {
    this.resumeCalls += 1;
    this.state = "running";
    return Promise.resolve();
  }

  decodeAudioData() {
    const clip = { id: this.buffers.length };
    this.buffers.push(clip);
    return Promise.resolve(clip);
  }

  createGain(): GainNode {
    const audio = this;
    return {
      gain: { value: 1 },
      connect(target?: object) {
        audio.routes.push(target === audio.destination ? "dest" : "bus");
      },
    };
  }

  createBiquadFilter() {
    const audio = this;
    const frequency = {
      value: SPIN_OPEN_HZ,
      cancelScheduledValues() {},
      setValueAtTime(value: number) {
        frequency.value = value;
      },
      setTargetAtTime(value: number, _time: number, tau: number) {
        audio.filterTargets.push(value);
        audio.rampTau = tau;
        frequency.value = value;
      },
    };
    const filter = {
      type: "",
      Q: { value: 0 },
      frequency,
      connect() {},
    };
    Object.defineProperty(filter, "type", {
      get: () => audio.filterType,
      set: (value: string) => {
        audio.filterType = value;
      },
    });
    Object.defineProperty(filter.Q, "value", {
      get: () => audio.filterQ,
      set: (value: number) => {
        audio.filterQ = value;
      },
    });
    return filter;
  }

  createBufferSource() {
    const audio = this;
    const source = {
      buffer: null as { id: number } | null,
      playbackRate: { value: 1 },
      gainNode: null as GainNode | null,
      connect(node: GainNode) {
        source.gainNode = node;
      },
      start() {
        audio.starts += 1;
        audio.gains.push(source.gainNode?.gain.value ?? -1);
        audio.rates.push(source.playbackRate.value);
        audio.buffers.push(source.buffer ?? {});
      },
    };
    return source;
  }
}

const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
const nowDescriptor = Object.getOwnPropertyDescriptor(performance, "now");

function installAudio(fake = new FakeAudio()) {
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

afterEach(() => {
  resetReelClickForTests();
  resetHapticQueue();
  if (fetchDescriptor) Object.defineProperty(globalThis, "fetch", fetchDescriptor);
  else delete (globalThis as { fetch?: unknown }).fetch;
  if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
  else delete (globalThis as { window?: unknown }).window;
  if (nowDescriptor) Object.defineProperty(performance, "now", nowDescriptor);
});

test("a reel snap plays a pawl tick with a quiet knock", async () => {
  const fake = installAudio();
  await loadReelClick();
  reelSnap();
  assert.equal(fake.starts, 2);
  assert.deepEqual(fake.gains, [PAWL_GAIN, KNOCK_GAIN]);
  assert.ok(fake.rates[0] >= PAWL_RATE_MIN && fake.rates[0] <= PAWL_RATE_MAX);
});

test("a fast flick drops clicks closer than 40ms, and a stopped reel stays quiet", async () => {
  const fake = installAudio();
  let now = 1_000;
  Object.defineProperty(performance, "now", { configurable: true, value: () => now });
  await loadReelClick();

  for (let i = 0; i < 40; i += 1) playReelClick();
  assert.equal(fake.starts, 2);

  now += 20;
  playReelClick();
  assert.equal(fake.starts, 2);

  now += 20;
  playReelClick();
  assert.equal(fake.starts, 4);

  settleReels([true], [false]);
  now += 40;
  playReelClick();
  assert.equal(fake.starts, 4);
  playReelClick(false, false, true);
  assert.equal(fake.starts, 6);
  setReelTicksOpen(true);
});

test("the first user gesture resumes a suspended audio context", () => {
  const fake = installAudio();
  fake.state = "suspended";
  unlockReelClick();
  assert.equal(fake.resumeCalls, 1);
});

test("the spin bus rolls off only while a reel is spinning", async () => {
  const fake = installAudio();
  await loadReelClick();

  let now = 2_000;
  Object.defineProperty(performance, "now", { configurable: true, value: () => now });
  reelSnap();
  assert.deepEqual(fake.routes, ["dest", "dest"]);
  assert.deepEqual(fake.filterTargets, []);

  noteReelSpinning(true);
  noteReelSpinning(true);
  now += 40;
  playReelClick(true);
  assert.equal(fake.filterType, "lowpass");
  assert.equal(fake.filterQ, SPIN_LOWPASS_Q);
  assert.equal(fake.rampTau, SPIN_FILTER_RAMP_S);
  assert.equal(fake.filterTargets.at(-1), SPIN_LOWPASS_HZ);
  assert.equal(fake.routes.at(-2), "bus");
  assert.equal(fake.routes.at(-1), "bus");
  assert.equal(fake.gains.at(-2), PAWL_GAIN);
  assert.equal(fake.gains.at(-1), KNOCK_GAIN);

  noteReelSpinning(false);
  assert.equal(fake.filterTargets.at(-1), SPIN_LOWPASS_HZ);
  noteReelSpinning(false);
  assert.equal(fake.filterTargets.at(-1), SPIN_OPEN_HZ);

  now += 40;
  playReelClick(false);
  assert.equal(fake.routes.at(-1), "dest");
  assert.equal(fake.gains.at(-2), PAWL_GAIN);
  assert.equal(fake.gains.at(-1), KNOCK_GAIN);
});

test("gray stops are a quieter pawl with no knock, and a landing is louder and deeper", async () => {
  const fake = installAudio();
  let now = 3_000;
  Object.defineProperty(performance, "now", { configurable: true, value: () => now });
  await loadReelClick();

  playReelClick(true, true);
  assert.equal(fake.starts, 1);
  assert.equal(fake.gains[0], PAWL_GAIN * REEL_CLICK_DULL);

  now += 40;
  playReelClick(false, false, true, true);
  assert.equal(fake.starts, 3);
  assert.equal(fake.gains.at(-2), LANDING_PAWL_GAIN);
  assert.equal(fake.gains.at(-1), LANDING_KNOCK_GAIN);
  assert.ok((fake.rates.at(-1) ?? 0) >= LANDING_RATE_MIN && (fake.rates.at(-1) ?? 0) <= LANDING_RATE_MAX);
  assert.equal(fake.buffers.at(-2), fake.buffers[PAWL_URLS.length - 1]);
});

test("passing ticks vary the pawl and never repeat the same slice twice", () => {
  let previous = -1;
  const seen = new Set<number>();
  for (let i = 0; i < 24; i += 1) {
    const next = pickPawlIndex(PAWL_URLS.length, previous, () => (i % 5) / 5);
    assert.notEqual(next, previous);
    seen.add(next);
    previous = next;
  }
  assert.ok(seen.size >= 4);
});

test("missing audio support stays silent", () => {
  const host = globalThis as typeof globalThis & { window?: typeof globalThis };
  Object.defineProperty(host, "window", { configurable: true, writable: true, value: host });
  Object.defineProperty(host, "AudioContext", { configurable: true, writable: true, value: undefined });
  assert.doesNotThrow(() => {
    unlockReelClick();
    playReelClick();
    reelSnap();
  });
});
