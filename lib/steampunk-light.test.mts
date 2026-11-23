import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CAGE_EACH_WAY,
  cagePaths,
  LAMP_FULL,
  LAMP_LOW,
  LAMP_MEDIUM,
  LAMP_OFF,
  LAMP_REST,
  lampPaint,
  RIVET_PX,
  STEAMPUNK_LIGHT_PX,
  WHEEL_LAMP_COUNT,
  WHEEL_LAMP_PX,
} from "@/lib/steampunk-light";

const light = readFileSync(new URL("../components/steampunk-light.tsx", import.meta.url), "utf8");
const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");
const lamps = readFileSync(new URL("../components/wheel-lamps.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("a light is a caged bulb larger than a rivet", () => {
  assert.equal(RIVET_PX, 12);
  assert.equal(STEAMPUNK_LIGHT_PX, 30);
  assert.ok(STEAMPUNK_LIGHT_PX > RIVET_PX);
  assert.equal(CAGE_EACH_WAY, 3);
  const bars = cagePaths();
  assert.equal(bars.length, CAGE_EACH_WAY * 2);
  assert.equal(bars.filter((bar) => bar.axis === "across").length, 3);
  assert.equal(bars.filter((bar) => bar.axis === "down").length, 3);
  for (const bar of bars) assert.match(bar.d, / Q /);
  assert.match(light, /useId\(/);
  assert.match(light, /url\(#\$\{id\}-bulb\)/);
  assert.match(light, /url\(#\$\{id\}-glass\)/);
  assert.match(light, /url\(#\$\{id\}-brass\)/);
  assert.match(light, /#f3e2ad/);
  assert.match(light, /cx="32%" cy="30%"/);
  assert.equal(light.includes("feGaussianBlur"), false);
});

test("the scrap plate has no caged lights", () => {
  const start = machine.indexOf('className="gear-panel"');
  const panel = machine.slice(start, machine.indexOf("{lampCompare ?", start));
  assert.equal(panel.includes("gear-panel-lights"), false);
  assert.equal(panel.includes("gear-panel-lighthouse"), false);
  assert.equal(panel.includes("SteampunkLightCast"), false);
  assert.equal(panel.includes("<SteampunkLight "), false);
  assert.match(css, /\.rivet \{[^}]*width:\s*12px/);
});

test("three full caged lamps replace the dots under the wheels", () => {
  assert.equal(WHEEL_LAMP_COUNT, 3);
  assert.equal(WHEEL_LAMP_PX, 36);
  const underWheels = machine.slice(machine.indexOf('className="playfield"'), machine.indexOf('className="gear-panel"'));
  assert.match(underWheels, /<WheelLamps \/>/);
  assert.equal(underWheels.includes('className="bulbs"'), false);
  assert.match(underWheels, /<WheelLamps \/>/);
  assert.match(machine, /pulseWheelLamp\(0\)/);
  assert.match(machine, /pulseWheelLamp\(1\)/);
  assert.match(machine, /pulseWheelLamp\(2\)/);
  assert.match(css, /\.wheel-lamps \{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.wheel-lamps \.steampunk-light \{[^}]*width:\s*36px/);
  assert.match(lamps, /prefers-reduced-motion: reduce/);
  assert.match(lamps, /REDUCED_LEVEL = 1/);
});

test("brightness runs from an unlit bulb to a full warm halo", () => {
  assert.equal(LAMP_OFF, 0);
  assert.equal(LAMP_LOW, 0.33);
  assert.equal(LAMP_MEDIUM, 0.66);
  assert.equal(LAMP_FULL, 1);
  const off = lampPaint(LAMP_OFF);
  const low = lampPaint(LAMP_LOW);
  const medium = lampPaint(LAMP_MEDIUM);
  const full = lampPaint(LAMP_FULL);
  const luminance = (hex: string) => {
    const n = Number.parseInt(hex.slice(1), 16);
    return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
  };
  assert.equal(off.glowOpacity, 0);
  assert.equal(off.haloOpacity, 0);
  assert.equal(off.barWarm, 0);
  assert.ok(luminance(off.bulbCore) < luminance(full.bulbCore));
  assert.ok(low.haloOpacity < medium.haloOpacity && medium.haloOpacity < full.haloOpacity);
  assert.ok(low.glowOpacity < full.glowOpacity);
  assert.equal(LAMP_REST.haloOpacity, 0);
  assert.equal(LAMP_REST.glowOpacity, 0.28);
  assert.match(light, /brightness\?: number/);
  assert.match(light, /LAMP_REST/);
  assert.equal(light.includes("feGaussianBlur"), false);
});

test("the scrap plate keeps its height without the test lamps", () => {
  assert.match(css, /\.gear-panel \{[^}]*min-height:\s*360px/);
  assert.equal(css.includes("min-height: 540px"), false);
  assert.equal(css.includes(".gear-panel-lights"), false);
  assert.equal(css.includes(".lighthouse-beam"), false);
  assert.equal(css.includes(".gear-panel-cast"), false);
  assert.equal(light.includes("feGaussianBlur"), false);
});
