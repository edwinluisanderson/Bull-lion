import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CATCH_PX,
  CUSHION_ZONE_PX,
  FLING_MIN_PX_PER_SEC,
  FLING_SPEED_CAP,
  GLIDE_PX,
  GLIDE_SPEED,
  HARD_FLING_PX_PER_SEC,
  LAND_EPS_PX,
  RELEASE_SAMPLE_MS,
  SETTLE_PX,
  aimedSpeed,
  zoneEntryCap,
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
  passStopPositions,
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

test("only the melt plate and whichever of My Stack or the bottom comes first", () => {
  const stops = collectStops(page, 1500);
  assert.deepEqual(
    stops.map((stop) => stop.name),
    ["melt", "stack"],
  );
  assert.deepEqual(snapStops(page, 1500), [190, 946]);
  assert.equal(stops.some((stop) => stop.name === "top" || stop.name === "wheels"), false);

  const stackFirst = collectStops(
    [
      { at: 180, always: true, name: "melt" },
      { at: 400, always: true, name: "wheels" },
      { at: 950, always: false, name: "stack" },
    ],
    1000,
  );
  assert.deepEqual(
    stackFirst.map((stop) => stop.at),
    [180, 950],
  );
  assert.equal(stackFirst.find((stop) => stop.at === 950)?.name, "stack");

  const bottomFirst = collectStops(
    [
      { at: 180, always: true, name: "melt" },
      { at: 1400, always: false, name: "stack" },
    ],
    1000,
  );
  assert.deepEqual(
    bottomFirst.map((stop) => stop.name),
    ["melt", "bottom"],
  );
  assert.deepEqual(
    bottomFirst.map((stop) => stop.at),
    [180, 1000],
  );

  const shared = collectStops([{ at: 200, always: true, name: "melt" }, { at: 1000, always: false, name: "stack" }], 1000);
  assert.equal(shared.find((stop) => Math.abs(stop.at - 1000) <= 0.5)?.name, "stack/bottom");
  assert.equal(shared.length, 2);
});

