import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { STRETCH_POP_FRACTIONS, stretchPopCount } from "@/lib/stretch-pops";
import { STRETCH_RIM_FLOOR, activeStretchRim, stretchRim } from "@/lib/stretch";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

const HEIGHT = 86;

test("the stretch glow is on at the floor when the press engages", () => {
  const engaged = activeStretchRim(true, null, 0, HEIGHT);
  assert.equal(engaged?.edge, "both");
  assert.equal(engaged?.opacity, STRETCH_RIM_FLOOR);
  assert.ok(STRETCH_RIM_FLOOR >= 0.35 && STRETCH_RIM_FLOOR <= 0.4);
  assert.equal(stretchRim("down", 0, HEIGHT).edge, "both");
  assert.equal(stretchRim("up", 0, HEIGHT).opacity, STRETCH_RIM_FLOOR);
});

test("the stretch glow brightens as a new count starts out", () => {
  const down = stretchRim("down", 1, HEIGHT);
  const up = stretchRim("up", 1, HEIGHT);
  assert.equal(down.edge, "bottom");
  assert.equal(up.edge, "top");
  assert.ok(down.opacity > 0.95);
  assert.ok(up.opacity > 0.95);
  assert.equal(activeStretchRim(true, "down", 1, HEIGHT)?.edge, "bottom");
  assert.equal(activeStretchRim(true, "up", 1, HEIGHT)?.edge, "top");
});

test("the stretch rim sits on the edge the next count leaves", () => {
  assert.equal(stretchRim("down", 10, HEIGHT).edge, "bottom");
  assert.equal(stretchRim("up", 10, HEIGHT).edge, "top");
});

test("the stretch glow pulses down to a floor and never goes out", () => {
  const halfway = stretchRim("down", HEIGHT / 2, HEIGHT).opacity;
  const full = stretchRim("down", HEIGHT, HEIGHT).opacity;
  assert.ok(halfway < 0.75 && halfway > STRETCH_RIM_FLOOR);
  assert.equal(full, STRETCH_RIM_FLOOR);
  assert.equal(activeStretchRim(true, "down", HEIGHT, HEIGHT)?.opacity, STRETCH_RIM_FLOOR);
  assert.ok(stretchRim("up", HEIGHT + 1, HEIGHT).opacity > 0.95);
  for (let travel = 0; travel <= HEIGHT * 3; travel += 1) {
    const opacity = stretchRim("down", travel, HEIGHT).opacity;
    assert.ok(opacity >= STRETCH_RIM_FLOOR, `travel ${travel}`);
  }
});

test("the stretch rim is gone once the gesture is released", () => {
  assert.equal(activeStretchRim(false, "down", HEIGHT / 2, HEIGHT), null);
  assert.equal(activeStretchRim(false, null, 0, HEIGHT), null);
  assert.equal(activeStretchRim(false, "up", 1, HEIGHT), null);
  assert.equal(activeStretchRim(true, "down", HEIGHT / 2, HEIGHT)?.edge, "bottom");
});

test("the stretch glow is royal blue and falls off the pin edge", () => {
  const rim = css.slice(css.indexOf(".stretch-rim {"), css.indexOf(".reel-nudge {"));
  assert.match(rim, /height:\s*96px/);
  assert.match(rim, /filter:\s*blur\(5px\)/);
  assert.match(rim, /mix-blend-mode:\s*screen/);
  assert.doesNotMatch(rim, /rgba\(198,\s*236,\s*255/);
  assert.match(rim, /\.stretch-rim\[data-edge="bottom"\][^}]*top:\s*calc\(100% - 8px\)/);
  assert.match(rim, /\.stretch-rim\[data-edge="top"\][^}]*bottom:\s*calc\(100% - 8px\)/);
  assert.match(rim, /radial-gradient\(92% 100% at 50% 0%[^;]*rgba\(47,\s*91,\s*255,\s*0\) 100%\)/);
  assert.match(rim, /radial-gradient\(92% 100% at 50% 100%[^;]*rgba\(47,\s*91,\s*255,\s*0\) 100%\)/);
});

test("stretch pops keep their original timing", () => {
  assert.deepEqual(STRETCH_POP_FRACTIONS, [0.25, 0.5, 0.75, 1]);
  assert.equal(stretchPopCount(HEIGHT * 0.25, HEIGHT, 3), 1);
  assert.equal(stretchPopCount(HEIGHT, HEIGHT, 3), 4);
  assert.equal(stretchPopCount(HEIGHT, HEIGHT, 0), 0);
});
