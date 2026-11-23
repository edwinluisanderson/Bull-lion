import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CATCH_PX,
  CUSHION_ZONE_PX,
  FLING_MIN_PX_PER_SEC,
  GLIDE_PX,
  GLIDE_SPEED,
  HARD_FLING_PX_PER_SEC,
  SETTLE_PX,
  SNAP_MIN_GAP_PX,
  collectStops,
  cushionSpeed,
  dragCues,
  flingCues,
  magnetCaption,
  nearestStop,
  planFling,
  snapStops,
  stopsPassed,
} from "@/lib/page-snap";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");
const readout = readFileSync(new URL("../components/readout.tsx", import.meta.url), "utf8");
const reel = readFileSync(new URL("../components/reel.tsx", import.meta.url), "utf8");
const lever = readFileSync(new URL("../components/lever.tsx", import.meta.url), "utf8");
const swipe = readFileSync(new URL("../components/swipe-card.tsx", import.meta.url), "utf8");
const snapSource = readFileSync(new URL("../components/page-snap.tsx", import.meta.url), "utf8");

const page = [
  { at: 0, always: true, name: "top" },
  { at: 190, always: true, name: "melt" },
  { at: 538, always: true, name: "wheels" },
  { at: 946, always: false, name: "stack" },
  { at: 1500, always: true, name: "bottom" },
];

test("always stops stay, and a non-stack optional stop still clears the gap", () => {
  assert.equal(SNAP_MIN_GAP_PX, 200);
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
  assert.deepEqual(
    snapStops(
      [
        { at: 538, always: true },
        { at: 538 + 199, always: false },
      ],
      1500,
    ),
    [0, 538, 1500],
  );
  assert.deepEqual(
    snapStops(
      [
        { at: 538, always: true },
        { at: 538 + 200, always: false },
      ],
      1500,
    ),
    [0, 538, 738, 1500],
  );
  assert.deepEqual(snapStops([{ at: 500, always: true }, { at: 500, always: true }], 800), [0, 500, 800]);
  assert.deepEqual(snapStops([], 0), [0]);
});

test("My Stack is a stop when its top can reach the top of the screen", () => {
  const wheels = { at: 400, always: true, name: "wheels" };
  const exact = collectStops([wheels, { at: 1000, always: false, name: "stack" }], 1000);
  assert.deepEqual(
    exact.map((stop) => stop.at),
    [0, 400, 1000],
  );
  assert.equal(exact.filter((stop) => Math.abs(stop.at - 1000) <= 0.5).length, 1);
  assert.equal(exact.find((stop) => Math.abs(stop.at - 1000) <= 0.5)?.name, "stack/bottom");

  const before = collectStops([wheels, { at: 950, always: false, name: "stack" }], 1000);
  assert.deepEqual(
    before.map((stop) => stop.at),
    [0, 400, 950, 1000],
  );
  assert.equal(before.find((stop) => stop.at === 950)?.name, "stack");

  const past = collectStops([wheels, { at: 1000.6, always: false, name: "stack" }], 1000);
  assert.deepEqual(
    past.map((stop) => stop.at),
    [0, 400, 1000],
  );
  assert.equal(past.some((stop) => stop.name === "stack"), false);

  const nearWheels = collectStops([wheels, { at: 450, always: false, name: "stack" }], 1000);
  assert.deepEqual(
    nearWheels.map((stop) => stop.at),
    [0, 400, 450, 1000],
  );
  const tie = nearestStop(975, [wheels, { at: 950, always: false, name: "stack" }], 1000);
  assert.equal(tie.at, 950);
  assert.equal(tie.name, "stack");
});

test("a My Stack that shares a stop is named stack and the other stop", () => {
  const withBottom = collectStops([{ at: 1000, always: false, name: "stack" }], 1000);
  assert.equal(withBottom.filter((stop) => Math.abs(stop.at - 1000) <= 0.5).length, 1);
  assert.equal(withBottom.find((stop) => Math.abs(stop.at - 1000) <= 0.5)?.name, "stack/bottom");

  const withWheels = collectStops(
    [
      { at: 400, always: true, name: "wheels" },
      { at: 400.4, always: false, name: "stack" },
    ],
    1200,
  );
  assert.equal(withWheels.find((stop) => stop.at === 400)?.name, "stack/wheels");
  assert.equal(withWheels.filter((stop) => Math.abs(stop.at - 400) <= 0.5).length, 1);
});

