/**
 * MOCKUP ONLY (local/compact-DO-NOT-PUSH): round 4 gap ornaments for plate d3, drawn as original
 * vectors after Scout's Colombian goldwork notes (reference only; nothing traced or embedded).
 * Each fills one gap between two dials; the same ornament goes in both gaps.
 *   orn=3  Nariño "disco giratorio": a bold rotating double spiral in a ring, comb crescent below
 *   orn=4  Tolima "avioncito": shuttle body, openwork triangle wings with double spirals, tail bar
 *   orn=5  Tairona coil / Muisca sunburst: a toothed sun-gear around a coiled spring, three hanging discs
 */
import { circ, f, roundRect, type CastShapes } from "@/components/cast-brass";

/** Scout's palette, sampled from the reference photos: highlight, primary, antique brass, deep bronze. */
export const COLOMBIAN_GOLD: [number, string][] = [[0, "#D6B97F"], [0.3, "#D6B97F"], [0.6, "#C19137"], [0.84, "#8A6913"], [1, "#643E0F"]];

type Out = CastShapes;

/** Archimedean spiral polyline from radius r0 to r1, starting angle th0 (rad), `turns` turns, dir ±1. */
function spiral(cx: number, cy: number, r0: number, r1: number, th0: number, turns: number, dir: number, N = 120) {
  let d = "";
  for (let i = 0; i <= N; i++) {
    const t = i / N, th = th0 + dir * t * turns * Math.PI * 2, r = r0 + (r1 - r0) * t;
    d += `${i ? "L" : "M"} ${f(cx + r * Math.cos(th))} ${f(cy + r * Math.sin(th))} `;
  }
  return d;
}

/** A filled ring as one nonzero path: outer polygon one way, inner polygon the other way. */
function ringPoly(outer: [number, number][], cx: number, cy: number, ri: number) {
  const o = outer.map(([x, y], i) => `${i ? "L" : "M"} ${f(x)} ${f(y)}`).join(" ") + " Z";
  const n = 48;
  let inner = "";
  for (let k = 0; k <= n; k++) {
    const a = (-k / n) * Math.PI * 2; // reverse winding
    inner += `${k ? "L" : "M"} ${f(cx + ri * Math.cos(a))} ${f(cy + ri * Math.sin(a))} `;
  }
  return `${o} ${inner}Z`;
}

function ringCirc(cx: number, cy: number, ro: number, ri: number) {
  const pts: [number, number][] = [];
  for (let k = 0; k < 48; k++) { const a = (k / 48) * Math.PI * 2; pts.push([cx + ro * Math.cos(a), cy + ro * Math.sin(a)]); }
  return ringPoly(pts, cx, cy, ri);
}

/** (3) Nariño rotating disc: two interleaved arms wind out from a boss and join a heavy rim. */
export function narinoDisc(out: Out, eng: string[], x: number, y0: number, H: number, W: number) {
  const R = Math.min(W / 2 - 0.4, H * 0.31);
  const yc = y0 + Math.max(R + 3.2, H * 0.38);
  // suspension loop above
  out.strokes.push({ d: circ(x, yc - R - 1.6, 1.7), w: 1.3 });
  // heavy rim
  out.fills.push(ringCirc(x, yc, R, R - 2));
  // the rotating double spiral: two arms meet in an S at the centre and sweep out to the rim
  const arm = Math.max(2.4, R * 0.2);
  for (const a0 of [0, Math.PI]) out.strokes.push({ d: spiral(x, yc, 0.4, R - 1.4, a0 - Math.PI / 2, 0.78, 1), w: arm });
  // a cast dot in each eye of the S, like the disc's punched centres
  for (const a0 of [0, Math.PI]) {
    const a = a0 + Math.PI * 0.25;
    out.fills.push(circ(x + R * 0.36 * Math.cos(a), yc + R * 0.36 * Math.sin(a), Math.max(1.2, R * 0.1)));
  }
  // neck and comb crescent (after the Nariño nose ornament's toothed scrolls)
  const yt = yc + R - 0.6, yk = Math.min(y0 + H - 5.5, yt + H * 0.14);
  out.strokes.push({ d: `M ${f(x)} ${f(yt)} L ${f(x)} ${f(yk)}`, w: 2.2 });
  const cw = Math.min(W * 0.46, R * 1.1), ch = Math.min(5.5, y0 + H - yk - 0.8);
  out.fills.push(`M ${f(x - cw)} ${f(yk)} Q ${f(x)} ${f(yk + ch * 2.1)} ${f(x + cw)} ${f(yk)} Q ${f(x)} ${f(yk + ch * 0.9)} ${f(x - cw)} ${f(yk)} Z`);
  for (const u of [-0.55, 0, 0.55]) out.fills.push(`M ${f(x + u * cw - 1.3)} ${f(yk + ch * 0.62)} L ${f(x + u * cw)} ${f(yk + ch * 0.62 - 3.2)} L ${f(x + u * cw + 1.3)} ${f(yk + ch * 0.62)} Z`);
  eng.push(circ(x, yc, R - 3.4));
}

