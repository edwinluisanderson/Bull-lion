import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { SNAP_MIN_GAP_PX, SNAP_RADIUS_PX, settleSnap, snapStops } from "@/lib/page-snap";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");
const readout = readFileSync(new URL("../components/readout.tsx", import.meta.url), "utf8");
const reel = readFileSync(new URL("../components/reel.tsx", import.meta.url), "utf8");
const lever = readFileSync(new URL("../components/lever.tsx", import.meta.url), "utf8");
const swipe = readFileSync(new URL("../components/swipe-card.tsx", import.meta.url), "utf8");

const page = [
  { at: 0, always: true },
  { at: 190, always: true },
  { at: 538, always: true },
  { at: 946, always: false },
  { at: 1500, always: true },
];

test("always stops stay, and My Stack is kept only when it clears the gap", () => {
  assert.equal(SNAP_RADIUS_PX, 48);
  assert.equal(SNAP_MIN_GAP_PX, SNAP_RADIUS_PX * 2);
  assert.deepEqual(
    snapStops(
      [
        { at: 20, always: true },
        { at: 190, always: true },
        { at: 538, always: true },
      ],
      1500,
    ),
    [0, 20, 190, 538, 1500],
  );
  assert.deepEqual(snapStops(page, 1500), [0, 190, 538, 946, 1500]);
  assert.deepEqual(
    snapStops(
      [
        { at: 190, always: true },
        { at: 538, always: true },
        { at: 540, always: false },
        { at: 548, always: false },
      ],
      548,
    ),
    [0, 190, 538, 548],
  );
  assert.deepEqual(snapStops([{ at: 500, always: true }, { at: 500, always: true }], 800), [0, 500, 800]);
  assert.deepEqual(snapStops([], 0), [0]);
});

test("a rest inside the capture radius springs back, and past it the page stays put", () => {
  const back = settleSnap({ scrollTop: 30, maxScroll: 1500, points: page, reduced: false });
  assert.equal(back, 0);
  const free = settleSnap({ scrollTop: 120, maxScroll: 1500, points: page, reduced: false });
  assert.equal(free, null);
  const nearMelt = settleSnap({ scrollTop: 190 - 40, maxScroll: 1500, points: page, reduced: false });
  assert.equal(nearMelt, 190);
  const mid = settleSnap({ scrollTop: 946 + 400, maxScroll: 2200, points: page, reduced: false });
  assert.equal(mid, null);
});

test("reduced motion does not pull the page", () => {
  assert.equal(settleSnap({ scrollTop: 30, maxScroll: 1500, points: page, reduced: true }), null);
});

test("the page snaps on the document and the plates are marked", () => {
  assert.match(css, /html \{[^}]*scroll-snap-type:\s*none/);
  assert.equal(css.includes("scroll-snap-type: y proximity"), false);
  assert.equal(css.includes("scroll-snap-type: y mandatory"), false);
  assert.match(css, /scroll-snap-align:\s*start/);
  assert.match(layout, /data-snap="top"/);
  assert.match(layout, /data-snap="bottom"/);
  assert.equal(machine.includes('data-snap="main"'), false);
  assert.equal(machine.includes('data-snap="scrap"'), false);
  assert.match(machine, /data-snap="wheels"/);
  assert.match(machine, /data-snap="stack"/);
  assert.match(readout, /data-snap="melt"/);
  assert.match(css, /\.reel-viewport \{[^}]*touch-action:\s*none/);
  assert.match(css, /\.pull-ball \{[^}]*touch-action:\s*none/);
  assert.match(css, /\.stack-swipe \{[^}]*touch-action:\s*pan-y/);
  assert.match(reel, /preventDefault\(\)/);
  assert.match(lever, /preventDefault\(\)/);
  assert.match(swipe, /onPointerDown/);
});
