import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  COAST_SETTLE_SPEED,
  brakeDecel,
  flywheelAdvance,
  grayGlidePlan,
  modStop,
  nearestEnabledNotch,
  REEL_SPEED_CAP,
} from "@/lib/drum";
import {
  PULL_FREE_SPIN_S,
  PULL_LIGHT_STOP_S,
  PULL_STAGGER_S,
  fitLaunchSpeeds,
  pullBrakeSeconds,
  pullDecel,
  pullFrame,
  pullFreeSpinning,
  pullLaunchSpeeds,
  pullLaunchVelocity,
  pullPose,
  pullStopSeconds,
  stillAtMs,
} from "@/lib/pull-spin";

test("every reel launches at the cap", () => {
  const speeds = [0, 1, 2].map((order) => pullLaunchVelocity({ order }));
  assert.deepEqual(speeds, [-REEL_SPEED_CAP, -REEL_SPEED_CAP, -REEL_SPEED_CAP]);
  assert.deepEqual(pullLaunchSpeeds(), [REEL_SPEED_CAP, REEL_SPEED_CAP, REEL_SPEED_CAP]);
});

test("the light brakes stop the reels left to right about 0.4s apart", () => {
  const times = [0, 1, 2].map((order) => pullStopSeconds(order));
  assert.deepEqual(times, [...PULL_LIGHT_STOP_S]);
  const decels = [0, 1, 2].map((order) => pullDecel(order));
  const brakes = [0, 1, 2].map((order) => pullBrakeSeconds(order));
  assert.ok(Math.abs(brakes[0] - 1) < 1e-9);
  assert.ok(Math.abs(brakes[1] - 1.4) < 1e-9);
  assert.ok(Math.abs(brakes[2] - 1.8) < 1e-9);
  assert.ok(Math.abs(decels[0] - REEL_SPEED_CAP / 1) < 1e-9);
  assert.ok(Math.abs(decels[1] - REEL_SPEED_CAP / 1.4) < 1e-9);
  assert.ok(Math.abs(decels[2] - REEL_SPEED_CAP / 1.8) < 1e-9);
  assert.ok(decels[0] > decels[1] && decels[1] > decels[2]);
  assert.equal(stillAtMs(1) - stillAtMs(0), Math.round(PULL_STAGGER_S * 1000));
  assert.equal(stillAtMs(2) - stillAtMs(1), Math.round(PULL_STAGGER_S * 1000));
});

test("pulls and flicks stay on the light brake", () => {
  assert.equal(brakeDecel(), 8);
  assert.equal(PULL_FREE_SPIN_S, 1.5);
  assert.deepEqual(
    [0, 1, 2].map((order) => pullDecel(order)),
    [0, 1, 2].map((order) => REEL_SPEED_CAP / (PULL_LIGHT_STOP_S[order] - PULL_FREE_SPIN_S)),
  );
  const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const reel = readFileSync(new URL("../components/reel.tsx", import.meta.url), "utf8");
  assert.equal(machine.includes("BrakeSwitch"), false);
  assert.equal(machine.includes('get("brake")'), false);
  assert.equal(css.includes("brake-switch"), false);
  assert.equal(reel.includes("pullFrame("), true);
  assert.equal(reel.includes("pullOrigin = position"), true);
  assert.equal(reel.includes("freeSpin ? 0 : pullSpin ? pullDecel(pullOrder) : brakeDecel()"), false);
  assert.equal(reel.includes("const decel = brakeDecel();"), true);
  assert.equal(reel.includes("flywheelAdvance("), true);
});

/** Where a full-speed free spin plus the pull brake comes to rest. */
function pullRest(order: number): number {
  const speed = REEL_SPEED_CAP;
  const coast = speed * PULL_FREE_SPIN_S;
  const brake = (speed * speed) / (2 * pullDecel(order));
  return -(coast + brake);
}

