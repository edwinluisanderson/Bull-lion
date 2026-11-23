export type ReelPhase = "idle" | "drag" | "coast" | "snap" | "script" | "ice";

/**
 * Tells the page when a reel is moving.
 * Entering idle always clears motion, even if the phase was already idle
 * after a settle that had announced movement.
 */
export function createReelMotion(onMotion: (moving: boolean) => void) {
  let announced = false;
  const emit = (moving: boolean) => {
    if (announced === moving) return;
    announced = moving;
    onMotion(moving);
  };
  return {
    set(current: ReelPhase, next: ReelPhase): boolean {
      if (current === next) {
        if (next === "idle") emit(false);
        return false;
      }
      emit(next !== "idle");
      return true;
    },
  };
}
