import assert from "node:assert/strict";
import { test } from "node:test";

import { PULL_ICE_MS, detentForStop, type Detent } from "@/lib/spin-gate";

function stops(
  frames: { elapsedMs: number; landing?: boolean }[],
  alternate: boolean,
): Detent[] {
  let alternated = 0;
  return frames.map((frame) => {
    const detent = detentForStop({
      pullSpin: true,
      alternate,
      elapsedMs: frame.elapsedMs,
      landing: frame.landing ?? false,
      alternated,
    });
    alternated = detent.alternated;
    return detent;
  });
}

test("a handle pull has no stop click or haptic during the first 500 ms", () => {
  for (const elapsedMs of [0, 100, 499]) {
    const detent = detentForStop({
      pullSpin: true,
      alternate: false,
      elapsedMs,
      landing: false,
      alternated: 0,
    });
    assert.equal(detent.sound, false);
    assert.equal(detent.haptic, false);
  }
  const resumed = detentForStop({
    pullSpin: true,
    alternate: false,
    elapsedMs: PULL_ICE_MS,
    landing: false,
    alternated: 0,
  });
  assert.equal(resumed.sound, true);
  assert.equal(resumed.haptic, true);
});

test("the landing click plays even when metal reaches it inside the ice", () => {
  const detent = detentForStop({
    pullSpin: true,
    alternate: false,
    elapsedMs: 498,
    landing: true,
    alternated: 0,
  });
  assert.equal(detent.sound, true);
  assert.equal(detent.haptic, true);
});

test("weight plays every other click after the ice and always plays the landing", () => {
  const heard = stops(
    [
      { elapsedMs: 100 },
      { elapsedMs: 400 },
      { elapsedMs: 500 },
      { elapsedMs: 600 },
      { elapsedMs: 700 },
      { elapsedMs: 800 },
      { elapsedMs: 900, landing: true },
    ],
    true,
  );
  assert.deepEqual(
    heard.map((detent) => detent.sound),
    [false, false, true, false, true, false, true],
  );
  assert.deepEqual(
    heard.map((detent) => detent.haptic),
    [false, false, true, true, true, true, true],
  );
  const skippedLanding = detentForStop({
    pullSpin: true,
    alternate: true,
    elapsedMs: 900,
    landing: true,
    alternated: 1,
  });
  assert.equal(skippedLanding.sound, true);
});

test("weight clicks every stop again once the pull has landed", () => {
  for (const elapsedMs of [0, 100, 800]) {
    const detent = detentForStop({
      pullSpin: false,
      alternate: true,
      elapsedMs,
      landing: false,
      alternated: 4,
    });
    assert.equal(detent.sound, true);
    assert.equal(detent.haptic, true);
    assert.equal(detent.alternated, 4);
  }
});

test("flicks, drags, steps, and stretches are not iced or alternated", () => {
  const flick = detentForStop({
    pullSpin: false,
    alternate: true,
    elapsedMs: 10,
    landing: false,
    alternated: 0,
  });
  assert.equal(flick.sound, true);
  assert.equal(flick.haptic, true);
  const count = detentForStop({
    pullSpin: true,
    alternate: false,
    elapsedMs: 700,
    landing: false,
    alternated: 0,
  });
  assert.equal(count.sound, true);
  assert.equal(count.haptic, true);
});
