import assert from "node:assert/strict";
import { test } from "node:test";

import { detentForStop, type Detent } from "@/lib/spin-gate";

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

test("a handle pull clicks from the first stop", () => {
  for (const elapsedMs of [0, 500, 2999]) {
    const detent = detentForStop({
      pullSpin: true,
      alternate: false,
      elapsedMs,
      landing: false,
      alternated: 0,
    });
    assert.equal(detent.sound, true);
    assert.equal(detent.haptic, true);
  }
});

test("a landing click still plays if it falls inside the ice", () => {
  const detent = detentForStop({
    pullSpin: true,
    alternate: false,
    elapsedMs: 2000,
    landing: true,
    alternated: 0,
  });
  assert.equal(detent.sound, true);
  assert.equal(detent.haptic, true);
});

test("weight plays every other click after the ice and always plays the landing", () => {
  const heard = stops(
    [
      { elapsedMs: 1000 },
      { elapsedMs: 2500 },
      { elapsedMs: 3000 },
      { elapsedMs: 3100 },
      { elapsedMs: 3200 },
      { elapsedMs: 3300 },
      { elapsedMs: 4000, landing: true },
    ],
    true,
  );
  assert.deepEqual(
    heard.map((detent) => detent.sound),
    [true, false, true, false, true, false, true],
  );
  assert.deepEqual(
    heard.map((detent) => detent.haptic),
    [true, true, true, true, true, true, true],
  );
  const skippedLanding = detentForStop({
    pullSpin: true,
    alternate: true,
    elapsedMs: 4000,
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
  const duringPull = detentForStop({
    pullSpin: true,
    alternate: false,
    elapsedMs: 700,
    landing: false,
    alternated: 0,
  });
  assert.equal(duringPull.sound, true);
  const count = detentForStop({
    pullSpin: true,
    alternate: false,
    elapsedMs: 3500,
    landing: false,
    alternated: 0,
  });
  assert.equal(count.sound, true);
  assert.equal(count.haptic, true);
});