function coastPull(order: number, isEnabled: (index: number) => boolean, count: number) {
  const dt = 1 / 60;
  let position = 0;
  let velocity = pullLaunchVelocity({ order });
  const direction = Math.sign(velocity);
  let glideTarget: number | null = null;
  let chosen: number | null = null;
  let elapsed = 0;
  let settleAt = 0;
  let stoppedAt = 0;
  let brakeEntry = false;
  let furthest = 0;
  while (elapsed < 4 && velocity !== 0) {
    const free = pullFreeSpinning(elapsed);
    const decel = free ? 0 : pullDecel(order);
    const before = velocity;
    const glide = grayGlidePlan({
      position,
      velocity,
      decel,
      count,
      isEnabled,
      locked: glideTarget,
    });
    if (chosen === null && glide.target !== null) chosen = glide.target;
    glideTarget = glide.fallback ? null : glide.target;
    const applied = glide.fallback ? decel : glide.decel;
    const step = flywheelAdvance(position, velocity, dt, applied);
    if (free) {
      assert.equal(glideTarget, null);
      assert.ok(Math.abs(step.velocity - before) < 1e-9);
      assert.ok(Math.abs(Math.abs(step.velocity) - REEL_SPEED_CAP) < 1e-9);
      assert.ok(Math.abs(step.position - (position + before * dt)) < 1e-9);
    }
    if (!free && pullFreeSpinning(elapsed - dt)) {
      const drop = Math.abs(before) - Math.abs(step.velocity);
      assert.ok(Math.abs(Math.abs(before) - REEL_SPEED_CAP) < 1e-9);
      assert.ok(Math.abs(drop - applied * dt) < 1e-6);
      brakeEntry = true;
    }
    assert.ok(step.velocity === 0 || Math.sign(step.velocity) === direction);
    assert.ok(Math.abs(step.velocity) <= Math.abs(before) + 1e-9);
    if ((step.position - furthest) * direction > 0) furthest = step.position;
    position = step.position;
    velocity = step.velocity;
    elapsed += dt;
    if (settleAt === 0 && Math.abs(velocity) < COAST_SETTLE_SPEED) settleAt = elapsed;
    stoppedAt = elapsed;
  }
  return { position, velocity, settleAt, stoppedAt, glideTarget, chosen, brakeEntry, furthest, direction };
}

test("a pull free-spins at the cap for 1.5s, then brakes onto its stop", () => {
  assert.equal(pullFreeSpinning(1.5 - 1e-9), true);
  assert.equal(pullFreeSpinning(PULL_FREE_SPIN_S), false);
  const count = 120;
  for (const order of [0, 1, 2] as const) {
    const run = coastPull(order, () => true, count);
    const rest = pullRest(order);
    assert.equal(run.brakeEntry, true);
    assert.ok(Math.abs(run.settleAt - PULL_LIGHT_STOP_S[order]) < 0.05, `reel ${order} settled at ${run.settleAt}`);
    assert.ok(Math.abs(run.stoppedAt - PULL_LIGHT_STOP_S[order]) < 0.05, `reel ${order} stopped at ${run.stoppedAt}`);
    assert.equal(run.velocity, 0);
    const frame = REEL_SPEED_CAP / 60;
    assert.ok(Math.abs(run.position - rest) <= frame + 1e-6, `reel ${order} rested at ${run.position}, expected ${rest}`);
    const land = nearestEnabledNotch(run.position, count, () => true);
    assert.equal(land, Math.round(rest));
    assert.ok((rest - run.furthest) * run.direction >= -(REEL_SPEED_CAP / 60) - 1e-6);
  }
});

