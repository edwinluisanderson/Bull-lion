import { reelAudioContext } from "@/lib/reel-click";

/**
 * Synthesized lever sounds, no new audio files. Shares the reel-click AudioContext.
 * Ratchet tick: 14ms band-passed noise at 3.2kHz, gain 0.10, with a 6ms buzz.
 */
export const LEVER_TICK_GAIN = 0.1;
export const LEVER_TICK_VIBRATE_MS = 6;

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
