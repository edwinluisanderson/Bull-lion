import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("the decorative gears sit in the holding panel under the machine", () => {
  const cabinet = machine.slice(machine.indexOf('className="cabinet"'), machine.indexOf('className="gear-panel"'));
  const panel = machine.slice(machine.indexOf('className="gear-panel"'));
  assert.equal(cabinet.includes("<Gear"), false);
  assert.equal(cabinet.includes("bg-gear-left"), false);
  assert.equal(cabinet.includes("bg-gear-right"), false);
  assert.equal((panel.match(/<Gear /g) ?? []).length, 4);
  assert.match(panel, /gear-panel-bg-left/);
  assert.match(panel, /gear-panel-bg-right/);
  assert.match(panel, /marquee-gear gear-reverse/);
  assert.match(css, /\.gear-panel \{[^}]*border-radius:\s*22px/);
  assert.match(css, /\.cabinet-gears \{[^}]*min-height:\s*52px/);
});
