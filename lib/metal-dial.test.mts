import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { DEFAULT_METAL_INDEX, METAL_CATALOG } from "@/lib/metals";
import { parsePriceBook, samplePriceBook } from "@/lib/price-book";
import {
  METAL_DIAL_START_DEG,
  METAL_DIAL_SWEEP_DEG,
  metalDialNeedleAngle,
  metalDialTickAngles,
} from "@/lib/metal-dial";

test("the metal dial has one evenly spaced tick per metal", () => {
  const ticks = metalDialTickAngles(METAL_CATALOG.length);
  assert.equal(METAL_CATALOG.length, 5);
  assert.equal(ticks.length, 5);
  assert.equal(ticks[0], METAL_DIAL_START_DEG);
  assert.equal(ticks.at(-1), METAL_DIAL_START_DEG + METAL_DIAL_SWEEP_DEG);
  const step = METAL_DIAL_SWEEP_DEG / 4;
  for (let index = 1; index < ticks.length; index += 1) {
    assert.equal(ticks[index] - ticks[index - 1], step);
  }
});

test("the metal needle sits on the selected metal's tick", () => {
  const count = METAL_CATALOG.length;
  const ticks = metalDialTickAngles(count);
  METAL_CATALOG.forEach((_, index) => {
    assert.equal(metalDialNeedleAngle(index, count), ticks[index]);
  });
  assert.equal(metalDialNeedleAngle(0, count), -120);
  assert.equal(metalDialNeedleAngle(3, count), 60);
  assert.equal(metalDialNeedleAngle(4, count), 120);
});

const METAL_ORDER = ["Gold", "Silver", "Platinum", "Palladium", "Copper"];

test("the metal dial and the metal wheel share one catalog order", () => {
  assert.deepEqual(
    METAL_CATALOG.map((metal) => metal.name),
    METAL_ORDER,
  );
  assert.equal(DEFAULT_METAL_INDEX, 0);
  assert.equal(METAL_CATALOG[DEFAULT_METAL_INDEX]?.name, "Gold");

  const sample = samplePriceBook();
  assert.deepEqual(
    sample.metals.map((metal) => metal.name),
    METAL_ORDER,
  );
  const shuffled = {
    ...sample,
    metals: [...sample.metals].reverse(),
  };
  const parsed = parsePriceBook(JSON.parse(JSON.stringify(shuffled)));
  assert.deepEqual(
    parsed?.metals.map((metal) => metal.name),
    METAL_ORDER,
  );

  const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");
  assert.match(machine, /book\.metals\.map\(\(entry\)/);
  assert.match(machine, /initialIndex=\{DEFAULT_METAL_INDEX\}/);
  const metalGauge = machine.slice(machine.indexOf('label="METAL"'), machine.indexOf('label="STACK"'));
  assert.match(metalGauge, /stops=\{book\.metals\.length\}/);
  assert.match(metalGauge, /index=\{metalIndex\}/);
  assert.equal(metalGauge.includes("fraction="), false);
});
