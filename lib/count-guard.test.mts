import assert from "node:assert/strict";
import { test } from "node:test";

import {
  copperCountAdjustment,
  holdAfterMotion,
  holdForPull,
  IDLE_COUNT_GUARD,
  notePullStarted,
  type CountGuardHold,
} from "@/lib/count-guard";
import { COUNTS, DEFAULT_WEIGHT_INDEX, WEIGHTS } from "@/lib/metals";
import { stillAtMs } from "@/lib/pull-spin";
import { usdPerTroyOunce } from "@/lib/value";

const COPPER = usdPerTroyOunce(6.3, "lb");
const ONE_OUNCE = WEIGHTS[DEFAULT_WEIGHT_INDEX]?.grams ?? 0;

function adjust(holding: boolean, countIndex: number, customPieces: number | null = null) {
  return copperCountAdjustment({
    holding,
    metalSymbol: "HG",
    usdPerTroyOz: COPPER,
    grams: ONE_OUNCE,
    countIndex,
    customPieces,
    counts: COUNTS,
  });
}

test("no count jump during a pull while copper is committed mid-spin", () => {
  let hold = holdForPull(IDLE_COUNT_GUARD);
  let step = holdAfterMotion(hold, [true, true, true]);
  hold = step.hold;
  const midSpin = adjust(hold.holding, 0);
  assert.equal(hold.holding, true);
  assert.equal(step.released, false);
  assert.equal(midSpin.guard, false);
  assert.equal(midSpin.countIndex, 0);

  step = holdAfterMotion(hold, [false, true, true]);
  assert.equal(step.released, false);
  assert.equal(adjust(step.hold.holding, 0).guard, false);

  step = holdAfterMotion(step.hold, [false, false, true]);
  assert.equal(step.released, false);
  assert.equal(adjust(step.hold.holding, 0).guard, false);
});

test("the guard applies once after all three wheels land", () => {
  let hold: CountGuardHold = holdAfterMotion(holdForPull(IDLE_COUNT_GUARD), [true, true, true]).hold;
  const motion = [true, true, true];
  let released = 0;
  for (const reel of [0, 1, 2]) {
    motion[reel] = false;
    const step = holdAfterMotion(hold, motion);
    hold = step.hold;
    if (step.released) released += 1;
  }
  assert.equal(released, 1);
  assert.equal(hold.holding, false);

  const first = adjust(hold.holding, 0);
  assert.equal(first.guard, true);
  assert.equal(COUNTS[first.countIndex], 2);

  const second = adjust(false, first.countIndex);
  assert.equal(second.guard, false);
  assert.equal(second.countIndex, first.countIndex);

  const again = holdAfterMotion(hold, [false, false, false]);
  assert.equal(again.released, false);
});

test("count lands last, so the guard waits for the right reel", () => {
  assert.ok(stillAtMs(2) > stillAtMs(1) && stillAtMs(1) > stillAtMs(0));

  const lands = [
    { reel: 0, at: stillAtMs(0) },
    { reel: 1, at: stillAtMs(1) },
    { reel: 2, at: stillAtMs(2) },
  ];
  let hold = holdAfterMotion(holdForPull(IDLE_COUNT_GUARD), [true, true, true]).hold;
  const motion = [true, true, true];
  let releasedAt = -1;
  for (const land of lands) {
    motion[land.reel] = false;
    const step = holdAfterMotion(hold, motion);
    hold = step.hold;
    if (step.released) releasedAt = land.at;
  }
  assert.equal(releasedAt, stillAtMs(2));
  assert.equal(adjust(true, 0).guard, false);
  assert.equal(adjust(false, 0).guard, true);
});

test("arrow and swipe changes are not held", () => {
  const flicked = holdAfterMotion(IDLE_COUNT_GUARD, [false, true, false]);
  assert.equal(flicked.released, false);
  assert.equal(flicked.hold.holding, false);
  const jump = adjust(false, 0);
  assert.equal(jump.guard, true);
  assert.equal(COUNTS[jump.countIndex], 2);
});

test("a pull that never moves has already landed", () => {
  const hold = notePullStarted(holdForPull(IDLE_COUNT_GUARD), [false, false, false]);
  assert.equal(hold.holding, false);
  assert.equal(adjust(hold.holding, 0).guard, true);
});

test("a re-pull keeps the hold until the new spin lands", () => {
  let hold = holdAfterMotion(holdForPull(IDLE_COUNT_GUARD), [true, true, true]).hold;
  hold = holdForPull(hold);
  const step = holdAfterMotion(hold, [false, false, false]);
  assert.equal(step.released, true);
  assert.equal(holdAfterMotion(step.hold, [false, false, false]).released, false);
});
