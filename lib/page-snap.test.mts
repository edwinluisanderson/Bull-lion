import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  GLIDE_MAX_ACCEL,
  SNAP_MIN_GAP_PX,
  SNAP_RADIUS_PX,
  SOFT_CLOSE_CUSHION_SEC,
  SOFT_CLOSE_SPEED,
  collectStops,
  glideDuration,
  magnetCaption,
  magneticStrength,
  settleSnap,
  snapStops,
  softCloseAt,
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
  assert.equal(SNAP_RADIUS_PX, 100);
  assert.equal(SNAP_MIN_GAP_PX, 200);
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
  const tie = settleSnap({ scrollTop: 975, maxScroll: 1000, points: [wheels, { at: 950, always: false, name: "stack" }], reduced: false });
  assert.equal(tie?.target, 950);
  assert.equal(tie?.name, "stack");
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

test("the field engages evenly and fades only at the outer rim", () => {
  assert.equal(magneticStrength(SNAP_RADIUS_PX), 0);
  assert.equal(magneticStrength(110), 0);
  assert.equal(magneticStrength(0), magneticStrength(15));
  assert.equal(magneticStrength(15), magneticStrength(50));
  assert.equal(magneticStrength(50), magneticStrength(85));
  assert.ok(magneticStrength(15) > 0 && magneticStrength(15) < 0.6);
  assert.ok(magneticStrength(95) > 0);
  assert.ok(magneticStrength(95) < magneticStrength(85));
  assert.ok(magneticStrength(99) > 0);
  assert.ok(magneticStrength(99) < magneticStrength(95));
});

test("a closer rest is not grabbier, and past the radius the page stays put", () => {
  const wide = [
    { at: 0, always: true, name: "top" },
    { at: 400, always: true, name: "melt" },
    { at: 800, always: true, name: "wheels" },
    { at: 1500, always: true, name: "bottom" },
  ];
  const close = settleSnap({ scrollTop: 15, maxScroll: 1500, points: wide, reduced: false });
  const middle = settleSnap({ scrollTop: 50, maxScroll: 1500, points: wide, reduced: false });
  const far = settleSnap({ scrollTop: 85, maxScroll: 1500, points: wide, reduced: false });
  assert.equal(close?.target, 0);
  assert.equal(middle?.target, 0);
  assert.equal(far?.target, 0);
  assert.ok(close && middle && far);
  assert.equal(close.strength, middle.strength);
  assert.equal(middle.strength, far.strength);
  const at15 = glideDuration(15);
  const at50 = glideDuration(50);
  const at95 = glideDuration(95);
  assert.equal(at15, SOFT_CLOSE_CUSHION_SEC * 1000);
  assert.ok(at15 < at50 && at50 < at95);
  assert.ok(15 / (at15 / 1000) < 50 / (at50 / 1000));
  assert.ok(50 / (at50 / 1000) <= SOFT_CLOSE_SPEED + 0.01);
  assert.equal(settleSnap({ scrollTop: 100, maxScroll: 1500, points: wide, reduced: false }), null);
  assert.equal(settleSnap({ scrollTop: 110, maxScroll: 1500, points: wide, reduced: false }), null);
  assert.equal(settleSnap({ scrollTop: 8, maxScroll: 1500, points: wide, reduced: false }), null);
  const melt = settleSnap({ scrollTop: 450, maxScroll: 1500, points: wide, reduced: false });
  assert.equal(melt?.target, 400);
  assert.equal(melt?.name, "melt");
  const away = settleSnap({ scrollTop: 946 + 400, maxScroll: 2200, points: page, reduced: false });
  assert.equal(away, null);
});

test("a rest 100px from one always-stop can still sit inside a nearer field", () => {
  const pulled = settleSnap({ scrollTop: 100, maxScroll: 1500, points: page, reduced: false });
  assert.equal(pulled?.target, 190);
  assert.equal(pulled?.name, "melt");
  assert.equal(pulled?.distance, 90);
});

