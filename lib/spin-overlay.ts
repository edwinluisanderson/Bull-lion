/**
 * One-shot overlay when a handle pull starts.
 * The coin sample is not in the build yet. spinOverlayUrl() stays null,
 * so playSpinOverlay() is silent and does not fetch. It does not use the
 * wheel-spin lowpass; the sample plays full-range once a URL is returned.
 */
export const SPIN_OVERLAY_GAIN = 1;

export function spinOverlayUrl(): string | null {
  return null;
}

let context: AudioContext | null = null;
let buffer: AudioBuffer | null = null;
let loading: Promise<void> | null = null;
let loadedUrl: string | null = null;

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

function load(ctx: AudioContext, url: string): Promise<void> {
  if (buffer && loadedUrl === url) return Promise.resolve();
  if (loading && loadedUrl === url) return loading;
  loadedUrl = url;
  buffer = null;
  loading = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) return;
      buffer = await ctx.decodeAudioData(await response.arrayBuffer());
    } catch {
      buffer = null;
      loading = null;
    }
  })();
  return loading;
}

function start(ctx: AudioContext): void {
  if (!buffer) return;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = SPIN_OVERLAY_GAIN;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}

/** Play the overlay once. No sample, no network, until spinOverlayUrl() is set. */
export function playSpinOverlay(): void {
  const url = spinOverlayUrl();
  if (!url) return;
  try {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    void load(ctx, url).then(() => {
      if (loadedUrl !== url) return;
      try {
        start(ctx);
      } catch {
        /* Audio is optional. */
      }
    });
  } catch {
    /* Audio is optional. */
  }
}
