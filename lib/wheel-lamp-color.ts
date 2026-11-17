import { lampPaint, type LampPaint } from "@/lib/steampunk-light";

/**
 * Stopped lamps burn amber. A handle pull's free spin is just over 36
 * stops per second, and that speed is full steampunk orange.
 * Flicks top out at 28, so they stay short of orange.
 */
export const WHEEL_LAMP_AMBER = "#ffb547";
export const WHEEL_LAMP_ORANGE = "#ff7a1a";
export const WHEEL_LAMP_FULL_SPEED = 36;

/** Existing glow-disc color. Its lightness stays put so the bloom does not dim. */
const GLOW_DISC = "#ffcf70";

type Oklch = { l: number; c: number; h: number };

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function srgbToLinear(channel: number): number {
  const x = channel / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(channel: number): number {
  const x = Math.min(1, Math.max(0, channel));
  const encoded = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, encoded)) * 255);
}

function parseHex(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function oklchOf(hex: string): Oklch {
  const [red, green, blue] = parseHex(hex);
  const r = srgbToLinear(red);
  const g = srgbToLinear(green);
  const b = srgbToLinear(blue);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);
  const lightness = 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot;
  const a = 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot;
  const bAxis = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot;
  let hue = (Math.atan2(bAxis, a) * 180) / Math.PI;
  if (hue < 0) hue += 360;
  return { l: lightness, c: Math.hypot(a, bAxis), h: hue };
}

function linearChannels(color: Oklch): [number, number, number] {
  const hue = (color.h * Math.PI) / 180;
  const a = color.c * Math.cos(hue);
  const b = color.c * Math.sin(hue);
  const lRoot = color.l + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = color.l - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = color.l - 0.0894841775 * a - 1.291485548 * b;
  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const s = sRoot ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function inGamut(channels: [number, number, number]): boolean {
  return channels.every((channel) => channel >= -1e-4 && channel <= 1 + 1e-4);
}

function hexFromOklch(color: Oklch): string {
  let chroma = Math.max(0, color.c);
  let channels = linearChannels({ ...color, c: chroma });
  if (!inGamut(channels)) {
    let low = 0;
    let high = chroma;
    for (let step = 0; step < 24; step += 1) {
      chroma = (low + high) / 2;
      channels = linearChannels({ ...color, c: chroma });
      if (inGamut(channels)) low = chroma;
      else high = chroma;
    }
    channels = linearChannels({ ...color, c: low });
  }
  const [red, green, blue] = channels.map(linearToSrgb);
  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function lerpHue(from: number, to: number, t: number): number {
  let delta = to - from;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  const hue = from + delta * t;
  return (hue + 360) % 360;
}

/** 0 is amber, 1 is steampunk orange, and the mix stays in OKLCH. */
export function wheelLampColor(speed: number): string {
  const t = clamp01(speed);
  if (t === 0) return WHEEL_LAMP_AMBER;
  if (t === 1) return WHEEL_LAMP_ORANGE;
  const amber = oklchOf(WHEEL_LAMP_AMBER);
  const orange = oklchOf(WHEEL_LAMP_ORANGE);
  return hexFromOklch({
    l: amber.l + (orange.l - amber.l) * t,
    c: amber.c + (orange.c - amber.c) * t,
    h: lerpHue(amber.h, orange.h, t),
  });
}

/** Same hue as the light, at the old glow-disc lightness, so the bloom stays as bright. */
export function wheelLampBloom(speed: number): string {
  const amber = oklchOf(WHEEL_LAMP_AMBER);
  const gold = oklchOf(GLOW_DISC);
  const sample = oklchOf(wheelLampColor(speed));
  const scale = amber.c === 0 ? 1 : sample.c / amber.c;
  return hexFromOklch({ l: gold.l, c: gold.c * scale, h: sample.h });
}

function mixHex(from: string, to: string, t: number): string {
  const read = (hex: string) => Number.parseInt(hex.slice(1), 16);
  const start = read(from);
  const end = read(to);
  const channel = (shift: number) => {
    const fromChannel = (start >> shift) & 255;
    const toChannel = (end >> shift) & 255;
    return Math.round(fromChannel + (toChannel - fromChannel) * t);
  };
  const rgb = (channel(16) << 16) | (channel(8) << 8) | channel(0);
  return `#${rgb.toString(16).padStart(6, "0")}`;
}

function withAlpha(hex: string, alpha: number): string {
  const channel = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
  return `${hex}${channel.toString(16).padStart(2, "0")}`;
}

/** The cage's floor spill. Alphas stay 0.50, 0.28, and 0. Only the hue moves. */
export function wheelLampCast(speed: number): { inner: string; mid: string; outer: string } {
  const amber = oklchOf(WHEEL_LAMP_AMBER);
  const sample = oklchOf(wheelLampColor(speed));
  const scale = amber.c === 0 ? 1 : sample.c / amber.c;
  const shift = (hex: string) => {
    const color = oklchOf(hex);
    return hexFromOklch({ l: color.l, c: color.c * scale, h: sample.h });
  };
  return {
    inner: withAlpha(shift("#ffd68c"), 0.5),
    mid: withAlpha(shift("#ffaa40"), 0.28),
    outer: withAlpha(shift("#e68c28"), 0),
  };
}

export type WheelLampPaint = LampPaint & {
  color: string;
  bloom: string;
  castInner: string;
  castMid: string;
  castOuter: string;
};

/**
 * Brightness, opacity, and the hot core stay on the existing lamp curve.
 * The saturated color follows wheel speed.
 */
export function wheelLampPaint(energy: number, speed: number): WheelLampPaint {
  const base = lampPaint(energy);
  const level = clamp01(energy);
  const color = wheelLampColor(speed);
  const bloom = wheelLampBloom(speed);
  const cast = wheelLampCast(speed);
  return {
    ...base,
    bulbMid: mixHex("#6e655c", bloom, level),
    bulbEdge: mixHex("#4a433c", color, level),
    color,
    bloom,
    castInner: cast.inner,
    castMid: cast.mid,
    castOuter: cast.outer,
  };
}

/** Handle-pull free spin is 1. A stopped wheel is 0. */
export function normalizeWheelSpeed(stopsPerSecond: number): number {
  if (!Number.isFinite(stopsPerSecond)) return 0;
  return Math.min(1, Math.abs(stopsPerSecond) / WHEEL_LAMP_FULL_SPEED);
}
