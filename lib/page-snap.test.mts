import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CATCH_PX,
  COINCIDENT_STOP_PX,
  CUSHION_ZONE_PX,
  FLING_MIN_PX_PER_SEC,
  GLIDE_PX,
  GLIDE_SPEED,
  HARD_FLING_PX_PER_SEC,
  RELEASE_SAMPLE_MS,
  SETTLE_PX,
  SNAP_MIN_GAP_PX,
  advanceOwnedGlide,
  beginPageGesture,
  collectStops,
  cushionSpeed,
  dragCues,
  flingCues,
  gestureLift,
  magnetCaption,
  nearestStop,
  notePagePointerCancel,
  notePageScroll,
  notePageTouchMove,
  pageGestureVelocity,
  planFling,
  snapStops,
  startOwnedGlide,
  stopsPassed,
  touchScrollVelocity,
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

  assert.equal(HARD_FLING_PX_PER_SEC, 1600);
  const phoneFlick = planFling({ ...input, scrollTop: 210, velocity: 1800 });
  assert.equal(phoneFlick.hard, true);
  assert.equal(phoneFlick.skipped, 538);
  assert.equal(phoneFlick.target, 946);
  const firm = planFling({ ...input, scrollTop: 210, velocity: 1500 });
  assert.equal(firm.hard, false);
  assert.equal(firm.target, 538);
  assert.equal(firm.skipped, null);
});

test("wheels and the page bottom a few pixels apart are one stop", () => {
  assert.equal(COINCIDENT_STOP_PX, 8);
  const packed = [
    { at: 0, always: true, name: "top" },
    { at: 200, always: true, name: "melt" },
    { at: 838, always: true, name: "wheels" },
    { at: 844, always: true, name: "bottom" },
  ];
  const input = { maxScroll: 844, points: packed, reduced: false };
  const hard = planFling({ ...input, scrollTop: 100, velocity: 1800 });
  assert.equal(hard.skipped, 200);
  assert.equal(hard.target, 838);
  const atThePair = planFling({ ...input, scrollTop: 700, velocity: 1900 });
  assert.equal(atThePair.skipped, null);
  assert.equal(atThePair.target, 838);
  assert.deepEqual(stopsPassed(700, 860, [838, 844]), [838]);
  assert.equal(stopsPassed(700, 860, [838, 844]).length, 1);
});

test("a pointercancel in the middle of a pan still flings from the later samples", () => {
  assert.equal(gestureLift("pointercancel"), false);
  assert.equal(gestureLift("pointerup"), false);
  assert.equal(gestureLift("touchend"), true);
  assert.equal(gestureLift("touchcancel"), true);
  assert.ok(RELEASE_SAMPLE_MS >= 80 && RELEASE_SAMPLE_MS <= 100);

  let gesture = beginPageGesture(0, 100, 500);
  gesture = notePageTouchMove(gesture, 16, 490);
  gesture = notePagePointerCancel(gesture);
  assert.equal(gesture.active, true);
  gesture = notePageScroll(gesture, 40, 120);
  gesture = notePageScroll(gesture, 80, 150);
  gesture = notePageScroll(gesture, 130, 190);
  const velocity = pageGestureVelocity(gesture);
  assert.ok(velocity > FLING_MIN_PX_PER_SEC);
  assert.ok(velocity < HARD_FLING_PX_PER_SEC);
  const plan = planFling({
    scrollTop: 190,
    velocity,
    maxScroll: 1500,
    points: page,
    reduced: false,
  });
  assert.equal(plan.target, 538);
  assert.equal(plan.skipped, null);
});

test("touch samples over the last 90ms are the release velocity", () => {
  const samples = [
    { t: 0, y: 400 },
    { t: 50, y: 390 },
    { t: 100, y: 380 },
    { t: 190, y: 200 },
  ];
  const velocity = touchScrollVelocity(samples);
  assert.ok(Math.abs(velocity - 2000) < 1);
  let gesture = beginPageGesture(0, 210, 400);
  for (const sample of samples) {
    gesture = notePageTouchMove(gesture, sample.t, sample.y);
    gesture = notePageScroll(gesture, sample.t, 210 + (400 - sample.y));
  }
  assert.ok(Math.abs(pageGestureVelocity(gesture) - 2000) < 1);
});

test("an owned glide keeps going when the scroller drifts and holds 56 in the cushion", () => {
  let state = startOwnedGlide(0, 900, 400, null);
  let sawGlide = false;
  for (let frame = 0; frame < 500 && !state.done; frame += 1) {
    const before = state.y;
    const remaining = Math.abs(state.target - before);
    const drifted = before + 40;
    const next = advanceOwnedGlide(state, 0.016, drifted);
    if (remaining <= 80 && remaining > 15 && !next.landed) {
      const moved = Math.abs(next.state.y - before) / 0.016;
      assert.ok(Math.abs(moved - GLIDE_SPEED) < 1.5, `glide speed ${moved}`);
      sawGlide = true;
    }
    assert.notEqual(next.state.y, drifted);
    state = next.state;
  }
  assert.equal(sawGlide, true);
  assert.equal(state.done, true);
  assert.equal(state.y, 400);
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
  assert.match(snapSource, /advanceOwnedGlide/);
  assert.match(snapSource, /scrollingElement/);
  assert.match(snapSource, /touchstart/);
  assert.match(snapSource, /touchmove/);
  assert.match(snapSource, /touchend/);
  assert.match(snapSource, /touchcancel/);
  assert.equal(snapSource.includes('addEventListener("pointerdown"'), false);
  assert.equal(snapSource.includes('addEventListener("pointerup"'), false);
  assert.equal(snapSource.includes('addEventListener("pointercancel"'), false);
  assert.match(snapSource, /prefers-reduced-motion: reduce/);
  assert.equal(snapSource.includes("preventDefault"), false);
  assert.equal(snapSource.includes("actual - placed"), false);
  assert.match(snapSource, /wheel/);
  assert.match(snapSource, /get\("magnet"\) !== "1"/);
  assert.match(snapSource, /pointer-events:\s*none/);
  assert.match(snapSource, /takeOverScroll/);
});
