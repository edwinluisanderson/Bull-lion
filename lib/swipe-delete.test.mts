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
  assert.match(css, /\.stack-plate:has\(\.stack-swipe\.is-raised\) \{[^}]*overflow:\s*visible/);
  assert.match(css, /\.stack-swipe\.is-raised \.stack-card \{[^}]*box-shadow:/);
  assert.match(css, /\.stack-swipe-face\.is-dragging \{[^}]*user-select:\s*none/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^}]*\.stack-swipe-face \{[^}]*transition:\s*none/);
  assert.match(css, /@media \(hover: none\), \(pointer: coarse\) \{[^}]*\.stack-remove \{[^}]*clip:/);
  assert.match(card, /Delete/);
  assert.match(card, /aria-label=\{`Delete \$\{label\}`\}/);
  assert.match(card, /stack-swipe-push/);
  assert.equal(card.includes("stack-swipe-lever"), false);
  assert.match(card, /leverTapDeletes/);
  assert.match(card, /playSwipeTone\("clunk"\)/);
  assert.match(css, /\.stack-swipe-plate \{[^}]*repeating-linear-gradient\(-45deg/);
  assert.match(css, /\.stack-swipe-push \{[^}]*border-radius:\s*50%/);
  assert.match(css, /\.stack-swipe-push \{[^}]*0 0 0 4px #111/);
  assert.match(css, /\.stack-swipe:not\(\.is-raised\) \.stack-swipe-delete \{[^}]*visibility:\s*hidden/);
  assert.match(css, /\.stack-swipe-window \{[^}]*pointer-events:\s*none/);
  assert.match(css, /\.stack-swipe-face \{[^}]*pointer-events:\s*auto/);
  assert.match(card, /onClick=\{onLeverClick\}/);
  const lever = card.slice(card.indexOf('className="stack-swipe-delete"'), card.indexOf("stack-swipe-plate"));
  assert.match(lever, /onClick=\{onLeverClick\}/);
  assert.equal(lever.includes("pointer-events"), false);
  assert.match(card, /onOpen/);
  assert.match(sound, /function playSwipeTone/);
  assert.match(sound, /flapSum\(ctx\)/);
});
