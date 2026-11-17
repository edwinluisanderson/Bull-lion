import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PULL_BRAKE_MS,
  PULL_ICE_MS,
  PULL_LOOPS,
  brakeVelocityAt,
  pullPlan,
  stillAtMs,
} from "@/lib/pull-spin";

test("free spin hands off to the brake at the same position and speed", () => {
  for (const order of [0, 1, 2]) {
    const count = [5, 16, 8][order];
    for (const landIndex of [0, Math.floor(count / 2), count - 1]) {
      const plan = pullPlan({ order, count, position: 12, landIndex, reduced: false });
      assert.equal(plan.iceMs, PULL_ICE_MS);
      assert.equal(plan.brakeMs, PULL_BRAKE_MS[order]);
      assert.ok(plan.speed > 36 && plan.speed < 46, `order ${order} speed ${plan.speed}`);
      const traveled = plan.start - plan.handoff;
      assert.ok(Math.abs(traveled - plan.speed * 3) < 1e-9);
      assert.ok(Math.abs(brakeVelocityAt(plan, 0) - plan.velocity) < 1e-9);
      assert.equal(((plan.notch % count) + count) % count, landIndex);
    }
  }
});

test("the wheels are fully still at 4.04, 4.30, and 4.56 seconds", () => {
  assert.deepEqual([0, 1, 2].map(stillAtMs), [4040, 4300, 4560]);
  assert.deepEqual(PULL_LOOPS, [25, 8, 16]);
});

test("reduced motion is a jump to the chosen stop", () => {
  const plan = pullPlan({ order: 1, count: 16, position: 12, landIndex: 4, reduced: true });
  assert.equal(plan.reduced, true);
  assert.equal(plan.iceMs, 0);
  assert.equal(plan.brakeMs, 0);
  assert.equal(plan.speed, 0);
  assert.equal(((plan.notch % 16) + 16) % 16, 4);
});