test("a lift with no fling stays, a normal fling takes the next stop, a hard fling skips exactly one", () => {
  const input = { maxScroll: 1500, points: page, reduced: false };
  const stay = planFling({ ...input, scrollTop: 210, velocity: 40 });
  assert.equal(stay.target, null);
  assert.equal(planFling({ ...input, scrollTop: 20, velocity: 0 }).target, null);
  assert.ok(40 < FLING_MIN_PX_PER_SEC);

  const normal = planFling({ ...input, scrollTop: 210, velocity: 700 });
  assert.equal(normal.target, 538);
  assert.equal(normal.skipped, null);
  assert.equal(normal.hard, false);

  const hard = planFling({ ...input, scrollTop: 210, velocity: HARD_FLING_PX_PER_SEC });
  assert.equal(hard.target, 946);
  assert.equal(hard.skipped, 538);
  assert.equal(hard.hard, true);
  const harder = planFling({ ...input, scrollTop: 210, velocity: HARD_FLING_PX_PER_SEC * 3 });
  assert.equal(harder.target, 946);
  assert.equal(harder.skipped, 538);

  const upward = planFling({ ...input, scrollTop: 700, velocity: -700 });
  assert.equal(upward.target, 538);
  const hardUp = planFling({ ...input, scrollTop: 700, velocity: -HARD_FLING_PX_PER_SEC });
  assert.equal(hardUp.skipped, 538);
  assert.equal(hardUp.target, 190);

  const onlyOne = planFling({ ...input, scrollTop: 1400, velocity: HARD_FLING_PX_PER_SEC });
  assert.equal(onlyOne.target, 1500);
  assert.equal(onlyOne.skipped, null);
  assert.equal(planFling({ ...input, scrollTop: 15, velocity: 900, reduced: true }).target, null);
});

test("the cushion keeps the fling speed at the catch, glides at 56, and stops at zero", () => {
  assert.equal(CUSHION_ZONE_PX, 120);
  assert.equal(CATCH_PX, 40);
  assert.equal(SETTLE_PX, 15);
  assert.equal(GLIDE_PX, 65);
  assert.equal(GLIDE_SPEED, 56);
  const fling = 900;
  assert.equal(cushionSpeed(120, fling), fling);
  assert.equal(cushionSpeed(121, fling), fling);
  assert.ok(Math.abs(cushionSpeed(80.001, fling) - GLIDE_SPEED) < 0.05);
  assert.equal(cushionSpeed(50, fling), GLIDE_SPEED);
  assert.equal(cushionSpeed(15, fling), GLIDE_SPEED);
  assert.equal(cushionSpeed(0, fling), 0);
  assert.ok(cushionSpeed(7, fling) > 0 && cushionSpeed(7, fling) < GLIDE_SPEED);

  const started = 100;
  assert.equal(cushionSpeed(started, fling, started), fling);
  assert.ok(Math.abs(cushionSpeed(80.001, fling, started) - GLIDE_SPEED) < 0.05);
  assert.equal(cushionSpeed(40, 400), GLIDE_SPEED);
});

test("pass and landing cues fire once for the stops they belong to", () => {
  assert.deepEqual(flingCues(false), ["land"]);
  assert.deepEqual(flingCues(true), ["pass", "land"]);
  assert.deepEqual(dragCues(0), []);
  assert.deepEqual(dragCues(2), ["pass", "pass"]);
  assert.deepEqual(stopsPassed(200, 600, [0, 190, 538, 946, 1500]), [538]);
  assert.deepEqual(stopsPassed(1000, 100, [0, 190, 538, 946, 1500]), [946, 538, 190]);
  assert.deepEqual(stopsPassed(190, 538, [190, 538]), []);
});

test("the caption names distance from the nearest stop", () => {
  assert.equal(magnetCaption(15, "melt"), "15px from melt · cushion");
  assert.equal(magnetCaption(50, "wheels"), "50px from wheels · cushion");
  assert.equal(magnetCaption(130, "top"), "130px from top · free");
});

test("reduced motion does not pull the page", () => {
  assert.equal(planFling({ scrollTop: 15, maxScroll: 1500, points: page, velocity: 900, reduced: true }).target, null);
});

test("the page eases after scrollend and the plates are marked", () => {
  assert.match(css, /html \{[^}]*scroll-snap-type:\s*none/);
  assert.match(css, /html \{[^}]*overscroll-behavior-y:\s*auto/);
  const htmlBlocks = css.match(/html \{[^}]*\}/g) ?? [];
  assert.equal(
    htmlBlocks.some((block) => /overscroll-behavior(?:-y)?:\s*(?:contain|none)/.test(block)),
    false,
  );
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
  assert.match(snapSource, /planFling/);
  assert.match(snapSource, /cushionSpeed/);
  assert.match(snapSource, /scrollingElement/);
  assert.equal(snapSource.includes("touchmove"), false);
  assert.match(snapSource, /prefers-reduced-motion: reduce/);
  assert.equal(snapSource.includes("preventDefault"), false);
  assert.match(snapSource, /pointerdown/);
  assert.match(snapSource, /wheel/);
  assert.match(snapSource, /get\("magnet"\) !== "1"/);
  assert.match(snapSource, /pointer-events:\s*none/);
  assert.match(snapSource, /takeOverScroll/);
});
