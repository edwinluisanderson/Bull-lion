import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { SNAP_COMMIT, settleSnap, snapStops } from "@/lib/page-snap";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");
const readout = readFileSync(new URL("../components/readout.tsx", import.meta.url), "utf8");
const reel = readFileSync(new URL("../components/reel.tsx", import.meta.url), "utf8");
const lever = readFileSync(new URL("../components/lever.tsx", import.meta.url), "utf8");
const swipe = readFileSync(new URL("../components/swipe-card.tsx", import.meta.url), "utf8");

const stops = [0, 20, 360, 720, 1100, 1500];

test("catches include the top, each plate, and the bottom without duplicates", () => {
  assert.deepEqual(snapStops([20, 360, 1500, 1500, 2000], 1500), [0, 20, 360, 1500]);
  assert.deepEqual(snapStops([], 0), [0]);
});

test("a short push pulls back and a committed push catches the next plate", () => {
  const back = settleSnap({ scrollTop: 20 + 80, maxScroll: 1500, points: stops, viewport: 800, reduced: false });
  assert.equal(back, 20);
  const gap = 360 - 20;
  const committed = 20 + gap * (SNAP_COMMIT + 0.05);
  const forward = settleSnap({
    scrollTop: committed,
    maxScroll: 1500,
    points: stops,
    viewport: 800,
    reduced: false,
  });
  assert.equal(forward, 360);
});

test("the middle of a section taller than the screen stays put", () => {
  const mid = settleSnap({
    scrollTop: 1100 + 400,
    maxScroll: 2200,
    points: [0, 1100, 2200],
    viewport: 800,
    reduced: false,
  });
  assert.equal(mid, null);
  const nearEnd = settleSnap({
    scrollTop: 2200 - 40,
    maxScroll: 2200,
    points: [0, 1100, 2200],
    viewport: 800,
    reduced: false,
  });
  assert.equal(nearEnd, 2200);
});

test("reduced motion does not pull the page", () => {
  assert.equal(
    settleSnap({ scrollTop: 40, maxScroll: 1500, points: stops, viewport: 800, reduced: true }),
    null,
  );
});

test("the page snaps on the document and the plates are marked", () => {
  assert.match(css, /html \{[^}]*scroll-snap-type:\s*y proximity/);
  assert.match(css, /scroll-snap-align:\s*start/);
  const reduced = css
    .split("@media (prefers-reduced-motion: reduce)")
    .slice(1)
    .find((part) => part.includes("scroll-snap-type"));
  assert.match(reduced ?? "", /html \{[^}]*scroll-snap-type:\s*none/);
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
