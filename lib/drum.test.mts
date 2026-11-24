import assert from "node:assert/strict";
import { test } from "node:test";

import { armLandingWatch, commitReelStop, settleReelLanding } from "@/lib/reel-landing";

import {
  basinIndex,
  brakeDecel,
  camPastNotch,
  BRAKE_PRESETS,
  coastAdvance,
  commitIndex,
  cylinderPose,
  flingVelocity,
  flywheelAdvance,
  glideSettleNotch,
  grayGlidePlan,
  COAST_SETTLE_SPEED,
  paylineSpacing,
  REEL_CAP_FRACTION,
  REEL_CHECK_HZ,
  REEL_SPEED_CAP,
  reelAliasSpeed,
  stopsCrossed,
  modStop,
  nearestEnabledNotch,
  pointerPullCommits,
  pullStage,
  releaseCommitsSpin,
  shouldApplyGuard,
  stageBendDegrees,
} from "@/lib/drum";

test("pull stages split at 75 and 85 percent", () => {
  assert.equal(pullStage(0), "a");
  assert.equal(pullStage(0.749), "a");
  assert.equal(pullStage(0.75), "b");
  assert.equal(pullStage(0.849), "b");
  assert.equal(pullStage(0.85), "c");
  assert.equal(pullStage(1), "c");
  assert.equal(pullStage(1.4), "c");
  assert.equal(releaseCommitsSpin(0.84), false);
  assert.equal(releaseCommitsSpin(0.85), true);
});

test("a pointer pull adds a card only for a real drag released past stage C", () => {
  assert.equal(pointerPullCommits(false, 0, "release"), false);
  assert.equal(pointerPullCommits(false, 1, "release"), false);
  assert.equal(pointerPullCommits(true, 0.84, "release"), false);
  assert.equal(pointerPullCommits(true, 0.85, "release"), true);
  assert.equal(pointerPullCommits(true, 1, "release"), true);
  assert.equal(pointerPullCommits(true, 1, "cancel"), false);
  assert.equal(pointerPullCommits(true, 0.9, "cancel"), false);
  assert.equal(pointerPullCommits(false, 1, "cancel"), false);
});

test("stage A barely strains and stage B kicks backward two to five degrees", () => {
  assert.ok(stageBendDegrees(0) === 0);
  assert.ok(stageBendDegrees(0.74) > 0);
  assert.ok(stageBendDegrees(0.74) < 1);
  assert.equal(stageBendDegrees(0.75), -2);
  assert.ok(stageBendDegrees(0.8) < -2);
  assert.ok(stageBendDegrees(0.8) > -5);
  assert.ok(Math.abs(stageBendDegrees(0.849) - -5) < 0.05);
  assert.equal(stageBendDegrees(0.85), 0);
  assert.equal(stageBendDegrees(1), 0);
});

test("the notch cam passes the nearest stop then names that center", () => {
  assert.equal(nearestEnabledNotch(4.2, 11, () => true), 4);
  assert.equal(nearestEnabledNotch(4.8, 11, () => true), 5);
  assert.equal(nearestEnabledNotch(4, 11, () => true), 4);
  assert.equal(camPastNotch(4.2, 4), 4 - 0.07);
  assert.equal(camPastNotch(4.8, 5), 5 + 0.07);
  assert.equal(camPastNotch(3, 3), 3);

  const skipFour = (index: number) => index % 11 !== 4;
  assert.equal(nearestEnabledNotch(4, 11, skipFour), 5);
  assert.equal(nearestEnabledNotch(3.9, 11, skipFour), 3);
});

test("a count flick keeps spinning across gray stops and only a new guard token jumps", () => {
  const count = 8;
  const enabled = (index: number) => index >= 6;
  assert.equal(commitIndex(2.2, count, enabled), null);
  assert.equal(commitIndex(6.1, count, enabled), 6);
  const land = nearestEnabledNotch(2.2, count, enabled);
  assert.equal(enabled(modStop(land, count)), true);
  assert.ok(Math.abs(land - 2.2) < 4);
  assert.equal(shouldApplyGuard(1, 0), true);
  assert.equal(shouldApplyGuard(1, 1), false);
  assert.equal(shouldApplyGuard(0, 0), false);
});

test("gray stops take the same brake as lit stops", () => {
  const count = 8;
  const grayBefore = (index: number) => modStop(index, count) >= 6;
  const decel = 16;
  const acrossGray = coastAdvance(1.1, 7, 0.08, grayBefore, count, decel);
  const acrossLit = coastAdvance(1.1, 7, 0.08, () => true, count, decel);
  assert.equal(acrossGray.velocity, acrossLit.velocity);
  assert.ok(acrossGray.velocity < 7);
  assert.ok(Math.abs(acrossGray.position - acrossLit.position) < 1e-9);
  const dt = 0.016;
  const speed = 9;
  const matched = coastAdvance(3, speed, dt, () => true, count, decel);
  const next = speed - decel * dt;
  const distance = speed * dt - 0.5 * decel * dt * dt;
  assert.ok(Math.abs(matched.velocity - next) < 1e-9);
  assert.ok(Math.abs(matched.position - (3 + distance)) < 1e-9);
  const stopped = coastAdvance(3, 1, 1, () => true, count, decel);
  assert.equal(stopped.velocity, 0);
  assert.ok(stopped.position > 3);
});

