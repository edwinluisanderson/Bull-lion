import assert from "node:assert/strict";
import { test } from "node:test";

import {
  nearestAffordableCountIndex,
  nearestAffordableWeightIndex,
  weightShowsDollars,
} from "@/lib/affordable-weight";
import { formatStackPhrase, formatWeightPhrase } from "@/lib/weight-label";
import { COUNTS, DEFAULT_WEIGHT_INDEX, WEIGHTS } from "@/lib/metals";
import { usdPerTroyOunce } from "@/lib/value";

const byId = (id: string) => {
  const weight = WEIGHTS.find((entry) => entry.id === id);
  if (!weight) throw new Error(id);
  return weight;
};

test("reel faces stay on the pre-plate abbreviations", () => {
  assert.deepEqual(
    WEIGHTS.map((weight) => [weight.face, weight.detail]),
    [
      ["1 g", "gram"],
      ["2.5 g", "grams"],
      ["5 g", "grams"],
      ["10 g", "grams"],
      ["20 g", "grams"],
      ["25 g", "grams"],
      ["50 g", "grams"],
      ["100 g", "grams"],
      ["1 kg", "kilogram"],
      ["1/10 oz", "troy"],
      ["1/4 oz", "troy"],
      ["1/2 oz", "troy"],
      ["1 oz", "troy"],
      ["2 oz", "troy"],
      ["5 oz", "troy"],
      ["10 oz", "troy"],
    ],
  );
  assert.equal(`${byId("10g").face} ${byId("10g").detail}`, "10 g grams");
  assert.notEqual(formatStackPhrase(byId("10g"), 1), "10 g grams, 1 piece");
});

test("weight phrases spell grams and reserve troy for ounces", () => {
  assert.equal(formatWeightPhrase(byId("1g")), "1 gram");
  assert.equal(formatWeightPhrase(byId("2.5g")), "2.5 grams");
  assert.equal(formatStackPhrase(byId("2.5g"), 1), "2.5 grams, 1 piece");
  assert.equal(formatWeightPhrase(byId("10g")), "10 grams");
  assert.equal(formatWeightPhrase(byId("25g")), "25 grams");
  assert.equal(formatWeightPhrase(byId("100g")), "100 grams");
  assert.equal(formatWeightPhrase(byId("1kg")), "1 kilogram");
  assert.equal(formatWeightPhrase(byId("1/10")), "1/10 ounce troy");
  assert.equal(formatWeightPhrase(byId("1/4")), "1/4 ounce troy");
  assert.equal(formatWeightPhrase(byId("1/2")), "1/2 ounce troy");
  assert.equal(formatWeightPhrase(byId("1oz")), "1 ounce troy");
  assert.equal(formatWeightPhrase(byId("2oz")), "2 ounces troy");
  assert.equal(formatWeightPhrase(byId("10oz")), "10 ounces troy");
  assert.equal(formatStackPhrase(byId("10g"), 1), "10 grams, 1 piece");
  assert.equal(formatStackPhrase(byId("1oz"), 100), "1 ounce troy, 100 pieces");
  assert.equal(formatWeightPhrase(byId("10g")).includes("troy"), false);
  assert.equal(formatWeightPhrase(byId("1kg")).includes("troy"), false);
});

test("weights run grams ascending, then troy ascending, and default to one ounce", () => {
  assert.deepEqual(
    WEIGHTS.map((weight) => weight.id),
    ["1g", "2.5g", "5g", "10g", "20g", "25g", "50g", "100g", "1kg", "1/10", "1/4", "1/2", "1oz", "2oz", "5oz", "10oz"],
  );
  assert.equal(WEIGHTS[DEFAULT_WEIGHT_INDEX]?.id, "1oz");
  assert.equal(WEIGHTS.length, 16);
  const twoOunce = byId("2oz");
  assert.equal(twoOunce.grams, 31.1034768 * 2);
  assert.equal(twoOunce.face, "2 oz");
  assert.equal(twoOunce.detail, "troy");
  const troy = WEIGHTS.filter((weight) => weight.detail === "troy").map((weight) => weight.id);
  assert.deepEqual(troy, ["1/10", "1/4", "1/2", "1oz", "2oz", "5oz", "10oz"]);
});