/** (4) Tolima avioncito: head with scroll ears, ringed neck, tapered shuttle body, spiral wings, tail bar, loop. */
export function tolimaAvioncito(out: Out, eng: string[], x: number, y0: number, H: number, W: number) {
  const Y = (v: number) => y0 + v * H, hw = W / 2;
  // head and its two scroll ears (the pendant's crest)
  const headW = Math.max(7, W * 0.32);
  out.fills.push(roundRect(x - headW / 2, Y(0.1), headW, H * 0.11, 2.4));
  // crest: two scrolls curling out and down off the crown
  for (const sd of [-1, 1]) {
    const cr = Math.min(3.3, W * 0.11);
    out.strokes.push({ d: spiral(x + sd * (headW * 0.5 + cr * 0.35), Y(0.1) - cr * 0.15, 0.5, cr, sd > 0 ? Math.PI : 0, 1.15, -sd, 50), w: 1.5 });
  }
  // shuttle body: shoulders under the head, tapering to the tail
  out.fills.push(`M ${f(x - headW * 0.42)} ${f(Y(0.19))} L ${f(x + headW * 0.42)} ${f(Y(0.19))} C ${f(x + headW * 0.5)} ${f(Y(0.45))} ${f(x + W * 0.09)} ${f(Y(0.66))} ${f(x + W * 0.06)} ${f(Y(0.76))} L ${f(x - W * 0.06)} ${f(Y(0.76))} C ${f(x - W * 0.09)} ${f(Y(0.66))} ${f(x - headW * 0.5)} ${f(Y(0.45))} ${f(x - headW * 0.42)} ${f(Y(0.19))} Z`);
  // openwork triangle wings, each enclosing a double spiral that winds in from the frame
  for (const sd of [-1, 1]) {
    const a: [number, number] = [x + sd * headW * 0.4, Y(0.22)];
    const b: [number, number] = [x + sd * (hw - 1), Y(0.45)];
    const c: [number, number] = [x + sd * W * 0.1, Y(0.66)];
    out.strokes.push({ d: `M ${f(a[0])} ${f(a[1])} L ${f(b[0])} ${f(b[1])} L ${f(c[0])} ${f(c[1])}`, w: 2.1 });
    // incentre-ish anchor for the spiral
    const sx = x + sd * (hw * 0.5), sy = Y(0.445), sr = Math.min(hw * 0.36, H * 0.1);
    out.strokes.push({ d: spiral(sx, sy, 0.5, sr, sd > 0 ? Math.PI * 0.25 : Math.PI * 0.75, 1.35, -sd, 60), w: 1.7 });
    // the spiral's tail runs back to the wing's lower edge so it is cast in one piece
    const ex = sx + sr * Math.cos((sd > 0 ? Math.PI * 0.25 : Math.PI * 0.75) - sd * 1.35 * Math.PI * 2);
    const ey = sy + sr * Math.sin((sd > 0 ? Math.PI * 0.25 : Math.PI * 0.75) - sd * 1.35 * Math.PI * 2);
    out.strokes.push({ d: `M ${f(ex)} ${f(ey)} L ${f((b[0] + c[0]) / 2)} ${f((b[1] + c[1]) / 2)}`, w: 1.5 });
  }
  // tail plane: a rounded bar with three cast beads at the hub
  const ty = Y(0.75), tw = W * 0.4;
  out.fills.push(roundRect(x - tw, ty - 1.7, tw * 2, 3.4, 1.7));
  for (const u of [-1, 0, 1]) out.fills.push(circ(x + u * 2.6, ty, 1.7));
  // hanging loop
  out.strokes.push({ d: `M ${f(x)} ${f(ty + 1.5)} L ${f(x)} ${f(Y(0.86))} A 2.4 2.4 0 1 0 ${f(x + 0.01)} ${f(Y(0.86))}`, w: 1.4 });
  // engraved eyes, neck rings and the body's centre seam
  eng.push(`M ${f(x - headW * 0.26)} ${f(Y(0.125))} L ${f(x - headW * 0.07)} ${f(Y(0.125))} M ${f(x + headW * 0.07)} ${f(Y(0.125))} L ${f(x + headW * 0.26)} ${f(Y(0.125))}`);
  for (const v of [0.23, 0.27, 0.31]) eng.push(`M ${f(x - headW * 0.36)} ${f(Y(v))} L ${f(x + headW * 0.36)} ${f(Y(v))}`);
  eng.push(`M ${f(x)} ${f(Y(0.34))} L ${f(x)} ${f(Y(0.7))}`);
}

