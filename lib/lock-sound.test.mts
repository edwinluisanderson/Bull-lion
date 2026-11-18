import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  LOCK_FILE_PEAK,
  LOCK_SOUND_URLS,
  REEL_CLICK_FILE_PEAK,
  cardAlarmLive,
  freshLockDrag,
  lockCueGain,
  lockDragArmed,
  lockDragMoved,
  lockDragSettled,
  lockOutsideClose,
} from "@/lib/lock-sound";
import { REEL_CLICK_GAIN } from "@/lib/reel-click";
import { SWIPE_REVEAL_PX } from "@/lib/swipe-delete";

const card = readFileSync(new URL("../components/swipe-card.tsx", import.meta.url), "utf8");
const preload = readFileSync(new URL("./sound-preload.ts", import.meta.url), "utf8");
const credits = readFileSync(new URL("../public/sounds/flap-credits.txt", import.meta.url), "utf8");

const hashes: Record<string, string> = {
  "/sounds/lock-start.mp3": "987599b45a418261388386eb6bbcb77b768688e63bded8fd34e93eab80ba2891",
  "/sounds/lock-middle.mp3": "71731e92cdad294cb9bf7be7e52bce6fe4e8ef10c44da81f65678c539b741ad1",
  "/sounds/lock-end.mp3": "224bc85cf21c6d9fcf639c54ee0936747d80fc5935ef8f33014ee86e1a56954f",
};

test("the bolt clips match the FenrirFangs credit and stay under the wheel click", () => {
  assert.deepEqual([...LOCK_SOUND_URLS], ["/sounds/lock-start.mp3", "/sounds/lock-middle.mp3", "/sounds/lock-end.mp3"]);
  for (const url of LOCK_SOUND_URLS) {
    const name = url.slice("/sounds/".length);
    const bytes = readFileSync(new URL(`../public/sounds/${name}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), hashes[url]);
  }
  assert.match(credits, /door bolt 5\.wav/);
  assert.match(credits, /https:\/\/freesound\.org\/people\/FenrirFangs\/sounds\/213996\//);
  assert.match(credits, /CC0/);
  for (const cue of ["start", "middle", "end"] as const) {
    const played = lockCueGain(cue) * LOCK_FILE_PEAK[cue];
    const click = REEL_CLICK_GAIN * REEL_CLICK_FILE_PEAK;
    assert.ok(Math.abs(played - click) < 1e-6);
  }
  assert.match(preload, /loadLockSounds/);
  assert.match(preload, /LOCK_SOUND_URLS/);
});

test("a drag starts once, clicks the middle each crossing, and clunks when it settles", () => {
  const closed = freshLockDrag(0);
  const first = lockDragArmed(closed);
  assert.equal(first.cue, "start");
  const again = lockDragArmed(first.drag);
  assert.equal(again.cue, null);

  const opening = lockDragMoved(first.drag, 20);
  assert.equal(opening.cue, null);
  const across = lockDragMoved(opening.drag, SWIPE_REVEAL_PX / 2);
  assert.equal(across.cue, "middle");
  const held = lockDragMoved(across.drag, 70);
  assert.equal(held.cue, null);
  const back = lockDragMoved(held.drag, 20);
  assert.equal(back.cue, "middle");

  const stayedOpen = lockDragSettled(across.drag, "open");
  assert.equal(stayedOpen.cue, "end");
  assert.equal(stayedOpen.drag.offset, SWIPE_REVEAL_PX);
  const sprangShut = lockDragSettled(back.drag, "shut");
  assert.equal(sprangShut.cue, "end");
  assert.equal(sprangShut.drag.offset, 0);

  const tap = lockDragSettled(freshLockDrag(SWIPE_REVEAL_PX), "shut");
  assert.equal(tap.cue, null);
  assert.equal(lockOutsideClose(true, false), "end");
  assert.equal(lockOutsideClose(true, true), null);
  assert.equal(lockOutsideClose(false, false), null);
});

test("the alarm stops as soon as a locked card starts to close", () => {
  assert.equal(cardAlarmLive(true, false, false), true);
  assert.equal(cardAlarmLive(true, true, false), false);
  assert.equal(cardAlarmLive(true, false, true), false);
  assert.equal(cardAlarmLive(false, false, false), false);
  assert.match(card, /cardAlarmLive\(open, dragging, departing\)/);
  assert.match(card, /lockDragArmed/);
  assert.match(card, /lockDragMoved/);
  assert.match(card, /lockDragSettled/);
  assert.match(card, /lockOutsideClose/);
  assert.match(card, /playLockCue/);
  assert.equal(card.includes('playSwipeTone("detent")'), false);
  assert.match(card, /playSwipeTone\("clunk"\)/);
});
