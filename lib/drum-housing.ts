import { cylinderPose } from "@/lib/drum";
import { REEL_ITEM_HEIGHT } from "@/lib/metals";

/** The reel window. Three facing-face heights. */
export const DRUM_WINDOW = REEL_ITEM_HEIGHT * 3;

/**
 * At rest the ±1 face edge is this far from the brass, top and bottom.
 * The skin stops 15px short of the brass, so it runs this far past that edge.
 */
export const REST_FACE_EDGE = 20.710493;
export const HOUSING_GAP = 15;
export const DRUM_RIM = REST_FACE_EDGE - HOUSING_GAP;

/** Screen top and bottom of one cylinder face. Offset 0 is the center row. */
export function visualFace(offsetStops: number, itemHeight = REEL_ITEM_HEIGHT): { top: number; bottom: number } {
  const pose = cylinderPose(offsetStops);
  const y = itemHeight * 1.5 + pose.shift * itemHeight - itemHeight / 2;
  const top = y + (itemHeight / 2) * (1 - pose.scaleY);
  return { top, bottom: top + itemHeight * pose.scaleY };
}

/**
 * The drawn ±1 edges sit closer to the brass than the rest gap calls for.
 * Shift them out to the measured rest edge, then keep that same shift while they move.
 */
const REST_BIAS = REST_FACE_EDGE - visualFace(-1).top;

export type DrumSkin = { top: number; bottom: number; height: number };

const FACE_SLOTS = [-2, -1, 0, 1, 2, 3];

/**
 * Square drum body for a reel whose payline is `fraction` of a stop off center.
 * The body stays `DRUM_RIM` past every face still in the window, and never paints
 * past the brass. At rest only the ±1 faces are in the window, so the gap is 15px.
 */
export function drumSkin(fraction: number): DrumSkin {
  let faceTop = Infinity;
  let faceBottom = -Infinity;
  for (const slot of FACE_SLOTS) {
    const face = visualFace(slot - fraction);
    const top = face.top + REST_BIAS;
    const bottom = face.bottom - REST_BIAS;
    if (bottom > 0 && top < DRUM_WINDOW) {
      faceTop = Math.min(faceTop, top);
      faceBottom = Math.max(faceBottom, bottom);
    }
  }
  if (!Number.isFinite(faceTop) || !Number.isFinite(faceBottom)) {
    const top = HOUSING_GAP;
    const bottom = DRUM_WINDOW - HOUSING_GAP;
    return { top, bottom, height: bottom - top };
  }
  const top = Math.min(HOUSING_GAP, Math.max(0, faceTop - DRUM_RIM));
  const bottom = Math.max(DRUM_WINDOW - HOUSING_GAP, Math.min(DRUM_WINDOW, faceBottom + DRUM_RIM));
  return { top, bottom, height: Math.max(0, bottom - top) };
}
