import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  SWIPE_REVEAL_PX,
  clampSwipe,
  crossedDetent,
  lockSwipeAxis,
  leverTapDeletes,
  settleSwipe,
} from "@/lib/swipe-delete";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const card = readFileSync(new URL("../components/swipe-card.tsx", import.meta.url), "utf8");
const sound = readFileSync(new URL("../lib/flap-sound.ts", import.meta.url), "utf8");

test("a sideways drag locks to the track and a vertical move keeps scrolling", () => {
  assert.equal(lockSwipeAxis(2, 3), "undecided");
  assert.equal(lockSwipeAxis(20, 4), "drag");
  assert.equal(lockSwipeAxis(6, 22), "scroll");
  assert.equal(clampSwipe(-12), 0);
  assert.equal(clampSwipe(40), 40);
  assert.equal(clampSwipe(200), SWIPE_REVEAL_PX);
});

test("a fast fling only opens the card, and a later lever tap is what deletes", () => {
  assert.equal(settleSwipe(20), "shut");
  assert.equal(settleSwipe(30), "shut");
  assert.equal(settleSwipe(SWIPE_REVEAL_PX / 2), "open");
  assert.equal(settleSwipe(SWIPE_REVEAL_PX), "open");
  assert.equal(settleSwipe(SWIPE_REVEAL_PX * 2), "open");
  assert.equal(leverTapDeletes(0), false);
  assert.equal(leverTapDeletes(50), false);
  assert.equal(leverTapDeletes(400), true);
  assert.equal(crossedDetent(20, 50), true);
  assert.equal(crossedDetent(50, 70), false);
  assert.equal(crossedDetent(60, 20), true);
  assert.match(card, /leverTapDeletes/);
  assert.equal(card.includes('end === "delete"'), false);
});

test("the card slides on a vertical-scroll track and the clicks share the flap limiter", () => {
  assert.match(css, /\.stack-swipe \{[^}]*overflow:\s*visible/);
  assert.match(css, /\.stack-swipe \{[^}]*touch-action:\s*pan-y/);
  assert.match(css, /\.gear-panel:has\(\.stack-swipe\.is-raised\) \{[^}]*overflow:\s*visible/);
  assert.match(css, /\.stack-swipe\.is-raised \.stack-card \{[^}]*box-shadow:/);
  assert.match(css, /\.stack-swipe-face\.is-dragging \{[^}]*user-select:\s*none/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^}]*\.stack-swipe-face \{[^}]*transition:\s*none/);
  assert.match(css, /@media \(hover: none\), \(pointer: coarse\) \{[^}]*\.stack-remove \{[^}]*clip:/);
  assert.match(card, /Delete/);
  assert.match(card, /onOpen/);
  assert.match(sound, /function playSwipeTone/);
  assert.match(sound, /flapSum\(ctx\)/);
});
