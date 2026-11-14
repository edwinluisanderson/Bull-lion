import assert from "node:assert/strict";
import test from "node:test";

import { STRETCH_POP_FRACTIONS, stretchPopCount } from "@/lib/stretch-pops";
import { activeStretchRim, stretchRim } from "@/lib/stretch";

const HEIGHT = 86;

test("the stretch rim sits on the edge the next count leaves", () => {
  assert.equal(stretchRim("down", 0, HEIGHT).edge, "bottom");
  assert.equal(stretchRim("up", 10, HEIGHT).edge, "top");
});

test("the stretch rim fades as the incoming count is revealed", () => {
  assert.equal(stretchRim("down", 0, HEIGHT).opacity, 1);
  const halfway = stretchRim("down", HEIGHT / 2, HEIGHT).opacity;
  assert.ok(halfway < 0.6 && halfway > 0.4);
  assert.equal(stretchRim("down", HEIGHT, HEIGHT).opacity, 0);
  assert.ok(stretchRim("up", HEIGHT + 1, HEIGHT).opacity > 0.95);
});

test("the stretch rim is gone once the gesture is released", () => {
  assert.equal(activeStretchRim(false, "down", HEIGHT / 2, HEIGHT), null);
  assert.equal(activeStretchRim(true, "down", HEIGHT / 2, HEIGHT)?.edge, "bottom");
});

test("stretch pops keep their original timing", () => {
  assert.deepEqual(STRETCH_POP_FRACTIONS, [0.25, 0.5, 0.75, 1]);
  assert.equal(stretchPopCount(HEIGHT * 0.25, HEIGHT, 3), 1);
  assert.equal(stretchPopCount(HEIGHT, HEIGHT, 3), 4);
  assert.equal(stretchPopCount(HEIGHT, HEIGHT, 0), 0);
});
