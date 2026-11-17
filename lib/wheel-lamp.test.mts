import assert from "node:assert/strict";
import test from "node:test";

import {
  WHEEL_LAMP_DECAY,
  WHEEL_LAMP_MAX,
  WHEEL_LAMP_PULSE,
  decayEnergy,
  pulseEnergy,
} from "@/lib/wheel-lamp";

test("a wheel pulse raises lamp energy and decay lowers it", () => {
  assert.equal(WHEEL_LAMP_PULSE, 0.34);
  assert.equal(WHEEL_LAMP_DECAY, 0.55);
  assert.equal(WHEEL_LAMP_MAX, 1);
  const pulsed = pulseEnergy(0);
  assert.equal(pulsed, 0.34);
  const again = pulseEnergy(pulsed);
  assert.ok(again > pulsed);
  const faded = decayEnergy(again, 1);
  assert.ok(faded < again);
  assert.ok(faded > 0);
  assert.equal(decayEnergy(0, 2), 0);
  assert.equal(decayEnergy(0.5, 0), 0.5);
});

test("a high step rate saturates the lamp at full brightness", () => {
  let energy = 0;
  for (let step = 0; step < 20; step += 1) energy = pulseEnergy(energy);
  assert.equal(energy, 1);
  assert.equal(pulseEnergy(1), 1);
  const during = decayEnergy(1, 0.05);
  const recovered = pulseEnergy(pulseEnergy(during));
  assert.equal(recovered, 1);
});
