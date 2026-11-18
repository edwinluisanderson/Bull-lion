import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { SNAP_RADIUS_PX, settleSnap, snapStops } from "@/lib/page-snap";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");
const readout = readFileSync(new URL("../components/readout.tsx", import.meta.url), "utf8");
const reel = readFileSync(new URL("../components/reel.tsx", import.meta.url), "utf8");
const lever = readFileSync(new URL("../components/lever.tsx", import.meta.url), "utf8");
const swipe = readFileSync(new URL("../components/swipe-card.tsx", import.meta.url), "utf8");

const stops = [0, 20, 360, 720, 1100, 1500];

test("the page top and the main plate share one catch", () => {
  assert.equal(SNAP_RADIUS_PX, 48);
  assert.deepEqual(snapStops([20, 360, 1500, 1500, 2000], 1500), [0, 360, 1500]);
  assert.deepEqual(snapStops([], 0), [0]);
});

test("a rest inside the capture radius springs back, and past it the page stays put", () => {
  const back = settleSnap({ scrollTop: 30, maxScroll: 1500, points: stops, reduced: false });
  assert.equal(back, 0);
  const free = settleSnap({ scrollTop: 20 + 120, maxScroll: 1500, points: stops, reduced: false });
  assert.equal(free, null);
  const nearNext = settleSnap({ scrollTop: 360 - 40, maxScroll: 1500, points: stops, reduced: false });
  assert.equal(nearNext, 360);
  const mid = settleSnap({
    scrollTop: 1100 + 400,
    maxScroll: 2200,
    points: [0, 1100, 2200],
    reduced: false,
  });
  assert.equal(mid, null);
});

test("reduced motion does not pull the page", () => {
  assert.equal(
    settleSnap({ scrollTop: 30, maxScroll: 1500, points: stops, reduced: true }),
    null,
  );
});

test("the page snaps on the document and the plates are marked", () => {
  assert.match(css, /html \{[^}]*scroll-snap-type:\s*none/);
  assert.equal(css.includes("scroll-snap-type: y proximity"), false);
  assert.equal(css.includes("scroll-snap-type: y mandatory"), false);
  assert.match(css, /scroll-snap-align:\s*start/);
  assert.match(layout, /data-snap="top"/);
  assert.match(layout, /data-snap="bottom"/);
  assert.match(machine, /data-snap="main"/);
  assert.match(machine, /data-snap="wheels"/);
  assert.match(machine, /data-snap="stack"/);
  assert.match(machine, /data-snap="scrap"/);
  assert.match(readout, /data-snap="melt"/);
  assert.match(css, /\.reel-viewport \{[^}]*touch-action:\s*none/);
  assert.match(css, /\.pull-ball \{[^}]*touch-action:\s*none/);
  assert.match(css, /\.stack-swipe \{[^}]*touch-action:\s*pan-y/);
  assert.match(reel, /preventDefault\(\)/);
  assert.match(lever, /preventDefault\(\)/);
  assert.match(swipe, /onPointerDown/);
});