test("fields that meet at the radius do not pull from the shared edge", () => {
  const pair = [
    { at: 400, always: true, name: "melt" },
    { at: 600, always: true, name: "wheels" },
  ];
  assert.deepEqual(snapStops(pair, 1200), [0, 400, 600, 1200]);
  assert.equal(settleSnap({ scrollTop: 500, maxScroll: 1200, points: pair, reduced: false }), null);
  const inside = settleSnap({ scrollTop: 499, maxScroll: 1200, points: pair, reduced: false });
  assert.equal(inside?.target, 400);
});

test("always-stops closer than the gap both stay, and the nearer one wins", () => {
  const packed = [
    { at: 0, always: true, name: "top" },
    { at: 100, always: true, name: "melt" },
    { at: 400, always: true, name: "wheels" },
  ];
  assert.deepEqual(snapStops(packed, 800), [0, 100, 400, 800]);
  const overlap = settleSnap({ scrollTop: 70, maxScroll: 800, points: packed, reduced: false });
  assert.equal(overlap?.target, 100);
  assert.equal(overlap?.name, "melt");
});

test("a soft-close cruises, then cushions to a stop under the acceleration cap", () => {
  for (const distance of [15, 30, 90]) {
    const start = softCloseAt(0, distance);
    assert.ok(Math.abs(start.offset - distance) < 1e-6);
    assert.ok(start.velocity < 0);
    assert.ok(Math.abs(start.velocity) <= SOFT_CLOSE_SPEED + 1e-6);
    const done = softCloseAt(glideDuration(distance) / 1000, distance);
    assert.ok(Math.abs(done.offset) < 1e-6);
    assert.ok(Math.abs(done.velocity) < 1e-6);
    let previous = distance;
    let peakAccel = 0;
    let previousVelocity = start.velocity;
    for (let step = 1; step <= 40; step += 1) {
      const sample = softCloseAt((glideDuration(distance) / 1000) * (step / 40), distance);
      assert.ok(sample.offset >= -0.001);
      assert.ok(sample.offset <= previous + 0.001);
      peakAccel = Math.max(peakAccel, Math.abs(sample.velocity - previousVelocity) / (glideDuration(distance) / 1000 / 40));
      previous = sample.offset;
      previousVelocity = sample.velocity;
    }
    assert.ok(peakAccel <= GLIDE_MAX_ACCEL);
  }
  const cruise = softCloseAt(0.2, 90);
  assert.ok(Math.abs(cruise.velocity + SOFT_CLOSE_SPEED) < 1e-6);
  assert.ok(Math.abs(90 - cruise.offset - SOFT_CLOSE_SPEED * 0.2) < 1e-6);
  const cushion = softCloseAt(glideDuration(30) / 1000 - 0.05, 30);
  assert.ok(Math.abs(cushion.velocity) < SOFT_CLOSE_SPEED * 0.25);
});

test("the caption names the four check distances", () => {
  assert.equal(magnetCaption(15, "melt"), "15px from melt · cushion");
  assert.equal(magnetCaption(50, "wheels"), "50px from wheels · soft close");
  assert.equal(magnetCaption(85, "wheels"), "85px from wheels · soft close");
  assert.equal(magnetCaption(100, "top"), "100px from top · no pull");
  assert.equal(magnetCaption(110, "top"), "110px from top · no pull");
});

test("reduced motion does not pull the page", () => {
  assert.equal(settleSnap({ scrollTop: 15, maxScroll: 1500, points: page, reduced: true }), null);
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
  assert.match(snapSource, /scrollend/);
  assert.match(snapSource, /softCloseAt/);
  assert.match(snapSource, /scrollingElement/);
  assert.equal(snapSource.includes("touchmove"), false);
  assert.match(snapSource, /prefers-reduced-motion: reduce/);
  assert.equal(snapSource.includes("preventDefault"), false);
  assert.match(snapSource, /get\("magnet"\) !== "1"/);
  assert.match(snapSource, /pointer-events:\s*none/);
  assert.match(snapSource, /stack-swipe\.is-departing/);
  assert.match(snapSource, /requestAnimationFrame\(onLayout\)/);
});
