import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("the dials and lights sit between the melt plate and the wheels", () => {
  const logo = machine.indexOf('className="bullion-logo"');
  const readout = machine.indexOf("<Readout");
  const gap = machine.indexOf('className="between-plates"');
  const row = machine.indexOf('className="gauge-row"');
  const dock = machine.indexOf('className="between-plates-dock"');
  const wheels = machine.indexOf('className="playfield"');
  assert.ok(logo > 0 && logo < readout);
  assert.ok(readout < gap && gap < row && row < wheels);
  assert.ok(dock > gap && dock < row);
  const between = machine.slice(gap, wheels);
  assert.equal((between.match(/<Gauge/g) ?? []).length, 2);
  assert.match(between, /className="bulbs"/);
  assert.equal(between.includes("bullion-logo"), false);
  assert.match(machine, /label="METAL"/);
  assert.match(machine, /label="STACK"/);
  assert.match(css, /\.gauge \{\s*width:\s*min\(148px, 34vw\);/);
  assert.match(css, /\.between-plates-dock:empty \{\s*display:\s*none;/);
  assert.match(css, /\.bulbs span\.on \{[^}]*animation:\s*blink 2\.6s infinite;/);
});