test("a lift with no fling stays, a normal fling takes the next stop, a hard fling skips exactly one", () => {
  const input = { maxScroll: 1500, points: page, reduced: false };
  const stay = planFling({ ...input, scrollTop: 210, velocity: 40 });
  assert.equal(stay.target, null);
  assert.equal(planFling({ ...input, scrollTop: 20, velocity: 0 }).target, null);
  assert.ok(40 < FLING_MIN_PX_PER_SEC);

  const normal = planFling({ ...input, scrollTop: 210, velocity: 700 });
  assert.equal(normal.target, 946);
  assert.equal(normal.skipped, null);
  assert.equal(normal.hard, false);

  const hard = planFling({ ...input, scrollTop: 100, velocity: HARD_FLING_PX_PER_SEC });
  assert.equal(hard.skipped, 190);
  assert.equal(hard.target, 946);
  assert.equal(hard.hard, true);
  const pastStack = planFling({ ...input, scrollTop: 400, velocity: 1800 });
  assert.equal(pastStack.skipped, 946);
  assert.equal(pastStack.target, 1500);

  const upward = planFling({ ...input, scrollTop: 700, velocity: -700 });
  assert.equal(upward.target, 190);
  const hardUp = planFling({ ...input, scrollTop: 700, velocity: -HARD_FLING_PX_PER_SEC });
  assert.equal(hardUp.skipped, 190);
  assert.equal(hardUp.target, 0);

  const onlyOne = planFling({ ...input, scrollTop: 1400, velocity: HARD_FLING_PX_PER_SEC });
  assert.equal(onlyOne.target, 1500);
  assert.equal(onlyOne.skipped, null);
  assert.equal(planFling({ ...input, scrollTop: 400, velocity: 900, reduced: true }).target, null);

  assert.equal(FLING_SPEED_CAP, 1500);
  assert.equal(aimedSpeed(2200, 100, 946), FLING_SPEED_CAP);
  assert.equal(aimedSpeed(-2200, 700, 0), -FLING_SPEED_CAP);
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
  assert.equal(plan.target, 946);
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
    if (remaining <= CUSHION_ZONE_PX - CATCH_PX && remaining > SETTLE_PX + 2 && !next.landed) {
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

test("the land cue fires once when scrollTop rounds off a fractional stop", () => {
  assert.equal(LAND_EPS_PX, 1);
  const target = 189.97;
  let state = startOwnedGlide(80, 700, target, null);
  let cues = 0;
  for (let frame = 0; frame < 800 && !state.done; frame += 1) {
    const scrollTop = Math.round(state.y);
    const next = advanceOwnedGlide(state, frame % 4 === 0 ? 0.031 : 0.016, scrollTop);
    if (next.landed) cues += 1;
    state = next.landed ? next.state : { ...next.state, y: Math.round(next.state.y) };
  }
  assert.equal(cues, 1);
  assert.equal(state.done, true);
  assert.ok(Math.abs(state.y - target) <= LAND_EPS_PX);
  assert.equal(advanceOwnedGlide(state, 0.016, Math.round(state.y)).landed, false);

  const packed = [
    { at: 0, always: true, name: "top" },
    { at: 838, always: true, name: "wheels" },
    { at: 844, always: true, name: "bottom" },
  ];
  const plan = planFling({ scrollTop: 600, velocity: 900, maxScroll: 844, points: packed, reduced: false });
  assert.equal(plan.skipped, null);
  assert.equal(plan.target, 844);
  let cluster = startOwnedGlide(600, 900, plan.target ?? 838, plan.skipped);
  let clusterLands = 0;
  let clusterPasses = 0;
  for (let frame = 0; frame < 800 && !cluster.done; frame += 1) {
    const next = advanceOwnedGlide(cluster, 0.016, Math.round(cluster.y));
    if (next.landed) clusterLands += 1;
    if (next.pass) clusterPasses += 1;
    cluster = next.state;
  }
  assert.equal(clusterLands, 1);
  assert.equal(clusterPasses, 0);
  assert.equal(cluster.y, 844);
});

test("a planned skip keeps its target through to the end", () => {
  const points = [
    { at: 0, always: true, name: "top" },
    { at: 190, always: true, name: "melt" },
    { at: 500, always: true, name: "wheels" },
    { at: 900, always: true, name: "bottom" },
  ];
  const plan = planFling({
    scrollTop: 420,
    velocity: -1618,
    maxScroll: 900,
    points,
    reduced: false,
  });
  assert.equal(plan.hard, true);
  assert.equal(plan.skipped, 190);
  assert.equal(plan.target, 0);
  let state = startOwnedGlide(420, -1618, plan.target ?? 420, plan.skipped);
  let lands = 0;
  let passes = 0;
  const dts = [0.016, 0.008, 0.04, 0.02];
  for (let frame = 0; frame < 800 && !state.done; frame += 1) {
    const next = advanceOwnedGlide(state, dts[frame % dts.length], Math.round(state.y));
    if (next.landed) lands += 1;
    if (next.pass) passes += 1;
    state = next.state;
    assert.notEqual(state.target, 190);
  }
  assert.equal(lands, 0);
  assert.equal(passes, 1);
  assert.equal(state.y, 0);
  assert.equal(state.target, 0);
});

test("the first owned frame uses the capped speed and does not reverse or overshoot", () => {
  const dt = 0.016;
  const opened = startOwnedGlide(100, 2600, 900, null, 1500);
  assert.ok(opened.speed <= FLING_SPEED_CAP);
  const first = advanceOwnedGlide(opened, dt, opened.y);
  const moved = first.state.y - 100;
  assert.ok(moved > 0, "a downward fling must not reverse");
  assert.ok(Math.abs(moved - FLING_SPEED_CAP * dt) < 0.6, `first step ${moved}`);

  const near = startOwnedGlide(165, 1200, 190, null, 700);
  assert.ok(near.speed <= zoneEntryCap(25) + 1);
  const nearStep = advanceOwnedGlide(near, dt, near.y);
  assert.ok(nearStep.state.y <= 190);
  assert.ok(nearStep.state.y >= 165);

  const close = startOwnedGlide(185, 1000, 190, null, 700);
  assert.ok(close.speed <= GLIDE_SPEED + 1);
  const closeStep = advanceOwnedGlide(close, dt, close.y);
  assert.ok(closeStep.state.y <= 190);
  assert.ok(closeStep.state.y >= 185);
  assert.equal(closeStep.landed, false);

  let onto = startOwnedGlide(100, 700, 190, null, 700);
  let cues = 0;
  for (let frame = 0; frame < 400 && !onto.done; frame += 1) {
    const next = advanceOwnedGlide(onto, 0.016, onto.y);
    if (next.landed) cues += 1;
    onto = next.state;
    assert.ok(onto.y <= 190 + 0.01);
  }
  assert.equal(cues, 1);
  assert.ok(Math.abs(onto.y - 190) <= LAND_EPS_PX);
  const held = advanceOwnedGlide(onto, 0.016, onto.y);
  assert.equal(held.landed, false);
  assert.equal(held.state.y, onto.y);
});

test("catch speed stays continuous when frame times are uneven", () => {
  let state = startOwnedGlide(0, 1000, 500, null);
  let prev = state.speed;
  let entered = false;
  const dts = [0.016, 0.005, 0.04, 0.008, 0.028, 0.016];
  for (let frame = 0; frame < 500 && !state.done; frame += 1) {
    const before = state.y;
    const dt = dts[frame % dts.length];
    const remaining = Math.abs(state.target - before);
    const next = advanceOwnedGlide(state, dt, Math.round(before));
    const used = dt > 0 ? Math.abs(next.state.y - before) / Math.min(dt, 0.032) : 0;
    if (!entered && remaining > CUSHION_ZONE_PX && Math.abs(state.target - next.state.y) <= CUSHION_ZONE_PX) {
      entered = true;
      assert.ok(Math.abs((next.state.entrySpeed ?? 0) - 1000) < 1);
    }
    if (remaining <= CUSHION_ZONE_PX && remaining > SETTLE_PX) {
      assert.ok(used >= -1, `catch reversed at ${used}`);
      assert.ok(used <= prev + 24, `catch spiked from ${prev} to ${used}`);
    }
    prev = used;
    state = next.state;
  }
  assert.equal(entered, true);
  assert.equal(state.done, true);
  assert.equal(state.y, 500);
});

test("the cushion keeps the fling speed at the catch, glides at 56, and stops at zero", () => {
  assert.equal(CUSHION_ZONE_PX, 60);
  assert.equal(CATCH_PX, 20);
  assert.equal(SETTLE_PX, 10);
  assert.equal(GLIDE_PX, 30);
  assert.equal(GLIDE_SPEED, 56);
  const fling = 900;
  assert.equal(cushionSpeed(60, fling), fling);
  assert.equal(cushionSpeed(61, fling), fling);
  assert.ok(Math.abs(cushionSpeed(40.001, fling) - GLIDE_SPEED) < 1);
  assert.equal(cushionSpeed(30, fling), GLIDE_SPEED);
  assert.equal(cushionSpeed(10, fling), GLIDE_SPEED);
  assert.equal(cushionSpeed(0, fling), 0);
  assert.ok(cushionSpeed(5, fling) > 0 && cushionSpeed(5, fling) < GLIDE_SPEED);

  const started = 50;
  assert.equal(cushionSpeed(started, fling, started), fling);
  assert.ok(Math.abs(cushionSpeed(40.001, fling, started) - GLIDE_SPEED) < 1);
  assert.equal(cushionSpeed(20, 400), GLIDE_SPEED);
});

test("the sliding cap is about 600 at 30px and the glide speed in the last 10", () => {
  assert.equal(zoneEntryCap(60), FLING_SPEED_CAP);
  assert.equal(zoneEntryCap(10), GLIDE_SPEED);
  const at30 = zoneEntryCap(30);
  assert.ok(at30 > 520 && at30 < 680, `cap at 30px was ${at30}`);
  assert.ok(zoneEntryCap(45) > at30);
  assert.ok(zoneEntryCap(15) < at30 && zoneEntryCap(15) > GLIDE_SPEED);
  const toward = aimedSpeed(1400, 160, 190);
  assert.ok(Math.abs(toward) < 1400);
  assert.ok(Math.abs(toward) <= zoneEntryCap(30) + 1);
  const away = aimedSpeed(1400, 160, 900);
  assert.equal(away, 1400);
});

test("touching the page edge cancels the soft close and holds", () => {
  let state = startOwnedGlide(200, 900, 800, null, 360);
  let lands = 0;
  for (let frame = 0; frame < 200 && !state.done; frame += 1) {
    const next = advanceOwnedGlide(state, 0.016, state.y);
    if (next.landed) lands += 1;
    state = next.state;
  }
  assert.equal(state.done, true);
  assert.equal(state.y, 360);
  assert.equal(lands, 0);
  assert.equal(advanceOwnedGlide(state, 0.016, state.y).state.y, 360);
});

test("pass and landing cues fire once for the stops they belong to", () => {
  assert.deepEqual(flingCues(false), ["land"]);
  assert.deepEqual(flingCues(true), ["pass", "land"]);
  assert.deepEqual(dragCues(0), []);
  assert.deepEqual(dragCues(2), ["pass", "pass"]);
  assert.deepEqual(stopsPassed(200, 600, [0, 190, 538, 946, 1500]), [538]);
  assert.deepEqual(stopsPassed(1000, 100, [0, 190, 538, 946, 1500]), [946, 538, 190]);
  assert.deepEqual(stopsPassed(190, 538, [190, 538]), [538]);
  assert.deepEqual(stopsPassed(189, 190, [190]), [190]);
  assert.deepEqual(stopsPassed(189.6, 190.4, [190.2]), [190.2]);
  assert.deepEqual(stopsPassed(190, 191, [190]), []);
  assert.deepEqual(passStopPositions(page, 1500), [190, 946]);
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
  assert.match(snapSource, /aimedSpeed/);
  assert.match(snapSource, /sealScroll/);
  assert.match(snapSource, /passStopPositions/);
});
