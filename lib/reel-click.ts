import { hapticClick } from "@/lib/haptics";

/**
 * Soft detent for a reel snap.
 * Source: Pixabay "UI Click Soft" by SoundShelfStudio (Content License),
 * trimmed to the 150ms transient. Gain stays low so it sits under the haptic.
 * A new buffer source is started per click so nearby snaps can overlap.
 * At most a few starts are allowed in one frame, so a fast flick cannot
 * stack dozens of copies before the next paint.
 */
export const REEL_CLICK_URL = "/sounds/reel-click.mp3";
export const REEL_CLICK_GAIN = 0.3;
export const REEL_CLICKS_PER_FRAME = 3;

let context: AudioContext | null = null;
let buffer: AudioBuffer | null = null;
let loading: Promise<void> | null = null;
let bytes: Promise<ArrayBuffer | null> | null = null;
let frameStamp = -1;
let framePlays = 0;

function audioCtor(): (new () => AudioContext) | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & { webkitAudioContext?: new () => AudioContext };
  return window.AudioContext ?? host.webkitAudioContext ?? null;
}

function getContext(): AudioContext | null {
  const Ctor = audioCtor();
  if (!Ctor) return null;
  if (!context || context.state === "closed") {
    try {
      context = new Ctor();
    } catch {
      return null;
    }
  }
  return context;
}

function loadBytes(): Promise<ArrayBuffer | null> {
  if (!bytes) {
    bytes = fetch(REEL_CLICK_URL)
      .then((response) => (response.ok ? response.arrayBuffer() : null))
      .catch(() => null);
  }
  return bytes;
}

function load(ctx: AudioContext): Promise<void> {
  if (buffer) return Promise.resolve();
  if (loading) return loading;
  loading = (async () => {
    try {
      const data = await loadBytes();
      if (!data) return;
      buffer = await ctx.decodeAudioData(data.slice(0));
    } catch {
      buffer = null;
      loading = null;
      bytes = null;
    }
  })();
  return loading;
}

if (typeof window !== "undefined") void loadBytes();

/** Resume audio on a user gesture and start decoding the click. */
export function unlockReelClick(): void {
  try {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    void load(ctx);
  } catch {
    /* Audio is optional. */
  }
}

export function loadReelClick(): Promise<void> {
  try {
    const ctx = getContext();
    if (!ctx) return Promise.resolve();
    return load(ctx);
  } catch {
    return Promise.resolve();
  }
}

function allowThisFrame(): boolean {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const stamp = Math.floor(now / 16);
  if (stamp !== frameStamp) {
    frameStamp = stamp;
    framePlays = 0;
  }
  if (framePlays >= REEL_CLICKS_PER_FRAME) return false;
  framePlays += 1;
  return true;
}

/** Play one snap. Silent when audio is missing, blocked, or not decoded yet. */
export function playReelClick(): void {
  try {
    const ctx = getContext();
    if (!ctx || !buffer) {
      if (ctx) void load(ctx);
      return;
    }
    if (!allowThisFrame()) return;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = REEL_CLICK_GAIN;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  } catch {
    /* Audio is optional. */
  }
}

/** Haptic plus click for a committed reel stop or the pull's stage B. */
export function reelSnap(): void {
  hapticClick();
  playReelClick();
}

export function resetReelClickForTests(): void {
  context = null;
  buffer = null;
  loading = null;
  bytes = null;
  frameStamp = -1;
  framePlays = 0;
}
