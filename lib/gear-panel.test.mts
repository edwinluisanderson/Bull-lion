import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("the scrap plate is blank wood under the machine", () => {
  const cabinet = machine.slice(machine.indexOf('className="cabinet"'), machine.indexOf('className="gear-panel"'));
  const panel = machine.slice(machine.indexOf('className="gear-panel"'));
  assert.equal(cabinet.includes("<Gear"), false);
  assert.equal(panel.includes("<Gear"), false);
  assert.equal(panel.includes("gear-panel-bg"), false);
  assert.equal(panel.includes("RollingPrice"), false);
  assert.equal(panel.includes("scrap-readout"), false);
  assert.match(panel, /className="scrap-clear"/);
  assert.match(css, /\.gear-panel \{[^}]*border-radius:\s*var\(--cabinet-radius\)/);
  assert.match(css, /\.nameplate \{[^}]*border-radius:\s*14px/);
  assert.match(css, /\.nameplate \{[^}]*inset 0 1px 0 rgba\(255, 255, 255, 0\.7\)/);
  assert.equal(css.includes(".melt-plate::after"), false);
  assert.match(css, /--cabinet-ring:[^;]*inset 0 0 0 11px #3a2416/);
  assert.match(
    css,
    /\.cabinet::after,\s*\.gear-panel::after \{[^}]*box-shadow:\s*var\(--cabinet-ring\)/,
  );
  assert.match(css, /\.cabinet::after,\s*\.gear-panel::after \{[^}]*border-radius:\s*var\(--cabinet-radius\)/);
  assert.match(css, /\.pull-handle \{[^}]*z-index:\s*8/);
  assert.match(css, /\.cabinet::after \{[^}]*z-index:\s*7/);
  assert.match(css, /\.gear-panel::after \{[^}]*z-index:\s*9/);
  assert.match(css, /\.gear-panel > \.rivet \{[^}]*z-index:\s*6/);
  assert.match(css, /\.cabinet-gears \{[^}]*min-height:\s*calc\(36px \+ 2\.05rem\)/);
});
