import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CAGE_EACH_WAY,
  cagePaths,
  RIVET_PX,
  STEAMPUNK_LIGHT_COUNT,
  STEAMPUNK_LIGHT_PX,
} from "@/lib/steampunk-light";

const light = readFileSync(new URL("../components/steampunk-light.tsx", import.meta.url), "utf8");
const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("a light is a caged bulb slightly larger than a rivet", () => {
  assert.equal(RIVET_PX, 12);
  assert.ok(STEAMPUNK_LIGHT_PX > RIVET_PX);
  assert.ok(STEAMPUNK_LIGHT_PX <= RIVET_PX * 1.6);
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
