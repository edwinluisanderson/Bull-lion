import { reelAudioContext } from "@/lib/reel-click";
import { spinSoundEnabled } from "@/lib/spin-overlay";

/**
 * One flap tick, just under the wheel-stop click.
 * The filtered burst peaks near the click sample, so this gain lands the tick
 * about 1 dB below a stop on the peak. The wheel-stop gain itself is unchanged.
 */
export const FLAP_GAIN = 0.26;
/** How many flap ticks may start inside one window. */
export const FLAP_MAX_PER_WINDOW = 2;
export const FLAP_WINDOW_MS = 45;
/**
 * Shared sum, in linear amplitude. A tick is linear under this.
 * Anything louder, including a pile of ticks, clips here.
 */
export const FLAP_SUM_LIMIT = 0.5;

export type FlapSoundGate = {
  stamp: number;
  count: number;
};

export function nextFlapSound(gate: FlapSoundGate, now: number): { play: boolean; gate: FlapSoundGate } {
  if (!(now >= gate.stamp) || now - gate.stamp >= FLAP_WINDOW_MS) {
    return { play: true, gate: { stamp: now, count: 1 } };
  }
  if (gate.count >= FLAP_MAX_PER_WINDOW) return { play: false, gate };
  return { play: true, gate: { stamp: gate.stamp, count: gate.count + 1 } };
}

let gate: FlapSoundGate = { stamp: 0, count: 0 };
let noise: AudioBuffer | null = null;
let noiseContext: AudioContext | null = null;
let sumBus: WaveShaperNode | null = null;
let sumContext: AudioContext | null = null;

function flapCurve(): Float32Array<ArrayBuffer> {
  const length = 1025;
  const curve = new Float32Array(length);
  const limit = FLAP_SUM_LIMIT;
  for (let index = 0; index < length; index += 1) {
    const x = (index / (length - 1)) * 2 - 1;
    curve[index] = Math.max(-limit, Math.min(limit, x));
  }
  return curve;
}

function flapSum(ctx: AudioContext): AudioNode {
  if (sumBus && sumContext === ctx) return sumBus;
  const shaper = ctx.createWaveShaper();
  shaper.curve = flapCurve();
  shaper.oversample = "none";
  shaper.connect(ctx.destination);
  sumBus = shaper;
  sumContext = ctx;
  return shaper;
}

function clickBuffer(ctx: AudioContext): AudioBuffer | null {
  if (noise && noiseContext === ctx) return noise;
  try {
    const length = Math.max(1, Math.floor(ctx.sampleRate * 0.028));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      const envelope = Math.exp(-index / (ctx.sampleRate * 0.005));
      data[index] = (Math.random() * 2 - 1) * envelope;
    }
    noise = buffer;
    noiseContext = ctx;
    return buffer;
  } catch {
    return null;
  }
}

/** One mechanical tick on the shared reel context. Silent when sound is off, and throttled. */
export function playFlapSound(now = typeof performance !== "undefined" ? performance.now() : Date.now()): boolean {
  if (!spinSoundEnabled()) return false;
  const decision = nextFlapSound(gate, now);
  gate = decision.gate;
  if (!decision.play) return false;
  try {
    const ctx = reelAudioContext();
    if (!ctx) return false;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const buffer = clickBuffer(ctx);
    if (!buffer) return false;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1400;
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.value = FLAP_GAIN;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(flapSum(ctx));
    source.start();
    return true;
  } catch {
    return false;
  }
}

export function resetFlapSoundForTests(): void {
  gate = { stamp: 0, count: 0 };
  noise = null;
  noiseContext = null;
  sumBus = null;
  sumContext = null;
}
