import assert from "node:assert/strict";
import { test } from "node:test";

import { BRAKE_PRESETS, REEL_SPEED_CAP } from "@/lib/drum";
import {
  PULL_LIGHT_STOP_S,
  PULL_STAGGER_S,
  fitLaunchSpeeds,
  pullDecel,
  pullLaunchSpeeds,
  pullLaunchVelocity,
  pullStopSeconds,
  stillAtMs,
} from "@/lib/pull-spin";

test("every reel launches at the cap", () => {
  const speeds = [0, 1, 2].map((order) => pullLaunchVelocity({ order }));
  assert.deepEqual(speeds, [-REEL_SPEED_CAP, -REEL_SPEED_CAP, -REEL_SPEED_CAP]);
  assert.deepEqual(pullLaunchSpeeds(), [REEL_SPEED_CAP, REEL_SPEED_CAP, REEL_SPEED_CAP]);
});

test("the light brakes stop the reels left to right about 0.4s apart", () => {
  const times = [0, 1, 2].map((order) => pullStopSeconds(order, "light"));
  assert.deepEqual(times, [...PULL_LIGHT_STOP_S]);
  const decels = [0, 1, 2].map((order) => pullDecel(order, "light"));
  assert.ok(Math.abs(decels[0] - 10) < 1e-9);
  assert.ok(Math.abs(decels[1] - 20 / 2.4) < 1e-9);
  assert.ok(Math.abs(decels[2] - 20 / 2.8) < 1e-9);
  assert.ok(decels[0] > decels[1] && decels[1] > decels[2]);
  assert.equal(stillAtMs(1) - stillAtMs(0), Math.round(PULL_STAGGER_S * 1000));
  assert.equal(stillAtMs(2) - stillAtMs(1), Math.round(PULL_STAGGER_S * 1000));
});

test("heavier presets shorten every stop and keep the proportions", () => {
  const light = [0, 1, 2].map((order) => pullStopSeconds(order, "light"));
  const medium = [0, 1, 2].map((order) => pullStopSeconds(order, "medium"));
  const heavy = [0, 1, 2].map((order) => pullStopSeconds(order, "heavy"));
  for (let order = 0; order < 3; order += 1) {
    assert.ok(Math.abs(medium[order] - light[order] / 2) < 1e-9);
    assert.ok(Math.abs(heavy[order] - light[order] / 4) < 1e-9);
    assert.ok(Math.abs(medium[order] / medium[0] - light[order] / light[0]) < 1e-9);
    assert.ok(Math.abs(heavy[order] / heavy[0] - light[order] / light[0]) < 1e-9);
  }
  const decels = (preset: keyof typeof BRAKE_PRESETS) =>
    [0, 1, 2].map((order) => pullDecel(order, preset));
  for (const preset of ["light", "medium", "heavy"] as const) {
    const values = decels(preset);
    assert.ok(values[0] > values[1] && values[1] > values[2]);
    assert.ok(Math.abs(values[0] / BRAKE_PRESETS[preset] - decels("light")[0] / BRAKE_PRESETS.light) < 1e-9);
  }
  assert.ok(stillAtMs(0, "light") > stillAtMs(0, "heavy"));
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
