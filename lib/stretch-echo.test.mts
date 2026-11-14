import assert from "node:assert/strict";
import test from "node:test";

import { STRETCH_POP_FRACTIONS, pickStretchPop, stretchPopCount } from "@/lib/stretch-pops";
import {
  STRETCH_ECHO_HIGHPASS_HZ,
  STRETCH_ECHO_TAPS,
  stretchEchoTailMs,
} from "@/lib/stretch-echo";

const HEIGHT = 86;

test("stretch echoes are a short metallic bounce", () => {
  assert.ok(STRETCH_ECHO_TAPS.length >= 2 && STRETCH_ECHO_TAPS.length <= 3);
  assert.equal(STRETCH_ECHO_TAPS[0]?.delayMs, 50);
  assert.equal(STRETCH_ECHO_TAPS[1]?.delayMs, 95);
  assert.equal(STRETCH_ECHO_TAPS[2]?.delayMs, 140);
  assert.equal(STRETCH_ECHO_TAPS[0]?.gain, 0.45);
  assert.equal(STRETCH_ECHO_TAPS[1]?.gain, 0.25);
  assert.equal(STRETCH_ECHO_TAPS[2]?.gain, 0.12);
  assert.ok(STRETCH_ECHO_HIGHPASS_HZ >= 1500);
  for (let index = 1; index < STRETCH_ECHO_TAPS.length; index += 1) {
    const previous = STRETCH_ECHO_TAPS[index - 1];
    const tap = STRETCH_ECHO_TAPS[index];
    assert.ok(previous && tap);
    assert.ok(tap.delayMs > previous.delayMs);
    assert.ok(tap.gain < previous.gain);
  }
});

test("the stretch echo tail dies inside a quarter second", () => {
  const tail = stretchEchoTailMs();
  assert.ok(tail <= 250);
  assert.ok(tail >= 150);
  assert.equal(tail, 210);
});

test("stretch pop timing and selection are unchanged by the echo", () => {
  assert.deepEqual(STRETCH_POP_FRACTIONS, [0.25, 0.5, 0.75, 1]);
  assert.equal(stretchPopCount(0, HEIGHT, 3), 0);
  assert.equal(stretchPopCount(HEIGHT * 0.25, HEIGHT, 3), 1);
  assert.equal(stretchPopCount(HEIGHT, HEIGHT, 3), 4);
  assert.equal(stretchPopCount(HEIGHT, HEIGHT, 0), 0);
  assert.equal(pickStretchPop(6, 0, () => 0), 1);
  assert.equal(pickStretchPop(6, null, () => 0), 0);
});
