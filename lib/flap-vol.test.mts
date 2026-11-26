import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { FLAP_GAIN, FLAP_SAMPLE_GAIN, FLAP_VOLUME, flapTickGain } from "@/lib/flap-sound";

const sound = readFileSync(new URL("./flap-sound.ts", import.meta.url), "utf8");

test("the flap tick stays at half the previous default", () => {
  assert.equal(FLAP_VOLUME, 0.5);
  assert.equal(flapTickGain(1), 0.5);
  assert.equal(flapTickGain(FLAP_SAMPLE_GAIN), FLAP_SAMPLE_GAIN * 0.5);
  assert.equal(flapTickGain(FLAP_GAIN), FLAP_GAIN * 0.5);
  assert.equal(flapTickGain(FLAP_GAIN), 0.041);
  assert.match(sound, /gain\.gain\.value = flapTickGain\(FLAP_SAMPLE_GAIN\)/);
  assert.match(sound, /gain\.gain\.value = flapTickGain\(FLAP_GAIN\)/);
});

test("the page URL no longer changes the flap tick", () => {
  assert.equal(sound.includes("flapvol"), false);
  assert.equal(sound.includes("location.search"), false);
  assert.equal(sound.includes("URLSearchParams"), false);
  const swipe = sound.slice(sound.indexOf("export function playSwipeTone"), sound.indexOf("export function playFlapSound"));
  assert.equal(swipe.includes("flapTickGain"), false);
  assert.equal(flapTickGain(FLAP_SAMPLE_GAIN), FLAP_SAMPLE_GAIN * 0.5);
  assert.equal(flapTickGain(FLAP_GAIN), 0.041);
});
