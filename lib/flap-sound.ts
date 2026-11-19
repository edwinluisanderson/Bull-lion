import { decodeSoundClip } from "@/lib/decode-clip";
import { REEL_CLICK_GAIN, reelAudioContext } from "@/lib/reel-click";
import { spinSoundEnabled } from "@/lib/spin-overlay";

/**
 * Fallback tick used only before the recorded clips decode.
 * Same 10 dB cut as the clips, so a missing file is not louder than a burst.
 * The wheel-stop gain itself is unchanged.
 */
export const FLAP_GAIN = 0.082;
/** How many flap ticks may start inside one window. */
export const FLAP_MAX_PER_WINDOW = 2;
export const FLAP_WINDOW_MS = 45;
/**
 * Shared sum, in linear amplitude. A tick is linear under this.
 * Anything louder, including a pile of ticks, clips here.
 */
export const FLAP_SUM_LIMIT = 0.5;

/**
 * Recorded ticks cut from "Split Flap Display" by ngruber.
 * https://freesound.org/people/ngruber/sounds/261244/
 * License: CC0 1.0 — https://creativecommons.org/publicdomain/zero/1.0/
 * See public/sounds/flap-credits.txt.
 */
export const FLAP_CLIP_URLS = [
  "/sounds/flap-1.mp3",
  "/sounds/flap-2.mp3",
  "/sounds/flap-3.mp3",
  "/sounds/flap-4.mp3",
  "/sounds/flap-5.mp3",
  "/sounds/flap-6.mp3",
] as const;

/** Loudest 50 ms of the wheel-stop file, the same window the stretch pops use. */
export const FLAP_CLICK_WINDOW_RMS = 0.2620292306;
/** Mean of the loudest 50 ms in flap-1.mp3 through flap-6.mp3, before playback gain. */
export const FLAP_FILE_WINDOW_RMS = 0.1879646975;
/**
 * Single-flap window versus the wheel-stop click.
 * Two flaps may start inside one throttle window. At this offset their combined
 * window sits about 1.8 dB under the coin pour, the quietest of the wheel click,
 * the stretch pops, and the coins. The wheel-stop gain itself is unchanged.
 */
export const FLAP_LEVEL_DB = -11;
/** Playback rate swings ±5%, inside the ±4–6% range. */
export const FLAP_PITCH_SPREAD = 0.05;

export function matchedFlapGain(
  clickRms = FLAP_CLICK_WINDOW_RMS,
  clickGain = REEL_CLICK_GAIN,
  flapRms = FLAP_FILE_WINDOW_RMS,
  db = FLAP_LEVEL_DB,
): number {
  if (!(flapRms > 0)) return 0;
  return (clickRms * clickGain * 10 ** (db / 20)) / flapRms;
}

export const FLAP_SAMPLE_GAIN = matchedFlapGain();

/** Pick a clip index, never the same one twice in a row when there is a choice. */
export function pickFlapClip(count: number, previous: number | null, random: () => number = Math.random): number {
  if (count <= 1) return 0;
  const avoid = previous !== null && previous >= 0 && previous < count;
  const span = avoid ? count - 1 : count;
  const roll = Math.floor(random() * span);
  if (!avoid) return Math.min(count - 1, Math.max(0, roll));
  return roll >= (previous as number) ? roll + 1 : roll;
}

export function flapPlaybackRate(random: () => number = Math.random, spread = FLAP_PITCH_SPREAD): number {
  return 1 + (random() * 2 - 1) * spread;
}

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
/** True only after the My Stack board reports that some of it intersects the viewport. */
let boardInView = false;
let noise: AudioBuffer | null = null;
let noiseContext: AudioContext | null = null;
let sumBus: WaveShaperNode | null = null;
let sumContext: AudioContext | null = null;
let clips: Array<AudioBuffer | null> = FLAP_CLIP_URLS.map(() => null);
let clipLoading: Promise<void> | null = null;
let lastClip: number | null = null;

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

function loadClips(ctx: AudioContext): Promise<void> {
  if (clips.some(Boolean)) return Promise.resolve();
  if (clipLoading) return clipLoading;
  clipLoading = (async () => {
    await Promise.all(
      FLAP_CLIP_URLS.map(async (url, index) => {
        clips[index] = await decodeSoundClip(ctx, url);
      }),
    );
    if (!clips.some(Boolean)) clipLoading = null;
  })();
  return clipLoading;
}

/** Decode the ticks without resuming the context. */
export function loadFlapSamples(): Promise<void> {
  try {
    const ctx = reelAudioContext();
    if (!ctx) return Promise.resolve();
    return loadClips(ctx);
  } catch {
    return Promise.resolve();
  }
}

