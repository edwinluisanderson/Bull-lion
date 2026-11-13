import assert from "node:assert/strict";
import { test } from "node:test";

import { COUNTS } from "@/lib/metals";
import {
  STRETCH_HOLD_MS,
  STRETCH_SLOP_PX,
  STRETCH_SLOT_PX,
  handoffShift,
  nextGestureMode,
  pressHitsCenter,
  readSlide,
  stretchSequence,
  valueAfterRelease,
} from "@/lib/stretch";

const TWENTY_FIVE = COUNTS.indexOf(25);

test("a short press or a quick drag does not engage stretch", () => {
  assert.equal(nextGestureMode("pending", 200, 2), "pending");
  assert.equal(nextGestureMode("pending", STRETCH_HOLD_MS - 1, 0), "pending");
  assert.equal(nextGestureMode("pending", 90, STRETCH_SLOP_PX + 30), "drag");
  assert.equal(nextGestureMode("drag", 800, 1), "drag");
});

test("a long press with little movement engages stretch", () => {
  assert.equal(nextGestureMode("pending", STRETCH_HOLD_MS, 4), "stretch");
  assert.equal(nextGestureMode("pending", 450, STRETCH_SLOP_PX), "stretch");
  assert.equal(pressHitsCenter(120, 258), true);
  assert.equal(pressHitsCenter(10, 258), false);
  assert.equal(pressHitsCenter(220, 258), false);
});

test("dragging down from 25 reveals the next lower counts", () => {
  assert.deepEqual(stretchSequence(COUNTS, TWENTY_FIVE, "down"), [24, 23, 22, 21]);
  const early = readSlide(STRETCH_SLOT_PX * 0.4, "down", [24, 23, 22, 21], 25);
  assert.equal(early.highlight, 24);
  assert.deepEqual(early.frozen.map((plate) => plate.value), []);
  assert.equal(early.sliding?.value, 24);
  assert.equal(early.handoff, false);

  const next = readSlide(STRETCH_SLOT_PX + 12, "down", [24, 23, 22, 21], 25);
  assert.equal(next.highlight, 23);
  assert.deepEqual(next.frozen.map((plate) => plate.value), [24]);
  assert.notEqual(next.highlight, 24);
});

test("dragging up from 25 reveals the next higher counts", () => {
  const sequence = stretchSequence(COUNTS, TWENTY_FIVE, "up");
  assert.equal(sequence[0], 26);
  assert.equal(sequence.at(-1), 49);
  const early = readSlide(STRETCH_SLOT_PX * 0.5, "up", sequence, 25);
  assert.equal(early.highlight, 26);
  assert.equal(early.direction, "up");
  const further = readSlide(STRETCH_SLOT_PX + 8, "up", sequence, 25);
  assert.equal(further.highlight, 27);
  assert.deepEqual(further.frozen.map((plate) => plate.value), [26]);
});

test("only the newest revealed count is highlighted, and earlier ones stay put", () => {
  const sequence = [24, 23, 22, 21];
  const first = readSlide(STRETCH_SLOT_PX + 10, "down", sequence, 25);
  const later = readSlide(STRETCH_SLOT_PX * 2 + 10, "down", sequence, 25);
  const highlighted = [first.sliding, ...first.frozen].filter((plate) => plate?.value === first.highlight);
  assert.equal(highlighted.length, 1);
  assert.equal(first.highlight, 23);
  assert.equal(later.highlight, 22);
  assert.equal(first.frozen[0]?.offsetPx, STRETCH_SLOT_PX);
  assert.equal(later.frozen[0]?.offsetPx, first.frozen[0]?.offsetPx);
  assert.equal(later.frozen[1]?.offsetPx, STRETCH_SLOT_PX * 2);
  assert.equal(later.frozen[1]?.frozen, true);
});

test("the original stop starts moving only after the in-between counts run out", () => {
  const sequence = [24, 23, 22, 21];
  const before = readSlide(sequence.length * STRETCH_SLOT_PX - 1, "down", sequence, 25);
  assert.equal(before.handoff, false);
  assert.equal(before.highlight, 21);
  assert.equal(before.remainderPx, 0);

  const edge = readSlide(sequence.length * STRETCH_SLOT_PX, "down", sequence, 25);
  assert.equal(edge.handoff, true);
  assert.equal(edge.remainderPx, 0);
  assert.equal(edge.frozen.length, sequence.length);

  const past = readSlide(sequence.length * STRETCH_SLOT_PX + 30, "down", sequence, 25);
  assert.equal(past.remainderPx, 30);
  assert.equal(past.frozen.length, sequence.length);
  assert.equal(handoffShift("down", past.remainderPx, 86), -past.remainderPx / 86);
  assert.equal(handoffShift("up", 86, 86), 1);
});

test("release keeps the ended count and a gray count falls back to the nearest stop", () => {
  assert.equal(valueAfterRelease(25, null, COUNTS, () => true), 25);
  assert.equal(valueAfterRelease(25, 22, COUNTS, () => true), 22);
  assert.equal(
    valueAfterRelease(25, 22, COUNTS, (value) => value === 20 || value === 25 || value === 50),
    20,
  );
  assert.equal(
    valueAfterRelease(25, 24, COUNTS, (value) => COUNTS.includes(value)),
    25,
  );
});

test("the ends of the count list have no invented numbers", () => {
  assert.deepEqual(stretchSequence(COUNTS, COUNTS.indexOf(1), "down"), []);
  assert.deepEqual(stretchSequence(COUNTS, COUNTS.indexOf(100), "up"), []);
  assert.deepEqual(stretchSequence(COUNTS, COUNTS.indexOf(2), "down"), []);
  const immediate = readSlide(28, "down", [], 1);
  assert.equal(immediate.handoff, true);
  assert.equal(immediate.highlight, 1);
  assert.equal(immediate.remainderPx, 28);
});
