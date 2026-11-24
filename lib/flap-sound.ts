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

/**
 * Hidden level check. `?flapvol=0.5` multiplies the flap tick only.
 * Remove this block, and the two `flapTickGain` calls below, to drop it.
 */
export const FLAP_VOL_PARAM = "flapvol";
export const FLAP_VOL_MIN = 0;
export const FLAP_VOL_MAX = 2;

/** A finite multiplier clamped to 0..2. Anything else is ignored. */
export function parseFlapVolume(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const text = raw.trim();
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return Math.min(FLAP_VOL_MAX, Math.max(FLAP_VOL_MIN, value));
}

export function flapVolumeFromSearch(search: string): number {
  const query = search.startsWith("?") ? search.slice(1) : search;
  return parseFlapVolume(new URLSearchParams(query).get(FLAP_VOL_PARAM)) ?? 1;
}

let flapVolume: number | null = null;
let flapVolumeRead = false;

function flapVolumeMultiplier(): number {
  if (flapVolumeRead) return flapVolume ?? 1;
  flapVolumeRead = true;
  try {
    flapVolume = flapVolumeFromSearch(globalThis.window?.location?.search ?? "");
  } catch {
    flapVolume = 1;
  }
  return flapVolume ?? 1;
}

/** Current flap gain, times `?flapvol=` when that param is present. */
export function flapTickGain(base: number, multiplier = flapVolumeMultiplier()): number {
  return base * multiplier;
}

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

type FlapWatch = { intersecting: boolean; watches: number };
/** Flap tiles that are mid-turn. The title, the card edge, and settled tiles are not in here. */
const watches = new Map<Element, FlapWatch>();
let flapObserver: IntersectionObserver | null = null;
const liveSources = new Set<AudioBufferSourceNode>();
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

/** A flipping tile counts as soon as any of it meets the viewport. */
export const FLAP_VIEW_THRESHOLD = 0;

/**
 * Flap ticks are the only sounds tied to the board.
 * Wheel clicks, coins, and the swipe detent stay independent of this.
 * `flippingInView` is true only when a tile that is actually turning meets the viewport.
 */
export function flapSoundAllowed(flippingInView: boolean, visibilityState: string): boolean {
  return flippingInView && visibilityState === "visible";
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

function elementInViewport(element: Element): boolean {
  const view = element.ownerDocument?.defaultView;
  if (!view) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  return rect.bottom > 0 && rect.right > 0 && rect.top < view.innerHeight && rect.left < view.innerWidth;
}

/** True while at least one tracked flipping tile meets the viewport. */
export function flippingFlapsAudible(): boolean {
  for (const record of watches.values()) {
    if (record.intersecting) return true;
  }
  return false;
}

function ensureFlapObserver(): void {
  if (flapObserver || typeof IntersectionObserver === "undefined") return;
  flapObserver = new IntersectionObserver(
    (entries) => {
      let changed = false;
      for (const entry of entries) {
        const record = watches.get(entry.target);
        if (!record || record.intersecting === entry.isIntersecting) continue;
        record.intersecting = entry.isIntersecting;
        changed = true;
      }
      if (changed && !flippingFlapsAudible()) stopActiveFlapSources();
    },
    { threshold: FLAP_VIEW_THRESHOLD },
  );
}

function stopActiveFlapSources(): void {
  for (const source of liveSources) {
    try {
      source.stop();
    } catch {
      /* already stopped */
    }
  }
  liveSources.clear();
}

function armFlapSource(source: AudioBufferSourceNode): void {
  liveSources.add(source);
  source.onended = () => {
    liveSources.delete(source);
  };
}

/**
 * Follow one tile that is turning right now.
 * The first sample is synchronous, so the tick that starts the turn is not a race.
 * Drop the watch when the turn ends. A still tile must not be passed in.
 */
export function trackFlippingFlap(element: Element): () => void {
  let record = watches.get(element);
  if (!record) {
    record = { intersecting: elementInViewport(element), watches: 0 };
    watches.set(element, record);
    ensureFlapObserver();
    flapObserver?.observe(element);
  }
  record.watches += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const current = watches.get(element);
    if (!current) return;
    current.watches -= 1;
    if (current.watches > 0) return;
    watches.delete(element);
    flapObserver?.unobserve(element);
  };
}

function pageVisibility(): string {
  if (typeof document === "undefined") return "hidden";
  return document.visibilityState;
}

/**
 * Delete clunk body. The flap sum hard-clips at 0.5, so this goes straight
 * to the context output. The body is 0.8 rather than 0.92 so the knock can
 * sit on top and the two peaks still add to 0.94, under 0.95.
 */
export const CLUNK_GAIN = 0.8;
export const CLUNK_START_HZ = 130;
export const CLUNK_END_HZ = 50;
export const CLUNK_SWEEP_S = 0.13;
export const CLUNK_DECAY_S = 0.28;
export const CLUNK_STOP_S = 0.3;
/** Short triangle blip so a small speaker still has an attack. */
export const CLUNK_KNOCK_GAIN = 0.14;
export const CLUNK_KNOCK_HZ = 220;
export const CLUNK_KNOCK_S = 0.022;
/** Two quieter copies of the body, low-passed, finished well before 0.6s. */
export const CLUNK_ECHO_DELAYS_S = [0.11, 0.22] as const;
export const CLUNK_ECHO_RATIO = 0.4;
export const CLUNK_ECHO_DECAY_S = 0.2;
export const CLUNK_ECHO_STOP_S = 0.22;
export const CLUNK_ECHO_LOWPASS_HZ = 480;

