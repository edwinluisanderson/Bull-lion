import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { resetHapticQueue } from "@/lib/haptics";
import {
  REEL_CLICK_GAIN,
  REEL_CLICKS_PER_FRAME,
  loadReelClick,
  playReelClick,
  reelSnap,
  resetReelClickForTests,
  unlockReelClick,
} from "@/lib/reel-click";

type GainNode = { gain: { value: number }; connect: () => void };

class FakeAudio {
  state: AudioContextState = "running";
  destination = {};
  resumeCalls = 0;
  starts = 0;
  gains: number[] = [];

  resume() {
    this.resumeCalls += 1;
    this.state = "running";
    return Promise.resolve();
  }

  decodeAudioData() {
    return Promise.resolve({ duration: 0.15 });
  }

  createGain(): GainNode {
    return { gain: { value: 1 }, connect() {} };
  }

  createBufferSource() {
    const audio = this;
    const source = {
      buffer: null as unknown,
      gainNode: null as GainNode | null,
      connect(node: GainNode) {
        source.gainNode = node;
      },
      start() {
        audio.starts += 1;
        audio.gains.push(source.gainNode?.gain.value ?? -1);
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

test("a reel snap plays the soft click", async () => {
  const fake = installAudio();
  await loadReelClick();
  reelSnap();
  assert.equal(fake.starts, 1);
  assert.deepEqual(fake.gains, [REEL_CLICK_GAIN]);
  assert.ok(REEL_CLICK_GAIN >= 0.25 && REEL_CLICK_GAIN <= 0.35);
});

test("a fast flick cannot stack dozens of clicks in one frame", async () => {
  const fake = installAudio();
  let now = 1_000;
  Object.defineProperty(performance, "now", { configurable: true, value: () => now });
  await loadReelClick();

  for (let i = 0; i < 40; i += 1) playReelClick();
  assert.equal(fake.starts, REEL_CLICKS_PER_FRAME);

  now += 20;
  playReelClick();
  assert.equal(fake.starts, REEL_CLICKS_PER_FRAME + 1);
});

test("the first user gesture resumes a suspended audio context", () => {
  const fake = installAudio();
  fake.state = "suspended";
  unlockReelClick();
  assert.equal(fake.resumeCalls, 1);
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
