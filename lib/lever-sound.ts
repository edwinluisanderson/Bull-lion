import { reelAudioContext } from "@/lib/reel-click";

/**
 * Synthesized lever sounds, no new audio files. Shares the reel-click AudioContext.
 * Ratchet tick: 14ms band-passed noise at 3.2kHz, gain 0.10, with a 6ms buzz.
 * Release thunk: a light sine drop plus a tiny noise tap, played once when the reels launch.
 */
export const LEVER_TICK_GAIN = 0.1;
export const LEVER_TICK_VIBRATE_MS = 6;
export const RELEASE_START_HZ = 140;
export const RELEASE_END_HZ = 70;
export const RELEASE_SWEEP_S = 0.06;
export const RELEASE_GAIN = 0.18;
export const RELEASE_DECAY_S = 0.09;
export const RELEASE_FLOOR = 0.001;
export const RELEASE_NOISE_HZ = 800;
export const RELEASE_NOISE_S = 0.015;
export const RELEASE_NOISE_GAIN = 0.06;

function noise(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const data = ctx.createBuffer(1, length, ctx.sampleRate);
  const channel = data.getChannelData(0);
  for (let i = 0; i < length; i += 1) channel[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
  return data;
}

function vibrate(pattern: number): void {
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    navigator.vibrate(pattern);
  } catch {
    /* Haptics are optional. */
  }
}

/** Softer than the lever tick. A page passing a stop. */
export const PAGE_PASS_GAIN = 0.045;
/** Quiet landing click when the page settles on a stop. */
export const PAGE_LAND_GAIN = 0.06;

function pageClick(gainValue: number): void {
  try {
    const ctx = reelAudioContext();
    if (!ctx || ctx.state !== "running") return;
    const source = ctx.createBufferSource();
    source.buffer = noise(ctx, 0.014);
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 3200;
    band.Q.value = 2.5;
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    source.connect(band).connect(gain).connect(ctx.destination);
    source.start();
  } catch {
    /* Audio is optional. */
  }
}

/** Lever-tick timbre, lighter, and without its own buzz. The page owns the 6ms haptic. */
export function pagePassClick(): void {
  pageClick(PAGE_PASS_GAIN);
}

/** One quiet click when the cushion lands. The page owns the 15ms tap. */
export function pageLandClick(): void {
  pageClick(PAGE_LAND_GAIN);
}

export function leverTick(): void {
  vibrate(LEVER_TICK_VIBRATE_MS);
  try {
    const ctx = reelAudioContext();
    if (!ctx || ctx.state !== "running") return;
    const source = ctx.createBufferSource();
    source.buffer = noise(ctx, 0.014);
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 3200;
    band.Q.value = 2.5;
    const gain = ctx.createGain();
    gain.gain.value = LEVER_TICK_GAIN;
    source.connect(band).connect(gain).connect(ctx.destination);
    source.start();
  } catch {
    /* Audio is optional. */
  }
}

/** Light mechanical thunk when the reels launch. Much quieter than the old bottom-stop clunk. */
export function leverRelease(): void {
  try {
    const ctx = reelAudioContext();
    if (!ctx || ctx.state !== "running") return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(RELEASE_START_HZ, now);
    osc.frequency.exponentialRampToValueAtTime(RELEASE_END_HZ, now + RELEASE_SWEEP_S);
    const tone = ctx.createGain();
    tone.gain.setValueAtTime(RELEASE_GAIN, now);
    tone.gain.exponentialRampToValueAtTime(RELEASE_FLOOR, now + RELEASE_DECAY_S);
    osc.connect(tone).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + RELEASE_DECAY_S);
    const tap = ctx.createBufferSource();
    tap.buffer = noise(ctx, RELEASE_NOISE_S);
    const low = ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = RELEASE_NOISE_HZ;
    const tapGain = ctx.createGain();
    tapGain.gain.value = RELEASE_NOISE_GAIN;
    tap.connect(low).connect(tapGain).connect(ctx.destination);
    tap.start(now);
  } catch {
    /* Audio is optional. */
  }
}
