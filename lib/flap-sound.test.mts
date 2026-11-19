import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CLUNK_DECAY_S,
  CLUNK_ECHO_DECAY_S,
  CLUNK_ECHO_DELAYS_S,
  CLUNK_ECHO_LOWPASS_HZ,
  CLUNK_ECHO_RATIO,
  CLUNK_ECHO_STOP_S,
  CLUNK_END_HZ,
  CLUNK_GAIN,
  CLUNK_KNOCK_GAIN,
  CLUNK_KNOCK_HZ,
  CLUNK_KNOCK_S,
  CLUNK_START_HZ,
  CLUNK_STOP_S,
  CLUNK_SWEEP_S,
  FLAP_BOARD_THRESHOLD,
  clunkAttackPeak,
  clunkEchoGain,
  clunkTailEnd,
  flapSoundAllowed,
  playFlapSound,
  resetFlapSoundForTests,
  setFlapBoardInView,
  shouldPlayFlapTick,
  watchFlapBoard,
} from "@/lib/flap-sound";

const sound = readFileSync(new URL("./flap-sound.ts", import.meta.url), "utf8");
const table = readFileSync(new URL("../components/stack-table.tsx", import.meta.url), "utf8");
const flap = readFileSync(new URL("../components/split-flap.tsx", import.meta.url), "utf8");

const quiet = { stamp: 0, count: 0 };

test("a visible board plays a flap tick", () => {
  const heard = shouldPlayFlapTick(true, "visible", quiet, 10, true);
  assert.equal(flapSoundAllowed(true, "visible"), true);
  assert.equal(heard.play, true);
  assert.equal(heard.gate.count, 1);
});

test("an offscreen or hidden board stays silent and keeps the throttle", () => {
  assert.equal(flapSoundAllowed(false, "visible"), false);
  assert.equal(flapSoundAllowed(true, "hidden"), false);
  assert.equal(flapSoundAllowed(true, "prerender"), false);
  const offscreen = shouldPlayFlapTick(false, "visible", quiet, 12, true);
  const hidden = shouldPlayFlapTick(true, "hidden", quiet, 12, true);
  assert.equal(offscreen.play, false);
  assert.equal(hidden.play, false);
  assert.equal(offscreen.gate, quiet);
  assert.equal(hidden.gate, quiet);
  const later = shouldPlayFlapTick(true, "visible", hidden.gate, 12, true);
  assert.equal(later.play, true);
});

test("playFlapSound follows the board and the page, and other clicks do not", () => {
  resetFlapSoundForTests();
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousObserver = globalThis.IntersectionObserver;
  let seen: Element | null = null;
  const sink: { notify: (entries: { isIntersecting: boolean }[]) => void } = {
    notify: () => {},
  };

  class FakeObserver {
    constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
      sink.notify = callback;
    }
    observe(target: Element) {
      seen = target;
    }
    disconnect() {
      seen = null;
    }
    takeRecords() {
      return [];
    }
  }

  class FakeContext {
    state = "running";
    sampleRate = 8000;
    currentTime = 0;
    destination = {};
    resume() {
      return Promise.resolve();
    }
    createBuffer(_channels: number, length: number) {
      return { getChannelData: () => new Float32Array(length) };
    }
    createBufferSource() {
      return { buffer: null as AudioBuffer | null, connect() {}, start() {} };
    }
    createBiquadFilter() {
      return { type: "bandpass", frequency: { value: 0 }, Q: { value: 0 }, connect() {} };
    }
    createGain() {
      return { gain: { value: 0 }, connect() {} };
    }
    createWaveShaper() {
      return { curve: null as Float32Array | null, oversample: "none", connect() {} };
    }
  }

  const view = { AudioContext: FakeContext, innerHeight: 800, innerWidth: 390 };
  Object.assign(globalThis, {
    window: view,
    document: { visibilityState: "visible" },
    IntersectionObserver: FakeObserver,
  });

  try {
    const board = {
      ownerDocument: { defaultView: view },
      getBoundingClientRect: () => ({ top: 20, left: 8, bottom: 240, right: 360, width: 352, height: 220 }),
    } as unknown as Element;
    const stop = watchFlapBoard(board);
    assert.equal(seen, board);
    assert.equal(FLAP_BOARD_THRESHOLD, 0);
    assert.equal(playFlapSound(10), true);
    assert.equal(playFlapSound(12), true);
    assert.equal(playFlapSound(14), false);

    sink.notify([{ isIntersecting: false }]);
    assert.equal(playFlapSound(16), false);
    sink.notify([{ isIntersecting: true }]);
    (globalThis.document as { visibilityState: string }).visibilityState = "hidden";
    assert.equal(playFlapSound(80), false);
    (globalThis.document as { visibilityState: string }).visibilityState = "visible";
    assert.equal(playFlapSound(80), true);

    setFlapBoardInView(false);
    assert.equal(playFlapSound(140), false);
    stop();
    assert.equal(seen, null);
    assert.equal(playFlapSound(200), false);
  } finally {
    resetFlapSoundForTests();
    Object.assign(globalThis, {
      window: previousWindow,
      document: previousDocument,
      IntersectionObserver: previousObserver,
    });
  }

  const swipe = sound.slice(sound.indexOf("export function playSwipeTone"), sound.indexOf("export function playFlapSound"));
  assert.equal(swipe.includes("shouldPlayFlapTick"), false);
  assert.equal(swipe.includes("visibilityState"), false);
  assert.match(swipe, /flapSum\(ctx\)/);
  assert.match(sound, /new IntersectionObserver/);
  assert.match(sound, /document\.visibilityState/);
  assert.match(table, /useLayoutEffect\(\(\) => \{[^}]*watchFlapBoard\(board\)/);
  assert.match(table, /ref=\{boardRef\}/);
  assert.match(flap, /playFlapSound\(\)/);
});

