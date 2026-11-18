import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { DELETE_AHOOGA_EVERY_MS, DELETE_LINGER_MS, deleteAlarmAllowed, deleteAlarmDue } from "@/lib/delete-alarm";

const alarm = readFileSync(new URL("./delete-alarm.ts", import.meta.url), "utf8");
const card = readFileSync(new URL("../components/swipe-card.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const credits = readFileSync(new URL("../public/sounds/flap-credits.txt", import.meta.url), "utf8");

test("the ahooga waits a few seconds and stays quiet when the page or the sound is off", () => {
  assert.equal(DELETE_AHOOGA_EVERY_MS, 4500);
  assert.equal(deleteAlarmDue(Number.NaN, 1000), true);
  assert.equal(deleteAlarmDue(0, 4499), false);
  assert.equal(deleteAlarmDue(0, 4500), true);
  assert.equal(deleteAlarmAllowed("visible", true), true);
  assert.equal(deleteAlarmAllowed("hidden", true), false);
  assert.equal(deleteAlarmAllowed("visible", false), false);
  assert.match(alarm, /visibilityState/);
  assert.match(alarm, /spinSoundEnabled\(\)/);
  assert.match(alarm, /\/sounds\/delete-ahooga\.mp3/);
  assert.match(alarm, /craigsmith\/sounds\/480002/);
  assert.match(credits, /https:\/\/freesound\.org\/people\/craigsmith\/sounds\/480002\//);
  assert.match(credits, /CC0 1\.0/);
  assert.equal(existsSync(new URL("../public/sounds/delete-ahooga.mp3", import.meta.url)), true);
  assert.equal(existsSync(new URL("../public/sounds/delete-ahooga.mp3.b64", import.meta.url)), false);
});

test("a locked card spins amber lamps, glows, and a tap shoots the card off", () => {
  assert.match(card, /data-alarm=\{alarm\}/);
  assert.match(card, /delete-amber-rotor/);
  assert.match(card, /delete-alarm-glow/);
  assert.match(card, /createPortal/);
  assert.match(card, /playDeleteAhooga/);
  assert.match(card, /stopDeleteAhooga/);
  assert.match(card, /DELETE_LINGER_MS/);
  assert.equal(DELETE_LINGER_MS > 280, true);
  assert.equal(card.includes('end === "delete"'), false);
  assert.match(css, /\.delete-amber-rotor \{[^}]*conic-gradient\(/);
  assert.match(css, /\.stack-swipe\[data-alarm="open"\] \.delete-amber-rotor \{[^}]*lighthouse-sweep/);
  assert.match(css, /\.stack-swipe\[data-alarm="drag"\] \.delete-amber-rotor \{[^}]*animation:\s*none/);
  assert.match(css, /\.stack-swipe\[data-alarm="drag"\] \.stack-swipe-push \{[^}]*brightness\(0\.42\)/);
  assert.match(css, /\.delete-alarm-glow \{[^}]*pointer-events:\s*none/);
  assert.match(css, /\.delete-alarm-glow \{[^}]*position:\s*fixed/);
  assert.match(css, /\.stack-swipe\.is-departing \.stack-swipe-face \{[^}]*translateX\(120vw\)/);
  assert.match(css, /\.stack-swipe\.is-departing \.stack-swipe-delete \{[^}]*delete-linger/);
  const reduced = css
    .split("@media (prefers-reduced-motion: reduce)")
    .slice(1)
    .find((part) => part.includes(".delete-amber-rotor"));
  assert.ok(reduced);
  assert.match(reduced ?? "", /\.delete-amber-rotor,\s*\.delete-alarm-glow \{[^}]*animation:\s*none/);
});