/** Resume audio on a user gesture and start decoding the flap clips. */
export function unlockFlapSamples(): void {
  try {
    const ctx = reelAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    void loadFlapSamples();
  } catch {
    /* Audio is optional. */
  }
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

/** Any painted part of the board counts as on screen. */
export const FLAP_BOARD_THRESHOLD = 0;

/**
 * Flap ticks are the only sounds tied to the board.
 * Wheel clicks, coins, and the swipe detent stay independent of this.
 */
export function flapSoundAllowed(boardInView: boolean, visibilityState: string): boolean {
  return boardInView && visibilityState === "visible";
}

/**
 * Offscreen and hidden ticks do not play and do not spend the throttle window.
 * A later tick, once the board is back, still gets a fresh window.
 */
export function shouldPlayFlapTick(
  inView: boolean,
  visibilityState: string,
  current: FlapSoundGate,
  now: number,
  soundOn: boolean,
): { play: boolean; gate: FlapSoundGate } {
  if (!soundOn || !flapSoundAllowed(inView, visibilityState)) return { play: false, gate: current };
  return nextFlapSound(current, now);
}

export function setFlapBoardInView(inView: boolean): void {
  boardInView = inView;
}

function intersectsViewport(board: Element): boolean {
  const view = board.ownerDocument?.defaultView;
  if (!view) return false;
  const rect = board.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  return rect.bottom > 0 && rect.right > 0 && rect.top < view.innerHeight && rect.left < view.innerWidth;
}

/** Follow the board. The first sample is synchronous so the opening tick is not a race. */
export function watchFlapBoard(board: Element): () => void {
  setFlapBoardInView(intersectsViewport(board));
  let observer: IntersectionObserver | null = null;
  if (typeof IntersectionObserver !== "undefined") {
    observer = new IntersectionObserver(
      (entries) => {
        const latest = entries[entries.length - 1];
        setFlapBoardInView(Boolean(latest?.isIntersecting));
      },
      { threshold: FLAP_BOARD_THRESHOLD },
    );
    observer.observe(board);
  }
  return () => {
    observer?.disconnect();
    setFlapBoardInView(false);
  };
}

function pageVisibility(): string {
  if (typeof document === "undefined") return "hidden";
  return document.visibilityState;
}

/**
 * Delete clunk. About twice the old 0.34, and a little deeper and longer.
 * A sine at this gain peaks at 0.68. The flap sum hard-clips at FLAP_SUM_LIMIT
 * (0.5), so the clunk goes straight to the context output. 0.68 stays under
 * full scale. A flap tick is about 0.12, so the two together still sit under 1.
 */
export const CLUNK_GAIN = 0.68;
export const CLUNK_START_HZ = 130;
export const CLUNK_END_HZ = 50;
export const CLUNK_SWEEP_S = 0.13;
export const CLUNK_DECAY_S = 0.18;
export const CLUNK_STOP_S = 0.19;

/** Brass tick as the card crosses the track detent, or the heavier delete clunk. */
export function playSwipeTone(kind: "detent" | "clunk"): void {
  if (!spinSoundEnabled()) return;
  try {
    const ctx = reelAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const clunk = kind === "clunk";
    osc.type = clunk ? "sine" : "triangle";
    osc.frequency.setValueAtTime(clunk ? CLUNK_START_HZ : 880, now);
    osc.frequency.exponentialRampToValueAtTime(clunk ? CLUNK_END_HZ : 420, now + (clunk ? CLUNK_SWEEP_S : 0.04));
    gain.gain.setValueAtTime(clunk ? CLUNK_GAIN : 0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (clunk ? CLUNK_DECAY_S : 0.05));
    osc.connect(gain);
    gain.connect(clunk ? ctx.destination : flapSum(ctx));
    osc.start(now);
    osc.stop(now + (clunk ? CLUNK_STOP_S : 0.06));
  } catch {
    /* Audio is optional. */
  }
}

/** One mechanical tick on the shared reel context. Silent offscreen, in a hidden tab, when sound is off, and when throttled. */
export function playFlapSound(now = typeof performance !== "undefined" ? performance.now() : Date.now()): boolean {
  const decision = shouldPlayFlapTick(boardInView, pageVisibility(), gate, now, spinSoundEnabled());
  gate = decision.gate;
  if (!decision.play) return false;
  try {
    const ctx = reelAudioContext();
    if (!ctx) return false;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const ready = clips.filter((buffer): buffer is AudioBuffer => buffer !== null);
    if (ready.length === 0) void loadClips(ctx);
    if (ready.length > 0) {
      const index = pickFlapClip(ready.length, lastClip);
      lastClip = index;
      const buffer = ready[index];
      if (!buffer) return false;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = flapPlaybackRate();
      const gain = ctx.createGain();
      gain.gain.value = FLAP_SAMPLE_GAIN;
      source.connect(gain);
      gain.connect(flapSum(ctx));
      source.start();
      return true;
    }
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
  boardInView = false;
  noise = null;
  noiseContext = null;
  sumBus = null;
  sumContext = null;
  clips = FLAP_CLIP_URLS.map(() => null);
  clipLoading = null;
  lastClip = null;
}
