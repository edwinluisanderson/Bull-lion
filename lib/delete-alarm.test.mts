import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { DELETE_AHOOGA_EVERY_MS, deleteAlarmAllowed, deleteAlarmDue } from "@/lib/delete-alarm";

const alarm = readFileSync(new URL("./delete-alarm.ts", import.meta.url), "utf8");
const card = readFileSync(new URL("../components/swipe-card.tsx", import.meta.url), "utf8");
const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");
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
  assert.match(card, /delete-beam/);
  assert.match(card, /delete-alarm-glow/);
  assert.equal(card.includes("createPortal"), false);
  assert.match(card, /playDeleteAhooga/);
  assert.match(card, /stopDeleteAhooga/);
  assert.equal(card.includes("DELETE_LINGER_MS"), false);
  assert.match(card, /onDepart\(\)/);
  assert.equal(card.includes('end === "delete"'), false);
  assert.match(card, /unlockAppAudio/);
  assert.match(machine, /preloadAppSounds\(\)/);
  assert.match(machine, /installAppAudioUnlock\(\)/);
  assert.match(alarm, /export function loadDeleteAhooga/);
  assert.match(css, /\.delete-beam \{[^}]*width:\s*880px/);
  assert.match(css, /\.delete-beam \{[^}]*height:\s*880px/);
  assert.match(css, /\.delete-beam \{[^}]*conic-gradient\(/);
  assert.match(css, /\.delete-beam \{[^}]*mask-image:\s*radial-gradient\(circle, transparent 0 2\.3%/);
  assert.match(css, /\.delete-beam \{[^}]*pointer-events:\s*none/);
  assert.match(css, /\.delete-beam \{[^}]*opacity:\s*0/);
  assert.match(css, /\.delete-beam \{[^}]*visibility:\s*hidden/);
  assert.match(css, /\.stack-swipe\[data-alarm="drag"\] \.delete-beam \{[^}]*opacity:\s*0/);
  assert.match(css, /\.stack-swipe\[data-alarm="open"\] \.delete-beam \{[^}]*opacity:\s*1/);
  assert.match(css, /\.stack-swipe\[data-alarm="open"\] \.delete-beam \{[^}]*visibility:\s*visible/);
  assert.match(css, /\.stack-swipe\[data-alarm="open"\] \.delete-beam \{[^}]*lighthouse-sweep 5s linear infinite/);
  assert.match(css, /\.stack-swipe\[data-alarm="open"\] \.stack-swipe-push \{[^}]*#fff6f6/);
  assert.match(css, /\.stack-swipe\[data-alarm="drag"\] \.delete-beam \{[^}]*animation:\s*none/);
  assert.equal(css.includes("brightness(0.42)"), false);
  assert.match(css, /\.stack-swipe-push \{[^}]*rgba\(92, 14, 14/);
  assert.match(css, /\.stack-swipe\[data-alarm="open"\] \.stack-swipe-push \{[^}]*#fff6f6/);
  assert.match(css, /\.stack-swipe-push \{[^}]*transition:[^}]*background/);
  assert.match(css, /\.stack-swipe-delete \{[^}]*z-index:\s*0/);
  assert.match(css, /\.stack-swipe-face \{[^}]*z-index:\s*2/);
  assert.match(css, /\.delete-alarm-glow \{[^}]*pointer-events:\s*none/);
  assert.match(css, /\.delete-alarm-glow \{[^}]*position:\s*fixed/);
  assert.match(css, /\.delete-alarm-glow \{[^}]*z-index:\s*0/);
  assert.match(css, /\.stack-swipe\.is-departing \.stack-swipe-face \{[^}]*translateX\(120vw\)/);
  assert.equal(css.includes("delete-linger"), false);
  const reduced = css
    .split("@media (prefers-reduced-motion: reduce)")
    .slice(1)
    .find((part) => part.includes(".delete-beam"));
  assert.ok(reduced);
  assert.match(reduced ?? "", /\.stack-swipe\[data-alarm="open"\] \.delete-beam,[\s\S]*animation:\s*none/);
});
