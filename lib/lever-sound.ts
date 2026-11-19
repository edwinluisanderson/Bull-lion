import { reelAudioContext } from "@/lib/reel-click";

/**
 * Synthesized lever sounds, no new audio files. Shares the reel-click AudioContext.
 * Ratchet tick: 14ms band-passed noise at 3.2kHz, gain 0.10.
 * Clunk: 70ms noise thump low-passed at 900Hz, plus a 110Hz to 48Hz sine drop over 140ms, gain 0.35.
 */
export const LEVER_TICK_GAIN = 0.1;
export const LEVER_CLUNK_GAIN = 0.35;
export const LEVER_TICK_VIBRATE_MS = 6;
export const LEVER_CATCH_VIBRATE: number[] = [32, 40, 14];

function noise(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const data = ctx.createBuffer(1, length, ctx.sampleRate);
  const channel = data.getChannelData(0);
  for (let i = 0; i < length; i += 1) channel[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
  return data;
}

function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    navigator.vibrate(pattern);
  } catch {
    /* Haptics are optional. */
  }
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

export function leverClunk(): void {
  vibrate(LEVER_CATCH_VIBRATE);
  try {
    const ctx = reelAudioContext();
    if (!ctx || ctx.state !== "running") return;
    const now = ctx.currentTime;
    const thump = ctx.createBufferSource();
    thump.buffer = noise(ctx, 0.07);
    const low = ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 900;
    const tg = ctx.createGain();
    tg.gain.value = LEVER_CLUNK_GAIN;
    thump.connect(low).connect(tg).connect(ctx.destination);
    thump.start(now);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.14);
    const og = ctx.createGain();
    og.gain.setValueAtTime(LEVER_CLUNK_GAIN, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(og).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  } catch {
    /* Audio is optional. */
  }
}
