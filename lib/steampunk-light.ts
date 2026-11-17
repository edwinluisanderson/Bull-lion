/** Corner rivets on the plates. The light is drawn a little larger than this. */
export const RIVET_PX = 12;
/** Decorative lamp, viewed from above. Slightly larger than a rivet. */
export const STEAMPUNK_LIGHT_PX = 18;
/** How many lamps sit across the temporary bottom plate. */
export const STEAMPUNK_LIGHT_COUNT = 5;
/** Cage bars in each direction, seen from above. */
export const CAGE_EACH_WAY = 3;

const CENTER = 16;
const GLASS_RADIUS = 11.2;

/** Three bars across and three down, each bent so it reads as arching over the dome. */
export function cagePaths(): { axis: "across" | "down"; d: string }[] {
  const slots = [-5.8, 0, 5.8];
  const across = slots.map((offset) => {
    const y = CENTER + offset;
    const half = Math.sqrt(GLASS_RADIUS ** 2 - offset ** 2);
    const bow = offset === 0 ? -0.75 : Math.sign(offset) * 1.7;
    const y1 = y.toFixed(2);
    return {
      axis: "across" as const,
      d: `M ${(CENTER - half).toFixed(2)} ${y1} Q ${CENTER} ${(y + bow).toFixed(2)} ${(CENTER + half).toFixed(2)} ${y1}`,
    };
  });
  const down = slots.map((offset) => {
    const x = CENTER + offset;
    const half = Math.sqrt(GLASS_RADIUS ** 2 - offset ** 2);
    const bow = offset === 0 ? -0.75 : Math.sign(offset) * 1.7;
    const x1 = x.toFixed(2);
    return {
      axis: "down" as const,
      d: `M ${x1} ${(CENTER - half).toFixed(2)} Q ${(x + bow).toFixed(2)} ${CENTER} ${x1} ${(CENTER + half).toFixed(2)}`,
    };
  });
  return [...across, ...down];
}
