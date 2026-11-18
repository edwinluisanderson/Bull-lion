import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { WEIGHTS } from "@/lib/metals";
import { TROY_OUNCE_GRAMS } from "@/lib/value";
import {
  WEIGHT_DIAL_GAP_DEG,
  WEIGHT_DIAL_MIN_DEG,
  WEIGHT_DIAL_SWEEP_DEG,
  WEIGHT_DIAL_TICK_COUNT,
  permanentWeightGrams,
  weightDialAngle,
  weightDialIndex,
  weightDialTickAngles,
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
  const sorted = weightDialValues(permanent);
  assert.deepEqual(sorted, [...permanent].sort((left, right) => left - right));
  const oneOunce = weightDialIndex(sorted, TROY_OUNCE_GRAMS);
  assert.ok(oneOunce > 0 && oneOunce < sorted.length - 1);
});

test("a temporary stretch weight keeps the permanent scale and aims at the nearest stop", () => {
  const scale = weightDialValues(permanent);
  assert.equal(scale.length, 16);
  assert.equal(scale.at(-1), 1000);
  assert.deepEqual(scale, [...permanent].sort((left, right) => left - right));

  const two = weightDialIndex(scale, 2);
  assert.equal(scale[two], 2.5);
  assert.equal(weightDialAngle(two, scale.length), weightDialAngle(weightDialIndex(scale, 2.5), scale.length));
  assert.equal(scale[weightDialIndex(scale, 3)], TROY_OUNCE_GRAMS / 10);

  const threeQuarter = weightDialIndex(scale, TROY_OUNCE_GRAMS * 0.75);
  assert.equal(scale[threeQuarter], 25);
  const twoKilograms = weightDialIndex(scale, 2000);
  assert.equal(scale[twoKilograms], 1000);

  const midpoint = (1 + 2.5) / 2;
  assert.equal(scale[weightDialIndex(scale, midpoint)], 2.5);
  assert.equal(weightDialAngle(scale.length - 1, scale.length), WEIGHT_DIAL_MIN_DEG + WEIGHT_DIAL_SWEEP_DEG);
});

test("nine ticks span the arc and only the ends share a needle stop", () => {
  const ticks = weightDialTickAngles();
  assert.equal(WEIGHT_DIAL_TICK_COUNT, 9);
  assert.equal(ticks.length, 9);
  assert.equal(ticks[0], 194);
  assert.equal(ticks.at(-1), 526);
  ticks.forEach((angle, index) => {
    assert.equal(angle, weightDialAngle(index, 9));
    if (index > 0) assert.equal(angle - ticks[index - 1], 41.5);
  });

  const stops = permanent.map((_, index) => weightDialAngle(index, permanent.length));
  const shared = ticks.map((tick) =>
    stops.findIndex((stop) => Math.abs(stop - tick) < 1e-6),
  );
  assert.deepEqual(shared, [0, -1, -1, -1, -1, -1, -1, -1, 15]);

  const source = readFileSync(new URL("../components/weight-dial.tsx", import.meta.url), "utf8");
  const restyle = readFileSync(new URL("../components/gauge-restyle.tsx", import.meta.url), "utf8");
  assert.match(source, /weightDialTickAngles\(\)/);
  assert.match(source, /weightDialAngle\(weightDialIndex\(values, grams\), values\.length\)/);
  assert.match(restyle, /r - 8/);
  assert.match(restyle, /r - 1\.5/);
  assert.equal(WEIGHT_DIAL_SWEEP_DEG, 332);
  assert.equal(WEIGHT_DIAL_GAP_DEG, 28);
});
