import { DELETE_AHOOGA_URL, loadDeleteAhooga } from "@/lib/delete-alarm";
import { FLAP_CLIP_URLS, loadFlapSamples } from "@/lib/flap-sound";
import { REEL_CLICK_URL, loadReelClick, reelAudioContext } from "@/lib/reel-click";
import { COINS_FALL_URL, loadCoinsFall } from "@/lib/spin-overlay";
import { STRETCH_POP_URLS, loadStretchPops } from "@/lib/stretch-pop";

/** Every file in public/sounds, decoded into the shared reel context. */
export const APP_SOUND_URLS = [
  REEL_CLICK_URL,
  ...STRETCH_POP_URLS,
  ...FLAP_CLIP_URLS,
  COINS_FALL_URL,
  DELETE_AHOOGA_URL,
] as const;

const loads = [loadReelClick, loadStretchPops, loadFlapSamples, loadCoinsFall, loadDeleteAhooga];

/**
 * Fetch and decode every clip after the first paint.
 * Each family fails on its own. This does not resume the context.
 */
export function preloadAppSounds(): void {
  if (typeof window === "undefined") return;
  const start = () => {
    for (const load of loads) {
      try {
        void Promise.resolve(load()).catch(() => {});
      } catch {
        /* One family can fail without the others. */
      }
    }
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(start);
  else start();
}

/** Resume the shared context and make sure the clips are decoding. */
export function unlockAppAudio(): void {
  try {
    const ctx = reelAudioContext();
    if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => {});
  } catch {
    /* Audio is optional. */
  }
  preloadAppSounds();
}

let unlockInstalled = false;

/** The first pointer or key unlocks audio on Android, then the listener leaves. */
export function installAppAudioUnlock(): void {
  if (typeof window === "undefined" || unlockInstalled) return;
  unlockInstalled = true;
  const once = () => {
    unlockAppAudio();
    window.removeEventListener("pointerdown", once, true);
    window.removeEventListener("keydown", once, true);
  };
  window.addEventListener("pointerdown", once, { capture: true, passive: true });
  window.addEventListener("keydown", once, true);
}

export function resetSoundPreloadForTests(): void {
  unlockInstalled = false;
}
