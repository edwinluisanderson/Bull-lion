import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  LIVE_WIRE_GREEN_MS,
  LIVE_WIRE_YELLOW_MS,
  liveWireState,
} from "@/lib/live-wire";

const readout = readFileSync(new URL("../components/readout.tsx", import.meta.url), "utf8");
const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("the live wire sits under the stack line inside the melt plate", () => {
  const stack = readout.indexOf('className="tagline"');
  const wire = readout.indexOf('data-testid="price-source"');
  assert.ok(stack > 0);
  assert.ok(wire > stack);
  assert.match(readout, /className="lamp"/);
  assert.match(readout, /Live wire/);
  assert.equal(machine.includes('data-testid="price-source"'), false);
  assert.equal(machine.includes('className="lamp"'), false);
  const plateLamp = css.slice(css.indexOf(".melt-plate .lamp,"));
  assert.match(plateLamp, /\.melt-plate \.lamp,\s*\.melt-plate \.lamp span \{\s*color:\s*#3a2710;/);
  assert.match(css, /\.melt-plate \.lamp \{[^}]*position:\s*absolute;/);
  assert.match(css, /\.melt-plate \.lamp \{[^}]*bottom:\s*6px;/);
  assert.match(css, /\.eyebrow,\s*\.tagline,\s*\.plate-title \{\s*color:\s*#3a2710;/);
});

const NOW = Date.parse("2026-11-14T12:00:00.000Z");
const at = (ms: number) => new Date(ms).toISOString();

test("the live wire lamp is green for a check 30 minutes old", () => {
  assert.equal(LIVE_WIRE_GREEN_MS, 30 * 60 * 1000);
  assert.equal(LIVE_WIRE_YELLOW_MS, 2 * 60 * 60 * 1000);
  assert.equal(liveWireState(at(NOW), NOW, false), "green");
  assert.equal(liveWireState(at(NOW - LIVE_WIRE_GREEN_MS), NOW, false), "green");
  assert.equal(liveWireState(at(NOW + 60_000), NOW, false), "green");
});

test("the live wire lamp is yellow after 30 minutes and through 2 hours", () => {
  assert.equal(liveWireState(at(NOW - LIVE_WIRE_GREEN_MS - 1), NOW, false), "yellow");
  assert.equal(liveWireState(at(NOW - 60 * 60 * 1000), NOW, false), "yellow");
  assert.equal(liveWireState(at(NOW - LIVE_WIRE_YELLOW_MS), NOW, false), "yellow");
});

test("the live wire lamp is red after 2 hours or when only the sample card is showing", () => {
  assert.equal(liveWireState(at(NOW - LIVE_WIRE_YELLOW_MS - 1), NOW, false), "red");
  assert.equal(liveWireState(at(NOW - 5 * 60 * 60 * 1000), NOW, false), "red");
  assert.equal(liveWireState(at(NOW), NOW, true), "red");
  assert.equal(liveWireState(null, NOW, false), "red");
  assert.equal(liveWireState("not-a-time", NOW, false), "red");
});
