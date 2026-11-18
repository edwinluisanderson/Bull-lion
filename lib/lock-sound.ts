import { decodeSoundClip } from "@/lib/decode-clip";
import { REEL_CLICK_GAIN, reelAudioContext } from "@/lib/reel-click";
import { spinSoundEnabled } from "@/lib/spin-overlay";
import { SWIPE_REVEAL_PX, crossedDetent, type SwipeEnd } from "@/lib/swipe-delete";

/**
 * Door bolt split into unlock, the halfway catch, and the final clunk.
 * "door bolt 5.wav" by FenrirFangs.
 * https://freesound.org/people/FenrirFangs/sounds/213996/
 * License: CC0 1.0. See public/sounds/flap-credits.txt.
 */
export const LOCK_START_URL = "/sounds/lock-start.mp3";
export const LOCK_MIDDLE_URL = "/sounds/lock-middle.mp3";
export const LOCK_END_URL = "/sounds/lock-end.mp3";
export const LOCK_SOUND_URLS = [LOCK_START_URL, LOCK_MIDDLE_URL, LOCK_END_URL] as const;

export type LockCue = "start" | "middle" | "end";

/**
 * s16 peaks of the three clips and of reel-click.mp3.
 * Each cue's gain puts its peak on the wheel click, and not above it.
 */
export const LOCK_FILE_PEAK = { start: 4846, middle: 1980, end: 11824 } as const;
export const REEL_CLICK_FILE_PEAK = 12132;

export function lockCueGain(cue: LockCue, clickGain = REEL_CLICK_GAIN, clickPeak = REEL_CLICK_FILE_PEAK): number {
  const peak = LOCK_FILE_PEAK[cue];
  if (!(peak > 0)) return 0;
  return (clickPeak * clickGain) / peak;
}

export type LockDrag = {
  /** True after this gesture's axis has locked horizontal. */
  armed: boolean;
  offset: number;
};

export function freshLockDrag(offset: number): LockDrag {
  return { armed: false, offset };
}

/** Unlock click, once, when the drag axis first locks horizontal. */
export function lockDragArmed(drag: LockDrag): { drag: LockDrag; cue: LockCue | null } {
  if (drag.armed) return { drag, cue: null };
  return { drag: { ...drag, armed: true }, cue: "start" };
}

/** Halfway catch, once each time the card crosses the middle in either direction. */
export function lockDragMoved(
  drag: LockDrag,
  next: number,
  reveal = SWIPE_REVEAL_PX,
): { drag: LockDrag; cue: LockCue | null } {
  const cue = crossedDetent(drag.offset, next, reveal) ? "middle" : null;
  return { drag: { ...drag, offset: next }, cue };
}

/**
 * Final clunk when a real drag settles, open or shut.
 * A tap that never locked the axis does not clunk.
 */
export function lockDragSettled(
  drag: LockDrag,
  end: SwipeEnd,
  reveal = SWIPE_REVEAL_PX,
): { drag: LockDrag; cue: LockCue | null } {
  const cue = drag.armed ? "end" : null;
  return { drag: { armed: false, offset: end === "open" ? reveal : 0 }, cue };
}

/** An open card tapped shut from outside the row settles closed. */
export function lockOutsideClose(open: boolean, gestureActive: boolean): LockCue | null {
  if (!open || gestureActive) return null;
  return "end";
}

/** The red lamp, beams, and ahooga run only while the card is locked and still. */
export function cardAlarmLive(open: boolean, dragging: boolean, departing: boolean): boolean {
  return open && !dragging && !departing;
}

const urlFor: Record<LockCue, string> = {
  start: LOCK_START_URL,
  middle: LOCK_MIDDLE_URL,
  end: LOCK_END_URL,
};

let buffers: Record<LockCue, AudioBuffer | null> = { start: null, middle: null, end: null };
let loading: Promise<void> | null = null;

export function loadLockSounds(): Promise<void> {
  try {
    const ctx = reelAudioContext();
    if (!ctx) return Promise.resolve();
    if (buffers.start && buffers.middle && buffers.end) return Promise.resolve();
    if (loading) return loading;
    loading = (async () => {
      await Promise.all(
        (Object.keys(urlFor) as LockCue[]).map(async (cue) => {
          buffers[cue] = await decodeSoundClip(ctx, urlFor[cue]);
        }),
      );
      if (!buffers.start && !buffers.middle && !buffers.end) loading = null;
    })();
    return loading;
  } catch {
    return Promise.resolve();
  }
}

/** One bolt cue. Quiet when the sound switch is off. Same context as the wheel click. */
export function playLockCue(cue: LockCue): void {
  if (!spinSoundEnabled()) return;
  try {
    const ctx = reelAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const buffer = buffers[cue];
    if (!buffer) {
      void loadLockSounds();
      return;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = lockCueGain(cue);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  } catch {
    /* Audio is optional. */
  }
}