/** Linear peaks of the body and the knock, which start together. */
export function clunkAttackPeak(body = CLUNK_GAIN, knock = CLUNK_KNOCK_GAIN): number {
  return body + knock;
}

/** Gain of echo number `index` (0 is the first repeat). */
export function clunkEchoGain(index: number, body = CLUNK_GAIN, ratio = CLUNK_ECHO_RATIO): number {
  return body * ratio ** (index + 1);
}

/** When the last echo has stopped, in seconds after the hit. */
export function clunkTailEnd(
  delays: readonly number[] = CLUNK_ECHO_DELAYS_S,
  stop = CLUNK_ECHO_STOP_S,
): number {
  const last = delays.length === 0 ? 0 : Math.max(...delays);
  return last + stop;
}

function playDeleteClunk(ctx: AudioContext, now: number): void {
  const body = ctx.createOscillator();
  const bodyGain = ctx.createGain();
  body.type = "sine";
  body.frequency.setValueAtTime(CLUNK_START_HZ, now);
  body.frequency.exponentialRampToValueAtTime(CLUNK_END_HZ, now + CLUNK_SWEEP_S);
  bodyGain.gain.setValueAtTime(CLUNK_GAIN, now);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, now + CLUNK_DECAY_S);
  body.connect(bodyGain);
  bodyGain.connect(ctx.destination);
  body.start(now);
  body.stop(now + CLUNK_STOP_S);

  const knock = ctx.createOscillator();
  const knockGain = ctx.createGain();
  knock.type = "triangle";
  knock.frequency.setValueAtTime(CLUNK_KNOCK_HZ, now);
  knockGain.gain.setValueAtTime(CLUNK_KNOCK_GAIN, now);
  knockGain.gain.exponentialRampToValueAtTime(0.001, now + CLUNK_KNOCK_S);
  knock.connect(knockGain);
  knockGain.connect(ctx.destination);
  knock.start(now);
  knock.stop(now + CLUNK_KNOCK_S);

  CLUNK_ECHO_DELAYS_S.forEach((delay, index) => {
    const when = now + delay;
    const echo = ctx.createOscillator();
    const echoGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(CLUNK_ECHO_LOWPASS_HZ, when);
    echo.type = "sine";
    echo.frequency.setValueAtTime(CLUNK_START_HZ, when);
    echo.frequency.exponentialRampToValueAtTime(CLUNK_END_HZ, when + CLUNK_SWEEP_S);
    echoGain.gain.setValueAtTime(clunkEchoGain(index), when);
    echoGain.gain.exponentialRampToValueAtTime(0.001, when + CLUNK_ECHO_DECAY_S);
    echo.connect(filter);
    filter.connect(echoGain);
    echoGain.connect(ctx.destination);
    echo.start(when);
    echo.stop(when + CLUNK_ECHO_STOP_S);
  });
}

/** Brass tick as the card crosses the track detent, or the heavier delete clunk. */
export function playSwipeTone(kind: "detent" | "clunk"): void {
  if (!spinSoundEnabled()) return;
  try {
    const ctx = reelAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    if (kind === "clunk") {
      playDeleteClunk(ctx, now);
      return;
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.04);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(flapSum(ctx));
    osc.start(now);
    osc.stop(now + 0.06);
  } catch {
    /* Audio is optional. */
  }
}

/** One mechanical tick on the shared reel context. Silent when no flipping tile is on screen, in a hidden tab, when sound is off, and when throttled. */
export function playFlapSound(now = typeof performance !== "undefined" ? performance.now() : Date.now()): boolean {
  const audible = flippingFlapsAudible();
  const visibility = pageVisibility();
  const decision = shouldPlayFlapTick(audible, visibility, gate, now, spinSoundEnabled());
  gate = decision.gate;
  if (!decision.play) {
    if (!flapSoundAllowed(audible, visibility)) stopActiveFlapSources();
    return false;
  }
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
      gain.gain.value = flapTickGain(FLAP_SAMPLE_GAIN);
      source.connect(gain);
      gain.connect(flapSum(ctx));
      armFlapSource(source);
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
    gain.gain.value = flapTickGain(FLAP_GAIN);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(flapSum(ctx));
    armFlapSource(source);
    source.start();
    return true;
  } catch {
    return false;
  }
}

export function resetFlapSoundForTests(): void {
  gate = { stamp: 0, count: 0 };
  for (const element of watches.keys()) flapObserver?.unobserve(element);
  watches.clear();
  flapObserver?.disconnect();
  flapObserver = null;
  stopActiveFlapSources();
  noise = null;
  noiseContext = null;
  sumBus = null;
  sumContext = null;
  clips = FLAP_CLIP_URLS.map(() => null);
  clipLoading = null;
  lastClip = null;
  flapVolume = null;
  flapVolumeRead = false;
}
