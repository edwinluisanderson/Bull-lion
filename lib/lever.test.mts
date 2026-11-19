import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  LEVER_OVERSHOOT,
  LEVER_PULL_MS,
  LEVER_RETURN_MS,
  ROLL_MAX_DEG,
  armPose,
  legendRoll,
  leverReturnCurve,
  ratchetTooth,
} from "@/lib/lever-motion";
import {
  PULL_SPHERE_RADIUS,
  PULL_VIEW_CENTER,
  PULL_WORD_PATH,
  PULL_WORD_WEIGHT,
  projectPullPoint,
  pullLongitudeScale,
} from "@/lib/pull-word";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const lever = readFileSync(new URL("../components/lever.tsx", import.meta.url), "utf8");

test("a real drag launches at stage C and release does not launch again", () => {
  assert.equal(LEVER_PULL_MS, 420);
  assert.equal(LEVER_RETURN_MS, 520);
  assert.match(lever, /if \(stage === "c" && dragged\.current\) commitSpin\(\)/);
  assert.match(lever, /function commitSpin\(\) \{\s*if \(committed\.current\) return;/);
  assert.match(lever, /if \(travelRef\.current > 0\) glideHome\(committed\.current\)/);
  assert.equal(lever.includes("pointerPullCommits"), false);
  assert.equal(lever.includes("onClick"), false);
  assert.equal(lever.includes("leverClunk"), false);
  assert.equal(lever.includes("LEVER_CLUNK"), false);
  assert.equal(lever.includes("is-clunk"), false);
  const release = lever.slice(lever.indexOf("const onUp"), lever.indexOf("window.addEventListener(\"pointermove\""));
  assert.equal(release.includes("commitSpin"), false);
  assert.equal(release.includes("leverRelease"), false);
  assert.match(lever, /onKeyDown=\{[\s\S]*?fullPull\(\)/);
  const keyboard = lever.slice(lever.indexOf("function fullPull"), lever.indexOf("const drop"));
  assert.match(keyboard, /commitSpin\(\)/);
  assert.match(keyboard, /dragged\.current = false/);
});

test("the release thunk plays once inside the commit, not on the way home", () => {
  const sound = readFileSync(new URL("../lib/lever-sound.ts", import.meta.url), "utf8");
  assert.match(lever, /function commitSpin\(\) \{[\s\S]*?leverRelease\(\);[\s\S]*?onCommit\(\)/);
  assert.equal(lever.split("leverRelease()").length - 1, 1);
  assert.equal(lever.includes("leverClunk"), false);
  assert.match(sound, /export function leverRelease\(\)/);
  assert.match(sound, /RELEASE_START_HZ = 140/);
  assert.match(sound, /RELEASE_END_HZ = 70/);
  assert.match(sound, /RELEASE_SWEEP_S = 0\.06/);
  assert.match(sound, /RELEASE_GAIN = 0\.18/);
  assert.match(sound, /RELEASE_DECAY_S = 0\.09/);
  assert.match(sound, /RELEASE_FLOOR = 0\.001/);
  assert.match(sound, /RELEASE_NOISE_HZ = 800/);
  assert.match(sound, /RELEASE_NOISE_S = 0\.015/);
  assert.match(sound, /RELEASE_NOISE_GAIN = 0\.06/);
  assert.match(sound, /osc\.connect\(tone\)\.connect\(ctx\.destination\)/);
  assert.match(sound, /tap\.connect\(low\)\.connect\(tapGain\)\.connect\(ctx\.destination\)/);
  assert.equal(sound.includes("flapSum"), false);
  assert.equal(sound.includes("leverClunk"), false);
});

test("the return overshoots once and stops cleanly at rest", () => {
  assert.equal(leverReturnCurve(0), 1);
  assert.equal(leverReturnCurve(1), 0);
  let lowest = 1;
  let crossings = 0;
  let previous = leverReturnCurve(0);
  for (let i = 1; i <= 200; i += 1) {
    const value = leverReturnCurve(i / 200);
    lowest = Math.min(lowest, value);
    if (Math.sign(value) !== Math.sign(previous) && value !== 0) crossings += 1;
    previous = value;
  }
  assert.ok(Math.abs(lowest + LEVER_OVERSHOOT) < 1e-3);
  assert.equal(crossings, 1);
  assert.equal(css.includes("wobble"), false);
});

test("the arm foreshortens through the hub instead of vanishing", () => {
  assert.equal(armPose(150, 0).scaleY, 1);
  assert.equal(armPose(150, 150).scaleY, 0);
  assert.ok(armPose(150, 270).scaleY < 0);
  assert.equal(armPose(150, 150).toward, 1);
});

test("the legend rolls down the ball with the pull", () => {
  const rest = legendRoll(0);
  assert.equal(rest.shift, 0);
  assert.equal(rest.scaleY, 1);
  assert.equal(rest.opacity, 1);
  const bottom = legendRoll(1);
  assert.ok(Math.abs(bottom.phi - (ROLL_MAX_DEG * Math.PI) / 180) < 1e-9);
  assert.ok(bottom.shift > 45 && bottom.shift < 46);
  assert.ok(bottom.scaleY > 0.17 && bottom.scaleY < 0.18);
  assert.ok(legendRoll(-LEVER_OVERSHOOT).shift < 0);
  assert.match(lever, /clipPath="url\(#pull-legend-clip\)"/);
});

test("ratchet teeth stop before the kicker and a full travel has no lever clunk", () => {
  assert.equal(ratchetTooth(0), 0);
  assert.equal(ratchetTooth(0.74), 7);
  assert.equal(ratchetTooth(1), 7);
  assert.equal(lever.includes("leverClunk"), false);
  assert.equal(css.includes("pull-ball-clunk"), false);
  assert.equal(css.includes("pull-drum-jolt"), false);
});

test("the lever stays in the 48px column above the cabinet ring", () => {
  assert.match(css, /\.pull-handle \{[^}]*width:\s*48px/);
  assert.match(css, /\.pull-handle \{[^}]*z-index:\s*8/);
  assert.match(css, /\.pull-drum \{[^}]*width:\s*24px/);
  assert.match(css, /\.pull-arm \{[^}]*width:\s*14px/);
  assert.match(css, /\.pull-ball \{[^}]*z-index:\s*2;/);
  assert.match(css, /\.pull-ball \{[^}]*#2ee0cf/);
});

test("the pull word is bold, centered, and projected on the sphere", () => {
  assert.equal(PULL_WORD_WEIGHT, 700);
  const front = projectPullPoint(0, 0);
  assert.equal(front.x, PULL_VIEW_CENTER);
  assert.equal(front.y, PULL_VIEW_CENTER);
  const equator = projectPullPoint(0.4, 0);
  assert.ok(Math.abs(equator.x - (PULL_VIEW_CENTER + PULL_SPHERE_RADIUS * Math.sin(0.4))) < 1e-9);
  assert.ok(pullLongitudeScale(0.8) < pullLongitudeScale(0));
  const nums = [...PULL_WORD_PATH.matchAll(/-?\d+\.\d+/g)].map((match) => Number(match[0]));
  let minX = Infinity;
  let maxX = -Infinity;
  for (let i = 0; i < nums.length; i += 2) {
    minX = Math.min(minX, nums[i] ?? 0);
    maxX = Math.max(maxX, nums[i] ?? 0);
  }
  assert.ok(Math.abs((minX + maxX) / 2 - PULL_VIEW_CENTER) < 1.5);
  assert.match(lever, /PULL_WORD_PATH/);
  assert.match(lever, /fillRule="nonzero"/);
});
