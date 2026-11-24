import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { DIVIDER_BRIGHT, DIVIDER_DIM, dividerLevels, outerDividerLevels } from "@/lib/reel-dividers";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("both dividers rest just under the old lit brightness", () => {
  const still = dividerLevels([false, false, false]);
  assert.equal(still.left, DIVIDER_DIM);
  assert.equal(still.right, DIVIDER_DIM);
  assert.ok(DIVIDER_DIM < DIVIDER_BRIGHT);
  assert.ok(DIVIDER_BRIGHT - DIVIDER_DIM <= 0.4);
  assert.ok(DIVIDER_DIM >= 0.6);
  assert.equal(DIVIDER_BRIGHT, 1);
  assert.equal(DIVIDER_DIM, 0.6);
});

test("a moving reel lights only the dividers beside it", () => {
  assert.deepEqual(dividerLevels([true, false, false]), { left: DIVIDER_BRIGHT, right: DIVIDER_DIM });
  assert.deepEqual(dividerLevels([false, false, true]), { left: DIVIDER_DIM, right: DIVIDER_BRIGHT });
  assert.deepEqual(dividerLevels([false, true, false]), { left: DIVIDER_BRIGHT, right: DIVIDER_BRIGHT });
  assert.deepEqual(dividerLevels([true, false, true]), { left: DIVIDER_BRIGHT, right: DIVIDER_BRIGHT });
  assert.ok(dividerLevels([true, true, true]).left <= DIVIDER_BRIGHT);
  assert.ok(dividerLevels([true, true, true]).right <= DIVIDER_BRIGHT);
  assert.match(css, new RegExp(`opacity:\\s*${DIVIDER_DIM}`));
  assert.match(css, new RegExp(`opacity:\\s*${DIVIDER_BRIGHT}`));
  const seam = css.match(/\.reel-column \+ \.reel-column::after\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(seam, /top:\s*calc\(var\(--reel-name\) \+ 15px\)/);
  assert.match(seam, /height:\s*calc\(var\(--reel-window\) - 30px\)/);
  assert.match(seam, /width:\s*1px/);
  assert.match(seam, /background:\s*#f0d78c/);
  assert.match(seam, /opacity:\s*0\.6;/);
  assert.match(seam, /-webkit-mask-image:\s*linear-gradient\(180deg, rgba\(0,0,0,0\.28\) 0%.*#000 20%, #000 75%.*rgba\(0,0,0,0\.15\) 100%\)/);
  assert.match(seam, /mask-image:\s*linear-gradient\(180deg, rgba\(0,0,0,0\.28\) 0%.*#000 20%, #000 75%.*rgba\(0,0,0,0\.15\) 100%\)/);
  assert.equal(/background:[^;]*linear-gradient/.test(seam), false);
  assert.equal(/\.reel-viewport:focus-visible\s*\{[^}]*#f0d78c/.test(css), false);
  assert.equal(seam.includes("clip-path"), false);
});

test("outer lights match the inner seams and follow only the adjacent reel", () => {
  const still = outerDividerLevels([false, false, false]);
  assert.deepEqual(still, { left: DIVIDER_DIM, right: DIVIDER_DIM });
  assert.deepEqual(outerDividerLevels([true, false, false]), { left: DIVIDER_BRIGHT, right: DIVIDER_DIM });
  assert.deepEqual(outerDividerLevels([false, true, false]), { left: DIVIDER_DIM, right: DIVIDER_DIM });
  assert.deepEqual(outerDividerLevels([false, false, true]), { left: DIVIDER_DIM, right: DIVIDER_BRIGHT });
  assert.deepEqual(outerDividerLevels([true, true, true]), { left: DIVIDER_BRIGHT, right: DIVIDER_BRIGHT });

  const outer = css.match(/\.reel-grid::before,\s*\.reel-grid::after\s*\{([^}]*)\}/)?.[1] ?? "";
  const seam = css.match(/\.reel-column \+ \.reel-column::after\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(outer, /top:\s*calc\(var\(--reel-name\) \+ 15px\)/);
  assert.match(outer, /height:\s*calc\(var\(--reel-window\) - 30px\)/);
  assert.match(outer, /width:\s*1px/);
  assert.match(outer, /background:\s*#f0d78c/);
  assert.match(outer, /opacity:\s*0\.6;/);
  assert.match(outer, /transition:\s*opacity 280ms ease/);
  assert.match(outer, /position:\s*absolute/);
  assert.equal(outer.match(/mask-image:\s*([^;]+);/)?.[1], seam.match(/mask-image:\s*([^;]+);/)?.[1]);
  assert.match(css, /\.reel-grid::before\s*\{[^}]*left:\s*0/);
  assert.match(css, /\.reel-grid::after\s*\{[^}]*right:\s*0/);
  assert.match(css, /\.reel-grid\[data-outer-left="bright"\]::before\s*\{[^}]*opacity:\s*1/);
  assert.match(css, /\.reel-grid\[data-outer-right="bright"\]::after\s*\{[^}]*opacity:\s*1/);
  assert.equal(
    /\.reel-grid\[data-outer-left="bright"\]::before\s*,/.test(css),
    false,
  );
  const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");
  assert.match(machine, /outerDividerLevels\(handled\)/);
  assert.match(machine, /data-outer-left=\{outers\.left === DIVIDER_BRIGHT \? "bright" : "dim"\}/);
  assert.match(machine, /data-outer-right=\{outers\.right === DIVIDER_BRIGHT \? "bright" : "dim"\}/);
});

test("a metal drag release does not light the right outer line", () => {
  const inner = dividerLevels([true, false, true]);
  const outer = outerDividerLevels([true, false, false]);
  assert.equal(inner.right, DIVIDER_BRIGHT);
  assert.equal(outer.left, DIVIDER_BRIGHT);
  assert.equal(outer.right, DIVIDER_DIM);
  assert.deepEqual(outerDividerLevels([false, true, false]), { left: DIVIDER_DIM, right: DIVIDER_DIM });
  assert.deepEqual(outerDividerLevels([false, false, true]), { left: DIVIDER_DIM, right: DIVIDER_BRIGHT });
});
