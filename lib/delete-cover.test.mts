import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { DELETE_SHOOT_MS } from "@/lib/delete-alarm";
import {
  COVER_FRAME_MS,
  COVER_SLIDE_MS,
  STACK_ROW_GAP_PX,
  advanceDeleteCover,
  beginDeleteCover,
  collapseInset,
  coverDistance,
  coveringIndexes,
  deleteRowLocked,
  isCoveringRow,
  isRemnantRow,
  queuedCoverId,
} from "@/lib/delete-cover";

const card = readFileSync(new URL("../components/swipe-card.tsx", import.meta.url), "utf8");
const table = readFileSync(new URL("../components/stack-table.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("the shell stays until the rows below have covered it, then it is removed", () => {
  const shot = beginDeleteCover("gold", 0, 3, 100);
  assert.equal(shot.phase, "shoot");
  assert.equal(shot.tail, false);
  assert.equal(shot.distance, coverDistance(100));
  assert.equal(shot.distance, 100 + STACK_ROW_GAP_PX);
  assert.deepEqual(coveringIndexes(3, 0), [1, 2]);
  assert.equal(isRemnantRow(shot, "gold"), true);
  assert.equal(isCoveringRow(shot, 1), false);

  const sliding = advanceDeleteCover(shot);
  assert.notEqual(sliding, "remove");
  if (sliding === "remove") return;
  assert.equal(sliding.phase, "slide");
  assert.equal(isRemnantRow(sliding, "gold"), true);
  assert.equal(isCoveringRow(sliding, 0), false);
  assert.equal(isCoveringRow(sliding, 1), true);
  assert.equal(isCoveringRow(sliding, 2), true);
  assert.equal(advanceDeleteCover(sliding), "remove");
});

test("the last card has no row below it, so the slot collapses from the bottom", () => {
  const only = beginDeleteCover("last", 0, 1, 90, 40);
  assert.equal(only.tail, true);
  assert.equal(only.solo, true);
  assert.equal(only.totalHeight, 40);
  assert.deepEqual(coveringIndexes(1, 0), []);
  assert.equal(isCoveringRow({ ...only, phase: "slide" }, 0), false);
  assert.equal(collapseInset(true, 0), 0);

  const end = beginDeleteCover("end", 2, 3, 90);
  assert.equal(end.tail, true);
  assert.equal(end.solo, false);
  assert.deepEqual(coveringIndexes(3, 2), []);
  assert.equal(collapseInset(true, 2), STACK_ROW_GAP_PX);
  assert.equal(collapseInset(false, 2), 0);
});

test("the face still shoots off and the button is not faded away", () => {
  assert.equal(card.includes("DELETE_LINGER_MS"), false);
  assert.match(card, /onDepart\(\)/);
  assert.equal(card.includes("setDeparting"), false);
  assert.match(card, /leaving \? " is-departing"/);
  assert.match(css, /\.stack-swipe\.is-departing \.stack-swipe-face \{[^}]*translateX\(120vw\)/);
  assert.match(css, new RegExp(`transition: transform ${DELETE_SHOOT_MS}ms`));
  assert.equal(css.includes("delete-linger"), false);
  assert.match(css, /\.stack-swipe\.is-raised\.is-remnant \{[^}]*z-index:\s*0/);
  assert.match(css, /\.stack-swipe\.is-cover-front[^}]*z-index:\s*4/);
  assert.match(css, new RegExp(`transition: margin-bottom ${COVER_SLIDE_MS}ms`));
  assert.match(css, /\.stack-swipe\.is-remnant\.is-covering \{[^}]*margin-bottom:\s*calc\(-1 \* var\(--cover, 0px\)\)/);
  assert.match(css, /\.stack-swipe\.is-remnant\.is-collapsing \{[^}]*overflow:\s*hidden/);
  assert.match(table, /beginDeleteCover\(/);
  assert.match(table, /advanceDeleteCover\(/);
  assert.match(table, /removeLine\(linesRef\.current, id\)/);
  assert.match(table, /is-cover-front/);
  assert.match(table, /coverSlack\(\)/);
  assert.match(table, /releaseCoverSlack\(\)/);
  assert.match(table, /deleteRowLocked\(shift !== null, blank, cover\?\.id \?\? null, line\?\.id \?\? null\)/);
  assert.match(table, /id=\{line \? line\.id : `blank-\$\{index\}`\}/);
  assert.match(table, /queuedCoverId\(/);
  assert.match(card, /is-collapsing/);
  assert.equal(COVER_SLIDE_MS > COVER_FRAME_MS, true);
  assert.match(css, /\.split-rows \{[^}]*gap:\s*8px/);
});

test("a second delete waits its turn and the other cards stay swipeable", () => {
  assert.equal(deleteRowLocked(true, false, null, "silver"), true);
  assert.equal(deleteRowLocked(false, true, null, "silver"), true);
  assert.equal(deleteRowLocked(false, false, "gold", "gold"), true);
  assert.equal(deleteRowLocked(false, false, "gold", "silver"), false);
  assert.equal(deleteRowLocked(false, false, null, "silver"), false);
  assert.equal(queuedCoverId("gold", "silver"), "silver");
  assert.equal(queuedCoverId("gold", "gold"), null);
  assert.equal(queuedCoverId("gold", null), null);

  const snap = readFileSync(new URL("../components/page-snap.tsx", import.meta.url), "utf8");
  assert.match(snap, /stack-swipe\.is-departing/);
  assert.match(snap, /requestAnimationFrame\(onLayout\)/);
  assert.match(table, /queuedDelete/);
  assert.match(card, /if \(leaving\) return/);
});
