import assert from "node:assert/strict";
import { test } from "node:test";

import {
  basinIndex,
  camPastNotch,
  BRAKE_PRESETS,
  coastAdvance,
  commitIndex,
  cylinderPose,
  flingVelocity,
  glideSettleNotch,
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
  const decel = BRAKE_PRESETS.medium;
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

test("cylinder faces shrink and crowd toward the edges", () => {
  const center = cylinderPose(0);
  const one = cylinderPose(1);
  const two = cylinderPose(2);
  assert.equal(center.scaleY, 1);
  assert.ok(center.brightness > one.brightness);
  assert.ok(one.scaleY > two.scaleY);
  assert.ok(Math.abs(two.shift) < Math.abs(one.shift) * 2);
});
