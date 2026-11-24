import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  FLAP_GAIN,
  FLAP_SAMPLE_GAIN,
  FLAP_VOL_MAX,
  FLAP_VOL_MIN,
  flapTickGain,
  flapVolumeFromSearch,
  parseFlapVolume,
} from "@/lib/flap-sound";

const sound = readFileSync(new URL("./flap-sound.ts", import.meta.url), "utf8");

test("flapvol parses a multiplier and ignores junk", () => {
  assert.equal(FLAP_VOL_MIN, 0);
  assert.equal(FLAP_VOL_MAX, 2);
  assert.equal(parseFlapVolume("0.25"), 0.25);
  assert.equal(parseFlapVolume("0.5"), 0.5);
  assert.equal(parseFlapVolume("0.75"), 0.75);
  assert.equal(parseFlapVolume("1"), 1);
  assert.equal(parseFlapVolume("1.0"), 1);
  assert.equal(parseFlapVolume("2"), 2);
  assert.equal(parseFlapVolume("0"), 0);
  assert.equal(parseFlapVolume("3"), 2);
  assert.equal(parseFlapVolume("-1"), 0);
  assert.equal(parseFlapVolume(" 0.5 "), 0.5);
  assert.equal(parseFlapVolume("nope"), null);
  assert.equal(parseFlapVolume(""), null);
  assert.equal(parseFlapVolume(null), null);
  assert.equal(parseFlapVolume("Infinity"), null);

  assert.equal(flapVolumeFromSearch(""), 1);
  assert.equal(flapVolumeFromSearch("?lamps=compare"), 1);
  assert.equal(flapVolumeFromSearch("?flapvol=0.5"), 0.5);
  assert.equal(flapVolumeFromSearch("flapvol=0.25&x=1"), 0.25);
  assert.equal(flapVolumeFromSearch("?flapvol=nope"), 1);
  assert.equal(flapVolumeFromSearch("?flapvol=4"), 2);
  assert.equal(flapTickGain(FLAP_SAMPLE_GAIN, 1), FLAP_SAMPLE_GAIN);
  assert.equal(flapTickGain(FLAP_SAMPLE_GAIN, 0.5), FLAP_SAMPLE_GAIN * 0.5);
  assert.equal(flapTickGain(FLAP_GAIN, 0.25), FLAP_GAIN * 0.25);
});

test("the flap tick is the only sound that reads flapvol", () => {
  assert.match(sound, /gain\.gain\.value = flapTickGain\(FLAP_SAMPLE_GAIN\)/);
  assert.match(sound, /gain\.gain\.value = flapTickGain\(FLAP_GAIN\)/);
  const swipe = sound.slice(sound.indexOf("export function playSwipeTone"), sound.indexOf("export function playFlapSound"));
  assert.equal(swipe.includes("flapTickGain"), false);
  assert.equal(swipe.includes("flapvol"), false);
});
