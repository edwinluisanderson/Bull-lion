import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  SWIPE_REVEAL_PX,
  clampSwipe,
  crossedDetent,
  lockSwipeAxis,
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

test("release past halfway stays open, a short drag shuts, and a full fling deletes", () => {
  assert.equal(settleSwipe(20, 0), "shut");
  assert.equal(settleSwipe(SWIPE_REVEAL_PX / 2, 0), "open");
  assert.equal(settleSwipe(SWIPE_REVEAL_PX, 0.1), "open");
  assert.equal(settleSwipe(SWIPE_REVEAL_PX, 0.65), "delete");
  assert.equal(settleSwipe(30, 2), "shut");
  assert.equal(crossedDetent(20, 50), true);
  assert.equal(crossedDetent(50, 70), false);
  assert.equal(crossedDetent(60, 20), true);
});

test("the card slides on a vertical-scroll track and the clicks share the flap limiter", () => {
  assert.match(css, /\.stack-swipe \{[^}]*touch-action:\s*pan-y/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^}]*\.stack-swipe-face \{[^}]*transition:\s*none/);
  assert.match(css, /@media \(hover: none\), \(pointer: coarse\) \{[^}]*\.stack-remove \{[^}]*clip:/);
  assert.match(card, /Delete/);
  assert.match(card, /onOpen/);
  assert.match(sound, /function playSwipeTone/);
  assert.match(sound, /flapSum\(ctx\)/);
});
