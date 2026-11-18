/**
 * MOCKUP ONLY (local/gauge-mockups-DO-NOT-PUSH): shared cast-brass language for the Art Nouveau
 * surround (variant D) and the embellishments. Shapes are unioned through a mask, then one SVG
 * filter turns the flat silhouette into lit, sand-cast relief with the bezels' #2a1a08 outline.
 */
import type { ReactNode } from "react";

export const f = (n: number) => n.toFixed(2);
export const circ = (cx: number, cy: number, r: number) =>
  `M ${f(cx - r)} ${f(cy)} a ${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0 a ${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0 Z`;

export function roundRect(x: number, y: number, w: number, h: number, r: number) {
  return `M ${f(x + r)} ${f(y)} H ${f(x + w - r)} Q ${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + r)} V ${f(y + h - r)} Q ${f(x + w)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)} H ${f(x + r)} Q ${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - r)} V ${f(y + r)} Q ${f(x)} ${f(y)} ${f(x + r)} ${f(y)} Z`;
}

/** Blunt, swelling lily bud: narrow at the stem, round at the tip. */
export function bud(x: number, y: number, len: number, wid: number, deg: number) {
  const a = (deg * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
  const P = (t: number, n: number) => `${f(x + ux * len * t + nx * n)} ${f(y + uy * len * t + ny * n)}`;
  return `M ${P(0, 1.6)} C ${P(0.45, 1.4)} ${P(0.55, wid)} ${P(0.8, wid)} C ${P(1.02, wid)} ${P(1.04, 0)} ${P(1, 0)}` +
    ` C ${P(1.04, 0)} ${P(1.02, -wid)} ${P(0.8, -wid)} C ${P(0.55, -wid)} ${P(0.45, -1.4)} ${P(0, -1.6)} Z`;
}

/**
 * Whiplash tendril: a clothoid (curvature k0 + k1*(s/L)^p) so it starts lazy and winds into a curl,
 * filled as a tapered ribbon w0 -> w1 with a round knob at the tip.
 */
export function tendril(x: number, y: number, headDeg: number, L: number, k0: number, k1: number, p: number, w0: number, w1: number) {
  const N = 64, ds = L / N, pts: [number, number, number][] = [];
  let h = (headDeg * Math.PI) / 180, px = x, py = y;
  for (let i = 0; i <= N; i++) {
    pts.push([px, py, h]);
    h += (k0 + k1 * Math.pow(i / N, p)) * ds;
    px += Math.cos(h) * ds;
    py += Math.sin(h) * ds;
  }
  const L1: string[] = [], L2: string[] = [];
  pts.forEach(([px, py, h], i) => {
    const t = i / N, w = (w0 + (w1 - w0) * Math.pow(t, 0.8)) / 2;
    const nx = -Math.sin(h), ny = Math.cos(h);
    L1.push(`${f(px + nx * w)} ${f(py + ny * w)}`);
    L2.push(`${f(px - nx * w)} ${f(py - ny * w)}`);
  });
  const [ex, ey] = pts[N];
  return `M ${L1.join(" L ")} L ${L2.reverse().join(" L ")} Z ${circ(ex, ey, w1 * 0.85)}`;
}

export type CastShapes = {
  fills: string[];
  strokes: { d: string; w: number }[];
  holes: string[];
  rivets: [number, number, number?][];
  beads: { d: string; w: number }[];
};
export const emptyShapes = (): CastShapes => ({ fills: [], strokes: [], holes: [], rivets: [], beads: [] });
export type Box = { x: number; y: number; w: number; h: number };

/**
 * One casting. `shadow` bakes the drop shadow into the filter (for the page-wide overlay, where a
 * CSS filter on the whole layer would be costly); the gauge surround uses its CSS shadow instead.
 */
export function CastPiece({ id, box, shapes: s, shadow = false, fine = false, tone, children }: { id: string; box: Box; shapes: CastShapes; shadow?: boolean; fine?: boolean; tone?: number; children?: ReactNode }) {
  const { x, y, w, h } = box;
  // small pieces stretch the gradient over `tone` px (the surround's own height) so they show the same
  // band of brass instead of squeezing all five stops into a 40px rosette
  const gh = tone ?? h, gy = tone ? y - tone * 0.12 : y;
  // small castings (4–6px stems) use a tighter height-map blur so the edges roll instead of lumping
  const blur = fine ? 1.5 : 2.4, relief = fine ? 2.6 : 3.2;
  return (
    <>
      <defs>
        {/* Older, deeper brass than the bezels so the dials still read as separate instruments */}
        <linearGradient id={`${id}-brass`} gradientUnits="userSpaceOnUse" x1={x} y1={gy} x2={x + w * 0.18} y2={gy + gh}>
          <stop offset="0" stopColor="#f6dc98" />
          <stop offset="0.22" stopColor="#d9b066" />
          <stop offset="0.55" stopColor="#a87a36" />
          <stop offset="0.85" stopColor="#6f4a1c" />
          <stop offset="1" stopColor="#a47634" />
        </linearGradient>
        <mask id={`${id}-mask`} maskUnits="userSpaceOnUse" x={x} y={y} width={w} height={h}>
          <g fill="#fff">
            {s.fills.map((d, i) => <path key={i} d={d} />)}
          </g>
          <g fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round">
            {s.strokes.map((t, i) => <path key={i} d={t.d} strokeWidth={t.w} />)}
          </g>
          <g fill="#000">{s.holes.map((d, i) => <path key={i} d={d} />)}</g>
        </mask>
        {/* Cast-metal relief: blurred alpha as a height map (+ fine sand-cast grain), lit from upper-left */}
        <filter id={`${id}-cast`} x="-5%" y="-10%" width="110%" height="120%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation={blur} result="hb" />
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="7" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.035 0" result="na" />
          <feComposite in="hb" in2="na" operator="arithmetic" k2="1" k3="1" result="h" />
          <feDiffuseLighting in="h" surfaceScale={relief} diffuseConstant="1.15" lightingColor="#fff" result="diff">
            <feDistantLight azimuth="225" elevation="50" />
          </feDiffuseLighting>
          <feSpecularLighting in="h" surfaceScale={relief} specularConstant="0.85" specularExponent="22" lightingColor="#fff1c8" result="spec">
            <feDistantLight azimuth="225" elevation="38" />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
          <feComposite in="SourceGraphic" in2="diff" operator="arithmetic" k1="1.18" result="lit" />
          <feComposite in="lit" in2="specIn" operator="arithmetic" k2="1" k3="0.6" result="shine" />
          {/* dark cast outline, same tone as the bezel's #2a1a08 edge */}
          <feMorphology in="SourceAlpha" operator="dilate" radius="0.85" result="dil" />
          <feComposite in="dil" in2="SourceAlpha" operator="out" result="ring" />
          <feFlood floodColor="#2a1a08" />
          <feComposite in2="ring" operator="in" result="edge" />
          <feComposite in="shine" in2="SourceAlpha" operator="in" result="body" />
          {shadow ? (
            <>
              <feGaussianBlur in="SourceAlpha" stdDeviation="2.6" />
              <feOffset dy="3.5" />
              <feComponentTransfer><feFuncA type="linear" slope="0.5" /></feComponentTransfer>
              <feComposite in2="SourceAlpha" operator="out" result="sh1" />
              <feGaussianBlur in="SourceAlpha" stdDeviation="0.6" />
              <feOffset dy="1" />
              <feComponentTransfer><feFuncA type="linear" slope="0.55" /></feComponentTransfer>
              <feComposite in2="SourceAlpha" operator="out" result="sh2" />
            </>
          ) : null}
          <feMerge>
            {shadow ? <feMergeNode in="sh1" /> : null}
            {shadow ? <feMergeNode in="sh2" /> : null}
            <feMergeNode in="body" />
            <feMergeNode in="edge" />
          </feMerge>
        </filter>
        <filter id={`${id}-bead`} x="-5%" y="-10%" width="110%" height="120%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="0.7" result="h" />
          <feDiffuseLighting in="h" surfaceScale="2" diffuseConstant="1.2" lightingColor="#fff" result="diff">
            <feDistantLight azimuth="225" elevation="45" />
          </feDiffuseLighting>
          <feSpecularLighting in="h" surfaceScale="2" specularConstant="0.9" specularExponent="16" lightingColor="#fff4d2" result="spec">
            <feDistantLight azimuth="225" elevation="35" />
          </feSpecularLighting>
          <feComposite in="SourceGraphic" in2="diff" operator="arithmetic" k1="1.2" result="lit" />
          <feComposite in="lit" in2="spec" operator="arithmetic" k2="1" k3="0.55" result="sh" />
          <feComposite in="sh" in2="SourceAlpha" operator="in" />
        </filter>
        <radialGradient id={`${id}-hub`} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#fff4cc" />
          <stop offset="0.45" stopColor="#c99d4c" />
          <stop offset="1" stopColor="#5e3f15" />
        </radialGradient>
      </defs>
      <g className="cast-piece">
        <g filter={`url(#${id}-cast)`}>
          <rect x={x} y={y} width={w} height={h} fill={`url(#${id}-brass)`} mask={`url(#${id}-mask)`} />
        </g>
      </g>
      {s.beads.length ? (
        <g filter={`url(#${id}-bead)`}>
          <g fill="none" stroke={`url(#${id}-brass)`} strokeLinecap="round">
            {s.beads.map((b, i) => <path key={i} d={b.d} strokeWidth={b.w} />)}
          </g>
        </g>
      ) : null}
      {children}
      {s.rivets.map(([rx, ry, r = 2.2], i) => (
        <g key={i}>
          <circle cx={rx + 0.5} cy={ry + 0.8} r={r + 0.5} fill="#1c1005" opacity="0.45" />
          <circle cx={rx} cy={ry} r={r} fill={`url(#${id}-hub)`} stroke="#3a2610" strokeWidth="0.45" />
          <line x1={rx - r * 0.65} y1={ry - r * 0.3} x2={rx + r * 0.65} y2={ry + r * 0.3} stroke="#3a2610" strokeWidth="0.5" />
        </g>
      ))}
    </>
  );
}
