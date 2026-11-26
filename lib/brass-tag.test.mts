import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const readout = readFileSync(new URL("../components/readout.tsx", import.meta.url), "utf8");

test("the melt tag and the reel tags share one upsized brass plate", () => {
  const shared = css.slice(css.indexOf(".gauge-unit .gauge-nameplate,\n.melt-price-tag {"));
  assert.match(shared, /\.gauge-unit \.gauge-nameplate,\s*\.melt-price-tag \{[^}]*height:\s*18px/);
  assert.match(shared, /\.gauge-unit \.gauge-nameplate,\s*\.melt-price-tag \{[^}]*font-size:\s*13px/);
  assert.match(shared, /\.gauge-unit \.gauge-nameplate,\s*\.melt-price-tag \{[^}]*font-weight:\s*700/);
  assert.match(shared, /\.gauge-unit \.gauge-nameplate,\s*\.melt-price-tag \{[^}]*letter-spacing:\s*0\.1em/);
  assert.match(shared, /\.gauge-unit \.gauge-nameplate,\s*\.melt-price-tag \{[^}]*border-radius:\s*3\.5px/);
  assert.match(shared, /\.gauge-unit \.gauge-nameplate,\s*\.melt-price-tag \{[^}]*padding:\s*0 7px 0 calc\(7px \+ 0\.1em\)/);
  assert.match(shared, /\.gauge-unit \.gauge-nameplate,\s*\.melt-price-tag \{[^}]*font-family:\s*var\(--font-display\)/);
  assert.match(css, /\.melt-price-tag \{[^}]*margin:\s*12px 0/);
  assert.match(css, /html\[data-compact="3"\] \.gauge-row \.gauge-unit \.gauge-nameplate,\s*html\[data-compact="3"\] \.melt-price-tag \{[^}]*height:\s*18px/);
  assert.match(css, /html\[data-compact="3"\] \.gauge-row \.gauge-unit \.gauge-nameplate,\s*html\[data-compact="3"\] \.melt-price-tag \{[^}]*font-size:\s*13px/);
  assert.match(readout, /className="melt-price-tag"/);
  assert.match(readout, /gauge-nameplate-cut">Melt Price/);
  assert.equal(readout.includes("melt-price-screw"), false);
  assert.ok(13 / 11.5 >= 1.12 && 13 / 11.5 <= 1.15);
  assert.ok(18 / 16 >= 1.12 && 18 / 16 <= 1.15);
});
