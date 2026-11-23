import { HAPTIC_CLICK_MS, hapticClick, reelTicksOpen, setReelTicksOpen } from "@/lib/haptics";

/**
 * Pawl ticks cut from the slow opening of "Freewheel clicks" by donkpow,
 * and a short "Wood Knock" by Mrguff. Both CC0. See public/sounds/flap-credits.txt.
 * A new buffer source is started per click so nearby snaps can overlap.
 * At most a few starts are allowed in one frame, so a fast flick cannot
 * stack dozens of copies before the next paint.
 */
export const PAWL_URLS = [
  "/sounds/pawl-1.wav",
  "/sounds/pawl-2.wav",
  "/sounds/pawl-3.wav",
  "/sounds/pawl-4.wav",
  "/sounds/pawl-5.wav",
  "/sounds/pawl-6.wav",
] as const;
export const WOOD_KNOCK_URL = "/sounds/wood-knock.wav";
/** Lit pawl tick. Kept apart from the flap/lock calibration gain. */
export const PAWL_GAIN = 0.48;
/** Wood body under a lit tick. Quiet enough that it is not a door knock. */
export const KNOCK_GAIN = 0.03;
/** Landing pawl. The last slice, played louder than a passing tick. */
export const LANDING_PAWL_GAIN = 0.95;
/** Landing knock, louder than the under-tick knock and still under the pawl. */
export const LANDING_KNOCK_GAIN = 0.08;
export const PAWL_RATE_MIN = 0.94;
export const PAWL_RATE_MAX = 1.06;
export const LANDING_RATE_MIN = 0.85;
export const LANDING_RATE_MAX = 0.9;
/** Other cues still balance against the old click gain. */
export const REEL_CLICK_GAIN = 0.3;
/** Gray stops use the pawl only, quieter, and never a haptic or a knock. */
export const REEL_CLICK_DULL = 0.4;
export const REEL_CLICKS_PER_FRAME = 3;

/** Shared spin bus. Low Q keeps the click's body; the cutoff only takes the hiss. */
export const SPIN_LOWPASS_HZ = 4000;
export const SPIN_LOWPASS_Q = 0.7;
/** Open enough to leave a stopped click full-range. */
export const SPIN_OPEN_HZ = 20000;
/** setTargetAtTime time constant. About 30ms, no zipper. */
export const SPIN_FILTER_RAMP_S = 0.03;

let context: AudioContext | null = null;
let pawlBuffers: AudioBuffer[] = [];
let knockBuffer: AudioBuffer | null = null;
let loading: Promise<void> | null = null;
const fileBytes = new Map<string, Promise<ArrayBuffer | null>>();
let frameStamp = -1;
let framePlays = 0;
let lastClickAt = Number.NEGATIVE_INFINITY;
let lastPawl = -1;
let spinVoices = 0;
let spinTrim: GainNode | null = null;
let spinFilter: BiquadFilterNode | null = null;

function audioCtor(): (new () => AudioContext) | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & { webkitAudioContext?: new () => AudioContext };
  return window.AudioContext ?? host.webkitAudioContext ?? null;
}

/** The one context the reel clicks and the coin overlay share. */
export function reelAudioContext(): AudioContext | null {
  return getContext();
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

function loadBytes(url: string): Promise<ArrayBuffer | null> {
  let pending = fileBytes.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((response) => (response.ok ? response.arrayBuffer() : null))
      .catch(() => null);
    fileBytes.set(url, pending);
  }
  return pending;
}

function clipUrls(): readonly string[] {
  return [...PAWL_URLS, WOOD_KNOCK_URL];
}

function load(ctx: AudioContext): Promise<void> {
  if (pawlBuffers.length === PAWL_URLS.length && knockBuffer) return Promise.resolve();
  if (loading) return loading;
  loading = (async () => {
    try {
      const decoded: AudioBuffer[] = [];
      for (const url of PAWL_URLS) {
        const data = await loadBytes(url);
        if (!data) continue;
        decoded.push(await ctx.decodeAudioData(data.slice(0)));
      }
      pawlBuffers = decoded;
      const knock = await loadBytes(WOOD_KNOCK_URL);
      knockBuffer = knock ? await ctx.decodeAudioData(knock.slice(0)) : null;
    } catch {
      pawlBuffers = [];
      knockBuffer = null;
      loading = null;
      fileBytes.clear();
    }
  })();
  return loading;
}

if (typeof window !== "undefined") {
  for (const url of clipUrls()) void loadBytes(url);
}

/** Resume audio on a user gesture and start decoding the clicks. */
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

/** Pick a pawl slice, never the same one twice in a row when there is a choice. */
export function pickPawlIndex(count: number, previous: number, random: () => number = Math.random): number {
  if (count <= 1) return 0;
  const avoid = previous >= 0 && previous < count;
  const span = avoid ? count - 1 : count;
  const roll = Math.min(span - 1, Math.max(0, Math.floor(random() * span)));
  if (!avoid) return roll;
  return roll >= previous ? roll + 1 : roll;
}

