/** Shortest signed step from `current` onto `index`, keeping the drum's direction. */
export function nextMetalNamePosition(current: number, index: number, count: number): number {
  if (count <= 0) return 0;
  const target = mod(index, count);
  const base = mod(current, count);
  let delta = target - base;
  if (delta > count / 2) delta -= count;
  if (delta < -count / 2) delta += count;
  return current + delta;
}

/** Bring a spun position back onto the first copy of the drum without changing the face. */
export function foldMetalNamePosition(position: number, count: number): number {
  if (count <= 0) return 0;
  return mod(position, count);
}

export function metalNameAt(position: number, names: readonly string[]): string {
  if (names.length === 0) return "";
  return names[mod(position, names.length)] ?? "";
}

function mod(value: number, count: number): number {
  return ((value % count) + count) % count;
}