/** (5) Tairona coil in a Muisca sunburst: a toothed sun-gear ring round a coiled spring, three hanging discs. */
export function taironaSunGear(out: Out, eng: string[], x: number, y0: number, H: number, W: number) {
  const ro = Math.min(W / 2 - 0.4, H * 0.3);
  const yc = y0 + Math.max(ro + 3.2, H * 0.36);
  const rr = ro * 0.78, ri = ro * 0.56, teeth = 12;
  const pts: [number, number][] = [];
  for (let k = 0; k < teeth; k++) {
    const a0 = (k / teeth) * Math.PI * 2 - Math.PI / 2, w = (Math.PI * 2) / teeth;
    // pointed sun rays that still read as gear teeth: wide root, blunt tip
    for (const [r, a] of [[rr, a0], [ro, a0 + w * 0.32], [ro, a0 + w * 0.5], [rr, a0 + w * 0.82]] as const) pts.push([x + r * Math.cos(a), yc + r * Math.sin(a)]);
  }
  out.fills.push(ringPoly(pts, x, yc, ri));
  // the coil: a watch-spring that starts at the boss and joins the ring
  out.strokes.push({ d: spiral(x, yc, 2, ri + 0.4, -Math.PI / 2, 1.6, 1), w: Math.max(1.5, ri * 0.2) });
  out.fills.push(circ(x, yc, 2.6));
  out.rivets.push([x, yc, Math.min(1.6, ro * 0.12)]);
  // suspension loop
  out.strokes.push({ d: circ(x, yc - ro - 1.5, 1.6), w: 1.2 });
  // three hanging discs on wires, after the Tairona pendants' dangles
  const yb = yc + ro - 0.6, yd = Math.min(y0 + H - 3, yb + H * 0.2);
  const sp = Math.min(W * 0.3, ro * 0.7);
  for (const u of [-1, 0, 1]) {
    const dx = x + u * sp, dy = yd - (u === 0 ? 0 : 2.2);
    out.strokes.push({ d: `M ${f(x + u * sp * 0.4)} ${f(yb)} L ${f(dx)} ${f(dy - 2)}`, w: 1.1 });
    out.fills.push(circ(dx, dy, u === 0 ? 2.8 : 2.3));
    eng.push(circ(dx, dy, u === 0 ? 1.3 : 1));
  }
  eng.push(circ(x, yc, rr - 1.2));
}

export function colombianOrnament(kind: string, out: Out, eng: string[], x: number, y0: number, H: number, W: number) {
  if (kind === "3") narinoDisc(out, eng, x, y0, H, W);
  else if (kind === "4") tolimaAvioncito(out, eng, x, y0, H, W);
  else taironaSunGear(out, eng, x, y0, H, W);
}
