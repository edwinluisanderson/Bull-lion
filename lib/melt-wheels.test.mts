import assert from "node:assert/strict";
import test from "node:test";

import {
  MELT_WHEEL_MAX,
  ODOMETER_STRIP,
  OVERSHOOT_EM,
  STAGGER_MS,
  WHEEL_COUNT,
  WHEEL_STEP_DEG,
  clampMeltDollars,
  layoutWheels,
  meltWheelLabel,
  odometerCell,
  odometerNeighbours,
  wheelDurationMs,
  wheelStaggerMs,
} from "@/lib/melt-wheels";

test("a right-locked row pads blanks on the left and keeps the ones wheel last", () => {
  assert.equal(WHEEL_COUNT, 10);
  const small = layoutWheels("$189");
  assert.deepEqual(small, ["", "", "", "", "", "", "$", "1", "8", "9"]);
  assert.equal(small.at(-1), "9");

  const grouped = layoutWheels("$1,234");
  assert.deepEqual(grouped, ["", "", "", "", "$", "1", ",", "2", "3", "4"]);
  assert.equal(grouped.filter((char) => char === "$").length, 1);
  assert.equal(grouped.filter((char) => char === ",").length, 1);

  const full = layoutWheels("$9,999,999");
  assert.equal(full.length, 10);
  assert.deepEqual(full, ["$", "9", ",", "9", "9", "9", ",", "9", "9", "9"]);
  assert.equal(full.filter((char) => char === "").length, 0);

  const again = layoutWheels("$2");
  assert.deepEqual(again, ["", "", "", "", "", "", "", "", "$", "2"]);
  assert.equal(again.at(-1), "2");
  assert.equal(layoutWheels("$189").at(-1), "9");
});

test("dollars clamp at $9,999,999 and a bad value is a blank row", () => {
  assert.equal(clampMeltDollars(9_999_999), MELT_WHEEL_MAX);
  assert.equal(clampMeltDollars(9_999_999.4), MELT_WHEEL_MAX);
  assert.equal(clampMeltDollars(12_345_678), MELT_WHEEL_MAX);
  assert.equal(clampMeltDollars(-40), 0);
  assert.equal(meltWheelLabel(12_345_678), "$9,999,999");
  assert.equal(meltWheelLabel(18698), "$18,698");
  assert.deepEqual(layoutWheels(meltWheelLabel(Number.NaN)), Array(WHEEL_COUNT).fill(""));
  assert.equal(layoutWheels(meltWheelLabel(MELT_WHEEL_MAX)).join(""), "$9,999,999");
});

test("odometer neighbours put 9 above 0 and 0 below 9", () => {
  assert.equal(odometerNeighbours("0").above, "9");
  assert.equal(odometerNeighbours("0").below, "1");
  assert.equal(odometerNeighbours("9").below, "0");
  assert.equal(odometerNeighbours("9").above, "8");
  assert.equal(odometerNeighbours("5").above, "4");
  assert.equal(odometerNeighbours("5").below, "6");
  assert.equal(ODOMETER_STRIP[odometerCell("0") - 1], "9");
  assert.equal(ODOMETER_STRIP[odometerCell("9") + 1], "0");
  const neighbour = Math.cos((WHEEL_STEP_DEG * Math.PI) / 180);
  assert.ok(Math.abs(neighbour - 0.48) < 0.01, `neighbour scale ${neighbour}`);
});

test("wheels stagger from the right and a longer trip lasts longer", () => {
  assert.equal(STAGGER_MS, 55);
  assert.equal(OVERSHOOT_EM, 0.14);
  assert.equal(wheelStaggerMs(WHEEL_COUNT - 1), 0);
  assert.equal(wheelStaggerMs(WHEEL_COUNT - 2), STAGGER_MS);
  assert.equal(wheelStaggerMs(0), (WHEEL_COUNT - 1) * STAGGER_MS);
  for (let slot = 0; slot < WHEEL_COUNT - 1; slot += 1) {
    assert.ok(wheelStaggerMs(slot) > wheelStaggerMs(slot + 1));
  }
  assert.ok(wheelDurationMs(8) > wheelDurationMs(1));
  assert.equal(wheelDurationMs(0), 460);
});
