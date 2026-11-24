import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DIVIDER_BRIGHT,
  DIVIDER_DIM,
  DIVIDER_FADE_IN_MS,
  DIVIDER_FADE_OUT_MS,
  dividerLevels,
  outerDividerLevels,
} from "@/lib/reel-dividers";

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

  const outer = css.match(/\.reel-outer-light\s*\{([^}]*)\}/)?.[1] ?? "";
  const seam = css.match(/\.reel-column \+ \.reel-column::after\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(outer, /top:\s*calc\(var\(--plate-pad-top\) \+ var\(--reel-name\) \+ 15px\)/);
  assert.match(outer, /height:\s*calc\(var\(--reel-window\) - 30px\)/);
  assert.match(outer, /width:\s*1px/);
  assert.match(outer, /background:\s*#f0d78c/);
  assert.match(outer, /opacity:\s*0\.6;/);
  assert.match(outer, /transition:\s*opacity var\(--divider-fade-out\) ease-out/);
  assert.match(outer, /position:\s*absolute/);
  assert.match(outer, /z-index:\s*2/);
  assert.equal(outer.match(/mask-image:\s*([^;]+);/)?.[1], seam.match(/mask-image:\s*([^;]+);/)?.[1]);
  assert.match(css, /\.reel-outer-light\[data-edge="left"\]\s*\{[^}]*left:\s*calc\(var\(--plate-pad-x\) - 1px\)/);
  assert.match(css, /\.reel-outer-light\[data-edge="right"\]\s*\{[^}]*right:\s*calc\(var\(--plate-pad-x\) - 1px\)/);
  const payline = css.match(/\.payline\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(payline, /z-index:\s*3/);
  assert.match(css, /\.payline::before,\s*\.payline::after\s*\{[^}]*border:\s*10px solid transparent/);
  assert.match(css, /\.payline::before\s*\{[^}]*left:\s*0/);
  assert.match(css, /\.payline::after\s*\{[^}]*right:\s*0/);
  const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");
  assert.match(machine, /outerDividerLevels\(handled\)/);
  assert.match(machine, /className="reel-outer-light"/);
  assert.match(machine, /data-edge="left"/);
  assert.match(machine, /data-edge="right"/);
});

test("all four divider lights rise softly and ease out longer", () => {
  assert.equal(DIVIDER_FADE_IN_MS, 250);
  assert.equal(DIVIDER_FADE_OUT_MS, 600);
  assert.match(css, new RegExp(`--divider-fade-in:\\s*${DIVIDER_FADE_IN_MS}ms`));
  assert.match(css, new RegExp(`--divider-fade-out:\\s*${DIVIDER_FADE_OUT_MS}ms`));
  const outer = css.match(/\.reel-outer-light\s*\{([^}]*)\}/)?.[1] ?? "";
  const seam = css.match(/\.reel-column \+ \.reel-column::after\s*\{([^}]*)\}/)?.[1] ?? "";
  const fadeOut = /transition:\s*opacity var\(--divider-fade-out\) ease-out/;
  const fadeIn = /transition:\s*opacity var\(--divider-fade-in\) cubic-bezier\(0\.33, 0, 0\.2, 1\)/;
  assert.match(outer, fadeOut);
  assert.match(seam, fadeOut);
  const outerBright = css.match(/\.reel-outer-light\[data-lit="bright"\]\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(outerBright, fadeIn);
  const innerBright = css.match(/\.reel-grid\[data-divider-left="bright"\][\s\S]*?\{([^}]*)\}/)?.[1] ?? "";
  assert.match(innerBright, fadeIn);
  assert.equal(css.includes("transition: opacity 280ms ease"), false);
  assert.equal(/@keyframes[^}]*divider/.test(css), false);
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
