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
  plateHidden,
  plateReelsBehind,
  queuedCoverId,
  reusedSlotMustSnap,
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

test("the visible remove button uses the same reel as a swipe delete", () => {
  const button = table.slice(table.indexOf('className="stack-remove"'), table.indexOf("</button>", table.indexOf('className="stack-remove"')));
  assert.match(button, /onClick=\{\(\) => requestDelete\(line\.id\)\}/);
  assert.equal(button.includes("removeLine"), false);
  assert.equal(button.includes("setLines"), false);
  assert.match(table, /function requestDelete\(lineId: string\)/);
  assert.match(table, /prefers-reduced-motion: reduce/);
  assert.match(table, /armCover\(lineId, rows\)/);
});

test("chains stay behind the plates and a deleted plate reels up behind the one above", () => {
  assert.equal(plateReelsBehind(0), "nameplate");
  assert.equal(plateReelsBehind(2), "card");
  assert.equal(plateHidden(0, 52), false);
  assert.equal(plateHidden(52, 52), true);
  assert.equal(plateHidden(60, 52), true);
  const chain = Number(css.match(/\.chain-half \{[^}]*z-index:\s*(\d+)/)?.[1]);
  const face = Number(css.match(/\.stack-swipe-face \{[^}]*z-index:\s*(\d+)/)?.[1]);
  const rails = Number(css.match(/\.stack-rails \{[^}]*z-index:\s*(-?\d+)/)?.[1]);
  const row = Number(css.match(/\.stack-swipe \{[^}]*z-index:\s*(\d+)/)?.[1]);
  assert.ok(chain < face);
  assert.ok(rails < row);
  assert.equal(css.includes(".chain-half-bottom::after"), false);
  assert.match(css, /\.stack-swipe\.is-reeled \{[^}]*z-index:\s*0/);
  assert.match(css, /\.stack-swipe\.is-reeled \.stack-empty-plate \{[^}]*translateY\(calc\(-1 \* var\(--lift/);
  assert.match(card, /stack-empty-plate/);
  assert.match(table, /lift: coverLive \? cover\.rowHeight : 0/);
  assert.match(card, /is-reeled/);
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
  assert.equal(snap.includes("ResizeObserver"), false);
  assert.equal(snap.includes('addEventListener("scrollend", finish)'), false);
  assert.match(table, /queuedDelete/);
  assert.match(card, /if \(leaving\) return/);
});

test("the card that slides into a deleted slot does not inherit the shoot-off", () => {
  assert.equal(reusedSlotMustSnap("deleted", "deleted", false, false), false);
  assert.equal(reusedSlotMustSnap("deleted", "deleted", true, true), false);
  assert.equal(reusedSlotMustSnap(null, "next", false, false), false);
  assert.equal(reusedSlotMustSnap("deleted", "next", true, false), true);
  assert.equal(reusedSlotMustSnap("deleted", "next", false, false), true);
  assert.equal(reusedSlotMustSnap("deleted", "deleted", true, false), true);
  assert.match(card, /reusedSlotMustSnap\(prevId\.current, id, prevLeaving\.current, leaving\)/);
  assert.match(card, /face\.style\.transition = "none"/);
  assert.match(card, /translateX\(0px\)/);
  assert.match(table, /key=\{line == null \? `blank-\$\{index\}` : line\.id\}/);
});
