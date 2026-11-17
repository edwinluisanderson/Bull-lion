import { reelAudioContext } from "@/lib/reel-click";

/**
 * Coins poured over a handle pull.
 * Cut from large-coins-falling.wav. The body is 18.83s through the spin,
 * then a 220 ms equal-power crossfade at 1.85s joins the thinning pour at
 * 36.00s–38.70s. The whole clip is 4.55s, with a 6 ms fade in and a 400 ms
 * fade out so the last coins die away.
 * Mono, because the two channels of that section correlate at 0.90.
 * Played on the reel-click context, not through the spin lowpass.
 * The lowpass is there to dull the click wash; the coins are the bright layer
 * under it. A highpass only takes the rumble out of the clicks' low body.
 */
export const COINS_FALL_URL = "/sounds/coins-fall.mp3";
/** Loudest 50 ms of the clip sits about 7 dB under the lock click. */
export const COINS_FALL_GAIN = 0.15;
export const COINS_FALL_HIGHPASS_HZ = 180;
export const COINS_FALL_HIGHPASS_Q = 0.7;
/** Old pour eases out instead of stacking on a fast second pull. */
export const COINS_RESTART_FADE_S = 0.06;

export type SpinGesture = "pull" | "flick" | "drag" | "step" | "stretch";

let soundEnabled = true;
let buffer: AudioBuffer | null = null;
let loading: Promise<void> | null = null;
let bytes: Promise<ArrayBuffer | null> | null = null;
let voice: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

/** There is no sound toggle in the cabinet. Clicks always play, and so do coins, unless a test turns this off. */
export function spinSoundEnabled(): boolean {
  return soundEnabled;
}

export function setSpinSoundEnabledForTests(next: boolean): void {
  soundEnabled = next;
}

/** Coins only on a handle pull, and only while sound is on. */
export function spinOverlayFor(gesture: SpinGesture): boolean {
  return gesture === "pull" && soundEnabled;
}

function loadBytes(): Promise<ArrayBuffer | null> {
  if (!bytes) {
    bytes = fetch(COINS_FALL_URL)
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

/** Decode ahead of the pull, on the same gesture that unlocks the reel click. */
export function armSpinOverlay(): void {
  try {
    const ctx = reelAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    void load(ctx);
  } catch {
    /* Audio is optional. */
  }
}

function start(ctx: AudioContext): void {
  if (!buffer) return;
  const now = ctx.currentTime;
  if (voice) {
    try {
      const old = voice;
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0, now + COINS_RESTART_FADE_S);
      old.source.stop(now + COINS_RESTART_FADE_S);
    } catch {
      /* The previous pour already ended. */
    }
    voice = null;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = COINS_FALL_HIGHPASS_HZ;
  highpass.Q.value = COINS_FALL_HIGHPASS_Q;
  const gain = ctx.createGain();
  gain.gain.value = COINS_FALL_GAIN;
  source.connect(highpass);
  highpass.connect(gain);
  gain.connect(ctx.destination);
  source.start(now);
  voice = { source, gain };
  source.onended = () => {
    if (voice?.source === source) voice = null;
  };
}

/** One pour. A second pull fades the first out and starts again. */
export function playSpinOverlay(): void {
  if (!soundEnabled) return;
  try {
    const ctx = reelAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    if (!buffer) {
      void load(ctx).then(() => {
        if (!soundEnabled || !buffer) return;
        try {
          start(reelAudioContext() ?? ctx);
        } catch {
          /* Audio is optional. */
        }
      });
      return;
    }
    start(ctx);
  } catch {
    /* Audio is optional. */
  }
}

export function resetSpinOverlayForTests(): void {
  soundEnabled = true;
  buffer = null;
  loading = null;
  bytes = null;
  voice = null;
}
