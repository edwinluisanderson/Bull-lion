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

export const STRETCH_POP_GAIN = 0.55;

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
    const source = ctx.createBufferSource();
    source.buffer = ready[index] ?? null;
    const gain = ctx.createGain();
    gain.gain.value = STRETCH_POP_GAIN;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
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
