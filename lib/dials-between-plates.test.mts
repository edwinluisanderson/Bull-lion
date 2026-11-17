import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const gauge = readFileSync(new URL("../components/gauge.tsx", import.meta.url), "utf8");
const weightDial = readFileSync(new URL("../components/weight-dial.tsx", import.meta.url), "utf8");

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
  assert.equal(between.includes('className="bulbs"'), false);
  const underWheels = machine.slice(wheels, machine.indexOf('className="gear-panel"'));
  assert.match(underWheels, /className="cabinet-gears"[\s\S]*className="wheel-lamps"/);
  assert.equal(underWheels.includes('className="bulbs"'), false);
  assert.equal(between.includes("bullion-logo"), false);
  assert.match(machine, /label="METAL"/);
  assert.match(machine, /label="STACK"/);
  assert.match(css, /\.gauge-row \{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.gauge-row \{[^}]*var\(--reel-inset-left\)/);
  assert.match(css, /\.gauge \{\s*width:\s*min\(148px, 100%\);/);
  assert.match(css, /\.between-plates-dock:empty \{\s*display:\s*none;/);
  assert.match(css, /\.bulbs span\.on \{[^}]*animation:\s*blink 2\.6s infinite;/);
});

test("the weight dial sits 10px below the side dials", () => {
  assert.equal(gauge.match(/viewBox="([^"]+)"/)?.[1], "0 0 120 96");
  assert.equal(weightDial.match(/viewBox="([^"]+)"/)?.[1], "0 0 96 96");
  assert.match(css, /\.gauge-row \{[^}]*align-items:\s*end;/);
  assert.match(css, /\.gauge \{\s*width:\s*min\(148px, 100%\);\s*height:\s*auto;/);
  assert.match(
    css,
    /\.gauge\.weight-dial \{\s*width:\s*min\(calc\(148px \* 96 \/ 120\), 80%\);\s*height:\s*auto;/,
  );
  assert.match(css, /\.gauge\.weight-dial \{[^}]*transform:\s*translateY\(10px\);/);
  assert.doesNotMatch(css, /\.gauge \{[^}]*transform:/);
  assert.doesNotMatch(css, /\.gauge-center \{[^}]*transform:/);
});
