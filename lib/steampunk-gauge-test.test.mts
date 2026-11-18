import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const original = readFileSync(new URL("../components/gauge.tsx", import.meta.url), "utf8");
const copy = readFileSync(new URL("../components/stack-gauge-test.tsx", import.meta.url), "utf8");

test("the scrap plate shows a test copy of the STACK gauge", () => {
  const row = machine.slice(machine.indexOf('className="gauge-row"'), machine.indexOf('className="playfield"'));
  assert.match(row, /label="STACK"/);
  assert.equal((row.match(/<Gauge/g) ?? []).length, 2);
  assert.equal(row.includes("StackGaugeTest"), false);
  const plate = machine.slice(machine.indexOf('className="gear-panel"'));
  assert.match(plate, /className="scrap-gauge-test"/);
  assert.match(plate, /<StackGaugeTest fraction=\{countIndex \/ Math\.max\(1, COUNTS\.length - 1\)\}/);
  assert.match(original, /stroke="#f0d78c"/);
  assert.match(original, /stroke="#f4e2b0"/);
  assert.match(copy, /halfCircleNeedleAngle\(clamped\)/);
  assert.match(copy, /Array\.from\(\{ length: 7 \}, \(_, tick\) => -90 \+ tick \* 30\)/);
  assert.match(copy, /const inner = 34;\s*const outer = 42;/);
  assert.match(copy, /stroke="#f4e2b0"\s*strokeWidth="2\.4"/);
  assert.match(copy, /stroke="#2a1c10"\s*strokeWidth="4\.2"/);
  assert.match(copy, /stroke="#2a1c10"\s*strokeWidth="1\.5"/);
  assert.match(copy, /url\(#scrap-gauge-ivory\)/);
  assert.match(copy, /url\(#scrap-gauge-brass\)/);
  assert.match(copy, /url\(#scrap-gauge-glass\)/);
  assert.match(css, /\.scrap-gauge-test \{[^}]*width:\s*min\(148px, 46%\)/);
  assert.match(css, /\.gauge text \{[^}]*fill:\s*#f6e7c8/);
});