test("copper sizes that round under a dollar are not affordable", () => {
  const copper = usdPerTroyOunce(6.3, "lb");
  assert.equal(weightShowsDollars(copper, byId("1g").grams), false);
  assert.equal(weightShowsDollars(copper, byId("1oz").grams), false);
  assert.equal(weightShowsDollars(copper, byId("5oz").grams), true);
  assert.equal(weightShowsDollars(copper, byId("100g").grams), true);
  assert.equal(weightShowsDollars(copper, byId("1kg").grams), true);
});

test("a larger piece count can make a copper size show a dollar", () => {
  const copper = usdPerTroyOunce(6.3, "lb");
  assert.equal(weightShowsDollars(copper, byId("1g").grams, 1), false);
  assert.equal(weightShowsDollars(copper, byId("1g").grams, 100), true);
  const oneGram = WEIGHTS.findIndex((weight) => weight.id === "1g");
  assert.equal(nearestAffordableWeightIndex(WEIGHTS, oneGram, copper, 100), oneGram);
});
test("a live copper price can make a smaller size affordable", () => {
  const rich = usdPerTroyOunce(200, "lb");
  assert.equal(weightShowsDollars(rich, byId("1oz").grams), true);
});

test("gold does not gray a one gram stop", () => {
  assert.equal(weightShowsDollars(3987.2, byId("1g").grams), true);
});

test("copper grays piece counts that round under a dollar for the selected weight", () => {
  const copper = usdPerTroyOunce(6.3, "lb");
  const oneGram = byId("1g").grams;
  const oneOunce = byId("1oz").grams;
  const oneKilo = byId("1kg").grams;
  assert.deepEqual(
    COUNTS.filter((pieces) => weightShowsDollars(copper, oneGram, pieces)),
    [50, 100],
  );
  assert.deepEqual(
    COUNTS.filter((pieces) => weightShowsDollars(copper, oneOunce, pieces)),
    [2, 5, 10, 20, 25, 50, 100],
  );
  assert.deepEqual(
    COUNTS.filter((pieces) => !weightShowsDollars(copper, oneKilo, pieces)),
    [],
  );
  assert.equal(nearestAffordableCountIndex(COUNTS, 0, oneGram, copper), COUNTS.indexOf(50));
  assert.equal(nearestAffordableCountIndex(COUNTS, COUNTS.indexOf(100), oneGram, copper), COUNTS.indexOf(100));
  assert.equal(nearestAffordableCountIndex(COUNTS, 0, oneOunce, copper), COUNTS.indexOf(2));
  assert.equal(nearestAffordableCountIndex(COUNTS, COUNTS.indexOf(25), oneOunce, copper), COUNTS.indexOf(25));
});

test("when no piece count reaches a dollar the highest count is the fallback", () => {
  assert.equal(
    nearestAffordableCountIndex(COUNTS, 0, byId("1kg").grams, 0.0001),
    COUNTS.length - 1,
  );
  const nearer = [1, 2, 100];
  assert.equal(nearestAffordableCountIndex(nearer, 2, byId("1oz").grams, usdPerTroyOunce(6.3, "lb")), 2);
});

test("an unaffordable copper stop moves to the nearest heavier-or-closest size", () => {
  const copper = usdPerTroyOunce(6.3, "lb");
  const oneOunce = WEIGHTS.findIndex((weight) => weight.id === "1oz");
  const fiftyGrams = WEIGHTS.findIndex((weight) => weight.id === "50g");
  assert.equal(nearestAffordableWeightIndex(WEIGHTS, oneOunce, copper), fiftyGrams);

  const tenOunce = WEIGHTS.findIndex((weight) => weight.id === "10oz");
  assert.equal(nearestAffordableWeightIndex(WEIGHTS, tenOunce, copper), tenOunce);
});
