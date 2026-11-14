import { REEL_CLICK_GAIN } from "@/lib/reel-click";
import { STRETCH_ECHO_HIGHPASS_HZ, STRETCH_ECHO_TAPS, stretchEchoTailMs } from "@/lib/stretch-echo";
import { pickStretchPop } from "@/lib/stretch-pops";

/** Six distinct pops cut from the virtual_vibes loop. Played at random, never twice in a row. */
export const STRETCH_POP_URLS = [
  "/sounds/pop-1.mp3",
  "/sounds/pop-2.mp3",
  "/sounds/pop-3.mp3",
  "/sounds/pop-4.mp3",
  "/sounds/pop-5.mp3",
  "/sounds/pop-6.mp3",
] as const;

/**
 * Loudest 50 ms of reel-click.mp3 and of pop-1.mp3 through pop-6.mp3,
 * measured before playback gain. The pops differ, so the match uses their mean.
 */
export const REEL_CLICK_FILE_WINDOW_RMS = 0.2620292306;
export const STRETCH_POP_FILE_WINDOW_RMS = 0.2650761108;

/** Dry-pop gain that puts that window at the same level as the lock click. */
export function matchedStretchPopGain(
  clickRms = REEL_CLICK_FILE_WINDOW_RMS,
  clickGain = REEL_CLICK_GAIN,
  popRms = STRETCH_POP_FILE_WINDOW_RMS,
): number {
  if (!(popRms > 0)) return 0;
  return (clickRms * clickGain) / popRms;
}

export const STRETCH_POP_GAIN = matchedStretchPopGain();

let context: AudioContext | null = null;
let buffers: Array<AudioBuffer | null> = STRETCH_POP_URLS.map(() => null);
let loading: Promise<void> | null = null;
let lastIndex: number | null = null;

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

function load(ctx: AudioContext): Promise<void> {
  if (buffers.some(Boolean)) return Promise.resolve();
  if (loading) return loading;
  loading = (async () => {
    try {
      const decoded = await Promise.all(
        STRETCH_POP_URLS.map(async (url) => {
          const response = await fetch(url);
          if (!response.ok) return null;
          return ctx.decodeAudioData((await response.arrayBuffer()).slice(0));
        }),
      );
      buffers = decoded;
    } catch {
      buffers = STRETCH_POP_URLS.map(() => null);
      loading = null;
    }
  })();
  return loading;
}

if (typeof window !== "undefined") {
  /* Fetch starts on the first gesture via playStretchPop / the reel unlock. */
}

/** Resume audio on a user gesture and start decoding the pops. */
export function unlockStretchPops(): void {
  try {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    void load(ctx);
  } catch {
    /* Audio is optional. */
  }
}

function playDry(ctx: AudioContext, buffer: AudioBuffer): void {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = STRETCH_POP_GAIN;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}

/** Dry pop plus a few delayed, quieter, highpassed copies. No feedback loop. */
function playEcho(ctx: AudioContext, buffer: AudioBuffer): boolean {
  try {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const dry = ctx.createGain();
    dry.gain.value = STRETCH_POP_GAIN;
    source.connect(dry);
    dry.connect(ctx.destination);

    const color = ctx.createBiquadFilter();
    color.type = "highpass";
    color.frequency.value = STRETCH_ECHO_HIGHPASS_HZ;
    color.Q.value = 0.707;
    source.connect(color);

    const taps = STRETCH_ECHO_TAPS.map((tap) => {
      const delay = ctx.createDelay(0.3);
      delay.delayTime.value = tap.delayMs / 1000;
      const gain = ctx.createGain();
      gain.gain.value = STRETCH_POP_GAIN * tap.gain;
      color.connect(delay);
      delay.connect(gain);
      gain.connect(ctx.destination);
      return { delay, gain };
    });

    const held = { source, dry, color, taps };
    source.onended = () => {
      window.setTimeout(() => {
        try {
          held.source.disconnect();
          held.dry.disconnect();
          held.color.disconnect();
          for (const tap of held.taps) {
            tap.delay.disconnect();
            tap.gain.disconnect();
          }
        } catch {
          /* Already torn down. */
        }
      }, stretchEchoTailMs());
    };
    source.start();
    return true;
  } catch {
    return false;
  }
}

/** One random pop. Silent until the clips have decoded. */
export function playStretchPop(): void {
  try {
    const ctx = getContext();
    if (!ctx) return;
    const ready = buffers.filter((buffer): buffer is AudioBuffer => buffer !== null);
    if (ready.length === 0) {
      void load(ctx);
      return;
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const index = pickStretchPop(ready.length, lastIndex);
    lastIndex = index;
    const buffer = ready[index] ?? null;
    if (!buffer) return;
    if (!playEcho(ctx, buffer)) playDry(ctx, buffer);
  } catch {
    /* Audio is optional. */
  }
}

export function resetStretchPopForTests(): void {
  context = null;
  buffers = STRETCH_POP_URLS.map(() => null);
  loading = null;
  lastIndex = null;
}