test("a flick settles forward onto the next lit stop and never on gray", () => {
  const count = 8;
  const enabled = (index: number) => modStop(index, count) >= 6;
  assert.equal(modStop(glideSettleNotch(2.2, 0.2, count, enabled), count), 6);
  assert.equal(modStop(glideSettleNotch(2.2, -0.2, count, enabled), count), 7);
  assert.equal(glideSettleNotch(6.2, 0.1, count, enabled), 7);
  assert.equal(glideSettleNotch(6, 0.1, count, enabled), 6);
  assert.ok(glideSettleNotch(6.2, 0.1, count, enabled) > 6.2);

  let position = 4.2;
  let velocity = 5;
  for (let frame = 0; frame < 400 && Math.abs(velocity) >= 0.5; frame += 1) {
    const step = coastAdvance(position, velocity, 1 / 60, enabled, count);
    position = step.position;
    velocity = step.velocity === 0 ? velocity : step.velocity;
    if (step.velocity === 0) break;
  }
  const land = glideSettleNotch(position, velocity, count, enabled);
  assert.equal(enabled(modStop(land, count)), true);
  assert.ok(land >= position);
});

test("a fling averages the last pointer samples", () => {
  const slow = [
    { t: 0, y: 0 },
    { t: 30, y: 2 },
    { t: 60, y: 4 },
  ];
  const fast = [
    { t: 0, y: 0 },
    { t: 30, y: 2 },
    { t: 50, y: 20 },
  ];
  assert.equal(flingVelocity(slow, 86, 28), flingVelocity(slow, 86, 28));
  assert.ok(Math.abs(flingVelocity(fast, 86, 28)) > Math.abs(flingVelocity(slow, 86, 28)));
  assert.deepEqual(stopsCrossed(1.2, 2.4), [2]);
  assert.deepEqual(stopsCrossed(2.2, 1.4), [2]);
  assert.deepEqual(stopsCrossed(1.2, 3.1), [2, 3]);
});

test("the speed cap stays under the wagon-wheel limit at 60, 90, and 120Hz", () => {
  const spacing = paylineSpacing();
  assert.ok(spacing > 1 && spacing < 1.04);
  for (const hz of REEL_CHECK_HZ) {
    const alias = reelAliasSpeed(1, hz);
    assert.equal(alias, 0.5 * hz);
    assert.ok(REEL_SPEED_CAP < alias);
    assert.ok(REEL_SPEED_CAP / hz < 0.5);
  }
  assert.equal(REEL_SPEED_CAP, REEL_CAP_FRACTION * 60);
  assert.ok(REEL_SPEED_CAP / 60 <= REEL_CAP_FRACTION + 1e-9);
  const flung = [
    { t: 0, y: 0 },
    { t: 16, y: 80 },
    { t: 32, y: 160 },
  ];
  assert.equal(Math.abs(flingVelocity(flung, 86)), REEL_SPEED_CAP);
});

test("a launch leaves at its speed and the brake slows it", () => {
  const first = flywheelAdvance(0, -REEL_SPEED_CAP, 1 / 60, BRAKE_PRESETS.light);
  assert.ok(first.velocity < 0);
  assert.ok(Math.abs(first.velocity) < REEL_SPEED_CAP);
  assert.ok(Math.abs(first.velocity) > REEL_SPEED_CAP - 1);
  assert.ok(first.position < 0);
  const over = flywheelAdvance(0, -REEL_SPEED_CAP - 8, 1 / 60, BRAKE_PRESETS.light);
  assert.ok(Math.abs(over.velocity) <= REEL_SPEED_CAP);
});

test("a late frame cannot jump half a stop", () => {
  const step = flywheelAdvance(0, -REEL_SPEED_CAP, 0.05, BRAKE_PRESETS.light);
  assert.ok(Math.abs(step.position) <= REEL_CAP_FRACTION + 1e-9);
  assert.ok(Math.abs(step.position) > 0);
});

test("the flick brake is locked to the light preset", () => {
  assert.equal(brakeDecel(), BRAKE_PRESETS.light);
  assert.equal(brakeDecel(), 8);
});

test("a gray landing retargets the brake onto the nearest lit face ahead", () => {
  const count = 8;
  const enabled = (index: number) => {
    const face = modStop(index, count);
    return face !== 2 && face !== 3 && face !== 4;
  };
  let position = 1.2;
  let velocity = 6;
  const decel = 6;
  let locked: number | null = null;
  for (let frame = 0; frame < 400 && Math.abs(velocity) >= COAST_SETTLE_SPEED; frame += 1) {
    const plan = grayGlidePlan({ position, velocity, decel, count, isEnabled: enabled, locked });
    if (!plan.fallback) locked = plan.target;
    if (frame === 0) {
      assert.equal(plan.fallback, false);
      assert.equal(plan.target, 5);
    }
    const step = flywheelAdvance(position, velocity, 1 / 60, plan.decel);
    assert.ok(Math.abs(step.position - position) < 0.5);
    assert.ok((step.position - position) * Math.sign(velocity) >= -1e-9);
    position = step.position;
    velocity = step.velocity;
  }
  const land = glideSettleNotch(position, velocity === 0 ? 1 : velocity, count, enabled);
  assert.equal(modStop(land, count), 5);
  assert.ok(Math.abs(position - land) < 0.75);
});

