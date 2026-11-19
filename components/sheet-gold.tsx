/**
 * MOCKUP ONLY (local/compact-DO-NOT-PUSH): round 6 gap pieces (orn=8..11) in flat, hammered sheet
 * gold after Edwin's edwin2 references (reference only; every shape here is an original vector).
 * The sheet is drawn in FRONT of the brass and clipped exactly at each gauge ring, so every part that
 * reaches a gauge meets the side of the ring rather than tucking behind it. One mask, one piece.
 */
import { circ, f } from "@/components/cast-brass";

export type Sheet = { fills: string[]; strokes: { d: string; w: number }[]; holes: string[]; emboss: string[]; dots: [number, number, number][] };
export const emptySheet = (): Sheet => ({ fills: [], strokes: [], holes: [], emboss: [], dots: [] });
type Ring = { cx: number; cy: number };

/** Scout's palette as a near-flat sheet: mostly highlight and primary gold, antique brass at the foot. */
const SHEET_STOPS: [number, string][] = [[0, "#D6B97F"], [0.4, "#D6B97F"], [0.72, "#C19137"], [1, "#8A6913"]];

const P = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"} ${f(x)} ${f(y)}`).join(" ");
const poly = (pts: [number, number][]) => P(pts) + " Z";

/**
 * The classic flat double spiral: two wide-banded coils, each sitting against its gauge ring, joined
 * across the top by one smooth bridge band with a gentle dip. Returns the coils' geometry.
 * `outward` turns them into horns (orn=10): same coils, bridge kept as the I's top bar.
 */
function doubleSpiral(s: Sheet, m: number, A: Ring, B: Ring, Ro: number, top: number, Rc = 11) {
  const band = 3.2, turns = 2, pitch = 4.1;
  const rOut = Rc - band / 2, rIn = rOut - turns * pitch;
  const cyc = top + 1.2 + Rc;
  // effective reach toward the ring (the outer turn a quarter-turn before its end) touches the ring
  const reach = rOut - pitch * 0.25 + band / 2 + 0.35;
  const dx = Math.sqrt((Ro + reach) ** 2 - (A.cy - cyc) ** 2);
  const cL = A.cx + dx, cR = B.cx - dx;
  const coil = (cx: number, sd: 1 | -1) => {
    const pts: [number, number][] = [];
    const N = 160;
    for (let i = 0; i <= N; i++) {
      const t = i / N, th = -Math.PI / 2 - (1 - t) * turns * Math.PI * 2, r = rIn + (rOut - rIn) * t;
      pts.push([cx + sd * r * Math.cos(th), cyc + r * Math.sin(th)]);
    }
    return pts;
  };
  s.strokes.push({ d: P(coil(cL, 1)), w: band });
  s.strokes.push({ d: P(coil(cR, -1)), w: band });
  // bridge band across the tops, gentle dip in the middle
  const yb = cyc - rOut, dip = 2.2;
  s.strokes.push({ d: `M ${f(cL)} ${f(yb)} C ${f(cL + 6)} ${f(yb)} ${f(m - 5)} ${f(yb + dip)} ${f(m)} ${f(yb + dip)} C ${f(m + 5)} ${f(yb + dip)} ${f(cR - 6)} ${f(yb)} ${f(cR)} ${f(yb)}`, w: band });
  return { cL, cR, cyc, Rc, bottom: cyc + rOut + band / 2 };
}

/** Small embossed face: eyes, a brow-and-nose line and a mouth, as soft raised lines. */
function face(s: Sheet, x: number, y: number, k = 1) {
  s.dots.push([x - 1.6 * k, y - 0.4 * k, 0.75 * k], [x + 1.6 * k, y - 0.4 * k, 0.75 * k]);
  s.emboss.push(`M ${f(x)} ${f(y - 0.2 * k)} L ${f(x)} ${f(y + 1.2 * k)}`, `M ${f(x - 1.3 * k)} ${f(y + 2.1 * k)} L ${f(x + 1.3 * k)} ${f(y + 2.1 * k)}`);
}


