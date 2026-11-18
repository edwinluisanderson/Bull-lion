import { decodeSoundClip } from "@/lib/decode-clip";
import { reelAudioContext } from "@/lib/reel-click";
import { spinSoundEnabled } from "@/lib/spin-overlay";

/**
 * Single-blast ahooga for a locked-open delete button.
 * Source: Ahooga by craigsmith.
 * https://freesound.org/people/craigsmith/sounds/480002/
 * License: CC0 1.0 — https://creativecommons.org/publicdomain/zero/1.0/
 * Trimmed to 1.78s, mono. See public/sounds/flap-credits.txt.
 */
export const DELETE_AHOOGA_URL = "/sounds/delete-ahooga.mp3";
/** Repeat while the card stays locked open. A few seconds between blasts. */
export const DELETE_AHOOGA_EVERY_MS = 4500;
export const DELETE_AHOOGA_GAIN = 0.42;
/** Card face travel. The shell stays until the rows below cover it. */
export const DELETE_SHOOT_MS = 460;

export function deleteAlarmAllowed(visibilityState: string, soundOn: boolean): boolean {
  return soundOn && visibilityState === "visible";
}

export function deleteAlarmDue(lastPlayedAt: number, now: number, every = DELETE_AHOOGA_EVERY_MS): boolean {
  if (!Number.isFinite(now)) return false;
  if (!Number.isFinite(lastPlayedAt)) return true;
  return now - lastPlayedAt >= every;
}

let buffer: AudioBuffer | null = null;
let loading: Promise<void> | null = null;
let voice: AudioBufferSourceNode | null = null;
let generation = 0;

function pageVisibility(): string {
  if (typeof document === "undefined") return "hidden";
  return document.visibilityState;
}

function load(ctx: AudioContext): Promise<void> {
  if (buffer) return Promise.resolve();
  if (loading) return loading;
  loading = (async () => {
    buffer = await decodeSoundClip(ctx, DELETE_AHOOGA_URL);
    if (!buffer) loading = null;
  })();
  return loading;
}

/** Decode the blast ahead of the first locked card. Does not resume the context. */
export function loadDeleteAhooga(): Promise<void> {
  try {
    const ctx = reelAudioContext();
    if (!ctx) return Promise.resolve();
    return load(ctx);
  } catch {
    return Promise.resolve();
  }
}

/** Stop the blast that is playing. A later open starts a new one. */
export function stopDeleteAhooga(): void {
  generation += 1;
  const current = voice;
  voice = null;
  if (!current) return;
  try {
    current.stop();
  } catch {
    /* Already finished. */
  }
}

/** One blast, only while sound is on and the page is visible. */
export async function playDeleteAhooga(): Promise<boolean> {
  const token = generation;
  if (!deleteAlarmAllowed(pageVisibility(), spinSoundEnabled())) return false;
  try {
    const ctx = reelAudioContext();
    if (!ctx) return false;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    await load(ctx);
    if (token !== generation) return false;
    if (!buffer || !deleteAlarmAllowed(pageVisibility(), spinSoundEnabled())) return false;
    stopDeleteAhooga();
    const owned = generation;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = DELETE_AHOOGA_GAIN;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.onended = () => {
      if (voice === source) voice = null;
    };
    voice = source;
    source.start();
    if (owned !== generation) {
      try {
        source.stop();
      } catch {
        /* Closed before the start settled. */
      }
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
