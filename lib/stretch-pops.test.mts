import assert from "node:assert/strict";
import test from "node:test";

import { pickStretchPop, stretchPopCount } from "@/lib/stretch-pops";

const HEIGHT = 86;

test("a number pops at a quarter, half, three-quarters, and lock", () => {
  assert.equal(stretchPopCount(0, HEIGHT, 3), 0);
  assert.equal(stretchPopCount(HEIGHT * 0.24, HEIGHT, 3), 0);
  assert.equal(stretchPopCount(HEIGHT * 0.25, HEIGHT, 3), 1);
  assert.equal(stretchPopCount(HEIGHT * 0.5, HEIGHT, 3), 2);
  assert.equal(stretchPopCount(HEIGHT * 0.75, HEIGHT, 3), 3);
  assert.equal(stretchPopCount(HEIGHT, HEIGHT, 3), 4);
  assert.equal(stretchPopCount(HEIGHT * 1.25, HEIGHT, 3), 5);
  assert.equal(stretchPopCount(HEIGHT * 3, HEIGHT, 3), 12);
  assert.equal(stretchPopCount(HEIGHT * 9, HEIGHT, 3), 12);
});

test("adjacent stops and bad sizes pop nothing", () => {
  assert.equal(stretchPopCount(HEIGHT, HEIGHT, 0), 0);
  assert.equal(stretchPopCount(HEIGHT, 0, 4), 0);
  assert.equal(stretchPopCount(-10, HEIGHT, 4), 0);
});

test("stretch pops do not repeat the previous clip", () => {
  const rolls = [0, 0, 0.99, 0.5];
  let index = 0;
  const random = () => rolls[index++] ?? 0;
  assert.equal(pickStretchPop(6, null, random), 0);
  assert.equal(pickStretchPop(6, 0, random), 1);
  assert.equal(pickStretchPop(6, 0, random), 5);
  assert.equal(pickStretchPop(6, 2, random), 3);
  assert.equal(pickStretchPop(1, 0, () => 0), 0);
});
