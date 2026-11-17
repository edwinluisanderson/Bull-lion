import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { lampPaint } from "@/lib/steampunk-light";
import {
  WHEEL_LAMP_AMBER,
  WHEEL_LAMP_FULL_SPEED,
  WHEEL_LAMP_ORANGE,
  normalizeWheelSpeed,
  oklchOf,
  wheelLampCast,
  wheelLampColor,
  wheelLampPaint,
} from "@/lib/wheel-lamp-color";

const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");
const reel = readFileSync(new URL("../components/reel.tsx", import.meta.url), "utf8");
const lamps = readFileSync(new URL("../components/wheel-lamps.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("the wheel light is amber at rest, orange at full spin, and between at half speed", () => {
  assert.equal(WHEEL_LAMP_AMBER, "#ffb547");
  assert.equal(WHEEL_LAMP_ORANGE, "#ff7a1a");
  assert.equal(wheelLampColor(0), WHEEL_LAMP_AMBER);
  assert.equal(wheelLampColor(1), WHEEL_LAMP_ORANGE);
  assert.equal(wheelLampColor(-0.4), WHEEL_LAMP_AMBER);
  assert.equal(wheelLampColor(2), WHEEL_LAMP_ORANGE);

  const amber = oklchOf(WHEEL_LAMP_AMBER);
  const orange = oklchOf(WHEEL_LAMP_ORANGE);
  const mid = wheelLampColor(0.5);
  const middle = oklchOf(mid);
  assert.notEqual(mid, WHEEL_LAMP_AMBER);
  assert.notEqual(mid, WHEEL_LAMP_ORANGE);
  const lowHue = Math.min(amber.h, orange.h);
  const highHue = Math.max(amber.h, orange.h);
  assert.ok(middle.h > lowHue && middle.h < highHue, `mid hue ${middle.h}`);
  assert.ok(middle.c >= Math.min(amber.c, orange.c) - 0.004, `mid chroma ${middle.c}`);
  assert.ok(middle.l > Math.min(amber.l, orange.l) - 0.004);
  assert.ok(middle.l < Math.max(amber.l, orange.l) + 0.004);

  const stopped = wheelLampPaint(1, 0);
  const half = wheelLampPaint(1, 0.5);
  const full = wheelLampPaint(1, 1);
  assert.equal(stopped.color, WHEEL_LAMP_AMBER);
  assert.equal(half.color, mid);
  assert.equal(full.color, WHEEL_LAMP_ORANGE);
  assert.notEqual(stopped.bulbEdge, full.bulbEdge);
  assert.notEqual(half.bulbEdge, stopped.bulbEdge);
  assert.notEqual(half.bulbEdge, full.bulbEdge);

  const plain = lampPaint(1);
  assert.equal(stopped.bulbCore, plain.bulbCore);
  assert.equal(full.bulbCore, plain.bulbCore);
  assert.equal(stopped.glowOpacity, plain.glowOpacity);
  assert.equal(full.glowOpacity, plain.glowOpacity);
  assert.equal(half.haloOpacity, plain.haloOpacity);
  assert.equal(stopped.glassWarm, plain.glassWarm);
  assert.equal(full.barWarm, plain.barWarm);
  const bloom = oklchOf(stopped.bloom);
  const gold = oklchOf("#ffcf70");
  assert.ok(Math.abs(bloom.l - gold.l) < 0.01, `bloom lightness ${bloom.l}`);
  assert.ok(Math.abs(oklchOf(full.bloom).l - gold.l) < 0.01);

  for (const energy of [0, 0.33, 0.66, 1]) {
    const base = lampPaint(energy);
    for (const speed of [0, 0.5, 1]) {
      const paint = wheelLampPaint(energy, speed);
      assert.equal(paint.glowOpacity, base.glowOpacity);
      assert.equal(paint.haloOpacity, base.haloOpacity);
      assert.equal(paint.glassWarm, base.glassWarm);
      assert.equal(paint.barWarm, base.barWarm);
      assert.equal(paint.bulbCore, base.bulbCore);
    }
  }

  const cast = wheelLampCast(0.5);
  assert.match(cast.inner, /80$/);
  assert.match(cast.mid, /47$/);
  assert.match(cast.outer, /00$/);
});

test("wheel speed is normalized to the handle pull, and the lamps read it", () => {
  assert.equal(WHEEL_LAMP_FULL_SPEED, 36);
  assert.equal(normalizeWheelSpeed(0), 0);
  assert.equal(normalizeWheelSpeed(Number.NaN), 0);
  assert.equal(normalizeWheelSpeed(WHEEL_LAMP_FULL_SPEED / 2), 0.5);
  assert.equal(normalizeWheelSpeed(WHEEL_LAMP_FULL_SPEED), 1);
  assert.equal(normalizeWheelSpeed(-WHEEL_LAMP_FULL_SPEED), 1);
  assert.equal(normalizeWheelSpeed(WHEEL_LAMP_FULL_SPEED + 8), 1);

  assert.match(machine, /lampIndex=\{0\}/);
  assert.match(machine, /lampIndex=\{1\}/);
  assert.match(machine, /lampIndex=\{2\}/);
  assert.match(reel, /setWheelLampSpeed\(index, speed\)/);
  assert.match(lamps, /wheelLampSpeed\(index\)/);
  assert.match(lamps, /prefers-reduced-motion: reduce/);
  assert.match(css, /--lamp-cast-inner/);
  assert.equal(/\.wheel-lamp \{[^}]*transition/.test(css), false);
});
