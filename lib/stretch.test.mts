import assert from "node:assert/strict";
import { test } from "node:test";

import { COUNTS } from "@/lib/metals";
import {
  STRETCH_HOLD_MS,
  STRETCH_SLOP_PX,
  countRows,
  guestStillVisible,
  handoffShift,
  nextGestureMode,
  pressHitsCenter,
  stretchLayout,
  stretchSequence,
  valueAfterRelease,
  visibleTriple,
} from "@/lib/stretch";

const TEN = COUNTS.indexOf(10);
const HEIGHT = 86;

test("a short press or a quick drag does not engage stretch", () => {
  assert.equal(nextGestureMode("pending", 200, 2), "pending");
  assert.equal(nextGestureMode("pending", STRETCH_HOLD_MS - 1, 0), "pending");
  assert.equal(nextGestureMode("pending", 90, STRETCH_SLOP_PX + 30), "drag");
  assert.equal(nextGestureMode("drag", 800, 1), "drag");
});

test("a long press with little movement engages stretch", () => {
  assert.equal(nextGestureMode("pending", STRETCH_HOLD_MS, 4), "stretch");
  assert.equal(pressHitsCenter(120, 258), true);
  assert.equal(pressHitsCenter(10, 258), false);
});

test("dragging down from 10 slides lower counts out while 10 and 20 move down", () => {
  assert.deepEqual(stretchSequence(COUNTS, TEN, "down"), [9, 8, 7, 6]);
  const start = stretchLayout({
    direction: "down",
    anchor: 10,
    pin: 5,
    pushed: 20,
    sequence: [9, 8, 7, 6],
    travel: 0,
    itemHeight: HEIGHT,
  });
  const pulled = stretchLayout({
    direction: "down",
    anchor: 10,
    pin: 5,
    pushed: 20,
    sequence: [9, 8, 7, 6],
    travel: HEIGHT,
    itemHeight: HEIGHT,
  });
  assert.equal(start.centered, 10);
  assert.equal(start.rows.find((row) => row.role === "pin")?.screenTop, 0);
  assert.equal(pulled.rows.find((row) => row.role === "pin")?.screenTop, 0);
  assert.ok(
    (pulled.rows.find((row) => row.role === "anchor")?.screenTop ?? 0) >
      (start.rows.find((row) => row.role === "anchor")?.screenTop ?? 0),
  );
  assert.ok(
    (pulled.rows.find((row) => row.role === "pushed")?.screenTop ?? 0) >
      (start.rows.find((row) => row.role === "pushed")?.screenTop ?? 0),
  );
  assert.equal(pulled.centered, 9);
  assert.equal(pulled.rows.filter((row) => row.centered).length, 1);
});

test("dragging up from 10 slides higher counts out from behind 20", () => {
  const sequence = stretchSequence(COUNTS, TEN, "up");
  assert.equal(sequence[0], 11);
  assert.equal(sequence.at(-1), 19);
  const pulled = stretchLayout({
    direction: "up",
    anchor: 10,
    pin: 20,
    pushed: 5,
    sequence,
    travel: HEIGHT,
    itemHeight: HEIGHT,
  });
  assert.equal(pulled.centered, 11);
  assert.equal(pulled.rows.find((row) => row.role === "pin")?.screenTop, HEIGHT * 2);
  assert.equal(pulled.rows.filter((row) => row.centered).length, 1);
  const further = stretchLayout({
    direction: "up",
    anchor: 10,
    pin: 20,
    pushed: 5,
    sequence,
    travel: HEIGHT * 2,
    itemHeight: HEIGHT,
  });
  assert.equal(further.centered, 12);
});

test("the single highlight is the value sitting on the center line", () => {
  const sequence = [9, 8, 7, 6];
  const mid = stretchLayout({
    direction: "down",
    anchor: 10,
    pin: 5,
    pushed: 20,
    sequence,
    travel: HEIGHT * 2,
    itemHeight: HEIGHT,
  });
  assert.equal(mid.centered, 8);
  assert.equal(mid.rows.filter((row) => row.centered).length, 1);
  assert.equal(mid.rows.find((row) => row.centered)?.value, 8);
  assert.equal(mid.rows.find((row) => row.value === 9)?.centered, false);
  assert.equal(mid.rows.find((row) => row.value === 10)?.centered, false);
});

test("release locks the centered in-between between its real neighbors", () => {
  const guest = { value: 8, slot: TEN - 0.5 };
  assert.deepEqual(visibleTriple(guest.slot, countRows(COUNTS, guest)), [5, 8, 10]);
  assert.equal(valueAfterRelease(10, 8, COUNTS, () => true), 8);
});

test("a locked in-between vanishes once it leaves the three visible rows", () => {
  const guest = { value: 8, slot: TEN - 0.5 };
  assert.equal(guestStillVisible(TEN - 0.5, COUNTS, guest), true);
  assert.equal(guestStillVisible(TEN - 1, COUNTS, guest), true);
  assert.equal(guestStillVisible(TEN, COUNTS, guest), true);
  assert.equal(guestStillVisible(TEN - 2, COUNTS, guest), false);
  assert.equal(guestStillVisible(TEN + 1, COUNTS, guest), false);
  assert.deepEqual(visibleTriple(TEN + 1, countRows(COUNTS, null)), [10, 20, 25]);
});

test("after the in-between counts pass center, further dragging is a normal reel move", () => {
  const sequence = [9, 8, 7, 6];
  const before = stretchLayout({
    direction: "down",
    anchor: 10,
    pin: 5,
    pushed: 20,
    sequence,
    travel: sequence.length * HEIGHT - 1,
    itemHeight: HEIGHT,
  });
  const edge = stretchLayout({
    direction: "down",
    anchor: 10,
    pin: 5,
    pushed: 20,
    sequence,
    travel: sequence.length * HEIGHT,
    itemHeight: HEIGHT,
  });
  assert.equal(before.handoff, false);
  assert.equal(before.centered, 6);
  assert.equal(edge.handoff, true);
  assert.equal(edge.remainderPx, 0);
  assert.equal(handoffShift("down", HEIGHT, HEIGHT), -1);
  assert.equal(handoffShift("up", HEIGHT, HEIGHT), 1);
});

test("a gray centered count falls back to the nearest real stop", () => {
  assert.equal(valueAfterRelease(10, 8, COUNTS, (value) => value !== 8), 10);
  assert.equal(
    valueAfterRelease(10, 6, COUNTS, (value) => value === 5 || value === 10),
    5,
  );
});

test("the ends of the count list have no invented numbers", () => {
  assert.deepEqual(stretchSequence(COUNTS, COUNTS.indexOf(1), "down"), []);
  assert.deepEqual(stretchSequence(COUNTS, COUNTS.indexOf(100), "up"), []);
  assert.deepEqual(stretchSequence(COUNTS, COUNTS.indexOf(2), "down"), []);
});
