import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import { decodeSoundClip } from "@/lib/decode-clip";
import { FLAP_LEVEL_DB } from "@/lib/flap-sound";
import { APP_SOUND_URLS, preloadAppSounds } from "@/lib/sound-preload";

const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");
const card = readFileSync(new URL("../components/swipe-card.tsx", import.meta.url), "utf8");
const preload = readFileSync(new URL("./sound-preload.ts", import.meta.url), "utf8");

test("app open decodes every sound without touching the flap level", () => {
  const files = readdirSync(new URL("../public/sounds", import.meta.url))
    .filter((name) => name.endsWith(".mp3") || name.endsWith(".wav"))
    .map((name) => `/sounds/${name}`)
    .sort();
  assert.deepEqual([...APP_SOUND_URLS].sort(), files);
  assert.equal(APP_SOUND_URLS.length, 24);
  assert.equal(FLAP_LEVEL_DB, -11);
  assert.match(machine, /preloadAppSounds\(\)/);
  assert.match(machine, /installAppAudioUnlock\(\)/);
  assert.match(card, /unlockAppAudio\(\)/);
  assert.match(preload, /requestAnimationFrame\(start\)/);
  assert.match(preload, /pointerdown/);
  assert.match(preload, /ctx\.resume\(\)/);
  assert.equal(preload.includes("FLAP_LEVEL_DB"), false);
  preloadAppSounds();
});

test("a clip that fails to decode stays null and does not throw", async () => {
  const ctx = {
    decodeAudioData() {
      throw new Error("bad clip");
    },
  } as unknown as AudioContext;
  const original = globalThis.fetch;
  globalThis.fetch = (() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
  try {
    assert.equal(await decodeSoundClip(ctx, "/sounds/pawl-1.wav"), null);
    globalThis.fetch = (() =>
      Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      })) as unknown as typeof fetch;
    assert.equal(await decodeSoundClip(ctx, "/sounds/pop-1.mp3"), null);
  } finally {
    globalThis.fetch = original;
  }
});
