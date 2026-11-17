import assert from "node:assert/strict";
import test from "node:test";

import {
  WHEEL_LAMP_DECAY,
  WHEEL_LAMP_DECAY_CAP,
  WHEEL_LAMP_FLASH_DIP,
  WHEEL_LAMP_MAX,
  WHEEL_LAMP_SLOW_INTERVAL,
  decayEnergy,
  decayForInterval,
  pulseEnergy,
} from "@/lib/wheel-lamp";

test("a stop flashes the lamp to full and the fade brings it back down", () => {
  assert.equal(WHEEL_LAMP_MAX, 1);
  assert.equal(WHEEL_LAMP_DECAY, 5.8);
  assert.equal(WHEEL_LAMP_SLOW_INTERVAL, 0.4);
  assert.equal(pulseEnergy(), 1);
  assert.equal(pulseEnergy(), 1);
  const soon = decayEnergy(1, 0.12);
  assert.ok(soon < 1);
  assert.ok(soon > 0.4);
  const faded = decayEnergy(1, 0.45);
  assert.ok(faded < 0.1);
  assert.equal(decayEnergy(0, 2), 0);
  assert.equal(decayEnergy(0.5, 0), 0.5);
});

test("rapid stops stay separate flashes instead of a solid glow", () => {
  const slow = decayForInterval(1);
  const quick = decayForInterval(0.05);
  assert.equal(slow, WHEEL_LAMP_DECAY);
  assert.ok(quick > slow);
  assert.ok(quick <= WHEEL_LAMP_DECAY_CAP);
  const dipped = decayEnergy(pulseEnergy(), 0.05, quick);
  assert.ok(dipped < 0.55);
  assert.ok(dipped > 0.15);
  assert.equal(pulseEnergy(), WHEEL_LAMP_MAX);
  const crowded = decayForInterval(0.02);
  assert.equal(crowded, WHEEL_LAMP_DECAY_CAP);
  const stillSeparate = decayEnergy(1, 0.04, crowded);
  assert.ok(stillSeparate < WHEEL_LAMP_FLASH_DIP + 0.15);
  assert.ok(stillSeparate > 0.2);
});
