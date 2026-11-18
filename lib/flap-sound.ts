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
/** True only after the My Stack board reports that some of it intersects the viewport. */
let boardInView = false;
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
    osc.frequency.setValueAtTime(clunk ? 150 : 880, now);
    osc.frequency.exponentialRampToValueAtTime(clunk ? 70 : 420, now + (clunk ? 0.09 : 0.04));
    gain.gain.setValueAtTime(clunk ? 0.34 : 0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (clunk ? 0.12 : 0.05));
    osc.connect(gain);
    gain.connect(flapSum(ctx));
    osc.start(now);
    osc.stop(now + (clunk ? 0.13 : 0.06));
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
}
