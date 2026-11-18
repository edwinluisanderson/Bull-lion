import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  FLAP_CLICK_WINDOW_RMS,
  FLAP_CLIP_URLS,
  FLAP_FILE_WINDOW_RMS,
  FLAP_LEVEL_DB,
  FLAP_PITCH_SPREAD,
  FLAP_SAMPLE_GAIN,
  flapPlaybackRate,
  matchedFlapGain,
  pickFlapClip,
} from "@/lib/flap-sound";
import { REEL_CLICK_GAIN } from "@/lib/reel-click";

const sound = readFileSync(new URL("./flap-sound.ts", import.meta.url), "utf8");
const credits = readFileSync(new URL("../public/sounds/flap-credits.txt", import.meta.url), "utf8");

test("recorded flap clips sit about 1 dB under the wheel stop", () => {
  assert.equal(FLAP_CLIP_URLS.length, 6);
  assert.equal(FLAP_LEVEL_DB, -1);
  assert.equal(FLAP_PITCH_SPREAD, 0.05);
  const gain = matchedFlapGain();
  assert.equal(FLAP_SAMPLE_GAIN, gain);
  const click = FLAP_CLICK_WINDOW_RMS * REEL_CLICK_GAIN;
  const flap = FLAP_FILE_WINDOW_RMS * FLAP_SAMPLE_GAIN;
  const db = 20 * Math.log10(flap / click);
  assert.ok(Math.abs(db - FLAP_LEVEL_DB) < 1e-9);
  assert.match(credits, /https:\/\/freesound\.org\/people\/ngruber\/sounds\/261244\//);
  assert.match(credits, /CC0 1\.0/);
  assert.match(sound, /playbackRate/);
  assert.match(sound, /clickBuffer\(ctx\)/);
  assert.match(sound, /unlockFlapSamples/);
});

test("flap clips do not repeat and the pitch stays inside ±5%", () => {
  const rolls = [0.1, 0.9, 0.4];
  let cursor = 0;
  const random = () => rolls[cursor++] ?? 0;
  assert.equal(pickFlapClip(6, null, random), 0);
  assert.equal(pickFlapClip(6, 0, random), 5);
  assert.notEqual(pickFlapClip(6, 5, random), 5);
  assert.equal(flapPlaybackRate(() => 0), 1 - FLAP_PITCH_SPREAD);
  assert.equal(flapPlaybackRate(() => 1), 1 + FLAP_PITCH_SPREAD);
  assert.equal(flapPlaybackRate(() => 0.5), 1);
});