export function buildSheet(kind: string, s: Sheet, A: Ring, B: Ring, Ro: number, top: number, yBase: number) {
  const m = (A.cx + B.cx) / 2;
  const L = A.cx + 22, Rr = B.cx - 22; // deep inside the rings: the ring clip trims every reach exactly at the ring's side
  // clip: nothing of the sheet inside any gauge ring
  s.holes.push(circ(A.cx, A.cy, Ro), circ(B.cx, B.cy, Ro));
  if (kind === "10") {
    // horned two-face pectoral: horns are the flat coils, the bridge is the I's top bar,
    // the I body fills the gap, its sides meet both rings and its flared base meets the plate rail
    const ds = doubleSpiral(s, m, A, B, Ro, top, 10.4);
    const yT = ds.cyc + 1.5, yF = yBase - 0.2;
    // concave top under the horns (the coils sit on it and merge), straight sides into both rings, flat foot
    s.fills.push(`M ${f(L)} ${f(yT)} Q ${f(m)} ${f(yT + 11)} ${f(Rr)} ${f(yT)} L ${f(Rr)} ${f(yF)} L ${f(L)} ${f(yF)} Z`);
    // the foot flares: a raised hem just above the plate rail
    s.emboss.push(`M ${f(m - 15)} ${f(yF - 2.4)} Q ${f(m)} ${f(yF - 1.2)} ${f(m + 15)} ${f(yF - 2.4)}`);
    // two embossed faces: one under the horns, one in the flare
    const f1 = ds.bottom + 4.5, f2 = yBase - 10;
    for (const fy of [f1, f2]) {
      s.emboss.push(`M ${f(m - 5.6)} ${f(fy - 3.4)} Q ${f(m)} ${f(fy - 6.2)} ${f(m + 5.6)} ${f(fy - 3.4)} Q ${f(m + 6.4)} ${f(fy + 3.6)} ${f(m)} ${f(fy + 5)} Q ${f(m - 6.4)} ${f(fy + 3.6)} ${f(m - 5.6)} ${f(fy - 3.4)} Z`);
      face(s, m, fy, 1.25);
    }
    // a soft raised waist line between the faces
    s.emboss.push(`M ${f(m - 9)} ${f((f1 + f2) / 2 + 0.5)} Q ${f(m)} ${f((f1 + f2) / 2 + 2)} ${f(m + 9)} ${f((f1 + f2) / 2 + 0.5)}`);
    return;
  }
  const ds = doubleSpiral(s, m, A, B, Ro, top);
  const yH = ds.bottom + 1.6; // head centre, nestled between the coil bottoms
  if (kind === "8") {
    // flat stepped figure (refs 2/3)
    const hr = 3.9;
    s.fills.push(circ(m, yH, hr));
    s.fills.push(poly([[m - 1.6, yH + hr - 0.6], [m + 1.6, yH + hr - 0.6], [m + 1.6, yH + hr + 1.4], [m - 1.6, yH + hr + 1.4]]));
    const a0 = yH + hr + 1, a1 = a0 + 4.2; // arm bar
    const hTop = a0 - 5.5; // hands step up at the ends
    const xr = (y: number) => B.cx - Math.sqrt(Math.max(0, Ro * Ro - (y - B.cy) ** 2));
    const xl = (y: number) => A.cx + Math.sqrt(Math.max(0, Ro * Ro - (y - A.cy) ** 2));
    const stepIn = 5.4;
    // arms: a bar from ring to ring; at each end a block stepping up against the ring
    s.fills.push(poly([[L, hTop], [xl(hTop) + stepIn, hTop], [xl(hTop) + stepIn, a0], [xr(hTop) - stepIn, a0], [xr(hTop) - stepIn, hTop], [Rr, hTop], [Rr, a1], [L, a1]]));
    const b1 = a1 + 8.6; // torso
    s.fills.push(poly([[m - 3, a1 - 0.5], [m + 3, a1 - 0.5], [m + 3, b1 + 0.5], [m - 3, b1 + 0.5]]));
    const l1 = b1 + 4.2, fBot = Math.min(yBase - 2.2, l1 + 6.2); // legs bar, feet step down at the ends
    s.fills.push(poly([[L, b1], [Rr, b1], [Rr, fBot], [xr(fBot) - stepIn, fBot], [xr(fBot) - stepIn, l1], [xl(fBot) + stepIn, l1], [xl(fBot) + stepIn, fBot], [L, fBot]]));
    face(s, m, yH - 0.4, 0.95);
    // soft hammered seams where the sheet was folded flat
    s.emboss.push(`M ${f(m - 2)} ${f(a1 + 1.5)} L ${f(m - 2)} ${f(b1 - 1.5)} M ${f(m + 2)} ${f(a1 + 1.5)} L ${f(m + 2)} ${f(b1 - 1.5)}`);
    return;
  }
  const xr = (y: number) => B.cx - Math.sqrt(Math.max(0, Ro * Ro - (y - B.cy) ** 2));
  const xl = (y: number) => A.cx + Math.sqrt(Math.max(0, Ro * Ro - (y - A.cy) ** 2));
  if (kind === "9") {
    // Tolima anchor figure (refs 4/5): headdress, small face, two pairs of stepped arms, long body, crescent base
    const hr = 3.5;
    s.fills.push(circ(m, yH + 0.6, hr));
    s.fills.push(poly([[m - 5.2, yH - 2.4], [m + 5.2, yH - 2.4], [m + 3.6, yH - 0.4], [m - 3.6, yH - 0.4]])); // flat headdress
    face(s, m, yH + 0.5, 0.85);
    const u0 = yH + hr + 1.8, u1 = u0 + 3.6, step = 4.6;
    // upper arms: out to the rings, ends stepping up
    s.fills.push(poly([[L, u0 - 4.4], [xl(u0 - 4.4) + step, u0 - 4.4], [xl(u0 - 4.4) + step, u0], [xr(u0 - 4.4) - step, u0], [xr(u0 - 4.4) - step, u0 - 4.4], [Rr, u0 - 4.4], [Rr, u1], [L, u1]]));
    // lower arms: out to the rings, ends stepping down
    const w0 = u1 + 4.4, w1 = w0 + 3.6;
    s.fills.push(poly([[L, w0], [Rr, w0], [Rr, w1 + 4.4], [xr(w1 + 4.4) - step, w1 + 4.4], [xr(w1 + 4.4) - step, w1], [xl(w1 + 4.4) + step, w1], [xl(w1 + 4.4) + step, w1 + 4.4], [L, w1 + 4.4]]));
    // long body from the neck to the crescent
    const cyC = yBase - 6.2;
    s.fills.push(poly([[m - 2.8, yH + hr - 0.4], [m + 2.8, yH + hr - 0.4], [m + 2.4, cyC + 1], [m - 2.4, cyC + 1]]));
    // crescent base with curled ends, along the bottom near the name plates
    const cr = 12.5;
    s.strokes.push({ d: `M ${f(m - cr)} ${f(cyC - 2.2)} Q ${f(m - cr + 0.5)} ${f(cyC + 5.4)} ${f(m)} ${f(cyC + 5.4)} Q ${f(m + cr - 0.5)} ${f(cyC + 5.4)} ${f(m + cr)} ${f(cyC - 2.2)}`, w: 3.2 });
    for (const sd of [-1, 1]) s.fills.push(circ(m + sd * (cr - 1.6), cyC - 2.8, 2.2));
    for (const sd of [-1, 1]) s.holes.push(circ(m + sd * (cr - 1.6), cyC - 2.8, 0.8));
    s.emboss.push(`M ${f(m)} ${f(u1 + 1)} L ${f(m)} ${f(cyC - 1)}`);
    return;
  }
  // orn=11: frontal flat jaguar in the spirit of Tolima / Quimbaya feline pendants
  const hy = yH + 1.8;
  // broad, flat-topped feline head with a wide muzzle
  s.fills.push(`M ${f(m - 7.6)} ${f(hy)} C ${f(m - 7.4)} ${f(hy - 4.6)} ${f(m + 7.4)} ${f(hy - 4.6)} ${f(m + 7.6)} ${f(hy)} C ${f(m + 7.6)} ${f(hy + 3.6)} ${f(m + 4.4)} ${f(hy + 5.6)} ${f(m)} ${f(hy + 5.6)} C ${f(m - 4.4)} ${f(hy + 5.6)} ${f(m - 7.6)} ${f(hy + 3.6)} ${f(m - 7.6)} ${f(hy)} Z`);
  // short pointed ears set wide on the head
  for (const sd of [-1, 1]) s.strokes.push({ d: poly([[m + sd * 7.2, hy - 1.4], [m + sd * 6.9, hy - 5.6], [m + sd * 3.9, hy - 3.4]]), w: 0.9 }), s.fills.push(poly([[m + sd * 7.2, hy - 1.4], [m + sd * 6.9, hy - 5.6], [m + sd * 3.9, hy - 3.4]]));
  // whiskers
  for (const sd of [-1, 1]) s.emboss.push(`M ${f(m + sd * 2.6)} ${f(hy + 2.2)} L ${f(m + sd * 6.4)} ${f(hy + 1.4)} M ${f(m + sd * 2.6)} ${f(hy + 2.9)} L ${f(m + sd * 6.2)} ${f(hy + 3.2)}`);
  // face: ringed eyes, broad nose, a fanged mouth
  for (const sd of [-1, 1]) { s.emboss.push(circ(m + sd * 2.9, hy - 0.8, 1.3)); s.dots.push([m + sd * 2.9, hy - 0.8, 0.55]); }
  s.emboss.push(`M ${f(m - 1.4)} ${f(hy + 1)} L ${f(m + 1.4)} ${f(hy + 1)} L ${f(m)} ${f(hy + 2.4)} Z`);
  s.emboss.push(`M ${f(m - 3.4)} ${f(hy + 3.2)} Q ${f(m)} ${f(hy + 4.8)} ${f(m + 3.4)} ${f(hy + 3.2)} M ${f(m - 1.6)} ${f(hy + 3.6)} L ${f(m - 1.2)} ${f(hy + 4.9)} M ${f(m + 1.6)} ${f(hy + 3.6)} L ${f(m + 1.2)} ${f(hy + 4.9)}`);
  // body
  const b0 = hy + 5, b1 = yBase - 9.5;
  s.fills.push(`M ${f(m - 4.6)} ${f(b0)} L ${f(m + 4.6)} ${f(b0)} C ${f(m + 6)} ${f((b0 + b1) / 2)} ${f(m + 5)} ${f(b1)} ${f(m + 3.4)} ${f(b1 + 1.5)} L ${f(m - 3.4)} ${f(b1 + 1.5)} C ${f(m - 5)} ${f(b1)} ${f(m - 6)} ${f((b0 + b1) / 2)} ${f(m - 4.6)} ${f(b0)} Z`);
  // forelegs splayed out to the rings, broad paws pressed against them
  const fy = b0 + 2.6;
  s.fills.push(poly([[m - 3, fy - 1.8], [xl(fy) + 6, fy - 1.8], [xl(fy) + 3.5, fy - 3.6], [L, fy - 3.6], [L, fy + 3.2], [xl(fy) + 3.5, fy + 3.2], [xl(fy) + 6, fy + 1.8], [m - 3, fy + 1.8]]));
  s.fills.push(poly([[m + 3, fy - 1.8], [xr(fy) - 6, fy - 1.8], [xr(fy) - 3.5, fy - 3.6], [Rr, fy - 3.6], [Rr, fy + 3.2], [xr(fy) - 3.5, fy + 3.2], [xr(fy) - 6, fy + 1.8], [m + 3, fy + 1.8]]));
  // hind legs, angled down and out
  const hy2 = b1 - 1.4, py = Math.min(yBase - 4, hy2 + 5);
  for (const sd of [-1, 1]) {
    const xe = sd < 0 ? xl(py) : xr(py), xo = sd < 0 ? L : Rr;
    s.fills.push(poly([[m + sd * 2.5, hy2 - 1.8], [m + sd * 2.5, hy2 + 1.8], [xe - sd * 5.5, py + 0.4], [xe - sd * 3.2, py + 2.6], [xo, py + 2.6], [xo, py - 3.4], [xe - sd * 3.2, py - 3.4], [xe - sd * 6.2, py - 1.8]]));
  }
  // paw toes, embossed
  for (const [x0, yy, sd] of [[xl(fy), fy, 1], [xr(fy), fy, -1], [xl(py), py, 1], [xr(py), py, -1]] as const) {
    for (const v of [-1.6, 0, 1.6]) s.emboss.push(`M ${f(x0 + sd * 0.6)} ${f(yy + v - 0.2)} L ${f(x0 + sd * 2.4)} ${f(yy + v - 0.2)}`);
  }
  // tail: drops from the rump and curls into a flat spiral at the base
  const tc = yBase - 4.8, tx = m;
  let d = `M ${f(tx)} ${f(b1)} `;
  for (let i = 0; i <= 60; i++) { const t = i / 60, th = -Math.PI / 2 + t * Math.PI * 2 * 1.25, r = 4 - t * 2.6; d += `L ${f(tx + 4 + r * Math.cos(th + Math.PI))} ${f(tc + r * Math.sin(th + Math.PI))} `; }
  s.strokes.push({ d, w: 2.2 });
  // spots along the legs
  for (const sd of [-1, 1]) for (const u of [0.35, 0.68]) {
    const xx = m + sd * (5 + (Math.abs((sd < 0 ? xl(fy) : xr(fy)) - m) - 5) * u);
    s.dots.push([xx, fy, 0.5]);
  }
  // rosette spots, embossed
  for (const [ux, uy] of [[-2.2, 0.25], [2.2, 0.35], [0, 0.55], [-2.4, 0.75], [2.3, 0.82]] as const) {
    const sy = b0 + (b1 - b0) * uy;
    s.emboss.push(circ(m + ux, sy, 0.95));
    s.dots.push([m + ux, sy, 0.35]);
  }
}

