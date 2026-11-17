/** Corner rivets on the plates. The light is drawn a little larger than this. */
export const RIVET_PX = 12;
/** Decorative lamp, viewed from above. Larger than a rivet so the cage reads. */
export const STEAMPUNK_LIGHT_PX = 30;
/** How many lamps sit across the temporary bottom plate. */
export const STEAMPUNK_LIGHT_COUNT = 5;
/** Cage bars in each direction, seen from above. */
export const CAGE_EACH_WAY = 3;

/** Named levels for a lamp. The plate lamps omit the prop and keep the resting paint. */
export const LAMP_OFF = 0;
export const LAMP_LOW = 0.33;
export const LAMP_MEDIUM = 0.66;
export const LAMP_FULL = 1;

export type LampPaint = {
  bulbCore: string;
  bulbMid: string;
  bulbEdge: string;
  /** Soft disc inside the glass. Zero when the lamp is off. */
  glowOpacity: number;
  /** Warm disc that spills past the bezel onto the plate. Zero at rest and when off. */
  haloOpacity: number;
  glassWarm: number;
  barWarm: number;
};

/** The paint the five plate lamps use when no brightness is passed. */
export const LAMP_REST: LampPaint = {
  bulbCore: "#fff8dc",
  bulbMid: "#ffcf70",
  bulbEdge: "#e6a23a",
  glowOpacity: 0.28,
  haloOpacity: 0,
  glassWarm: 0,
  barWarm: 0,
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function mixHex(from: string, to: string, t: number): string {
  const read = (hex: string) => Number.parseInt(hex.slice(1), 16);
  const a = read(from);
  const b = read(to);
  const channel = (shift: number) => {
    const start = (a >> shift) & 255;
    const end = (b >> shift) & 255;
    return Math.round(start + (end - start) * t);
  };
  const rgb = (channel(16) << 16) | (channel(8) << 8) | channel(0);
  return `#${rgb.toString(16).padStart(6, "0")}`;
}

/** 0 is an unlit amber-grey bulb. 1 is full, with a warm halo and lit bars. */
export function lampPaint(brightness: number): LampPaint {
  const level = clamp01(brightness);
  return {
    bulbCore: mixHex("#8d8274", "#fff8dc", level),
    bulbMid: mixHex("#6e655c", "#ffcf70", level),
    bulbEdge: mixHex("#4a433c", "#e6a23a", level),
    glowOpacity: level === 0 ? 0 : 0.1 + 0.45 * level,
    haloOpacity: level === 0 ? 0 : 0.12 + 0.5 * level,
    glassWarm: 0.04 + 0.26 * level,
    barWarm: level === 0 ? 0 : 0.1 + 0.48 * level,
  };
}

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
