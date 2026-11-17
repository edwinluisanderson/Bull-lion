import { normalizeWheelSpeed, wheelLampPaint } from "@/lib/wheel-lamp-color";

/** A stop is a full flash. Energy does not accumulate. */
export const WHEEL_LAMP_MAX = 1;
/**
 * Decay per second after an isolated stop.
 * Half-life is about 0.12s, and the lamp is near off by 0.45s.
 */
export const WHEEL_LAMP_DECAY = 5.8;
/** Gaps this long, or the first stop, use the isolated-stop decay. */
export const WHEEL_LAMP_SLOW_INTERVAL = 0.4;
/**
 * Between rapid stops the flash is allowed to fall to this fraction of full,
 * so the next stop still reads as its own flash.
 */
export const WHEEL_LAMP_FLASH_DIP = 0.28;
/** Fastest decay. A flash still lasts about two frames at 25fps. */
export const WHEEL_LAMP_DECAY_CAP = 26;

const energies = [0, 0, 0];
const speeds = [0, 0, 0];
const rates = [WHEEL_LAMP_DECAY, WHEEL_LAMP_DECAY, WHEEL_LAMP_DECAY];
const lastPulseAt = [0, 0, 0];
const listeners = new Set<() => void>();

/** Normalized 0..1 speed for one wheel. 0 is stopped, 1 is a handle pull at full spin. */
export function wheelLampSpeed(index: number): number {
  return speeds[index] ?? 0;
}

/** The reel reports stops per second. The stored value is already normalized. */
export function setWheelLampSpeed(index: number, stopsPerSecond: number): void {
  if (index < 0 || index >= speeds.length) return;
  const next = normalizeWheelSpeed(stopsPerSecond);
  if (speeds[index] === next) return;
  speeds[index] = next;
  listeners.forEach((listener) => listener());
}

export function wheelLampEnergy(index: number): number {
  return energies[index] ?? 0;
}

/** Every stop lights the lamp fully, whatever it was doing before. */
export function pulseEnergy(): number {
  return WHEEL_LAMP_MAX;
}

export function decayEnergy(energy: number, dtSeconds: number, decay = WHEEL_LAMP_DECAY): number {
  const base = Number.isFinite(energy) ? Math.max(0, energy) : 0;
  if (!(dtSeconds > 0) || base === 0) return base;
  const rate = Number.isFinite(decay) ? Math.max(0, decay) : 0;
  return base * Math.exp(-rate * dtSeconds);
}

/** Faster stops use a faster decay, capped so the flash is still visible. */
export function decayForInterval(intervalSeconds: number): number {
  if (!(intervalSeconds > 0) || intervalSeconds >= WHEEL_LAMP_SLOW_INTERVAL) return WHEEL_LAMP_DECAY;
  const scaled = -Math.log(WHEEL_LAMP_FLASH_DIP) / intervalSeconds;
  return Math.min(WHEEL_LAMP_DECAY_CAP, Math.max(WHEEL_LAMP_DECAY, scaled));
}

/** One reel detent. The lamp flashes to full and the recent gap sets the fade. */
export function pulseWheelLamp(index: number, now = performance.now()): number {
  if (index < 0 || index >= energies.length) return 0;
  const previous = lastPulseAt[index] ?? 0;
  const interval = previous > 0 ? (now - previous) / 1000 : Number.POSITIVE_INFINITY;
  rates[index] = decayForInterval(interval);
  lastPulseAt[index] = now;
  energies[index] = pulseEnergy();
  listeners.forEach((listener) => listener());
  return energies[index] ?? 0;
}

export function decayWheelLamps(dtSeconds: number): readonly number[] {
  for (let index = 0; index < energies.length; index += 1) {
    const next = decayEnergy(energies[index] ?? 0, dtSeconds, rates[index] ?? WHEEL_LAMP_DECAY);
    energies[index] = next < 0.004 ? 0 : next;
  }
  return energies;
}

export function subscribeWheelLamps(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Paint channels the driven lamp reads from inherited custom properties. */
export function applyLampEnergy(node: HTMLElement | null, energy: number, speed = 0): void {
  if (!node) return;
  const level = Number.isFinite(energy) ? Math.min(WHEEL_LAMP_MAX, Math.max(0, energy)) : 0;
  const paint = wheelLampPaint(level, speed);
  node.style.setProperty("--lamp-core", paint.bulbCore);
  node.style.setProperty("--lamp-mid", paint.bulbMid);
  node.style.setProperty("--lamp-edge", paint.bulbEdge);
  node.style.setProperty("--lamp-glow", String(paint.glowOpacity));
  node.style.setProperty("--lamp-halo", String(paint.haloOpacity));
  node.style.setProperty("--lamp-glass", String(paint.glassWarm));
  node.style.setProperty("--lamp-bar", String(paint.barWarm));
  node.style.setProperty("--lamp-cast", String(level));
  node.style.setProperty("--lamp-color", paint.color);
  node.style.setProperty("--lamp-bloom", paint.bloom);
  node.style.setProperty("--lamp-cast-inner", paint.castInner);
  node.style.setProperty("--lamp-cast-mid", paint.castMid);
  node.style.setProperty("--lamp-cast-outer", paint.castOuter);
}
