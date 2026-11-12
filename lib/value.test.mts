import assert from "node:assert/strict";
import { test } from "node:test";

import { formatTroyOunces, formatUsd } from "@/lib/format";
import {
  AVOIRDUPOIS_POUND_GRAMS,
  TROY_OUNCE_GRAMS,
  gramsToTroyOunces,
  meltValue,
  usdPerTroyOunce,
} from "@/lib/value";

test("one troy ounce is worth exactly the spot price", () => {
  assert.equal(meltValue(3987.2, TROY_OUNCE_GRAMS, 1), 3987.2);
});

test("piece count multiplies the melt value", () => {
  assert.equal(meltValue(50, TROY_OUNCE_GRAMS, 10), 500);
});

test("ten troy ounces is ten times spot", () => {
  assert.equal(meltValue(1545, TROY_OUNCE_GRAMS * 10, 1), 15450);
});

test("one gram uses the troy ounce constant", () => {
  const spot = 3100;
  assert.equal(meltValue(spot, 1, 1), spot / TROY_OUNCE_GRAMS);
  assert.equal(gramsToTroyOunces(1000), 1000 / TROY_OUNCE_GRAMS);
});

test("a pound of copper converts back to the per-pound quote", () => {
  const perPound = 6.3;
  const perOunce = usdPerTroyOunce(perPound, "lb");
  const value = meltValue(perOunce, AVOIRDUPOIS_POUND_GRAMS, 1);
  assert.ok(Math.abs(value - perPound) < 1e-9);
  assert.ok(perOunce < 1);
});

test("currency formatting keeps cents and sub-dollar copper", () => {
  assert.equal(formatUsd(3987.2), "$3,987.20");
  assert.equal(formatUsd(0.01389), "$0.0139");
});

test("nice troy weights stay exact and odd weights keep precision", () => {
  assert.equal(formatTroyOunces(TROY_OUNCE_GRAMS), "1 oz t");
  assert.equal(formatTroyOunces(TROY_OUNCE_GRAMS / 10), "0.1 oz t");
  assert.equal(formatTroyOunces(1), `${(1 / TROY_OUNCE_GRAMS).toFixed(6)} oz t`);
});
