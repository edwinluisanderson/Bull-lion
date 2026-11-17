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
  STEAMPUNK_LIGHT_COUNT,
  STEAMPUNK_LIGHT_PX,
} from "@/lib/steampunk-light";

const light = readFileSync(new URL("../components/steampunk-light.tsx", import.meta.url), "utf8");
const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");
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

test("five lights are spaced across the temporary bottom plate", () => {
  assert.equal(STEAMPUNK_LIGHT_COUNT, 5);
  const panel = machine.slice(machine.indexOf('className="gear-panel"'));
  const row = panel.indexOf('className="gear-panel-lights"');
  const gears = panel.indexOf("gear-panel-bg-left");
  assert.ok(row > 0 && row < gears);
  assert.match(panel, /STEAMPUNK_LIGHT_COUNT/);
  assert.match(panel, /<SteampunkLight /);
  assert.match(css, /\.gear-panel-lights \{[^}]*justify-content:\s*space-between/);
  assert.match(css, /\.rivet \{[^}]*width:\s*12px/);
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

test("one lighthouse sweeps a beam across the bottom plate", () => {
  const panel = machine.slice(machine.indexOf('className="gear-panel"'));
  const lights = panel.indexOf('className="gear-panel-lights"');
  const house = panel.indexOf('className="gear-panel-lighthouse"');
  assert.ok(lights > 0 && house > lights);
  assert.equal((panel.match(/gear-panel-lighthouse/g) ?? []).length, 1);
  assert.match(panel, /className="lighthouse-beam"/);
  assert.match(css, /\.gear-panel-lighthouse \{[^}]*bottom:\s*14px/);
  assert.match(css, /\.gear-panel-lighthouse \{[^}]*left:\s*50%/);
  assert.match(css, /\.lighthouse-beam \{[^}]*conic-gradient\(/);
  assert.match(css, /\.lighthouse-beam \{[^}]*mask-image:\s*radial-gradient\(circle, transparent 0 2\.3%/);
  assert.match(css, /\.lighthouse-beam \{[^}]*animation:\s*lighthouse-sweep 5s linear infinite/);
  const reduced = css
    .split("@media (prefers-reduced-motion: reduce)")
    .slice(1)
    .find((part) => part.includes(".lighthouse-beam"));
  assert.ok(reduced);
  assert.match(reduced ?? "", /\.lighthouse-beam \{[^}]*animation:\s*none/);
});

test("the bottom plate is taller and a lower lamp casts its cage", () => {
  assert.match(css, /\.gear-panel \{[^}]*min-height:\s*480px/);
  assert.match(css, /\.gear-panel-stage \{[^}]*min-height:\s*320px/);
  assert.match(css, /\.gear-panel-row \{[^}]*min-height:\s*168px/);
  assert.match(css, /\.gear-panel \{\s*min-height:\s*360px/);
  assert.match(css, /\.gear-panel-stage \{\s*min-height:\s*250px/);
  assert.match(css, /\.gear-panel-row \{\s*min-height:\s*132px/);
  const panel = machine.slice(machine.indexOf('className="gear-panel"'));
  assert.match(panel, /<SteampunkLightCast \/>/);
  assert.match(css, /\.gear-panel-cast \{[^}]*left:\s*22%/);
  assert.match(css, /\.gear-panel-cast \{[^}]*bottom:\s*20px/);
  assert.match(light, /scale\(1\.65\)/);
  assert.match(light, /scale\(2\.45\)/);
  assert.equal(light.includes("feGaussianBlur"), false);
});
