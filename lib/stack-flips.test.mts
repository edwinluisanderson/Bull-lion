import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { TOTAL_BOARD_ID, TOTAL_WORD_ID, priceCascade, seedCascade, syncCascadeLines } from "@/lib/stack-cascade";
import { boardsThatFlip, type FlapBoard } from "@/lib/stack-flips";
import { STACK_EMPTY_MESSAGE, TOTAL_WORD, totalBoardCopy } from "@/lib/stack-total";

const table = readFileSync(new URL("../components/stack-table.tsx", import.meta.url), "utf8");

function card(id: string, melt: string, description = id): FlapBoard {
  return { id, fields: [description, "AU", "1 oz", "1", melt] };
}

function total(amount: string): FlapBoard[] {
  const copy = totalBoardCopy(amount ? 1 : 0, amount);
  return [
    { id: TOTAL_WORD_ID, fields: [copy.top] },
    { id: TOTAL_BOARD_ID, fields: [copy.bottom] },
  ];
}

test("unchanged boards do not flip", () => {
  const boards = [card("a", "$10"), card("b", "$20"), ...total("$30.00")];
  assert.deepEqual(boardsThatFlip(boards, boards), []);
  assert.deepEqual(
    boardsThatFlip(boards, [card("b", "$20"), card("a", "$10"), ...total("$30.00")]),
    [],
  );
});

test("deleting a card does not flip the cards that remain", () => {
  const before = [card("top", "$10"), card("mid", "$20"), card("low", "$30"), ...total("$60.00")];
  for (const removed of ["top", "mid", "low"]) {
    const kept = before.filter((board) => board.id !== removed && board.id !== TOTAL_BOARD_ID);
    const sum = kept
      .filter((board) => board.id !== TOTAL_WORD_ID)
      .reduce((total, board) => total + Number(board.fields.at(-1)?.replace(/[^0-9.]/g, "")), 0);
    const after = [...kept.filter((board) => board.id !== TOTAL_WORD_ID), ...total(`$${sum}.00`)];
    const flipping = boardsThatFlip(before, after);
    assert.deepEqual(
      flipping.filter((id) => id !== TOTAL_BOARD_ID && id !== TOTAL_WORD_ID),
      [],
    );
    assert.equal(flipping.includes(TOTAL_BOARD_ID), true);
    assert.equal(flipping.includes(removed), false);
  }
});

test("the last delete flips the total to the empty message and nothing else", () => {
  const before = [card("only", "$10"), ...total("$10.00")];
  const empty = totalBoardCopy(0, "");
  const after: FlapBoard[] = [
    { id: TOTAL_WORD_ID, fields: [empty.top] },
    { id: TOTAL_BOARD_ID, fields: [empty.bottom] },
  ];
  assert.deepEqual(boardsThatFlip(before, after), [TOTAL_WORD_ID, TOTAL_BOARD_ID]);
  assert.equal(empty.top.includes("LET"), true);
  assert.equal(STACK_EMPTY_MESSAGE.includes("stacking"), true);
  assert.equal(after.some((board) => board.id === "only"), false);
});

test("adding a card flips only the new card", () => {
  const before = [card("old", "$10", "Gold"), ...total("$10.00")];
  const after = [card("new", "$4", "Silver"), card("old", "$10", "Gold"), ...total("$14.00")];
  const flipping = boardsThatFlip(before, after);
  assert.deepEqual(
    flipping.filter((id) => id !== TOTAL_BOARD_ID),
    ["new"],
  );
  assert.equal(flipping.includes("old"), false);
  assert.equal(flipping.includes(TOTAL_WORD_ID), false);
  assert.match(table, /key=\{line == null \? `blank-\$\{index\}` : line\.id\}/);
  assert.equal(table.includes("key={index}"), false);
  assert.equal(table.includes("insertCascade"), false);
});

test("a price change flips only the cards whose melt changed, then the amount", () => {
  const before = [card("gold", "$10"), card("silver", "$5"), ...total("$15.00")];
  const after = [card("gold", "$12"), card("silver", "$5"), ...total("$17.00")];
  assert.deepEqual(boardsThatFlip(before, after), ["gold", TOTAL_BOARD_ID]);
  assert.equal(TOTAL_WORD, "TOTAL");

  const step = priceCascade(
    seedCascade([
      { id: "gold", live: "$10", visible: true },
      { id: "silver", live: "$5", visible: true },
      { id: TOTAL_WORD_ID, live: "TOTAL", visible: true },
      { id: TOTAL_BOARD_ID, live: "$15.00", visible: true },
    ]),
    [
      { id: "gold", live: "$12", visible: true },
      { id: "silver", live: "$5", visible: true },
      { id: TOTAL_WORD_ID, live: "TOTAL", visible: true },
      { id: TOTAL_BOARD_ID, live: "$17.00", visible: true },
    ],
    0,
    false,
  );
  assert.equal(step.slots.find((slot) => slot.id === "gold")?.status, "flipping");
  assert.equal(step.slots.find((slot) => slot.id === "silver")?.status, "idle");
  assert.equal(step.slots.find((slot) => slot.id === "silver")?.committed, "$5");
  assert.equal(step.slots.find((slot) => slot.id === TOTAL_WORD_ID)?.status, "idle");
  assert.equal(step.slots.find((slot) => slot.id === TOTAL_BOARD_ID)?.status, "pending");

  const removed = syncCascadeLines(seedCascade(step.slots.map((slot) => ({
    id: slot.id,
    live: slot.committed,
    visible: true,
  }))), [
    { id: "silver", live: "$5", visible: true },
    { id: TOTAL_WORD_ID, live: "TOTAL", visible: true },
    { id: TOTAL_BOARD_ID, live: "$5.00", visible: true },
  ]);
  assert.equal(removed.slots.find((slot) => slot.id === "silver")?.committed, "$5");
  assert.equal(removed.effects.some((effect) => effect.type === "commit" && effect.id === "silver"), false);
  assert.equal(removed.slots.find((slot) => slot.id === TOTAL_BOARD_ID)?.animate, true);
});
