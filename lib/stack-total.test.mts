import assert from "node:assert/strict";
import test from "node:test";

import { FLAP_TOTAL_COLUMNS, FLAP_TOTAL_WORD_COLUMNS, fitFlapMoney, flapText, padFlap } from "@/lib/split-flap";
import { TOTAL_BOARD_ID, TOTAL_WORD_ID, seedCascade, syncCascadeLines } from "@/lib/stack-cascade";
import {
  STACK_EMPTY_MESSAGE,
  TOTAL_WORD,
  formatTotalAmount,
  totalBoardCopy,
} from "@/lib/stack-total";

test("the empty message fills both total rows", () => {
  assert.equal(FLAP_TOTAL_WORD_COLUMNS, 18);
  assert.equal(STACK_EMPTY_MESSAGE.includes("stacking"), true);
  const empty = totalBoardCopy(0, "$0");
  assert.equal(empty.top.trim(), "LET'S GET");
  assert.equal(empty.bottom.trim(), "STACKING!");
  assert.equal(empty.top.length, FLAP_TOTAL_WORD_COLUMNS);
  assert.equal(empty.bottom.length, FLAP_TOTAL_COLUMNS);
  assert.equal(empty.topWidth, FLAP_TOTAL_WORD_COLUMNS);
  assert.equal(empty.bottomWidth, FLAP_TOTAL_COLUMNS);
  assert.equal(empty.top.startsWith(" "), true);
  assert.equal(empty.bottom.startsWith(" "), true);
});

test("the word row reads MY HOARD in the existing uppercase flaps", () => {
  const used = [...TOTAL_WORD].length;
  assert.equal(TOTAL_WORD, "MY HOARD");
  assert.equal(flapText(TOTAL_WORD), TOTAL_WORD);
  assert.equal(used, 8);
  assert.equal(FLAP_TOTAL_WORD_COLUMNS, 18);
  assert.equal(used < FLAP_TOTAL_WORD_COLUMNS, true);

  const filled = totalBoardCopy(1, formatTotalAmount(30));
  assert.equal(filled.top, padFlap("MY HOARD", FLAP_TOTAL_WORD_COLUMNS));
  assert.equal(filled.top.length, FLAP_TOTAL_WORD_COLUMNS);
  assert.equal(filled.top.includes("\n"), false);
  assert.equal(filled.top.slice(0, used), "MY HOARD");
  assert.equal(filled.top.slice(used), " ".repeat(FLAP_TOTAL_WORD_COLUMNS - used));
  assert.equal([...filled.top].filter((char) => char !== " ").length, 7);
});

test("the amount row is whole dollars, left MY HOARD and right amount", () => {
  assert.equal(FLAP_TOTAL_COLUMNS, 13);
  assert.equal(formatTotalAmount(9999999.99), "$10,000,000");
  assert.equal(formatTotalAmount(3551), "$3,551");
  assert.equal(formatTotalAmount(0), "$0");
  assert.equal(formatTotalAmount(null), "-");
  const fitted = fitFlapMoney(formatTotalAmount(9999999), FLAP_TOTAL_COLUMNS);
  const small = fitFlapMoney(formatTotalAmount(30), FLAP_TOTAL_COLUMNS);
  assert.equal(fitted.endsWith("$9,999,999"), true);
  assert.equal(small.length, FLAP_TOTAL_COLUMNS);
  assert.equal(fitted.length, small.length);

  const filled = totalBoardCopy(2, formatTotalAmount(30));
  assert.equal(filled.top, padFlap(TOTAL_WORD, FLAP_TOTAL_WORD_COLUMNS));
  assert.equal(filled.top.startsWith(TOTAL_WORD), true);
  assert.equal(filled.top.endsWith(" "), true);
  assert.equal(filled.topWidth, FLAP_TOTAL_WORD_COLUMNS);
  assert.equal(filled.bottomWidth, FLAP_TOTAL_COLUMNS);
  assert.equal(filled.bottom.endsWith("$30"), true);
  assert.equal(filled.rounded, false);
});

test("the total flips between the invitation and MY HOARD plus the amount", () => {
  const emptyCopy = totalBoardCopy(0, formatTotalAmount(0));
  const filledCopy = totalBoardCopy(1, formatTotalAmount(80));
  const again = totalBoardCopy(4, formatTotalAmount(80));
  assert.equal(again.top, filledCopy.top);
  assert.notEqual(emptyCopy.top, filledCopy.top);
  assert.notEqual(emptyCopy.bottom, filledCopy.bottom);

  const emptyBoards = [
    { id: TOTAL_WORD_ID, live: emptyCopy.top, visible: true },
    { id: TOTAL_BOARD_ID, live: emptyCopy.bottom, visible: true },
  ];
  const added = syncCascadeLines(seedCascade(emptyBoards), [
    { id: "card", live: "$80", visible: true },
    { id: TOTAL_WORD_ID, live: filledCopy.top, visible: true },
    { id: TOTAL_BOARD_ID, live: filledCopy.bottom, visible: true },
  ]);
  const word = added.slots.find((slot) => slot.id === TOTAL_WORD_ID);
  const amount = added.slots.find((slot) => slot.id === TOTAL_BOARD_ID);
  assert.equal(word?.committed, filledCopy.top);
  assert.equal(word?.animate, true);
  assert.equal(amount?.committed, filledCopy.bottom);
  assert.equal(filledCopy.top.startsWith(TOTAL_WORD), true);
  assert.equal(amount?.animate, true);
  assert.equal(added.slots.find((slot) => slot.id === "card")?.committed, "$80");

  const removed = syncCascadeLines(added.slots, emptyBoards);
  assert.equal(removed.slots.find((slot) => slot.id === TOTAL_WORD_ID)?.committed, emptyCopy.top);
  assert.equal(removed.slots.find((slot) => slot.id === TOTAL_BOARD_ID)?.committed, emptyCopy.bottom);
  assert.equal(removed.slots.some((slot) => slot.id === "card"), false);
  assert.equal(removed.slots.length, 2);
});
