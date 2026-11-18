import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const gauge = readFileSync(new URL("../components/gauge.tsx", import.meta.url), "utf8");
const restyle = readFileSync(new URL("../components/gauge-restyle.tsx", import.meta.url), "utf8");
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
  const surround = machine.indexOf("<GaugeSurround");
  assert.ok(surround > dock && surround < row);
  const between = machine.slice(gap, wheels);
  assert.equal((between.match(/<Gauge(?![A-Za-z])/g) ?? []).length, 2);
  assert.equal(between.includes('className="bulbs"'), false);
  const underWheels = machine.slice(wheels, machine.indexOf('className="gear-panel"'));
  assert.match(underWheels, /className="cabinet-gears"[\s\S]*<WheelLamps \/>/);
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

test("the three round gauges share one 110px dial and the weight dial is not dropped", () => {
  assert.equal(restyle.match(/viewBox="([^"]+)"/)?.[1], "0 0 96 82");
  assert.match(gauge, /gauge--round-b/);
  assert.match(weightDial, /RoundGaugeRestyle/);
  assert.match(css, /\.gauge-row:has\(\.gauge--round-b\) \{[^}]*align-items:\s*end;/);
  assert.match(css, /\.gauge-row:has\(\.gauge--round-b\) \{[^}]*--gauge-b:\s*110px;/);
  assert.match(css, /\.gauge-row:has\(\.gauge--round-b\) \{[^}]*padding-left:\s*14px;\s*padding-right:\s*14px;/);
  assert.match(css, /\.gauge-row:has\(\.gauge--round-b\) \.gauge\.weight-dial \{[^}]*transform:\s*none;/);
  assert.match(css, /\.gauge-row:has\(\.gauge--round-b\) \.gauge\.weight-dial \{[^}]*width:\s*var\(--gauge-b\);/);
  assert.doesNotMatch(css, /\.gauge \{[^}]*transform:/);
  assert.doesNotMatch(css, /\.gauge-center \{[^}]*transform:/);
});