test("the delete clunk is a loud low body, a short knock, and a short echo", () => {
  assert.equal(CLUNK_GAIN, 0.8);
  assert.equal(CLUNK_START_HZ, 130);
  assert.equal(CLUNK_END_HZ, 50);
  assert.equal(CLUNK_SWEEP_S, 0.13);
  assert.equal(CLUNK_DECAY_S, 0.28);
  assert.equal(CLUNK_STOP_S, 0.3);
  assert.equal(CLUNK_KNOCK_HZ, 220);
  assert.equal(CLUNK_KNOCK_GAIN, 0.14);
  assert.ok(CLUNK_KNOCK_GAIN < CLUNK_GAIN);
  assert.ok(CLUNK_KNOCK_S >= 0.015 && CLUNK_KNOCK_S <= 0.03);
  assert.ok(clunkAttackPeak() <= 0.95);
  assert.ok(clunkAttackPeak() < 1);
  assert.deepEqual([...CLUNK_ECHO_DELAYS_S], [0.11, 0.22]);
  assert.equal(CLUNK_ECHO_RATIO, 0.4);
  assert.ok(CLUNK_ECHO_DELAYS_S[0] >= 0.09 && CLUNK_ECHO_DELAYS_S[0] <= 0.14);
  assert.ok(CLUNK_ECHO_DELAYS_S[1] - CLUNK_ECHO_DELAYS_S[0] >= 0.09);
  assert.ok(Math.abs(clunkEchoGain(0) - 0.32) < 1e-12);
  assert.ok(Math.abs(clunkEchoGain(1) - 0.128) < 1e-12);
  assert.ok(clunkEchoGain(0) < CLUNK_GAIN * 0.45 && clunkEchoGain(0) > CLUNK_GAIN * 0.35);
  assert.equal(CLUNK_ECHO_LOWPASS_HZ, 480);
  assert.equal(CLUNK_ECHO_DECAY_S, 0.2);
  assert.equal(CLUNK_ECHO_STOP_S, 0.22);
  assert.ok(clunkTailEnd() <= 0.6);
  assert.equal(clunkTailEnd(), 0.44);
  const tone = sound.slice(sound.indexOf("export function playSwipeTone"), sound.indexOf("export function playFlapSound"));
  assert.match(tone, /if \(!spinSoundEnabled\(\)\) return/);
  assert.match(tone, /playDeleteClunk\(ctx, now\)/);
  assert.match(tone, /gain\.connect\(flapSum\(ctx\)\)/);
  assert.match(tone, /setValueAtTime\(0\.16, now\)/);
  assert.match(tone, /setValueAtTime\(880, now\)/);
  const clunk = sound.slice(sound.indexOf("function playDeleteClunk"), sound.indexOf("export function playSwipeTone"));
  assert.match(clunk, /bodyGain\.connect\(ctx\.destination\)/);
  assert.match(clunk, /knockGain\.connect\(ctx\.destination\)/);
  assert.match(clunk, /echoGain\.connect\(ctx\.destination\)/);
  assert.match(clunk, /type = "lowpass"/);
  assert.equal(clunk.includes("flapSum"), false);
});
