import assert from "node:assert/strict";
import test from "node:test";

import { createReelMotion, type ReelPhase } from "@/lib/reel-motion";

function play(steps: ReelPhase[]) {
  const signals: boolean[] = [];
  const motion = createReelMotion((moving) => signals.push(moving));
  let phase: ReelPhase = "idle";
  for (const next of steps) {
    if (motion.set(phase, next)) phase = next;
  }
  return signals;
}

test("a flick goes quiet after the coast settles", () => {
  assert.deepEqual(play(["drag", "coast", "script", "idle"]), [true, false]);
});

test("a handle pull goes quiet after the reels settle", () => {
  assert.deepEqual(play(["coast", "script", "idle"]), [true, false]);
});

test("a drag that is released without a fling goes quiet", () => {
  assert.deepEqual(play(["drag", "idle"]), [true, false]);
});

test("a step or jump goes quiet after its glide", () => {
  assert.deepEqual(play(["script", "idle"]), [true, false]);
});

test("settling twice still ends on not moving", () => {
  assert.deepEqual(play(["drag", "coast", "idle", "idle"]), [true, false]);
});
