import assert from "node:assert/strict";
import { test } from "node:test";

import { commitIndex } from "@/lib/drum";
import { COUNTS } from "@/lib/metals";
import {
  STRETCH_HOLD_MS,
  STRETCH_RUBBER_PX,
  STRETCH_SLOP_PX,
  STRETCH_SLOT_PX,
  gapIntegers,
  handoffPosition,
  nextGestureMode,
  pressHitsCenter,
  readStretch,
  stretchDetents,
  valueAfterRelease,
} from "@/lib/stretch";

const FIVE = COUNTS.indexOf(5);

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

test("dragging down from 5 reveals the in-between counts", () => {
  assert.deepEqual(gapIntegers(5, 10), [6, 7, 8, 9]);
  const detents = stretchDetents(COUNTS, FIVE, 1, () => true);
  assert.deepEqual(detents, [6, 7, 8, 9, 10]);
  const atSeven = readStretch(STRETCH_RUBBER_PX + STRETCH_SLOT_PX + 8, detents, 10);
  assert.deepEqual(atSeven.committed, [6, 7]);
  assert.equal(atSeven.active, 7);
  assert.equal(atSeven.handoff, false);
  assert.equal(valueAfterRelease(5, 7, COUNTS, () => true), 7);
});

test("gray in-between counts are skipped", () => {
  const detents = stretchDetents(COUNTS, FIVE, 1, (value) => value !== 6 && value !== 7);
  assert.deepEqual(detents, [8, 9, 10]);
  const first = readStretch(STRETCH_RUBBER_PX + 1, detents, 10);
  assert.deepEqual(first.committed, [8]);
});

test("release keeps a valid count and snaps when that count is gray", () => {
  assert.equal(valueAfterRelease(5, null, COUNTS, () => true), 5);
  assert.equal(valueAfterRelease(5, 7, COUNTS, (value) => value !== 7), 8);
  assert.equal(
    valueAfterRelease(5, 7, COUNTS, (value) => COUNTS.includes(value)),
    5,
  );
});

test("handoff to the next real stop commits it once and keeps dragging", () => {
  const detents = stretchDetents(COUNTS, FIVE, 1, () => true);
  const almost = readStretch(STRETCH_RUBBER_PX + STRETCH_SLOT_PX * 4 - 1, detents, 10);
  const landed = readStretch(STRETCH_RUBBER_PX + STRETCH_SLOT_PX * 4, detents, 10);
  const past = readStretch(STRETCH_RUBBER_PX + STRETCH_SLOT_PX * 4 + 20, detents, 10);

  assert.deepEqual(almost.committed, [6, 7, 8, 9]);
  assert.equal(almost.handoff, false);
  assert.deepEqual(landed.committed, [6, 7, 8, 9, 10]);
  assert.equal(landed.handoff, true);
  assert.equal(landed.remainderPx, 0);
  assert.deepEqual(past.committed.slice(almost.committed.length), [10]);
  assert.deepEqual(past.committed.slice(landed.committed.length), []);
  assert.equal(past.remainderPx, 20);

  const nextIndex = FIVE + 1;
  assert.equal(handoffPosition(nextIndex, 0, 86), nextIndex);
  const stillThere = handoffPosition(nextIndex, past.remainderPx, 86);
  assert.equal(commitIndex(stillThere, COUNTS.length, () => true), nextIndex);
  const nextStop = handoffPosition(nextIndex, 86, 86);
  assert.equal(commitIndex(nextStop, COUNTS.length, () => true), nextIndex - 1);
});
