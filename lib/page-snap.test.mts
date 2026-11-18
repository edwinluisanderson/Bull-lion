import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  GLIDE_MAX_ACCEL,
  SNAP_MIN_GAP_PX,
  SNAP_RADIUS_PX,
  criticallyDamped,
  glideDuration,
  magnetCaption,
  magneticStrength,
  settleSnap,
  snapStops,
  springOmega,
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

const smoothstep = (distance: number) => {
  const t = distance / SNAP_RADIUS_PX;
  return 1 - t * t * (3 - 2 * t);
};

test("always stops stay, and My Stack is kept only when it clears the gap", () => {
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

test("magnetic strength is a smoothstep from a hard pull to nothing at 100px", () => {
  assert.equal(magneticStrength(0), 1);
  assert.equal(magneticStrength(SNAP_RADIUS_PX), 0);
  assert.equal(magneticStrength(110), 0);
  for (const distance of [15, 50, 85]) {
    assert.ok(Math.abs(magneticStrength(distance) - smoothstep(distance)) < 1e-12);
  }
  const close = magneticStrength(15);
  const middle = magneticStrength(50);
  const far = magneticStrength(85);
  assert.ok(close > 0.9);
  assert.ok(middle > 0.45 && middle < 0.55);
  assert.ok(far > 0 && far < 0.12);
  assert.ok(close > middle && middle > far);
  const edge = magneticStrength(0) - magneticStrength(1);
  const mid = magneticStrength(49) - magneticStrength(51);
  const rim = magneticStrength(99) - magneticStrength(100);
  assert.ok(edge < mid / 5);
  assert.ok(rim < mid / 5);
});

test("a closer rest eases faster, and past the radius the page stays put", () => {
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
  assert.ok(close.strength > middle.strength && middle.strength > far.strength);
  assert.ok(glideDuration(close.strength, 15) < glideDuration(middle.strength, 50));
  assert.ok(glideDuration(middle.strength, 50) < glideDuration(far.strength, 85));
  assert.ok(glideDuration(close.strength, 15) > 1000);
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

test("a close pull glides in under the acceleration cap", () => {
  const closeOmega = springOmega(magneticStrength(15), 15);
  const farOmega = springOmega(magneticStrength(85), 85);
  assert.ok(closeOmega > farOmega);
  assert.ok(closeOmega * closeOmega * 15 <= GLIDE_MAX_ACCEL + 1e-6);
  assert.ok(farOmega * farOmega * 85 <= GLIDE_MAX_ACCEL + 1e-6);
  const start = criticallyDamped(0, closeOmega, 15, 0);
  assert.ok(Math.abs(start.velocity) < 1e-9);
  assert.ok(Math.abs(start.offset - 15) < 1e-9);
  const early = criticallyDamped(0.1, closeOmega, 15, 0);
  assert.ok(15 - early.offset > 0);
  assert.ok(15 - early.offset < 1.5);
  const later = criticallyDamped(0.7, closeOmega, 15, 0);
  assert.ok(later.offset < early.offset);
  assert.ok(later.offset > 1);
  for (const t of [0.2, 0.6, 1, 1.6, 2.4]) {
    const sample = criticallyDamped(t, closeOmega, 15, 0);
    assert.ok(sample.offset >= -0.001);
    assert.ok(sample.offset <= 15);
  }
});

test("the caption names the four check distances", () => {
  assert.equal(magnetCaption(15, "melt"), "15px from melt · firm glide");
  assert.equal(magnetCaption(50, "wheels"), "50px from wheels · medium glide");
  assert.equal(magnetCaption(85, "wheels"), "85px from wheels · soft glide");
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
  assert.match(snapSource, /springOmega/);
  assert.match(snapSource, /criticallyDamped/);
  assert.match(snapSource, /scrollingElement/);
  assert.equal(snapSource.includes("touchmove"), false);
  assert.match(snapSource, /prefers-reduced-motion: reduce/);
  assert.equal(snapSource.includes("preventDefault"), false);
  assert.match(snapSource, /get\("magnet"\) !== "1"/);
  assert.match(snapSource, /pointer-events:\s*none/);
});
