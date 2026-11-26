import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { DELETE_AHOOGA_EVERY_MS, DELETE_BREATH_MS, breathDelayMs, breathPeakOffsetMs, deleteAlarmAllowed, deleteAlarmDue } from "@/lib/delete-alarm";

const alarm = readFileSync(new URL("./delete-alarm.ts", import.meta.url), "utf8");
const card = readFileSync(new URL("../components/swipe-card.tsx", import.meta.url), "utf8");
const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const credits = readFileSync(new URL("../public/sounds/flap-credits.txt", import.meta.url), "utf8");

test("the ahooga waits a few seconds and stays quiet when the page or the sound is off", () => {
  assert.equal(DELETE_AHOOGA_EVERY_MS, 4500);
  assert.equal(DELETE_BREATH_MS * 2, DELETE_AHOOGA_EVERY_MS);
  assert.equal(breathDelayMs(10_000, 10_000), -DELETE_BREATH_MS / 2);
  const start = 10_000;
  for (let blast = 0; blast < 7; blast += 1) {
    const at = start + blast * DELETE_AHOOGA_EVERY_MS;
    assert.equal(breathPeakOffsetMs(start, at), 0, `blast ${blast}`);
  }
  assert.equal(breathPeakOffsetMs(start, start + DELETE_BREATH_MS), 0);
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
  assert.match(card, /saved for settings tray/);
  assert.equal(card.includes('className="delete-beam"'), false);
  assert.match(card, /delete-screen-glow/);
  assert.match(card, /delete-filament/);
  assert.match(card, /createPortal/);
  assert.match(card, /--glow-r/);
  assert.match(css, /\.delete-screen-glow \{[^}]*mask-image:[^;]*var\(--glow-r/);
  assert.match(card, /breathDelayMs/);
  assert.match(card, /--breath-delay/);
  assert.match(card, /anim.startTime = startedAt/);
  assert.equal(card.includes("delete-alarm-glow"), false);
  assert.match(card, /playDeleteAhooga/);
  assert.match(card, /stopDeleteAhooga/);
  assert.equal(card.includes("DELETE_LINGER_MS"), false);
  assert.match(card, /onDepart\(\)/);
  assert.equal(card.includes('end === "delete"'), false);
  assert.match(card, /unlockAppAudio/);
  assert.match(machine, /preloadAppSounds\(\)/);
  assert.match(machine, /installAppAudioUnlock\(\)/);
  assert.match(alarm, /export function loadDeleteAhooga/);
  assert.match(css, /saved for settings tray/);
  assert.match(css, /\.delete-beam \{[^}]*width:\s*calc\(880px \* var\(--del-k\)\)/);
  assert.match(css, /\.delete-beam \{[^}]*height:\s*calc\(880px \* var\(--del-k\)\)/);
  assert.match(css, /\.delete-beam \{[^}]*conic-gradient\(/);
  assert.match(css, /\.delete-beam \{[^}]*mask-image:\s*radial-gradient\(circle, transparent 0 2\.3%/);
  assert.match(css, /\.delete-beam \{[^}]*pointer-events:\s*none/);
  assert.match(css, /\.delete-beam \{[^}]*opacity:\s*0/);
  assert.match(css, /\.delete-beam \{[^}]*visibility:\s*hidden/);
  assert.match(css, /\.stack-swipe\[data-alarm="drag"\] \.delete-beam \{[^}]*opacity:\s*0/);
  assert.match(css, /saved for settings tray[\s\S]*lighthouse-sweep 5s linear infinite/);
  assert.match(css, /\.stack-swipe\[data-alarm="open"\] \.stack-swipe-push \{[^}]*#fff6f6/);
  assert.match(css, /\.stack-swipe\[data-alarm="drag"\] \.delete-beam \{[^}]*animation:\s*none/);
  assert.equal(css.includes("brightness(0.42)"), false);
  assert.match(css, /\.stack-swipe-push \{[^}]*rgba\(92, 14, 14/);
  assert.match(css, /\.stack-swipe\[data-alarm="open"\] \.stack-swipe-push \{[^}]*#fff6f6/);
  assert.match(css, /\.stack-swipe-push \{[^}]*transition:[^}]*background/);
  assert.match(css, /\.stack-swipe-delete \{[^}]*z-index:\s*0/);
  assert.match(css, /\.stack-swipe-face \{[^}]*z-index:\s*2/);
  assert.match(css, /\.delete-screen-glow \{[^}]*pointer-events:\s*none/);
  assert.match(css, /\.delete-screen-glow \{[^}]*position:\s*fixed/);
  assert.match(css, /\.delete-screen-glow \{[^}]*var\(--glow-x\) var\(--glow-y\)/);
  assert.match(css, /\.delete-screen-glow \{[^}]*rgba\(255, 48, 40/);
  assert.match(css, /\.delete-screen-glow \{[^}]*var\(--breath-ms, 2\.25s\)/);
  assert.match(css, /\.delete-screen-glow \{[^}]*var\(--breath-delay, -1\.125s\)/);
  assert.match(css, /@keyframes delete-alarm-breath \{[^]*opacity:\s*0\.35/);
  assert.match(css, /\.delete-filament \{[^}]*calc\(24px \* var\(--del-k\)\)/);
  assert.match(css, /\.delete-filament \{[^}]*calc\(11px \* var\(--del-k\)\)/);
  assert.match(css, /\.stack-swipe\[data-alarm="open"\] \.delete-filament \{[^}]*#fff4c8/);
  assert.match(css, /\.stack-swipe\[data-alarm="open"\] \.delete-bulb-core,/);
  assert.equal(css.includes(".delete-alarm-glow"), false);
  assert.match(css, /\.stack-swipe\.is-departing \.stack-swipe-face \{[^}]*translateX\(120vw\)/);
  assert.equal(css.includes("delete-linger"), false);
  const reduced = css
    .split("@media (prefers-reduced-motion: reduce)")
    .slice(1)
    .find((part) => part.includes(".delete-beam"));
  assert.ok(reduced);
  assert.match(reduced ?? "", /\.stack-swipe\[data-alarm="open"\] \.delete-beam,[\s\S]*animation:\s*none/);
});
