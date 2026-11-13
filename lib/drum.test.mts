import assert from "node:assert/strict";
import { test } from "node:test";

import {
  basinIndex,
  camPastNotch,
  coastAdvance,
  commitIndex,
  cylinderPose,
  glideSettleNotch,
  modStop,
  nearestEnabledNotch,
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

test("velocity is not reduced while crossing gray stops", () => {
  const count = 8;
  const grayBefore = (index: number) => modStop(index, count) >= 6;
  const ice = coastAdvance(1.1, 7, 0.08, grayBefore, count);
  assert.equal(ice.velocity, 7);
  assert.ok(ice.position > 1.6);
  assert.ok(basinIndex(ice.position) < 6);
  const friction = coastAdvance(1.1, 7, 0.08, () => true, count);
  assert.ok(friction.velocity < 7);
  assert.ok(ice.velocity > friction.velocity);

  const decay = 2.7;
  const dt = 0.016;
  const retained = Math.exp(-decay * dt);
  const expectedVelocity = 9 * retained;
  const matched = coastAdvance(3, 9, dt, () => true, count, decay);
  assert.ok(Math.abs(matched.velocity - expectedVelocity) < 1e-9);
  assert.ok(Math.abs(matched.position - (3 + (9 - expectedVelocity) / decay)) < 1e-9);
});

test("a flick never settles on a gray stop and lands on the next valid one", () => {
  const count = 8;
  const enabled = (index: number) => modStop(index, count) >= 6;
  assert.equal(enabled(modStop(glideSettleNotch(2.2, 0.2, count, enabled), count)), true);
  assert.equal(modStop(glideSettleNotch(2.2, 0.2, count, enabled), count), 6);
  assert.equal(modStop(glideSettleNotch(2.2, -0.2, count, enabled), count), 7);
  assert.equal(glideSettleNotch(6.2, 0.1, count, enabled), 6);
  assert.notEqual(modStop(glideSettleNotch(2.2, 4, count, enabled), count), 2);

  let position = 4.2;
  let velocity = 5;
  for (let frame = 0; frame < 240 && Math.abs(velocity) >= 0.5; frame += 1) {
    const before = velocity;
    const step = coastAdvance(position, velocity, 1 / 60, enabled, count);
    if (basinIndex(position) < 6 && basinIndex(step.position) < 6) {
      assert.equal(step.velocity, before);
    }
    position = step.position;
    velocity = step.velocity;
  }
  const land = glideSettleNotch(position, velocity, count, enabled);
  assert.equal(enabled(modStop(land, count)), true);
  assert.ok(land > 4);
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
