import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { resetHapticQueue } from "@/lib/haptics";
import {
  LANDING_KNOCK_GAIN,
  LANDING_PAWL_GAIN,
  loadReelClick,
  resetReelClickForTests,
} from "@/lib/reel-click";
import {
  armLandingWatch,
  clearLandingWatch,
  commitReelStop,
  flickOwesLanding,
  playSettledLanding,
  settleReelLanding,
  type LandingWatch,
} from "@/lib/reel-landing";

type GainNode = { gain: { value: number }; connect: (target?: object) => void };

class FakeAudio {
  state: AudioContextState = "running";
  destination = {};
  currentTime = 0;
  starts = 0;
  gains: number[] = [];

  resume() {
    this.state = "running";
    return Promise.resolve();
  }

  decodeAudioData() {
    return Promise.resolve({ id: this.starts });
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
        audio.starts += 1;
        audio.gains.push(source.gainNode?.gain.value ?? -1);
      },
    };
    return source;
  }
}

const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

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

afterEach(() => {
  resetReelClickForTests();
  resetHapticQueue();
  if (fetchDescriptor) Object.defineProperty(globalThis, "fetch", fetchDescriptor);
  else delete (globalThis as { fetch?: unknown }).fetch;
  if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
  else delete (globalThis as { window?: unknown }).window;
});

/**
 * Coast ticks, including the final notch, are ordinary commits.
 * setPos then sees index === committed and does not commit again.
 * Idle is what owes the landing.
 */
function coastCommitsFinalNotch(kind: "pull" | "flick"): { landing: number; watch: LandingWatch } {
  assert.ok(kind === "pull" || kind === "flick");
  let watch = armLandingWatch();
  let landing = 0;
  for (const _notch of [1, 2, 3]) {
    const noted = commitReelStop(watch, false);
    watch = noted.watch;
    if (noted.playLanding) landing += 1;
  }
  const settled = settleReelLanding(watch);
  watch = settled.watch;
  if (settled.playLanding) landing += 1;
  const again = settleReelLanding(watch);
  if (again.playLanding) landing += 1;
  return { landing, watch: again.watch };
}

test("a handle pull still lands once when the coast already committed the final notch", async () => {
  const fake = installAudio();
  await loadReelClick();
  const result = coastCommitsFinalNotch("pull");
  assert.equal(result.landing, 1);
  assert.equal(result.watch.played, true);
  assert.equal(result.watch.owed, false);
  playSettledLanding();
  assert.equal(fake.starts, 2);
  assert.equal(fake.gains.at(-2), LANDING_PAWL_GAIN);
  assert.equal(fake.gains.at(-1), LANDING_KNOCK_GAIN);
});

test("a flick still lands once when the coast already committed the final notch", async () => {
  const fake = installAudio();
  await loadReelClick();
  const result = coastCommitsFinalNotch("flick");
  assert.equal(result.landing, 1);
  assert.equal(result.watch.played, true);
  playSettledLanding();
  assert.equal(fake.starts, 2);
  assert.equal(fake.gains.at(-2), LANDING_PAWL_GAIN);
  assert.equal(fake.gains.at(-1), LANDING_KNOCK_GAIN);
});

test("a landing committed on the cam plays once and the idle settle does not repeat it", () => {
  let watch = armLandingWatch();
  const coast = commitReelStop(watch, false);
  watch = coast.watch;
  assert.equal(coast.playLanding, false);
  const cam = commitReelStop(watch, true);
  watch = cam.watch;
  assert.equal(cam.playLanding, true);
  const settled = settleReelLanding(watch);
  assert.equal(settled.playLanding, false);
  assert.equal(commitReelStop(settled.watch, true).playLanding, false);
});

test("a guest run that returns before the commit still lands once at idle", () => {
  let watch = armLandingWatch();
  const passing = commitReelStop(watch, false);
  watch = passing.watch;
  const settled = settleReelLanding(watch);
  assert.equal(passing.playLanding, false);
  assert.equal(settled.playLanding, true);
  assert.equal(settleReelLanding(settled.watch).playLanding, false);
});

test("a step or a stationary release does not owe a landing", () => {
  const quiet = settleReelLanding(clearLandingWatch());
  assert.equal(quiet.playLanding, false);
  assert.equal(
    flickOwesLanding({ speed: 0, position: 4, notch: 4, committed: 4, count: 8 }),
    false,
  );
  assert.equal(
    flickOwesLanding({ speed: 0.2, position: 4.4, notch: 5, committed: 4, count: 8 }),
    true,
  );
  assert.equal(
    flickOwesLanding({ speed: 2, position: 4, notch: 4, committed: 4, count: 8 }),
    true,
  );
});