test("a gray pull still lands on the lit face inside the brake, without passing it", () => {
  const count = 120;
  for (const order of [0, 1, 2] as const) {
    const rest = Math.round(pullRest(order));
    const blocked = new Set([rest - 1, rest, rest + 1].map((index) => modStop(index, count)));
    const enabled = (index: number) => !blocked.has(modStop(index, count));
    const run = coastPull(order, enabled, count);
    assert.equal(run.brakeEntry, true);
    assert.ok(run.chosen !== null);
    const target = run.chosen ?? rest;
    assert.equal(enabled(target), true);
    assert.ok((target - run.furthest) * run.direction >= -1e-6);
    const land = nearestEnabledNotch(run.position, count, enabled);
    assert.equal(land, target);
    assert.ok(Math.abs(run.position - land) < 0.5);
    assert.equal(run.velocity, 0);

    let elapsed = 0;
    let cursor = 0;
    let locked: number | null = null;
    let restingAt = -1;
    let crossing = 0;
    const frames = [16.7, 25, 90, 22];
    let pose = { position: 0, velocity: pullLaunchVelocity({ order }), resting: false };
    while (elapsed < 6 && !pose.resting) {
      const dt = frames[cursor % frames.length] / 1000;
      cursor += 1;
      elapsed += dt;
      const frame = pullFrame({ origin: 0, order, elapsedS: elapsed, count, isEnabled: enabled, locked });
      locked = frame.locked;
      assert.equal(frame.resting, elapsed >= PULL_LIGHT_STOP_S[order]);
      assert.ok(frame.velocity === 0 || frame.velocity < 0);
      if (locked !== null) {
        const overshoot = (frame.position - locked) * Math.sign(pullLaunchVelocity({ order }));
        assert.ok(overshoot <= 0.07 + 1e-6);
      }
      if (frame.resting) {
        restingAt = elapsed;
        crossing = dt;
      }
      pose = frame;
    }
    assert.ok(locked !== null);
    assert.equal(pose.resting, true);
    assert.equal(pose.position, locked);
    assert.equal(pose.velocity, 0);
    assert.ok(restingAt + 1e-9 >= PULL_LIGHT_STOP_S[order]);
    assert.ok(restingAt - PULL_LIGHT_STOP_S[order] <= Math.max(0.05, crossing) + 1e-9);
  }
});

test("uneven frames still stop a pull at 2.5, 2.9, and 3.3", () => {
  const frames = [16.7, 25, 16.7, 90, 25, 22, 16.7, 25];
  for (const order of [0, 1, 2] as const) {
    let elapsed = 0;
    let cursor = 0;
    let locked: number | null = null;
    let stoppedAt = -1;
    let previousSpeed = REEL_SPEED_CAP;
    let crossedHandoff = false;
    while (elapsed < 4) {
      const dt = frames[cursor % frames.length] / 1000;
      cursor += 1;
      const before = elapsed;
      elapsed += dt;
      const frame = pullFrame({
        origin: 0,
        order,
        elapsedS: elapsed,
        count: 120,
        isEnabled: () => true,
        locked,
      });
      locked = frame.locked;
      const pose = pullPose(0, order, Math.min(elapsed, PULL_LIGHT_STOP_S[order]));
      const notch = Math.round(pullRest(order));
      if (frame.resting) {
        assert.equal(frame.velocity, 0);
        assert.equal(frame.position, notch);
      } else {
        assert.equal(frame.resting, false);
        assert.ok(elapsed < PULL_LIGHT_STOP_S[order]);
        assert.ok(Math.abs(frame.position - pose.position) < 1e-6);
        assert.ok(Math.abs(frame.velocity - pose.velocity) < 1e-6);
      }
      if (pullFreeSpinning(elapsed)) {
        assert.ok(Math.abs(Math.abs(frame.velocity) - REEL_SPEED_CAP) < 1e-9);
        assert.ok(Math.abs(frame.position - -REEL_SPEED_CAP * elapsed) < 1e-9);
      }
      if (!pullFreeSpinning(elapsed) && pullFreeSpinning(before)) {
        const intoBrake = elapsed - PULL_FREE_SPIN_S;
        const expected = Math.max(0, REEL_SPEED_CAP - pullDecel(order) * intoBrake);
        assert.ok(Math.abs(Math.abs(frame.velocity) - expected) < 1e-6);
        crossedHandoff = true;
      }
      assert.ok(frame.velocity === 0 || frame.velocity < 0);
      assert.ok(Math.abs(frame.velocity) <= previousSpeed + 1e-6);
      previousSpeed = Math.abs(frame.velocity);
      if (frame.resting) {
        stoppedAt = elapsed;
        const slack = Math.max(0.05, dt);
        assert.ok(stoppedAt + 1e-9 >= PULL_LIGHT_STOP_S[order]);
        assert.ok(stoppedAt - PULL_LIGHT_STOP_S[order] <= slack + 1e-9);
        break;
      }
    }
    assert.equal(crossedHandoff, true);
    assert.ok(
      Math.abs(stoppedAt - PULL_LIGHT_STOP_S[order]) <= 0.05,
      `reel ${order} stopped at ${stoppedAt}`,
    );
    assert.ok(Math.abs(pullPose(0, order, PULL_LIGHT_STOP_S[order]).velocity) < 1e-9);
    assert.ok(Math.abs(pullPose(0, order, stoppedAt).position - pullRest(order)) < 1e-6);
  }
  const hitch = pullPose(0, 0, 0.09);
  assert.ok(Math.abs(hitch.position - -REEL_SPEED_CAP * 0.09) < 1e-9);
  assert.ok(Math.abs(hitch.position) > REEL_SPEED_CAP / 60 + 0.5);
});

