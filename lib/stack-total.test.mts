import assert from "node:assert/strict";
import test from "node:test";

import { FLAP_TOTAL_COLUMNS, FLAP_TOTAL_WORD_COLUMNS, fitFlapMoney } from "@/lib/split-flap";
import { TOTAL_BOARD_ID, TOTAL_WORD_ID, seedCascade, syncCascadeLines } from "@/lib/stack-cascade";
import {
  STACK_EMPTY_MESSAGE,
  TOTAL_WORD,
  formatTotalAmount,
  splitFlapRows,
  totalBoardCopy,
} from "@/lib/stack-total";

test("the empty message splits across the two total rows", () => {
  const rows = splitFlapRows(STACK_EMPTY_MESSAGE, FLAP_TOTAL_WORD_COLUMNS, FLAP_TOTAL_COLUMNS);
  assert.equal(rows.top, "LET'S GET");
  assert.equal(rows.bottom, "STACKING!");
  assert.ok([...rows.top].length <= FLAP_TOTAL_WORD_COLUMNS);
  assert.ok([...rows.bottom].length <= FLAP_TOTAL_COLUMNS);

  const empty = totalBoardCopy(0, "$0.00");
  assert.equal(empty.top, "LET'S GET");
  assert.equal(empty.bottom.trim(), "STACKING!");
  assert.equal(empty.bottom.length, FLAP_TOTAL_COLUMNS);
  assert.equal(empty.topWidth, "LET'S GET".length);
  assert.equal(empty.bottomWidth, FLAP_TOTAL_COLUMNS);
});

test("the amount row is a fixed field for $9,999,999.99", () => {
  assert.equal(FLAP_TOTAL_COLUMNS, 13);
  assert.equal("$9,999,999.99".length, FLAP_TOTAL_COLUMNS);
  assert.equal(formatTotalAmount(9999999.99), "$9,999,999.99");
  assert.equal(formatTotalAmount(3551), "$3,551.00");
  assert.equal(formatTotalAmount(0), "$0.00");
  assert.equal(formatTotalAmount(null), "-");
  const fitted = fitFlapMoney(formatTotalAmount(9999999.99), FLAP_TOTAL_COLUMNS);
  const small = fitFlapMoney(formatTotalAmount(30), FLAP_TOTAL_COLUMNS);
  assert.equal(fitted, "$9,999,999.99");
  assert.equal(small.length, FLAP_TOTAL_COLUMNS);
  assert.equal(fitted.length, small.length);

  const filled = totalBoardCopy(2, formatTotalAmount(30));
  assert.equal(filled.top, TOTAL_WORD);
  assert.equal(filled.topWidth, TOTAL_WORD.length);
  assert.equal(filled.bottomWidth, FLAP_TOTAL_COLUMNS);
  assert.equal(filled.bottom.endsWith("$30.00"), true);
});

test("the total flips between the invitation and TOTAL plus the amount", () => {
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
  assert.equal(word?.committed, TOTAL_WORD);
  assert.equal(word?.animate, true);
  assert.equal(amount?.committed, filledCopy.bottom);
  assert.equal(amount?.animate, true);
  assert.equal(added.slots.find((slot) => slot.id === "card")?.committed, "$80");

  const removed = syncCascadeLines(added.slots, emptyBoards);
  assert.equal(removed.slots.find((slot) => slot.id === TOTAL_WORD_ID)?.committed, emptyCopy.top);
  assert.equal(removed.slots.find((slot) => slot.id === TOTAL_BOARD_ID)?.committed, emptyCopy.bottom);
  assert.equal(removed.slots.some((slot) => slot.id === "card"), false);
  assert.equal(removed.slots.length, 2);
});
