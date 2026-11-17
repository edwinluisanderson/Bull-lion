import { lampPaint } from "@/lib/steampunk-light";

/** Energy added by one wheel stop. A few stops in a row reach full. */
export const WHEEL_LAMP_PULSE = 0.34;
/** Exponential decay per second. A lone pulse fades over a few seconds. */
export const WHEEL_LAMP_DECAY = 0.55;
export const WHEEL_LAMP_MAX = 1;

const energies = [0, 0, 0];
const listeners = new Set<() => void>();

export function wheelLampEnergy(index: number): number {
  return energies[index] ?? 0;
}

export function pulseEnergy(energy: number, amount = WHEEL_LAMP_PULSE): number {
  const base = Number.isFinite(energy) ? Math.max(0, energy) : 0;
  const added = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  return Math.min(WHEEL_LAMP_MAX, base + added);
}

export function decayEnergy(energy: number, dtSeconds: number, decay = WHEEL_LAMP_DECAY): number {
  const base = Number.isFinite(energy) ? Math.max(0, energy) : 0;
  if (!(dtSeconds > 0) || base === 0) return base;
  const rate = Number.isFinite(decay) ? Math.max(0, decay) : 0;
  return base * Math.exp(-rate * dtSeconds);
}

/** One reel detent. Fast steps stack until the lamp is fully bright. */
export function pulseWheelLamp(index: number): number {
  if (index < 0 || index >= energies.length) return 0;
  energies[index] = pulseEnergy(energies[index] ?? 0);
  listeners.forEach((listener) => listener());
  return energies[index] ?? 0;
}

export function decayWheelLamps(dtSeconds: number): readonly number[] {
  for (let index = 0; index < energies.length; index += 1) {
    const next = decayEnergy(energies[index] ?? 0, dtSeconds);
    energies[index] = next < 0.004 ? 0 : next;
  }
  return energies;
}

export function subscribeWheelLamps(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Paint channels the driven lamp reads from inherited custom properties. */
export function applyLampEnergy(node: HTMLElement | null, energy: number): void {
  if (!node) return;
  const paint = lampPaint(energy);
  node.style.setProperty("--lamp-core", paint.bulbCore);
  node.style.setProperty("--lamp-mid", paint.bulbMid);
  node.style.setProperty("--lamp-edge", paint.bulbEdge);
  node.style.setProperty("--lamp-glow", String(paint.glowOpacity));
  node.style.setProperty("--lamp-halo", String(paint.haloOpacity));
  node.style.setProperty("--lamp-glass", String(paint.glassWarm));
  node.style.setProperty("--lamp-bar", String(paint.barWarm));
}
