import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { PULL_BALL_INK, PULL_BAR_WIDTH_RATIO, pullBarSpan } from "@/lib/pull-bar";
import {
  PULL_SPHERE_RADIUS,
  PULL_VIEW_CENTER,
  PULL_WORD_EDGE_OPACITY,
  PULL_WORD_PATH,
  PULL_WORD_WEIGHT,
  projectPullPoint,
  pullLongitudeScale,
} from "@/lib/pull-word";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const lever = readFileSync(new URL("../components/lever.tsx", import.meta.url), "utf8");

test("the bar runs from the ball center to the wheel midline", () => {
  const rest = pullBarSpan(180, 0);
  assert.equal(rest.end, "down");
  assert.equal(rest.length, 180);

  const midline = pullBarSpan(180, 180);
  assert.equal(midline.end, "none");
  assert.equal(midline.length, 0);

  const past = pullBarSpan(180, 240);
  assert.equal(past.end, "up");
  assert.equal(past.length, 60);

  const threeQuarter = pullBarSpan(180, 270);
  assert.equal(threeQuarter.end, "up");
  assert.ok(threeQuarter.length > 0);
});

test("the bar is a round silver shaft behind the ball", () => {
  assert.ok(PULL_BAR_WIDTH_RATIO >= 0.25 && PULL_BAR_WIDTH_RATIO <= 1 / 3);
  assert.equal(PULL_BAR_WIDTH_RATIO, 0.33);
  assert.match(css, /\.pull-bar \{[^}]*width:\s*33%/);
  assert.match(css, /\.pull-bar \{[^}]*z-index:\s*1;/);
  assert.match(css, /\.pull-ball \{[^}]*z-index:\s*2;/);
  assert.match(css, /\.pull-bar \{[^}]*linear-gradient\(90deg/);
  const bar = lever.indexOf('className="pull-bar"');
  const ball = lever.indexOf('className={`pull-ball');
  assert.ok(bar > 0 && ball > bar);
});

test("the pull label uses the plate title ink", () => {
  assert.equal(PULL_BALL_INK, "#3a2710");
  assert.match(css, /\.plate-title \{[^}]*color:\s*#3a2710;/);
  assert.match(css, new RegExp(`\\.pull-ball \\{[^}]*color:\\s*${PULL_BALL_INK};`));
  assert.match(lever, /stopColor=\{PULL_BALL_INK\}/);
});

test("the pull word is bold, centered, and projected on the sphere", () => {
  assert.equal(PULL_WORD_WEIGHT, 700);
  assert.ok(PULL_WORD_EDGE_OPACITY < 1 && PULL_WORD_EDGE_OPACITY > 0.4);
  const front = projectPullPoint(0, 0);
  assert.equal(front.x, PULL_VIEW_CENTER);
  assert.equal(front.y, PULL_VIEW_CENTER);
  const equator = projectPullPoint(0.4, 0);
  assert.ok(Math.abs(equator.x - (PULL_VIEW_CENTER + PULL_SPHERE_RADIUS * Math.sin(0.4))) < 1e-9);
  assert.equal(equator.y, PULL_VIEW_CENTER);
  const raised = projectPullPoint(0.4, 0.25);
  assert.ok(Math.abs(raised.x - (PULL_VIEW_CENTER + PULL_SPHERE_RADIUS * Math.sin(0.4) * Math.cos(0.25))) < 1e-9);
  assert.ok(Math.abs(raised.y - (PULL_VIEW_CENTER - PULL_SPHERE_RADIUS * Math.sin(0.25))) < 1e-9);
  const step = 0.04;
  const centerStep = projectPullPoint(step, 0).x - projectPullPoint(0, 0).x;
  const limbStep = projectPullPoint(0.8, 0).x - projectPullPoint(0.8 - step, 0).x;
  assert.ok(limbStep < centerStep * 0.85);
  assert.ok(pullLongitudeScale(0.8) < pullLongitudeScale(0));
  const nums = [...PULL_WORD_PATH.matchAll(/-?\d+\.\d+/g)].map((match) => Number(match[0]));
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < nums.length; i += 2) {
    const x = nums[i] ?? 0;
    const y = nums[i + 1] ?? 0;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  assert.ok(Math.abs((minX + maxX) / 2 - PULL_VIEW_CENTER) < 1.5);
  assert.ok(Math.abs((minY + maxY) / 2 - PULL_VIEW_CENTER) < 1.5);
  assert.ok((PULL_WORD_PATH.match(/L/g) ?? []).length > 800);
  assert.equal(lever.includes("rotate("), false);
  assert.match(lever, /PULL_WORD_PATH/);
  assert.match(lever, /fillRule="nonzero"/);
});
