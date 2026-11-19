/**
 * MOCKUP ONLY (local/compact-DO-NOT-PUSH): round 5 gap piece for plate d3 (orn=6 / orn=7).
 * One gold casting per gap: the top rail, a double spiral hanging from it whose outer curls run into
 * both gauge rings, and under it an original stepped "frog" figure after Edwin's stamp reference
 * (rounded head, stepped arms and legs, striped body, small triangle details) whose hands and feet
 * run into both rings and whose plinth tucks under the name-plate cartouches. Nothing is traced.
 * The piece is drawn behind the brass, so every contact simply disappears under a ring: no welds.
 *   style "A": two mirrored spirals side by side (the orn=2 Quimbaya pair, bigger, curling outward)
 *   style "B": the orn=3 Nariño S split, each curl winding into one gauge
 *   etched:    the figure's cut-outs become faint, shallow etched lines on a solid silhouette
 */
import { circ, f, type CastShapes } from "@/components/cast-brass";

/** Scout's palette, banded so the whole 80px-tall piece sits in highlight and primary gold, with the antique brass and deep bronze kept for the lowest edge. */
export const FIGURE_GOLD: [number, string][] = [[0, "#D6B97F"], [0.5, "#D6B97F"], [0.8, "#C19137"], [0.95, "#8A6913"], [1, "#643E0F"]];

type Ring = { cx: number; cy: number };
export type Etch = string[];

/** Outward spiral polyline: angle runs from thEnd + dir*2πT back to thEnd, radius r0 -> r1. */
function spiralTo(cx: number, cy: number, r0: number, r1: number, thEnd: number, turns: number, dir: 1 | -1, N = 120) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, th = thEnd + dir * (1 - t) * turns * Math.PI * 2, r = r0 + (r1 - r0) * t;
    pts.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]);
  }
  return pts;
}
const poly = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"} ${f(x)} ${f(y)}`).join(" ");
const rot = (pts: [number, number][], m: number, c: number) => pts.map(([x, y]) => [2 * m - x, 2 * c - y] as [number, number]);
const mir = (pts: [number, number][], m: number) => pts.map(([x, y]) => [2 * m - x, y] as [number, number]);

