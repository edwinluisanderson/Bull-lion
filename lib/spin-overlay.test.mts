import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { resetReelClickForTests } from "@/lib/reel-click";
import {
  COINS_FALL_GAIN,
  COINS_FALL_HIGHPASS_HZ,
  COINS_FALL_HIGHPASS_Q,
  COINS_RESTART_FADE_S,
  armSpinOverlay,
  playSpinOverlay,
  resetSpinOverlayForTests,
  setSpinSoundEnabledForTests,
  spinOverlayFor,
} from "@/lib/spin-overlay";

type Gain = {
  gain: {
    value: number;
    cancelScheduledValues: () => void;
    setValueAtTime: (value: number) => void;
    linearRampToValueAtTime: (value: number, time: number) => void;
  };
  connect: (target?: object) => void;
};

class FakeAudio {
  state: AudioContextState = "running";
  destination = {};
  currentTime = 1;
  starts = 0;
  stops = 0;
  filterType = "";
  filterHz = 0;
  filterQ = 0;
  gains: number[] = [];
  routes: string[] = [];
  ramps: number[] = [];

  resume() {
    this.state = "running";
    return Promise.resolve();
  }

  decodeAudioData() {
    return Promise.resolve({ duration: 7.93 });
  }

  createGain(): Gain {
    const audio = this;
    const gain = {
      value: 1,
      cancelScheduledValues() {},
      setValueAtTime(value: number) {
        gain.value = value;
      },
      linearRampToValueAtTime(value: number) {
        audio.ramps.push(value);
        gain.value = value;
      },
    };
    return {
      gain,
      connect(target?: object) {
        audio.routes.push(target === audio.destination ? "dest" : "other");
        audio.gains.push(gain.value);
      },
    };
  }

  createBiquadFilter() {
    const audio = this;
    return {
      frequency: {
        get value() {
          return audio.filterHz;
        },
        set value(next: number) {
          audio.filterHz = next;
        },
      },
      Q: {
        get value() {
          return audio.filterQ;
        },
        set value(next: number) {
          audio.filterQ = next;
        },
      },
      connect() {},
      set type(next: string) {
        audio.filterType = next;
      },
      get type() {
        return audio.filterType;
      },
    };
  }

  createBufferSource() {
    const audio = this;
    return {
      buffer: null as unknown,
      onended: null as null | (() => void),
      connect() {},
      start() {
        audio.starts += 1;
      },
      stop() {
        audio.stops += 1;
      },
    };
  }
}

const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

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
  resetSpinOverlayForTests();
  resetReelClickForTests();
  if (fetchDescriptor) Object.defineProperty(globalThis, "fetch", fetchDescriptor);
  else delete (globalThis as { fetch?: unknown }).fetch;
  if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
  else delete (globalThis as { window?: unknown }).window;
});

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test("a handle pull starts one coin pour on the shared context", async () => {
  const fake = installAudio();
  armSpinOverlay();
  assert.equal(spinOverlayFor("pull"), true);
  playSpinOverlay();
  await flush();
  assert.equal(fake.starts, 1);
  assert.equal(fake.stops, 0);
  assert.equal(fake.filterType, "highpass");
  assert.equal(fake.filterHz, COINS_FALL_HIGHPASS_HZ);
  assert.equal(fake.filterQ, COINS_FALL_HIGHPASS_Q);
  assert.deepEqual(fake.gains, [COINS_FALL_GAIN]);
  assert.deepEqual(fake.routes, ["dest"]);
});

test("a second pull fades the first pour instead of stacking it", async () => {
  const fake = installAudio();
  playSpinOverlay();
  await flush();
  playSpinOverlay();
  assert.equal(fake.starts, 2);
  assert.equal(fake.stops, 1);
  assert.deepEqual(fake.ramps, [0]);
  assert.equal(COINS_RESTART_FADE_S, 0.06);
});

test("flicks, drags, and steps do not ask for the coin pour", () => {
  assert.equal(spinOverlayFor("flick"), false);
  assert.equal(spinOverlayFor("drag"), false);
  assert.equal(spinOverlayFor("step"), false);
  assert.equal(spinOverlayFor("stretch"), false);
});

test("the coin pour stays silent when sound is off", async () => {
  const fake = installAudio();
  setSpinSoundEnabledForTests(false);
  assert.equal(spinOverlayFor("pull"), false);
  playSpinOverlay();
  await flush();
  assert.equal(fake.starts, 0);
});
