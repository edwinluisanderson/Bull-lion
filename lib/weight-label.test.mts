import assert from "node:assert/strict";
import { test } from "node:test";

import { nearestAffordableWeightIndex, weightShowsDollars } from "@/lib/affordable-weight";
import { formatStackPhrase, formatWeightPhrase } from "@/lib/weight-label";
import { WEIGHTS } from "@/lib/metals";
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
      ["5 g", "grams"],
      ["10 g", "grams"],
      ["1/10 oz", "troy"],
      ["1/4 oz", "troy"],
      ["1/2 oz", "troy"],
      ["1 oz", "troy"],
      ["5 oz", "troy"],
      ["10 oz", "troy"],
      ["100 g", "grams"],
      ["1 kg", "kilogram"],
    ],
  );
  assert.equal(`${byId("10g").face} ${byId("10g").detail}`, "10 g grams");
  assert.notEqual(formatStackPhrase(byId("10g"), 1), "10 g grams, 1 piece");
});

test("weight phrases spell grams and reserve troy for ounces", () => {
  assert.equal(formatWeightPhrase(byId("1g")), "1 gram");
  assert.equal(formatWeightPhrase(byId("10g")), "10 grams");
  assert.equal(formatWeightPhrase(byId("100g")), "100 grams");
  assert.equal(formatWeightPhrase(byId("1kg")), "1 kilogram");
  assert.equal(formatWeightPhrase(byId("1/10")), "1/10 ounce troy");
  assert.equal(formatWeightPhrase(byId("1/4")), "1/4 ounce troy");
  assert.equal(formatWeightPhrase(byId("1/2")), "1/2 ounce troy");
  assert.equal(formatWeightPhrase(byId("1oz")), "1 ounce troy");
  assert.equal(formatWeightPhrase(byId("10oz")), "10 ounces troy");
  assert.equal(formatStackPhrase(byId("10g"), 1), "10 grams, 1 piece");
  assert.equal(formatStackPhrase(byId("1oz"), 100), "1 ounce troy, 100 pieces");
  assert.equal(formatWeightPhrase(byId("10g")).includes("troy"), false);
  assert.equal(formatWeightPhrase(byId("1kg")).includes("troy"), false);
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

test("an unaffordable copper stop moves to the nearest heavier-or-closest size", () => {
  const copper = usdPerTroyOunce(6.3, "lb");
  const oneOunce = WEIGHTS.findIndex((weight) => weight.id === "1oz");
  const hundredGrams = WEIGHTS.findIndex((weight) => weight.id === "100g");
  assert.equal(nearestAffordableWeightIndex(WEIGHTS, oneOunce, copper), hundredGrams);

  const tenOunce = WEIGHTS.findIndex((weight) => weight.id === "10oz");
  assert.equal(nearestAffordableWeightIndex(WEIGHTS, tenOunce, copper), tenOunce);
});
