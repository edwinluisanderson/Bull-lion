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

export type DrumSkin = { top: number; bottom: number; height: number };

/** The drum never changes size. Faces scroll through this fixed band. */
export const REST_DRUM: DrumSkin = {
  top: HOUSING_GAP,
  bottom: DRUM_WINDOW - HOUSING_GAP,
  height: DRUM_WINDOW - HOUSING_GAP * 2,
};

export function drumSkin(): DrumSkin {
  return REST_DRUM;
}
