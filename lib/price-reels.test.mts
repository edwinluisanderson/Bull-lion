import assert from "node:assert/strict";
import { test } from "node:test";

import { formatWholeDollars } from "@/lib/format";
import { priceParts } from "@/lib/price-reels";

test("melt prices round to whole dollars with no cents", () => {
  assert.equal(formatWholeDollars(3926.5), "$3,927");
  assert.equal(formatWholeDollars(3926.49), "$3,926");
  assert.equal(formatWholeDollars(0.43), "$0");
  assert.equal(formatWholeDollars(0.5), "$1");
  assert.equal(formatWholeDollars(Number.NaN), "—");
});

test("a whole-dollar price keeps marks static and digits in order", () => {
  const parts = priceParts(formatWholeDollars(3926.5));
  assert.equal(
    parts.map((part) => (part.kind === "digit" ? String(part.digit) : part.char)).join(""),
    "$3,927",
  );
  assert.equal(parts.some((part) => part.kind === "mark" && part.char === "."), false);
  const digits = parts.filter((part) => part.kind === "digit");
  assert.deepEqual(
    digits.map((part) => part.order),
    [0, 1, 2, 3],
  );
});

test("the ones place keeps its key when the price grows from zero", () => {
  const copper = priceParts(formatWholeDollars(0.43));
  const gold = priceParts(formatWholeDollars(3926.5));

  const digit = (parts: ReturnType<typeof priceParts>, key: string) => {
    const part = parts.find((entry) => entry.key === key);
    assert.equal(part?.kind, "digit");
    if (part?.kind !== "digit") throw new Error(key);
    return part.digit;
  };

  assert.equal(digit(copper, "d-1"), 0);
  assert.equal(digit(gold, "d-1"), 7);
  assert.equal(copper.filter((part) => part.kind === "digit").length, 1);
  assert.equal(gold.filter((part) => part.kind === "digit").length, 4);
});

test("a missing price is a single static mark", () => {
  assert.deepEqual(priceParts("—"), [{ kind: "mark", key: "mark-0", char: "—" }]);
});
