import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { COUNTS, WEIGHTS } from "@/lib/metals";
import { stretchSequence } from "@/lib/stretch";
import { TROY_OUNCE_GRAMS } from "@/lib/value";
import { formatWeightPhrase } from "@/lib/weight-label";
import {
  WEIGHT_KG_MAX,
  WEIGHT_KG_STRETCH_CAP,
  weightStretchBetween,
  weightStretchLabel,
  weightStretchOrigin,
} from "@/lib/weight-stretch";

const OZ = TROY_OUNCE_GRAMS;
const stops = WEIGHTS.map((weight) => weight.grams);
const grams = (id: string) => {
  const weight = WEIGHTS.find((entry) => entry.id === id);
  if (!weight) throw new Error(id);
  return weight.grams;
};

function between(fromId: string, toId: string) {
  return weightStretchBetween(grams(fromId), grams(toId), "down").map((value) =>
    weightStretchLabel(value).mark,
  );
}

test("the quantity stretch still invents only whole counts and nothing past the ends", () => {
  assert.deepEqual(stretchSequence(COUNTS, COUNTS.indexOf(10), "down"), [9, 8, 7, 6]);
  assert.deepEqual(stretchSequence(COUNTS, COUNTS.indexOf(10), "up"), [11, 12, 13, 14, 15, 16, 17, 18, 19]);
  assert.deepEqual(stretchSequence(COUNTS, COUNTS.indexOf(1), "down"), []);
  assert.deepEqual(stretchSequence(COUNTS, COUNTS.indexOf(100), "up"), []);
  assert.deepEqual(stretchSequence(COUNTS, COUNTS.indexOf(2), "down"), []);
});

test("gram stretches insert every whole gram through 100 g and nothing above it", () => {
  assert.deepEqual(between("1g", "2.5g"), ["2 g"]);
  assert.deepEqual(between("2.5g", "5g"), ["3 g", "4 g"]);
  assert.deepEqual(between("5g", "10g"), ["6 g", "7 g", "8 g", "9 g"]);
  assert.deepEqual(between("10g", "20g"), ["11 g", "12 g", "13 g", "14 g", "15 g", "16 g", "17 g", "18 g", "19 g"]);
  assert.deepEqual(between("20g", "25g"), ["21 g", "22 g", "23 g", "24 g"]);
  assert.deepEqual(
    between("25g", "50g"),
    Array.from({ length: 24 }, (_, index) => `${26 + index} g`),
  );
  assert.deepEqual(
    between("50g", "100g"),
    Array.from({ length: 49 }, (_, index) => `${51 + index} g`),
  );
  assert.deepEqual(weightStretchBetween(grams("100g"), grams("1kg"), "up"), []);
  assert.deepEqual(weightStretchBetween(grams("1kg"), grams("100g"), "down"), []);
  assert.deepEqual(weightStretchLabel(2).detail, "grams");
  assert.deepEqual(weightStretchLabel(grams("2.5g")), { mark: "2.5 g", detail: "grams" });
});

test("whole ounces stretch between 2 and 5 and between 5 and 10 only", () => {
  assert.deepEqual(between("1oz", "2oz"), []);
  assert.deepEqual(between("2oz", "5oz"), ["3 oz", "4 oz"]);
  assert.deepEqual(between("5oz", "10oz"), ["6 oz", "7 oz", "8 oz", "9 oz"]);
  assert.deepEqual(weightStretchBetween(grams("10oz"), grams("1g"), "up"), []);
  assert.equal(weightStretchLabel(3 * OZ).detail, "troy");
  assert.equal(formatWeightPhrase({ id: "3oz", face: "3 oz", detail: "troy", grams: 3 * OZ }), "3 ounces troy");
});

test("fractional ounces insert 1/20, 1/25, 1/5, and 3/4 only", () => {
  assert.deepEqual(between("1/10", "1kg"), ["1/20 oz", "1/25 oz"]);
  assert.deepEqual(weightStretchBetween(OZ / 20, grams("1kg"), "down").map((value) => weightStretchLabel(value).mark), [
    "1/25 oz",
  ]);
  assert.deepEqual(weightStretchBetween(OZ / 25, grams("1/10"), "up").map((value) => weightStretchLabel(value).mark), [
    "1/20 oz",
  ]);
  assert.deepEqual(between("1/10", "1/4"), ["1/5 oz"]);
  assert.deepEqual(between("1/4", "1/2"), []);
  assert.deepEqual(between("1/2", "1oz"), ["3/4 oz"]);
  assert.equal(weightStretchLabel(OZ / 20).detail, "troy");
  assert.equal(
    formatWeightPhrase({ id: "1/20", face: "1/20 oz", detail: "troy", grams: OZ / 20 }),
    "1/20 ounce troy",
  );
});

test("1 kg stretches upward through the gap-integer cap and not downward", () => {
  const up = weightStretchBetween(grams("1kg"), grams("1/10"), "up");
  assert.equal(WEIGHT_KG_STRETCH_CAP, 400);
  assert.equal(WEIGHT_KG_MAX, 401);
  assert.equal(up.length, 400);
  assert.equal(up[0], 2000);
  assert.equal(up.at(-1), 401000);
  assert.deepEqual(weightStretchLabel(2000), { mark: "2 kg", detail: "kilograms" });
  assert.equal(formatWeightPhrase({ id: "2kg", face: "2 kg", detail: "kilograms", grams: 2000 }), "2 kilograms");
  assert.deepEqual(weightStretchBetween(grams("1kg"), grams("100g"), "down"), []);
  const fromTwo = weightStretchBetween(2000, grams("1/10"), "up");
  assert.equal(fromTwo[0], 3000);
  assert.equal(fromTwo.at(-1), 401000);
  assert.deepEqual(weightStretchBetween(2000, 1000, "down"), []);
  assert.deepEqual(weightStretchBetween(3000, 1000, "down"), [2000]);
});

test("a temporary weight remembers the real stops on either side", () => {
  const three = weightStretchOrigin(stops, 3);
  assert.equal(three.lower, grams("2.5g"));
  assert.equal(three.upper, grams("5g"));
  assert.deepEqual(weightStretchBetween(3, grams("5g"), "up").map((value) => weightStretchLabel(value).mark), ["4 g"]);
  assert.deepEqual(weightStretchBetween(3, grams("2.5g"), "down"), []);
  const fifth = weightStretchOrigin(stops, OZ / 5);
  assert.ok(Math.abs(fifth.lower - grams("1/10")) < 1e-8);
  assert.ok(Math.abs(fifth.upper - grams("1/4")) < 1e-8);
  const twoKg = weightStretchOrigin(stops, 2000);
  assert.equal(twoKg.lower, 1000);
  assert.ok(Math.abs(twoKg.upper - grams("1/10")) < 1e-8);
});

test("regular weight stops are not grayed, so temporary ones are not either", () => {
  const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");
  const weight = machine.slice(machine.indexOf('label="Weight"'), machine.indexOf('label="Count"'));
  assert.match(weight, /isValueEnabled: \(\) => true/);
  assert.equal(weight.includes("weightShowsDollars"), false);
  assert.match(machine, /weightShowsDollars\(metal\.usdPerTroyOz, weight\.grams, count\)/);
});
