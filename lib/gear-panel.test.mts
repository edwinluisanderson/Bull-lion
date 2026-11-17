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
  assert.match(css, /--plate-radius:\s*22px/);
  assert.match(css, /\.gear-panel \{[^}]*border-radius:\s*var\(--plate-radius\)/);
  assert.match(css, /\.nameplate \{[^}]*border-radius:\s*var\(--plate-radius\)/);
  assert.match(css, /--plate-ring:[^;]*inset 0 0 0 10px #2a1810/);
  assert.match(
    css,
    /\.melt-plate::after,\s*\.gear-panel::after \{[^}]*box-shadow:\s*var\(--plate-ring\)/,
  );
  assert.match(css, /\.melt-plate::after,\s*\.gear-panel::after \{[^}]*z-index:\s*5/);
  assert.match(css, /\.melt-plate > \.rivet,\s*\.gear-panel > \.rivet \{[^}]*z-index:\s*6/);
  assert.match(css, /\.cabinet-gears \{[^}]*min-height:\s*calc\(36px \+ 2\.05rem\)/);
});
