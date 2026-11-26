import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

/** Workshop border box: full viewport until the 390px cap. */
function workshopWidth(viewport: number) {
  return Math.min(viewport, 390);
}

/** Column inside the 0.85rem side padding at a 16px root. */
function columnAt16(viewport: number) {
  return workshopWidth(viewport) - 2 * 0.85 * 16;
}

/** Shared nameplate. Root font size does not enter the formula. */
function nameplateHeight(viewport: number) {
  return (columnAt16(viewport) * 58.25) / 292.8 + 8;
}

/** The old cqw plate: the column narrows when the root font grows. */
function legacyNameplate(viewport: number, root: number) {
  const column = workshopWidth(viewport) - 2 * 0.85 * root;
  return (column * 58.25) / 292.8 + 8;
}

test("the melt plate and My Stack share one nameplate height", () => {
  assert.match(
    css,
    /\.workshop \{[^}]*--nameplate-h:\s*calc\(\(min\(100vw, 390px\) - 2 \* 0\.85 \* 16px\) \* 58\.25 \/ 292\.8 \+ 8px\)/,
  );
  assert.match(css, /\.split-stack-head \{[^}]*min-height:\s*var\(--nameplate-h\)/);
  assert.match(css, /\.nameplate\.melt-plate \{[^}]*padding-top:\s*8px/);
  assert.match(css, /\.melt-plate \{[^}]*grid-template-rows:\s*auto auto auto auto/);
  assert.match(css, /\.melt-heading \{[^}]*min-height:\s*calc\(var\(--nameplate-h\) - 8px\)/);
  assert.match(css, /\.melt-heading \{[^}]*padding-bottom:\s*8px/);
  assert.match(css, /\.melt-plate \.plate-title \{[^}]*margin:\s*0/);
  assert.match(css, /\.stack-card \{[^}]*--card-h:\s*calc\(100cqw \* 58\.25 \/ 292\.8\)/);

  assert.equal(nameplateHeight(320), 66.25);
  assert.equal(nameplateHeight(320), legacyNameplate(320, 16));
  assert.ok(Math.abs(legacyNameplate(320, 20) - 64.897) < 0.01);
  for (const viewport of [320, 360, 390, 1440]) {
    assert.ok(
      Math.abs(nameplateHeight(viewport) - legacyNameplate(viewport, 16)) < 1e-9,
      `${viewport}px nameplate drifted from the 16px column`,
    );
    assert.equal(nameplateHeight(viewport), (columnAt16(viewport) * 58.25) / 292.8 + 8);
  }
});

test("the melt tag sits 12px from the glass and from the ounce line", () => {
  assert.match(css, /\.melt-price-tag \{[^}]*margin:\s*12px 0/);
  assert.match(css, /\.melt-plate \.tagline \{[^}]*min-height:\s*0/);
  assert.match(css, /\.melt-plate \.tagline \{[^}]*padding-bottom:\s*20px/);
  assert.match(css, /\.melt-plate \.lamp \{[^}]*bottom:\s*6px/);
});