/** Flat hammered sheet: barely raised edges, soft dimpled highlights, the bezels' #2a1a08 outline. */
export function SheetPiece({ id, w, h, s }: { id: string; w: number; h: number; s: Sheet }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-g`} gradientUnits="userSpaceOnUse" x1="0" y1={-h * 0.08} x2={w * 0.06} y2={h}>
          {SHEET_STOPS.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}
        </linearGradient>
        <mask id={`${id}-m`} maskUnits="userSpaceOnUse" x="0" y="0" width={w} height={h}>
          <g fill="#fff">{s.fills.map((d, i) => <path key={i} d={d} />)}</g>
          <g fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round">{s.strokes.map((t, i) => <path key={i} d={t.d} strokeWidth={t.w} />)}</g>
          <g fill="#000">{s.holes.map((d, i) => <path key={i} d={d} />)}</g>
        </mask>
        <filter id={`${id}-f`} x="0" y="0" width={w} height={h} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          {/* height: a shallow rolled edge plus low-frequency hammer dimples */}
          <feGaussianBlur in="SourceAlpha" stdDeviation="0.55" result="edge" />
          <feTurbulence type="fractalNoise" baseFrequency="0.3" numOctaves="2" seed="11" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.55 0 0 0 0" result="dim" />
          <feComposite in="edge" in2="dim" operator="arithmetic" k2="1" k3="0.3" result="hgt" />
          <feDiffuseLighting in="hgt" surfaceScale="1.4" diffuseConstant="1.05" lightingColor="#fff" result="diff">
            <feDistantLight azimuth="225" elevation="58" />
          </feDiffuseLighting>
          <feSpecularLighting in="hgt" surfaceScale="1.4" specularConstant="0.8" specularExponent="11" lightingColor="#fff3cf" result="spec">
            <feDistantLight azimuth="225" elevation="42" />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
          <feComposite in="SourceGraphic" in2="diff" operator="arithmetic" k1="1.32" result="lit" />
          <feComposite in="lit" in2="specIn" operator="arithmetic" k2="1" k3="0.55" result="shine" />
          <feComposite in="shine" in2="SourceAlpha" operator="in" result="body" />
          <feMorphology in="SourceAlpha" operator="dilate" radius="0.6" result="dil" />
          <feComposite in="dil" in2="SourceAlpha" operator="out" result="ring" />
          <feFlood floodColor="#2a1a08" />
          <feComposite in2="ring" operator="in" result="outl" />
          <feMerge><feMergeNode in="body" /><feMergeNode in="outl" /></feMerge>
        </filter>
      </defs>
      <g filter={`url(#${id}-f)`}>
        <rect x="0" y="0" width={w} height={h} fill={`url(#${id}-g)`} mask={`url(#${id}-m)`} />
      </g>
      {/* repoussé: soft raised lines, light on the upper-left lip and bronze on the lower-right */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
        {s.emboss.map((d, i) => <path key={`h${i}`} d={d} stroke="#fbeec8" strokeOpacity="0.55" strokeWidth="0.55" transform="translate(-0.3 -0.3)" />)}
        {s.emboss.map((d, i) => <path key={`s${i}`} d={d} stroke="#643E0F" strokeOpacity="0.6" strokeWidth="0.55" transform="translate(0.3 0.35)" />)}
      </g>
      <g pointerEvents="none">
        {s.dots.map(([x, y, r], i) => <circle key={`d${i}`} cx={x + 0.15} cy={y + 0.2} r={r} fill="#643E0F" fillOpacity="0.7" />)}
        {s.dots.map(([x, y, r], i) => <circle key={`e${i}`} cx={x - 0.2} cy={y - 0.25} r={r * 0.45} fill="#fbeec8" fillOpacity="0.6" />)}
      </g>
    </>
  );
}