test("a retargeted gray coast still lands exactly once", () => {
  const count = 8;
  const enabled = (index: number) => {
    const face = modStop(index, count);
    return face !== 2 && face !== 3 && face !== 4;
  };
  let position = 1.2;
  let velocity = 6;
  const decel = 6;
  let watch = armLandingWatch();
  let landings = 0;
  let committed: number | null = null;
  let locked: number | null = null;
  for (let frame = 0; frame < 500 && Math.abs(velocity) >= COAST_SETTLE_SPEED; frame += 1) {
    const plan = grayGlidePlan({ position, velocity, decel, count, isEnabled: enabled, locked });
    if (!plan.fallback) locked = plan.target;
    const step = flywheelAdvance(position, velocity, 1 / 60, plan.fallback ? decel : plan.decel);
    for (const stop of stopsCrossed(position, step.position)) {
      if (!enabled(modStop(stop, count)) || modStop(stop, count) === committed) continue;
      committed = modStop(stop, count);
      const noted = commitReelStop(watch, false);
      watch = noted.watch;
      if (noted.playLanding) landings += 1;
    }
    position = step.position;
    velocity = step.velocity;
  }
  const settled = settleReelLanding(watch);
  if (settled.playLanding) landings += 1;
  assert.equal(settleReelLanding(settled.watch).playLanding, false);
  assert.equal(landings, 1);
  const land = glideSettleNotch(position, velocity === 0 ? 1 : velocity, count, enabled);
  assert.equal(enabled(modStop(land, count)), true);
  assert.ok(Math.abs(position - land) < 0.75);
});

test("a lit landing keeps the original brake", () => {
  const count = 8;
  const enabled = () => true;
  const plan = grayGlidePlan({ position: 0, velocity: 4, decel: 8, count, isEnabled: enabled });
  assert.equal(plan.decel, 8);
  assert.equal(plan.target, null);
  assert.equal(plan.fallback, false);
});

test("a gray target this frame cannot reach falls back to a short roll", () => {
  const count = 8;
  const enabled = (index: number) => {
    const face = modStop(index, count);
    return face === 6 || face === 0;
  };
  const plan = grayGlidePlan({ position: 5.85, velocity: 20, decel: 200, count, isEnabled: enabled });
  assert.equal(plan.fallback, true);
  assert.equal(plan.target, 6);
  const start = 5.85;
  let position = start;
  const land = glideSettleNotch(position, 1, count, enabled);
  assert.equal(modStop(land, count), 6);
  const frames = 8;
  for (let frame = 1; frame <= frames; frame += 1) {
    const next = start + ((land - start) * frame) / frames;
    assert.ok(Math.abs(next - position) < 0.2);
    position = next;
  }
  assert.ok(Math.abs(position - land) < 1e-9);
});

test("thirty gray coasts rest on a lit face without a position jump", () => {
  const count = 8;
  const enabled = (index: number) => modStop(index, count) % 2 === 0;
  for (let spin = 0; spin < 30; spin += 1) {
    let position = (spin % count) + 0.2;
    let velocity = 3 + (spin % 5);
    const decel = 4 + (spin % 3);
    let fallback = false;
    let locked: number | null = null;
    let retargeted = false;
    for (let frame = 0; frame < 500 && Math.abs(velocity) >= COAST_SETTLE_SPEED; frame += 1) {
      const plan = grayGlidePlan({ position, velocity, decel, count, isEnabled: enabled, locked });
      fallback = plan.fallback;
      if (plan.target !== null && !plan.fallback) {
        locked = plan.target;
        retargeted = true;
      }
      const used = plan.fallback ? decel : plan.decel;
      const step = flywheelAdvance(position, velocity, 1 / 60, used);
      assert.ok(Math.abs(step.position - position) < 0.5, `spin ${spin} jumped`);
      position = step.position;
      velocity = step.velocity;
    }
    const land = glideSettleNotch(position, velocity === 0 ? 1 : velocity, count, enabled);
    assert.equal(enabled(modStop(land, count)), true, `spin ${spin} landed gray`);
    if (retargeted && !fallback) {
      assert.ok(Math.abs(position - land) < 0.75, `spin ${spin} needed a second move`);
    }
  }
});

test("cylinder faces shrink and crowd toward the edges", () => {
  const center = cylinderPose(0);
  const one = cylinderPose(1);
  const two = cylinderPose(2);
  assert.equal(center.scaleY, 1);
  assert.ok(center.brightness > one.brightness);
  assert.ok(one.scaleY > two.scaleY);
  assert.ok(Math.abs(two.shift) < Math.abs(one.shift) * 2);
});