export function pawlPlaybackRate(landing: boolean, random: () => number = Math.random): number {
  const min = landing ? LANDING_RATE_MIN : PAWL_RATE_MIN;
  const max = landing ? LANDING_RATE_MAX : PAWL_RATE_MAX;
  return min + random() * (max - min);
}

function ensureSpinBus(ctx: AudioContext): GainNode | null {
  if (spinTrim && spinFilter) return spinTrim;
  try {
    spinTrim = ctx.createGain();
    spinTrim.gain.value = 1;
    spinFilter = ctx.createBiquadFilter();
    spinFilter.type = "lowpass";
    spinFilter.Q.value = SPIN_LOWPASS_Q;
    spinFilter.frequency.value = SPIN_OPEN_HZ;
    spinTrim.connect(spinFilter);
    spinFilter.connect(ctx.destination);
    return spinTrim;
  } catch {
    spinTrim = null;
    spinFilter = null;
    return null;
  }
}

function rampSpinFilter(closed: boolean): void {
  const ctx = getContext();
  if (!ctx) return;
  const bus = ensureSpinBus(ctx);
  if (!bus || !spinFilter) return;
  try {
    const now = ctx.currentTime;
    const freq = spinFilter.frequency;
    const target = closed ? SPIN_LOWPASS_HZ : SPIN_OPEN_HZ;
    freq.cancelScheduledValues(now);
    freq.setValueAtTime(freq.value, now);
    freq.setTargetAtTime(target, now, SPIN_FILTER_RAMP_S);
  } catch {
    /* Audio is optional. */
  }
}

/** One reel entered or left a multi-stop spin. The bus filters only while any reel is spinning. */
export function noteReelSpinning(active: boolean): void {
  const next = Math.max(0, spinVoices + (active ? 1 : -1));
  const was = spinVoices > 0;
  spinVoices = next;
  if (was !== spinVoices > 0) rampSpinFilter(spinVoices > 0);
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

function startVoice(ctx: AudioContext, clip: AudioBuffer, gainValue: number, rate: number, spin: boolean): void {
  const source = ctx.createBufferSource();
  source.buffer = clip;
  source.playbackRate.value = rate;
  const gain = ctx.createGain();
  gain.gain.value = gainValue;
  source.connect(gain);
  if (spin) {
    const bus = ensureSpinBus(ctx);
    if (bus) gain.connect(bus);
    else gain.connect(ctx.destination);
  } else {
    gain.connect(ctx.destination);
  }
  source.start();
}

/**
 * Play one snap. `spin` routes it through the shared lowpass bus.
 * Stopped clicks, the lock, and the pull's stage B stay on the dry output.
 * Ticks closer than 40ms, or any tick after the reels have stopped, are dropped.
 * `force` skips that spacing. `landing` is the reel coming to rest: last pawl,
 * louder and deeper, with the knock. It skips the 40ms spacing and the
 * per-frame cap, and it does not take a slot in either.
 */
export function playReelClick(spin = false, dull = false, force = false, landing = false): void {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (!landing && !force && (!reelTicksOpen() || now - lastClickAt < HAPTIC_CLICK_MS)) return;
  if (!landing) lastClickAt = now;
  try {
    const ctx = getContext();
    if (!ctx || pawlBuffers.length === 0) {
      if (ctx) void load(ctx);
      return;
    }
    if (!landing && !allowThisFrame()) return;
    if (landing) lastClickAt = now;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const index = landing ? pawlBuffers.length - 1 : pickPawlIndex(pawlBuffers.length, lastPawl);
    lastPawl = index;
    const rate = pawlPlaybackRate(landing);
    const pawlGain = (landing ? LANDING_PAWL_GAIN : PAWL_GAIN) * (dull ? REEL_CLICK_DULL : 1);
    const clip = pawlBuffers[index];
    if (clip) startVoice(ctx, clip, pawlGain, rate, spin && !landing);
    if (!dull && knockBuffer) {
      const knockGain = landing ? LANDING_KNOCK_GAIN : KNOCK_GAIN;
      startVoice(ctx, knockBuffer, knockGain, rate, spin && !landing);
    }
  } catch {
    /* Audio is optional. */
  }
}

/** Haptic plus click for the pull's stage B. The reel landing uses playReelClick directly. */
export function reelSnap(): void {
  hapticClick(true);
  playReelClick(false, false, true);
}

export function resetReelClickForTests(): void {
  context = null;
  pawlBuffers = [];
  knockBuffer = null;
  loading = null;
  fileBytes.clear();
  frameStamp = -1;
  framePlays = 0;
  lastClickAt = Number.NEGATIVE_INFINITY;
  lastPawl = -1;
  setReelTicksOpen(true);
  spinVoices = 0;
  spinTrim = null;
  spinFilter = null;
}
