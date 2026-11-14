import assert from "node:assert/strict";
import test from "node:test";

import { REEL_CLICK_GAIN } from "@/lib/reel-click";
import { STRETCH_ECHO_HIGHPASS_HZ, STRETCH_ECHO_TAPS } from "@/lib/stretch-echo";
import {
  REEL_CLICK_FILE_WINDOW_RMS,
  STRETCH_POP_FILE_WINDOW_RMS,
  STRETCH_POP_GAIN,
  matchedStretchPopGain,
} from "@/lib/stretch-pop";

test("the dry stretch pop matches the lock click window level", () => {
  assert.equal(REEL_CLICK_GAIN, 0.3);
  const gain = matchedStretchPopGain();
  assert.equal(STRETCH_POP_GAIN, gain);
  assert.ok(Math.abs(gain - 0.29655) < 0.0001);
  const click = REEL_CLICK_FILE_WINDOW_RMS * REEL_CLICK_GAIN;
  const pop = STRETCH_POP_FILE_WINDOW_RMS * STRETCH_POP_GAIN;
  assert.ok(Math.abs(pop - click) < 1e-9);
  assert.ok(STRETCH_POP_GAIN < 0.55);
});

test("echo taps stay the same fraction of the matched dry pop", () => {
  assert.deepEqual(
    STRETCH_ECHO_TAPS.map((tap) => tap.gain),
    [0.45, 0.25, 0.12],
  );
  assert.deepEqual(
    STRETCH_ECHO_TAPS.map((tap) => tap.delayMs),
    [50, 95, 140],
  );
  assert.equal(STRETCH_ECHO_HIGHPASS_HZ, 2400);
  const levels = STRETCH_ECHO_TAPS.map((tap) => STRETCH_POP_GAIN * tap.gain);
  assert.ok(levels[0] < STRETCH_POP_GAIN);
  assert.ok(levels[1] < levels[0]);
  assert.ok(levels[2] < levels[1]);
});
