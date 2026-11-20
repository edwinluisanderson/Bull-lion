export type DetentInput = {
  /** This reel is inside a scripted handle pull and has not landed. */
  pullSpin: boolean;
  /** Weight, during a pull, sounds every other stop after the ice. */
  alternate: boolean;
  elapsedMs: number;
  landing: boolean;
  /** Post-ice weight stops already considered, not counting the landing. */
  alternated: number;
};

export type Detent = {
  sound: boolean;
  haptic: boolean;
  alternated: number;
};

/**
 * Whether a committed stop ticks.
 * The landing click always plays. Weight, during a pull, sounds every other stop.
 * A flick, drag, step, or stretch is not a pull spin, so it always ticks.
 */
export function detentForStop(input: DetentInput): Detent {
  const keep = input.alternated;
  if (!input.pullSpin || input.landing) {
    return { sound: true, haptic: true, alternated: keep };
  }
  if (!input.alternate) {
    return { sound: true, haptic: true, alternated: keep };
  }
  const alternated = keep + 1;
  return { sound: alternated % 2 === 1, haptic: true, alternated };
}
