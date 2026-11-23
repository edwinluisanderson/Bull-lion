import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BRAKE_PRESETS,
  REEL_CHECK_HZ,
  REEL_PROFILES,
  REEL_SPEED_CAPS,
  reelAliasSpeed,
  reelSpeedCap,
} from "@/lib/drum";
import {
  PULL_STAGGER_S,
  fitLaunchSpeeds,
  pullLaunchSpeeds,
  pullLaunchVelocity,
  pullStopSeconds,
  stillAtMs,
} from "@/lib/pull-spin";

test("later reels launch faster by one stagger of the shared brake", () => {
  const decel = BRAKE_PRESETS.medium;
  const speeds = pullLaunchSpeeds(decel);
  assert.ok(speeds[0] < speeds[1] && speeds[1] < speeds[2]);
  assert.ok(Math.abs(speeds[1] - speeds[0] - decel * PULL_STAGGER_S) < 1e-9);
  assert.ok(Math.abs(speeds[2] - speeds[1] - decel * PULL_STAGGER_S) < 1e-9);
  const gap = pullStopSeconds(speeds[1], decel) - pullStopSeconds(speeds[0], decel);
  assert.ok(Math.abs(gap - PULL_STAGGER_S) < 1e-9);
  assert.ok(pullLaunchVelocity({ order: 0, decel }) < 0);
});

test("a fast pull and a slow pull launch the same speeds", () => {
  const decel = BRAKE_PRESETS.light;
  const once = [0, 1, 2].map((order) => pullLaunchVelocity({ order, decel }));
  const again = [0, 1, 2].map((order) => pullLaunchVelocity({ order, decel }));
  assert.deepEqual(once, again);
  assert.deepEqual(
    once.map((speed) => Math.abs(speed)),
    pullLaunchSpeeds(decel),
  );
});

test("the three reels stop left to right on the light brake", () => {
  const decel = BRAKE_PRESETS.light;
  const speeds = pullLaunchSpeeds(decel);
  const lands = speeds.map((speed) => pullStopSeconds(speed, decel));
  assert.ok(lands[0] < lands[1] && lands[1] < lands[2]);
  const gap = lands[1] - lands[0];
  assert.ok(gap >= 0.3 && gap <= 0.5);
  assert.ok(Math.abs(gap - PULL_STAGGER_S) < 1e-9);
  assert.equal(stillAtMs(1) - stillAtMs(0), Math.round(PULL_STAGGER_S * 1000));
  assert.ok(stillAtMs(0, "light") > stillAtMs(0, "heavy"));
});

test("each reel stays under its own alias threshold", () => {
  for (const profile of REEL_PROFILES) {
    const cap = reelSpeedCap(profile.patternStops);
    assert.equal(REEL_SPEED_CAPS[profile.order], cap);
    const launch = Math.abs(pullLaunchVelocity({ order: profile.order, decel: BRAKE_PRESETS.light }));
    assert.ok(launch <= cap + 1e-9);
    for (const hz of REEL_CHECK_HZ) {
      const alias = reelAliasSpeed(profile.patternStops, hz);
      assert.ok(cap < alias);
      assert.ok(cap / hz < 0.5);
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
  assert.equal(speeds[2], 20);
});

test("different caps scale the set by the largest overshoot ratio", () => {
  const speeds = fitLaunchSpeeds([12, 15.2, 18.4], [10, 20, 22]);
  assert.ok(Math.abs(speeds[0] - 10) < 1e-9);
  assert.ok(speeds[1] <= 20 && speeds[2] <= 22);
  const gap = speeds[1] - speeds[0];
  assert.ok(Math.abs(speeds[2] - speeds[1] - gap) < 1e-9);
  assert.ok(gap > 0);
});
