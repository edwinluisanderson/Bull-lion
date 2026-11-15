import assert from "node:assert/strict";
import test from "node:test";

import { WEIGHTS } from "@/lib/metals";
import { TROY_OUNCE_GRAMS } from "@/lib/value";
import {
  WEIGHT_DIAL_GAP_DEG,
  WEIGHT_DIAL_MIN_DEG,
  WEIGHT_DIAL_SWEEP_DEG,
  permanentWeightGrams,
  weightDialAngle,
  weightDialIndex,
  weightDialValues,
} from "@/lib/weight-dial";

const permanent = permanentWeightGrams();
const lightest = Math.min(...permanent);
const heaviest = Math.max(...permanent);

test("the lightest weight sits just left of bottom and the heaviest just right", () => {
  assert.equal(WEIGHT_DIAL_GAP_DEG, 28);
  assert.equal(WEIGHT_DIAL_MIN_DEG, 180 + WEIGHT_DIAL_GAP_DEG / 2);
  assert.equal(WEIGHT_DIAL_SWEEP_DEG, 360 - WEIGHT_DIAL_GAP_DEG);
  const count = permanent.length;
  assert.equal(weightDialAngle(0, count), WEIGHT_DIAL_MIN_DEG);
  assert.equal(weightDialAngle(count - 1, count), WEIGHT_DIAL_MIN_DEG + WEIGHT_DIAL_SWEEP_DEG);
  assert.equal((weightDialAngle(count - 1, count) - 360), 180 - WEIGHT_DIAL_GAP_DEG / 2);
  assert.equal(lightest, WEIGHTS[0]?.grams);
  assert.equal(heaviest, 1000);
});

test("the needle angle increases clockwise as the stop index increases", () => {
  const count = permanent.length;
  let previous = weightDialAngle(0, count);
  for (let index = 1; index < count; index += 1) {
    const angle = weightDialAngle(index, count);
    assert.ok(angle > previous);
    previous = angle;
  }
  const sorted = weightDialValues(permanent, null);
  assert.deepEqual(sorted, [...permanent].sort((left, right) => left - right));
  const oneOunce = weightDialIndex(sorted, TROY_OUNCE_GRAMS);
  assert.ok(oneOunce > 0 && oneOunce < sorted.length - 1);
});

test("a temporary stretch weight widens the dial, then leaves it", () => {
  const settled = weightDialValues(permanent, null);
  assert.equal(settled.length, permanent.length);
  assert.equal(weightDialIndex(settled, 1000), settled.length - 1);

  const withGrams = weightDialValues(permanent, 3);
  assert.ok(withGrams.some((grams) => grams === 3));
  assert.ok(withGrams.some((grams) => grams === 4));
  assert.equal(withGrams.length, permanent.length + 2);
  const three = weightDialIndex(withGrams, 3);
  const twoPointFive = weightDialIndex(withGrams, 2.5);
  const five = weightDialIndex(withGrams, 5);
  assert.ok(three > twoPointFive && three < five);
  assert.notEqual(
    weightDialAngle(weightDialIndex(settled, 5), settled.length),
    weightDialAngle(five, withGrams.length),
  );
  assert.equal(
    weightDialAngle(weightDialIndex(withGrams, 1000), withGrams.length),
    WEIGHT_DIAL_MIN_DEG + WEIGHT_DIAL_SWEEP_DEG,
  );

  const withKilograms = weightDialValues(permanent, 2000);
  assert.equal(withKilograms.filter((grams) => grams >= 2000 && grams <= 10000).length, 9);
  assert.equal(withKilograms.at(-1), 10000);
  assert.equal(weightDialAngle(withKilograms.length - 1, withKilograms.length), WEIGHT_DIAL_MIN_DEG + WEIGHT_DIAL_SWEEP_DEG);
  assert.ok(weightDialIndex(withKilograms, 1000) < withKilograms.length - 1);

  const restored = weightDialValues(permanent, null);
  assert.equal(restored.length, permanent.length);
  assert.equal(weightDialIndex(restored, 1000), restored.length - 1);
});
