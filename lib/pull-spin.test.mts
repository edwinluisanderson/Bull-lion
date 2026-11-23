import assert from "node:assert/strict";
import { test } from "node:test";

import { BRAKE_PRESETS, REEL_SPEED_CAP } from "@/lib/drum";
import { PULL_STAGGER_S, pullLaunchVelocity, pullStopSeconds, stillAtMs } from "@/lib/pull-spin";

test("later reels launch faster by one stagger of the shared brake", () => {
  const decel = BRAKE_PRESETS.medium;
  const speeds = [0, 1, 2].map((order) =>
    Math.abs(pullLaunchVelocity({ order, decel, strength: 1, random: 0.5 })),
  );
  assert.ok(speeds[0] < speeds[1] && speeds[1] < speeds[2]);
  assert.ok(Math.abs(speeds[1] - speeds[0] - decel * PULL_STAGGER_S) < 1e-9);
  assert.ok(Math.abs(speeds[2] - speeds[1] - decel * PULL_STAGGER_S) < 1e-9);
  const gap = pullStopSeconds(speeds[1], decel) - pullStopSeconds(speeds[0], decel);
  assert.ok(Math.abs(gap - PULL_STAGGER_S) < 1e-9);
  assert.ok(pullLaunchVelocity({ order: 0, decel, strength: 1, random: 0.5 }) < 0);
});

test("jitter stays inside 15 percent and a harder pull is faster", () => {
  const decel = BRAKE_PRESETS.light;
  const calm = Math.abs(pullLaunchVelocity({ order: 0, decel, strength: 1, random: 0.5 }));
  const fast = Math.abs(pullLaunchVelocity({ order: 0, decel, strength: 1, random: 1 }));
  const slow = Math.abs(pullLaunchVelocity({ order: 0, decel, strength: 1, random: 0 }));
  assert.ok(fast > calm && slow < calm);
  assert.ok(Math.abs(fast / calm - 1.15) < 1e-9);
  assert.ok(Math.abs(slow / calm - 0.85) < 1e-9);
  const light = Math.abs(pullLaunchVelocity({ order: 0, decel, strength: 0.85, random: 0.5 }));
  const full = Math.abs(pullLaunchVelocity({ order: 0, decel, strength: 1, random: 0.5 }));
  assert.ok(full > light);
});

test("the three reels still stop left to right", () => {
  const lands = [0, 1, 2].map((order) => stillAtMs(order));
  assert.ok(lands[0] < lands[1] && lands[1] < lands[2]);
  assert.equal(lands[1] - lands[0], Math.round(PULL_STAGGER_S * 1000));
  assert.ok(stillAtMs(0, "light") > stillAtMs(0, "heavy"));
  for (const preset of ["light", "medium", "heavy"] as const) {
    const speeds = [0, 1, 2].map((order) =>
      Math.abs(pullLaunchVelocity({ order, decel: BRAKE_PRESETS[preset], strength: 1, random: 1 })),
    );
    assert.ok(speeds.every((speed) => speed <= REEL_SPEED_CAP + 1e-9));
    assert.ok(speeds[0] < speeds[1] && speeds[1] < speeds[2]);
  }
});
