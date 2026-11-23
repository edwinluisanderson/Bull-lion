import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { DRUM_RIM, DRUM_WINDOW, HOUSING_GAP, REST_FACE_EDGE, drumSkin } from "@/lib/drum-housing";
import { DIVIDER_BRIGHT, DIVIDER_DIM } from "@/lib/reel-dividers";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("the rest drum leaves a 15px housing gap", () => {
  assert.equal(DRUM_RIM, REST_FACE_EDGE - HOUSING_GAP);
  assert.equal(DRUM_RIM, 5.710493);
  const skin = drumSkin(0);
  assert.equal(skin.top, HOUSING_GAP);
  assert.equal(skin.bottom, DRUM_WINDOW - HOUSING_GAP);
  assert.equal(skin.height, DRUM_WINDOW - HOUSING_GAP * 2);
});

test("the body follows the faces and stays inside the window", () => {
  const moving = drumSkin(0.35);
  assert.ok(moving.top < HOUSING_GAP || DRUM_WINDOW - moving.bottom < HOUSING_GAP);
  for (let step = 0; step <= 40; step += 1) {
    const skin = drumSkin(step / 40);
    assert.ok(skin.top >= 0 && skin.bottom <= DRUM_WINDOW);
    assert.ok(skin.top <= HOUSING_GAP + 1e-6, `top opened to ${skin.top}`);
    assert.ok(DRUM_WINDOW - skin.bottom <= HOUSING_GAP + 1e-6, `bottom opened to ${DRUM_WINDOW - skin.bottom}`);
    assert.ok(skin.height > 0);
  }
  assert.equal(DRUM_RIM, REST_FACE_EDGE - HOUSING_GAP);
});

test("the housing is symmetric bronze and the seam matches the rest drum", () => {
  const stage = css.match(/\.reel-stage\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(stage, /linear-gradient\(180deg, rgba\(0, 0, 0, 0\.38\) 0%, transparent 26%, transparent 74%, rgba\(0, 0, 0, 0\.38\) 100%\)/);
  assert.match(stage, /linear-gradient\(90deg, #2a1a0e 0%, #4a301c 30%, #6a4a28 50%, #4a301c 70%, #2a1a0e 100%\)/);
  assert.match(stage, /#3a2616/);
  const lip = css.match(/\.reel-stage::after\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(lip, /inset 0 1px 0 rgba\(255, 226, 170, 0\.08\)/);
  assert.match(lip, /inset 0 -1px 0 rgba\(255, 226, 170, 0\.08\)/);
  assert.match(lip, /inset 0 7px 8px -2px rgba\(0, 0, 0, 0\.5\)/);
  assert.match(lip, /inset 0 -7px 8px -2px rgba\(0, 0, 0, 0\.5\)/);
  const drum = css.match(/\.reel-drum\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(drum, /border-radius:\s*0/);
  assert.match(drum, /0 -1px 0 rgba\(255, 226, 170, 0\.28\)/);
  assert.match(drum, /0 1px 0 rgba\(0, 0, 0, 0\.75\)/);
  assert.match(drum, /inset 0 3px 4px rgba\(0, 0, 0, 0\.55\)/);
  assert.match(drum, /inset 0 -3px 4px rgba\(0, 0, 0, 0\.55\)/);
  const seam = css.match(/\.reel-column \+ \.reel-column::after\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(seam, /top:\s*calc\(var\(--reel-name\) \+ 15px\)/);
  assert.match(seam, /height:\s*calc\(var\(--reel-window\) - 30px\)/);
  assert.match(seam, /width:\s*1px/);
  assert.match(seam, /background:\s*#f0d78c/);
  assert.match(seam, new RegExp(`opacity:\\s*${DIVIDER_DIM}`));
  assert.equal(DIVIDER_BRIGHT, 1);
  assert.equal(DIVIDER_DIM, 0.8);
  const shade = css.match(/\.reel-drum-shade\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(shade, /z-index:\s*3/);
  assert.match(shade, /pointer-events:\s*none/);
  assert.match(shade, /border-radius:\s*0/);
  assert.match(shade, /rgba\(0,0,0,0\.72\) 0%.*rgba\(0,0,0,0\) 20%.*rgba\(0,0,0,0\) 75%.*rgba\(0,0,0,0\.85\) 100%/);
  assert.equal(Number(seam.match(/z-index:\s*(\d+)/)?.[1]) > 3, true);
});