test("a pull is still braking 40ms before the stop, then rests on its face", () => {
  const count = 120;
  for (const order of [0, 1, 2] as const) {
    const stop = PULL_LIGHT_STOP_S[order];
    const notch = Math.round(pullRest(order));
    const early = pullFrame({
      origin: 0,
      order,
      elapsedS: stop - 0.04,
      count,
      isEnabled: () => true,
      locked: null,
    });
    assert.equal(early.resting, false);
    assert.ok(Math.abs(early.velocity) > 0.2);
    const rest = pullFrame({
      origin: 0,
      order,
      elapsedS: stop,
      count,
      isEnabled: () => true,
      locked: null,
    });
    assert.equal(rest.resting, true);
    assert.equal(rest.velocity, 0);
    assert.equal(rest.position, notch);
  }
});

test("throttled frames still rest within one frame and never stall", () => {
  const patterns = [
    [16.7, 25, 24, 45, 90, 121],
    [55, 80, 120, 180, 262],
  ];
  const count = 120;
  for (const frames of patterns) {
    for (const order of [0, 1, 2] as const) {
      let elapsed = 0;
      let cursor = 0;
      let locked: number | null = null;
      let previous: { position: number; velocity: number; resting: boolean } | null = null;
      let restingAt = -1;
      let crossing = 0;
      while (elapsed < 8) {
        const dt = frames[cursor % frames.length] / 1000;
        cursor += 1;
        elapsed += dt;
        const frame = pullFrame({
          origin: 0,
          order,
          elapsedS: elapsed,
          count,
          isEnabled: () => true,
          locked,
        });
        locked = frame.locked;
        if (previous && !previous.resting && !frame.resting && Math.abs(previous.velocity) > 0.05) {
          assert.ok(Math.abs(frame.position - previous.position) > 1e-4);
        }
        assert.ok(frame.velocity === 0 || frame.velocity < 0);
        assert.ok(!frame.resting || elapsed + 1e-9 >= PULL_LIGHT_STOP_S[order]);
        previous = frame;
        if (frame.resting) {
          restingAt = elapsed;
          crossing = dt;
          break;
        }
      }
      const notch = Math.round(pullRest(order));
      assert.equal(previous?.position, notch);
      assert.equal(previous?.velocity, 0);
      assert.ok(restingAt + 1e-9 >= PULL_LIGHT_STOP_S[order]);
      assert.ok(restingAt - PULL_LIGHT_STOP_S[order] <= Math.max(0.05, crossing) + 1e-9);
    }
  }
});

test("an over-cap launch lowers every reel by the same overshoot", () => {
  const speeds = fitLaunchSpeeds([16, 19.2, 24.4], [20, 20, 20]);
  assert.ok(Math.abs(speeds[0] - 11.6) < 1e-9);
  assert.ok(Math.abs(speeds[1] - 14.8) < 1e-9);
  assert.equal(speeds[2], 20);
  assert.ok(Math.abs(speeds[1] - speeds[0] - 3.2) < 1e-9);
  assert.ok(Math.abs(speeds[2] - speeds[1] - 5.2) < 1e-9);
});

test("different caps scale the set by the largest overshoot ratio", () => {
  const speeds = fitLaunchSpeeds([12, 15.2, 18.4], [10, 20, 22]);
  assert.ok(Math.abs(speeds[0] - 10) < 1e-9);
  assert.ok(speeds[1] <= 20 && speeds[2] <= 22);
  const gap = speeds[1] - speeds[0];
  assert.ok(Math.abs(speeds[2] - speeds[1] - gap) < 1e-9);
  assert.ok(gap > 0);
});