export function spiralFigure(
  style: "A" | "B", etched: boolean, out: CastShapes, eng: string[], etch: Etch,
  A: Ring, B: Ring, R: number, Ro: number, railD: string, railY: number, yBase: number,
) {
  const m = (A.cx + B.cx) / 2, cy = A.cy;
  // hidden contact radius: inside the brass ring band, clear of the dial opening (R + 0.4)
  const rc = R + 2;
  const xL = (y: number) => A.cx + Math.sqrt(Math.max(0, rc * rc - (y - cy) ** 2));
  const xR = (y: number) => B.cx - Math.sqrt(Math.max(0, rc * rc - (y - cy) ** 2));
  const W = 2.5; // spiral wire

  // the top rail, cast in the same gold as the rest of the piece
  out.strokes.push({ d: railD, w: 1.9 });

  let yHead: number;
  if (style === "A") {
    // two mirrored spirals that meet at the centre line, tops fused into the rail
    const rs = Math.min(9.6, (xR(cy) - xL(cy)) / 4);
    const ys = railY + rs - 0.4;
    const left = spiralTo(m - rs, ys, 1.1, rs, Math.PI, 1.55, 1);
    const [ex, ey] = left[left.length - 1];
    const tail: [number, number][] = [];
    const ty = ys + rs * 0.85, tx = xL(ty) - 1;
    for (let i = 1; i <= 16; i++) {
      const t = i / 16; // quadratic: heads down from the spiral's outer point, then out into the ring
      const qx = (1 - t) ** 2 * ex + 2 * (1 - t) * t * (ex - 1.5) + t * t * tx;
      const qy = (1 - t) ** 2 * ey + 2 * (1 - t) * t * (ey + rs * 0.7) + t * t * ty;
      tail.push([qx, qy]);
    }
    const L = [...left, ...tail];
    out.strokes.push({ d: poly(L), w: W });
    out.strokes.push({ d: poly(mir(L, m)), w: W });
    yHead = ys + rs - 1.2;
  } else {
    // the Nariño S, split: a centre stroke whose two ends wind out into fat curls against each ring
    const ys = railY + 10.4;
    const rs = 10.4;
    const cxL = Math.max(m - 15.5, xL(ys) + rs - 1.4);
    const left = spiralTo(cxL, ys, 1.1, rs, Math.PI / 2, 1.5, 1); // ends at its bottom, heading right
    const [sx, sy] = left[left.length - 1];
    const S: [number, number][] = [];
    for (let i = 1; i <= 24; i++) {
      const t = i / 24, ex = 2 * m - sx, ey = 2 * ys - sy, k = (m - sx) * 0.85;
      const bx = (1 - t) ** 3 * sx + 3 * (1 - t) ** 2 * t * (sx + k) + 3 * (1 - t) * t * t * (ex - k) + t ** 3 * ex;
      const by = (1 - t) ** 3 * sy + 3 * (1 - t) ** 2 * t * sy + 3 * (1 - t) * t * t * ey + t ** 3 * ey;
      S.push([bx, by]);
    }
    out.strokes.push({ d: poly([...left, ...S]), w: W });
    out.strokes.push({ d: poly(rot(left, m, ys)), w: W });
    // the S's centre drops straight into the head
    out.strokes.push({ d: `M ${f(m)} ${f(ys)} L ${f(m)} ${f(ys + rs - 2)}`, w: 2.6 });
    yHead = ys + rs - 2.2;
  }

  // ---- the stepped figure ----
  const y = (v: number) => yHead + v;
  const hr = 6.2; // head half-width
  const ARM0 = 7.4, ARM1 = 13.2, BODY1 = 19.6, LEG1 = 25.4;
  const yFeet1 = Math.min(y(31.4), yBase - 5.5);
  const holes: string[] = [], lines: string[] = [];
  // rounded head: a dome with a flat chin that runs into the arm bar
  out.fills.push(`M ${f(m - hr)} ${f(y(ARM0 + 0.5))} L ${f(m - hr)} ${f(y(5.4))} A ${f(hr)} ${f(5.4)} 0 0 1 ${f(m + hr)} ${f(y(5.4))} L ${f(m + hr)} ${f(y(ARM0 + 0.5))} Z`);
  // outstretched arms: a bar from ring to ring, raised hand blocks stepped up at each end
  const bar = (y0: number, y1: number, inset = 0) =>
    `M ${f(xL(y0) - inset)} ${f(y0)} L ${f(xR(y0) + inset)} ${f(y0)} L ${f(xR(y1) + inset)} ${f(y1)} L ${f(xL(y1) - inset)} ${f(y1)} Z`;
  out.fills.push(bar(y(ARM0), y(ARM1)));
  const handTop = y(2.2), blk = 8;
  for (const sd of [-1, 1]) {
    const xe = sd < 0 ? xL : xR;
    const x0 = Math.min(xe(handTop), xe(y(ARM0))) * 1, xi = (sd < 0 ? xL(y(ARM0)) + blk : xR(y(ARM0)) - blk);
    out.fills.push(`M ${f(xe(handTop))} ${f(handTop)} L ${f(xi)} ${f(handTop)} L ${f(xi)} ${f(y(ARM0) + 0.6)} L ${f(xe(y(ARM0) + 0.6))} ${f(y(ARM0) + 0.6)} Z`);
    void x0;
  }
  // striped body
  const bw = 4.8;
  out.fills.push(`M ${f(m - bw)} ${f(y(ARM1) - 0.5)} L ${f(m + bw)} ${f(y(ARM1) - 0.5)} L ${f(m + bw)} ${f(y(BODY1) + 0.5)} L ${f(m - bw)} ${f(y(BODY1) + 0.5)} Z`);
  for (const u of [-2.6, 0, 2.6]) {
    holes.push(`M ${f(m + u - 0.55)} ${f(y(ARM1 + 1.1))} H ${f(m + u + 0.55)} V ${f(y(BODY1 - 1.1))} H ${f(m + u - 0.55)} Z`);
    lines.push(`M ${f(m + u)} ${f(y(ARM1 + 1.1))} V ${f(y(BODY1 - 1.1))}`);
  }
  // outstretched legs: bar ring to ring, feet stepped down at each end
  out.fills.push(bar(y(BODY1), y(LEG1)));
  for (const sd of [-1, 1]) {
    const xe = sd < 0 ? xL : xR;
    const xi = sd < 0 ? xL(y(LEG1)) + blk : xR(y(LEG1)) - blk;
    out.fills.push(`M ${f(xe(y(LEG1) - 0.6))} ${f(y(LEG1) - 0.6)} L ${f(xi)} ${f(y(LEG1) - 0.6)} L ${f(xi)} ${f(yFeet1)} L ${f(xe(yFeet1))} ${f(yFeet1)} Z`);
  }
  // plinth: the base runs down between the feet and tucks under both name-plate cartouches
  out.fills.push(`M ${f(m - 5)} ${f(y(LEG1) - 0.5)} L ${f(m + 5)} ${f(y(LEG1) - 0.5)} L ${f(m + 5)} ${f(yBase - 4)} L ${f(m + 14)} ${f(yBase - 4)} L ${f(m + 14)} ${f(yBase + 2)} L ${f(m - 14)} ${f(yBase + 2)} L ${f(m - 14)} ${f(yBase - 4)} L ${f(m - 5)} ${f(yBase - 4)} Z`);

  // small triangle details (pointing outward, in facing pairs like the stamp's "> <" marks)
  const tri = (x: number, yc: number, sd: number, w = 2.3, h = 3) => {
    holes.push(`M ${f(x)} ${f(yc - h / 2)} L ${f(x + sd * w)} ${f(yc)} L ${f(x)} ${f(yc + h / 2)} Z`);
    lines.push(`M ${f(x)} ${f(yc - h / 2)} L ${f(x + sd * w)} ${f(yc)} L ${f(x)} ${f(yc + h / 2)}`);
  };
  const armMid = y((ARM0 + ARM1) / 2), legMid = y((BODY1 + LEG1) / 2);
  for (const sd of [-1, 1]) {
    const bodyEdge = m + sd * (hr + 1.2);
    tri(bodyEdge + sd * 0.4, armMid, sd);
    tri(bodyEdge + sd * 4.4, armMid, sd);
    tri(m + sd * (bw + 1.2), legMid, sd);
    tri(m + sd * (bw + 5.2), legMid, sd);
    const hx = sd < 0 ? xL(handTop + 3) + blk * 0.5 : xR(handTop + 3) - blk * 0.5;
    tri(hx - sd * 1.1, (handTop + y(ARM0)) / 2, -sd, 2.1, 2.7);
    const fx = sd < 0 ? xL(yFeet1 - 3) + blk * 0.5 : xR(yFeet1 - 3) - blk * 0.5;
    tri(fx - sd * 1.1, (y(LEG1) + yFeet1) / 2, -sd, 2.1, 2.7);
  }
  // face: big round eyes, a brow-and-nose T, a striped mouth
  const ey = y(4.4);
  for (const sd of [-1, 1]) {
    holes.push(circ(m + sd * 2.7, ey, 1.25));
    lines.push(circ(m + sd * 2.7, ey, 1.1));
  }
  eng.push(`M ${f(m - 4.4)} ${f(y(2.3))} L ${f(m + 4.4)} ${f(y(2.3))} M ${f(m)} ${f(y(2.3))} L ${f(m)} ${f(y(5.4))}`);
  eng.push(`M ${f(m - 1.8)} ${f(y(6.4))} L ${f(m + 1.8)} ${f(y(6.4))}`);
  for (const sd of [-1, 1]) eng.push(circ(m + sd * 2.7, ey, 0.45));
  if (etched) etch.push(...lines);
  else out.holes.push(...holes);
}
