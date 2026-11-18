import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ROUND_GAUGE_VIEW, needlePivotStyle, pivotPoint } from "@/lib/gauge-needle";

const restyle = readFileSync(new URL("../components/gauge-restyle.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("the needle pivot is the hub center", () => {
  const style = needlePivotStyle(194);
  const pivot = pivotPoint(style);
  assert.equal(style.transformBox, "view-box");
  assert.equal(style.transform, "rotate(194deg)");
  assert.ok(Math.abs(pivot.x - ROUND_GAUGE_VIEW.cx) < 1e-9);
  assert.ok(Math.abs(pivot.y - ROUND_GAUGE_VIEW.cy) < 1e-9);
  assert.equal(ROUND_GAUGE_VIEW.cx, 48);
  assert.equal(ROUND_GAUGE_VIEW.cy, 42);

  for (const angle of [194, 360, 526]) {
    const turned = pivotPoint(needlePivotStyle(angle));
    assert.ok(Math.abs(turned.x - 48) < 1e-9);
    assert.ok(Math.abs(turned.y - 42) < 1e-9);
  }
});

test("the needle turns from that hub and the shadow rides inside the same turn", () => {
  assert.match(restyle, /needlePivotStyle\(angle, cx, cy\)/);
  assert.doesNotMatch(restyle, /rotate\(\$\{angle\} \$\{cx\} \$\{cy\}\)/);
  const needle = restyle.slice(restyle.indexOf("function Needle"));
  const turn = needle.indexOf('className="gauge-needle"');
  const shadow = needle.indexOf("translate(${1.1 * s}");
  assert.ok(turn > 0 && shadow > turn);
  assert.match(css, /\.gauge-needle \{\s*transition:\s*transform 0\.35s ease;/);
});
