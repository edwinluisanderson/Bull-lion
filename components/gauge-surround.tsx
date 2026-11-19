"use client";
/**
 * MOCKUP ONLY (local/gauge-mockups-DO-NOT-PUSH): a cast-brass surround that wraps the three
 * round gauges, separate from each dial's own bezel. Geometry is measured from the dials so the
 * frame follows them at any width. This is the Art Nouveau casting (variant D).
 */
import { useLayoutEffect, useRef, useState } from "react";
import { CastPiece, circ, f, roundRect, bud, tendril, emptyShapes, type CastShapes } from "@/components/cast-brass";
import { colombianOrnament, COLOMBIAN_GOLD } from "@/components/colombian-ornaments";
import { spiralFigure, FIGURE_GOLD } from "@/components/spiral-figure";
import { buildSheet, emptySheet, SheetPiece, type Sheet } from "@/components/sheet-gold";

type Dial = { cx: number; cy: number; r: number; pw: number; pt: number; pb: number };
type Geo = { orn: string | null; bars: string | null; gearScale: number; plate: string | null; top: number; bottom: number; w: number; h: number; dials: Dial[]; rivL: number; rivR: number; frL: number; frR: number };

const TOP_REVEAL = 5; // px of wood left between melt plate and frame
const BOTTOM_REVEAL = 5; // px of wood left above the wheel plate

function measure(host: HTMLElement): Geo | null {
  const hb = host.getBoundingClientRect();
  const faces = [...host.querySelectorAll<SVGSVGElement>(".gauge-unit-face")];
  if (faces.length !== 3) return null;
  const plates = [...host.querySelectorAll<HTMLElement>(".gauge-nameplate")];
  const dials = faces.map((f, i) => {
    const b = f.getBoundingClientRect();
    const s = b.width / 96;
    const p = plates[i]?.getBoundingClientRect();
    return {
      cx: b.left - hb.left + 48 * s,
      cy: b.top - hb.top + 42 * s,
      r: 36.5 * s,
      pw: p ? p.width : 80,
      pt: p ? p.top - hb.top : 0,
      pb: p ? p.bottom - hb.top : 0,
    };
  });
  const prev = host.previousElementSibling as HTMLElement | null;
  const rv = (c: string) => prev?.querySelector<HTMLElement>(`.rivet[data-corner="${c}"]`)?.getBoundingClientRect();
  const bl = rv("bl"), br = rv("br");
  const fr = (c: string) => host.nextElementSibling?.querySelector<HTMLElement>(`.frame-rivet[data-corner="${c}"]`)?.getBoundingClientRect();
  const ftl = fr("tl"), ftr = fr("tr");
  const cs = getComputedStyle(host);
  const num = (n: string, d: number) => { const v = parseFloat(cs.getPropertyValue(n)); return Number.isFinite(v) ? v : d; };
  return {
    plate: "d3",
    orn: "14a",
    bars: "long",
    gearScale: 1.2,
    top: num("--wrap-top", TOP_REVEAL),
    bottom: num("--wrap-bottom", BOTTOM_REVEAL),
    w: hb.width,
    h: hb.height,
    dials,
    rivL: bl ? bl.left + bl.width / 2 - hb.left : dials[0].cx - dials[0].r - 10,
    rivR: br ? br.left + br.width / 2 - hb.left : dials[2].cx + dials[2].r + 10,
    frL: ftl ? ftl.left + ftl.width / 2 - hb.left : dials[0].cx - dials[0].r,
    frR: ftr ? ftr.left + ftr.width / 2 - hb.left : dials[2].cx + dials[2].r,
  };
}

type Shapes = CastShapes;

function build(g: Geo): Shapes {
  const { dials, h } = g;
  const cy = dials[1].cy, R = dials[1].r;
  const hole = R + 0.4;
  const out: Shapes = { fills: [], strokes: [], holes: dials.map((d) => circ(d.cx, d.cy, hole)), rivets: [], beads: [] };
  const top = g.top, bottom = h - g.bottom;

  // Art Nouveau. Heavy cast ring per dial; between the rings a stem rises from a riveted boss
  // and splits into a lyre of whiplash arms that scroll outward, with a bud between them (and the
  // same, shorter, hanging below). At the far ends a whiplash sweeps off each outer ring into a
  // volute in the corner, and another runs down and curls back under the label cartouche.
  const Ro = R + 7;
  for (const d of dials) {
    out.fills.push(circ(d.cx, d.cy, Ro));
    out.beads.push({ d: circ(d.cx, d.cy, R + 4.2), w: 1.5 });
  }
  for (let i = 0; i < 2; i++) {
    const m = (dials[i].cx + dials[i + 1].cx) / 2;
    for (const sd of [-1, 1]) {
      // MOCKUP (compact): lyre arms scale with the dial so small gauges keep the same proportions (1 at the approved 110px).
      const k = Math.min(1, R / 41.8);
      out.fills.push(tendril(m + sd * 3.4, cy - 8, -90 - sd * 3, 56 * k, 0, sd * 0.4, 3, 7, 3));
      out.fills.push(tendril(m + sd * 3.4, cy + 8, 90 + sd * 3, 44 * k, 0, -sd * 0.46, 3, 6.4, 2.6));
    }
    // lily bud between the arms, and a hanging seed-pod below
    out.fills.push(bud(m, cy - 10, cy - 10 - (top + 4), 5.6, -90));
    out.fills.push(bud(m, cy + 8, bottom - 6 - (cy + 8), 4.4, 90));
    out.fills.push(circ(m, cy, 7.4)); // waist boss bridging the two rings
    out.rivets.push([m, cy, 2.6]);
  }
  for (const sd of [-1, 1]) {
    const d = sd < 0 ? dials[0] : dials[2];
    const mx = (x: number) => (sd < 0 ? x : 2 * d.cx - x), mh = (h: number) => (sd < 0 ? h : 180 - h);
    const a42 = (42 * Math.PI) / 180, a40 = (40 * Math.PI) / 180;
    out.fills.push(tendril(mx(d.cx - Ro * Math.sin(a42) + 1.5), cy - Ro * Math.cos(a42) + 2.5, mh(-150), 46, 0, -sd * 0.45, 2, 6.6, 2.4));
    out.fills.push(tendril(mx(d.cx - Ro * Math.sin(a40) + 1.5), cy + Ro * Math.cos(a40) - 1.5, mh(165), 60, sd * 0.02, sd * 0.08, 1, 6.4, 2.4));
    out.rivets.push([d.cx + sd * (Ro - 3.4), cy, 2.4]);
  }
  for (const d of dials) {
    const aw = d.pw + 12;
    out.fills.push(roundRect(d.cx - aw / 2, d.pt - 3, aw, d.pb - d.pt + 6, 8.5));
  }
  return out;
}

/* ===== MOCKUP (compact ?plate=a|b|c): one cast backplate the three dials are set into ===== */
type Plate = { shapes: Shapes; engrave: string[]; crisp?: { d: string; slot: string; x: number; y: number; ring: number }[]; sheet?: Sheet; gold?: { shapes: Shapes; engrave: string[]; etch?: string[]; behind?: boolean } };
const P = (d: Dial, R: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return [d.cx + R * Math.cos(a), d.cy + R * Math.sin(a)] as const;
};
const xy = (p: readonly [number, number]) => `${f(p[0])} ${f(p[1])}`;
/** Centre-line of a whiplash curl, for engraved (cut-in) lines. */
function curlLine(x: number, y: number, headDeg: number, L: number, k0: number, k1: number, p: number) {
  const N = 40, ds = L / N; let h = (headDeg * Math.PI) / 180, px = x, py = y; const pts = [`${f(px)} ${f(py)}`];
  for (let i = 0; i < N; i++) { h += (k0 + k1 * Math.pow(i / N, p)) * ds; px += Math.cos(h) * ds; py += Math.sin(h) * ds; pts.push(`${f(px)} ${f(py)}`); }
  return `M ${pts.join(" L ")}`;
}
function cartouches(g: Geo, out: Shapes) {
  for (const d of g.dials) {
    const aw = d.pw + 10, y0 = d.pt - 2.5, y1 = Math.min(d.pb + 2.5, g.h - 2);
    out.fills.push(roundRect(d.cx - aw / 2, y0, aw, y1 - y0, 7));
  }
}
function endFlourish(g: Geo, out: Shapes, eng: string[], R: number, k: number) {
  const { dials } = g;
  for (const sd of [-1, 1]) {
    const d = sd < 0 ? dials[0] : dials[2];
    const mx = (x: number) => (sd < 0 ? x : 2 * d.cx - x), mh = (h: number) => (sd < 0 ? h : 180 - h);
    const top = P(d, R - 1.5, sd < 0 ? 205 : -25), bot = P(d, R - 1.5, sd < 0 ? 150 : 30);
    out.fills.push(tendril(top[0], top[1], mh(-165), 34 * k, 0, -sd * 0.55, 2, 5.6, 2.2));
    out.fills.push(tendril(bot[0], bot[1], mh(170), 30 * k, 0, sd * 0.6, 2, 5.2, 2));
    void mx;
    eng.push(curlLine(...P(d, R - 3.2, sd < 0 ? 135 : 45), mh(-90 - 0) + (sd < 0 ? 0 : 0), 14, 0, sd * 0.25, 1));
  }
}

/**
 * MOCKUP (?plate=d1|d2|d3): wraparound D's light openwork redrawn for the 75px dials. Thin cast ring
 * and bead per dial, slim lyres and lily buds at the waists, corner tendrils, lots of wood showing.
 * Everything is kept inside the svg box (top reveal to h - 2.5) so the rail can never crop it.
 */
/**
 * Tairona winged figure (orn=12/13), simplified boldly after Edwin's reference 9 (original drawing, not
 * traced): two big sweeping arcs ending in curls, a cluster of coiled discs each side, curved wings, a
 * compact head with a simple face, a body with arms on the hips and short legs. Same W x H box as the
 * fleur-de-lis, centred on x.
 */
function taironaWinged(out: Shapes, eng: string[], x: number, y0: number, H: number, W: number) {
  const X = (u: number) => x + u * W, Y = (v: number) => y0 + v * H;
  const pt = (u: number, v: number) => `${f(X(u))} ${f(Y(v))}`;
  for (const sd of [-1, 1]) {
    const u = (n: number) => n * sd;
    // big sweeping arc: rises from beside the head, over the top and down the outside, ending in a curl
    out.strokes.push({ d: `M ${pt(u(0.035), 0.34)} C ${pt(u(0.02), 0.02)} ${pt(u(0.32), -0.04)} ${pt(u(0.45), 0.05)} C ${pt(u(0.54), 0.12)} ${pt(u(0.53), 0.25)} ${pt(u(0.47), 0.3)}`, w: 2.1 });
    let d = "";
    const ccx = X(u(0.43)), ccy = Y(0.275), r0 = Math.min(3.4, W * 0.085);
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, th = (sd > 0 ? Math.PI * 0.2 : Math.PI * 0.8) + sd * t * Math.PI * 1.8, r = r0 * (1 - t * 0.62);
      d += `${i ? "L" : "M"} ${f(ccx + r * Math.cos(th))} ${f(ccy + r * Math.sin(th))} `;
    }
    out.strokes.push({ d, w: 1.8 });
    // cluster of coiled discs inside the arc
    for (const [cu, cv, rr] of [[0.17, 0.14, 0.07], [0.29, 0.16, 0.068], [0.22, 0.26, 0.06]] as const) {
      const r = rr * W, cx = X(u(cu)), cyy = Y(cv);
      out.fills.push(circ(cx, cyy, r));
      eng.push(circ(cx, cyy, r * 0.58));
      out.rivets.push([cx, cyy, Math.max(0.8, r * 0.3)]);
    }
    // curved wing: from behind the head, sweeping out and up to a pointed tip, the underside curving back
    out.fills.push(`M ${pt(u(0.08), 0.37)} C ${pt(u(0.2), 0.33)} ${pt(u(0.36), 0.33)} ${pt(u(0.46), 0.33)} C ${pt(u(0.45), 0.44)} ${pt(u(0.34), 0.55)} ${pt(u(0.1), 0.52)} Z`);
    eng.push(`M ${pt(u(0.15), 0.43)} C ${pt(u(0.25), 0.4)} ${pt(u(0.34), 0.39)} ${pt(u(0.42), 0.36)}`);
    // arms on the hips: shoulder out to the elbow, back in to the hip
    out.strokes.push({ d: `M ${pt(u(0.1), 0.55)} C ${pt(u(0.26), 0.57)} ${pt(u(0.27), 0.68)} ${pt(u(0.11), 0.73)}`, w: 2.3 });
    // short leg
    out.fills.push(`M ${pt(u(0.015), 0.8)} L ${pt(u(0.11), 0.8)} L ${pt(u(0.1), 0.93)} L ${pt(u(0.13), 0.97)} L ${pt(u(0.02), 0.97)} Z`);
  }
  // compact head with a simple face
  const hw = 0.15;
  out.fills.push(`M ${pt(-hw, 0.36)} C ${pt(-hw, 0.3)} ${pt(hw, 0.3)} ${pt(hw, 0.36)} L ${pt(hw * 0.85, 0.5)} C ${pt(hw * 0.6, 0.54)} ${pt(-hw * 0.6, 0.54)} ${pt(-hw * 0.85, 0.5)} Z`);
  for (const sd of [-1, 1]) eng.push(circ(X(sd * 0.06), Y(0.39), Math.max(0.9, W * 0.032)));
  eng.push(`M ${pt(-0.07, 0.46)} L ${pt(0.07, 0.46)} L ${pt(0.07, 0.49)} L ${pt(-0.07, 0.49)} Z M ${pt(-0.023, 0.46)} L ${pt(-0.023, 0.49)} M ${pt(0.023, 0.46)} L ${pt(0.023, 0.49)}`);
  // body, and the belt at the hips
  out.fills.push(`M ${pt(-0.11, 0.52)} L ${pt(0.11, 0.52)} C ${pt(0.13, 0.62)} ${pt(0.12, 0.72)} ${pt(0.12, 0.81)} L ${pt(-0.12, 0.81)} C ${pt(-0.12, 0.72)} ${pt(-0.13, 0.62)} ${pt(-0.11, 0.52)} Z`);
  eng.push(`M ${pt(-0.12, 0.75)} L ${pt(0.12, 0.75)}`);
}

/**
 * Round 10: crisp gear outlines for orn=14a/b/c. Same outer radius as orn=14 (S/2).
 *  a: 8 square-cut teeth, parallel sides, flat tops, clear gaps
 *  b: 10 trapezoid teeth, flat tops, sharp even edges
 *  c: 12 short teeth with round tops
 */
function crispGearPath(v: string, x: number, y: number, S: number) {
  const ro = S * 0.5;
  const teeth = v === "a" ? 8 : v === "b" ? 10 : 12;
  const rr = v === "c" ? ro - 1.9 : ro * 0.78;
  // tooth half-widths (px) at the root and at the tip
  const step = (Math.PI * 2) / teeth;
  const hw0 = v === "a" ? rr * Math.sin(step * 0.25) : v === "b" ? rr * Math.sin(step * 0.29) : rr * Math.sin(step * 0.26);
  const hw1 = v === "a" ? hw0 : v === "b" ? hw0 * 0.62 : hw0;
  let d = "";
  for (let k = 0; k < teeth; k++) {
    const a = k * step - Math.PI / 2;
    const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
    const at = (r: number, off: number) => `${f(x + ux * r + nx * off)} ${f(y + uy * r + ny * off)}`;
    const rootL = Math.sqrt(rr * rr - hw0 * hw0);
    const tipR = Math.sqrt(ro * ro - hw1 * hw1);
    if (k === 0) d += `M ${at(rootL, -hw0)} `;
    else d += `A ${f(rr)} ${f(rr)} 0 0 1 ${at(rootL, -hw0)} `;
    if (v === "c") {
      const top = ro - hw1; // the round cap ends exactly at ro
      d += `L ${at(top, -hw1)} A ${f(hw1)} ${f(hw1)} 0 0 1 ${at(top, hw1)} L ${at(rootL, hw0)} `;
    } else {
      d += `L ${at(tipR, -hw1)} L ${at(tipR, hw1)} L ${at(rootL, hw0)} `;
    }
  }
  // close along the root back to the first tooth's left root corner (x - hw0, y - rootL at -90°)
  d += `A ${f(rr)} ${f(rr)} 0 0 1 ${f(x - hw0)} ${f(y - Math.sqrt(rr * rr - hw0 * hw0))} Z`;
  return { d, rr };
}

/** A spiral slot cut through a casting: an Archimedean ribbon (r0 -> r1 over `turns`) of width w, as a fill path. */
function spiralSlot(cx: number, cy: number, r0: number, r1: number, turns: number, w: number, th0 = -Math.PI / 2) {
  const N = 90, a: string[] = [], b: string[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, th = th0 + t * turns * Math.PI * 2, r = r0 + (r1 - r0) * t;
    const x = cx + r * Math.cos(th), y = cy + r * Math.sin(th);
    // normal of the spiral is close to the radial direction
    const nx = Math.cos(th), ny = Math.sin(th);
    a.push(`${f(x + nx * w / 2)} ${f(y + ny * w / 2)}`);
    b.push(`${f(x - nx * w / 2)} ${f(y - ny * w / 2)}`);
  }
  return `M ${a.join(" L ")} L ${b.reverse().join(" L ")} Z`;
}

/**
 * Round 9 symbols (orn=14..17): small, calm cast-brass centrepieces after Edwin's symbol sheets
 * (original simplified vectors, not traced), set over the plain interlaced d3 bars. `S` is the size.
 */
function brassSymbol(kind: string, out: Shapes, eng: string[], x: number, y: number, S: number) {
  if (kind === "14") {
    // spiral gear: a cog with a spiral cut through its face and an engraved ring inside the teeth
    const ro = S * 0.5, rr = ro * 0.8, teeth = 10;
    let d = "";
    for (let k = 0; k < teeth; k++) {
      const a0 = (k / teeth) * Math.PI * 2 - Math.PI / 2, w = (Math.PI * 2) / teeth;
      for (const [r, a] of [[rr, a0], [ro, a0 + w * 0.16], [ro, a0 + w * 0.48], [rr, a0 + w * 0.64]] as const) d += `${d ? "L" : "M"} ${f(x + r * Math.cos(a))} ${f(y + r * Math.sin(a))} `;
    }
    out.fills.push(d + "Z");
    out.holes.push(spiralSlot(x, y, 0.6, rr * 0.66, 2.1, Math.max(1, S * 0.05)));
    eng.push(circ(x, y, rr * 0.8));
  } else if (kind === "15") {
    // spiral sun: a disc with a spiral cut, twelve short blunt rays
    const rd = S * 0.31, rays = 12;
    out.fills.push(circ(x, y, rd));
    for (let k = 0; k < rays; k++) {
      const a = (k / rays) * Math.PI * 2 - Math.PI / 2, w = 0.13;
      const p = (r: number, da: number) => `${f(x + r * Math.cos(a + da))} ${f(y + r * Math.sin(a + da))}`;
      out.fills.push(`M ${p(rd - 0.6, -w)} L ${p(S * 0.5, -w * 0.45)} L ${p(S * 0.5, w * 0.45)} L ${p(rd - 0.6, w)} Z`);
    }
    out.holes.push(spiralSlot(x, y, 0.5, rd * 0.72, 2, Math.max(1, S * 0.048)));
  } else if (kind === "16") {
    // lizard, head up: pointed head, long body, four splayed legs with three-toed feet, curled tail
    const u = S / 30;
    out.fills.push(`M ${f(x)} ${f(y - 15 * u)} C ${f(x + 2.6 * u)} ${f(y - 14 * u)} ${f(x + 2.9 * u)} ${f(y - 10.5 * u)} ${f(x + 2 * u)} ${f(y - 9 * u)} L ${f(x - 2 * u)} ${f(y - 9 * u)} C ${f(x - 2.9 * u)} ${f(y - 10.5 * u)} ${f(x - 2.6 * u)} ${f(y - 14 * u)} ${f(x)} ${f(y - 15 * u)} Z`);
    out.fills.push(`M ${f(x - 1.6 * u)} ${f(y - 9.5 * u)} C ${f(x - 3.6 * u)} ${f(y - 5 * u)} ${f(x - 3.6 * u)} ${f(y + 2 * u)} ${f(x - 1.4 * u)} ${f(y + 6 * u)} L ${f(x + 1.4 * u)} ${f(y + 6 * u)} C ${f(x + 3.6 * u)} ${f(y + 2 * u)} ${f(x + 3.6 * u)} ${f(y - 5 * u)} ${f(x + 1.6 * u)} ${f(y - 9.5 * u)} Z`);
    for (const sd of [-1, 1]) {
      for (const [y0, dir] of [[-5.5, -1], [2.5, 1]] as const) {
        const kx = x + sd * 7.5 * u, ky = y + (y0 + dir * 1.5) * u, fx = kx, fy = ky + dir * 3.2 * u;
        out.strokes.push({ d: `M ${f(x + sd * 2.4 * u)} ${f(y + y0 * u)} L ${f(kx)} ${f(ky)} L ${f(fx)} ${f(fy)}`, w: 2 * u });
        for (const t of [-1, 0, 1]) out.strokes.push({ d: `M ${f(fx)} ${f(fy)} L ${f(fx + t * 1.6 * u + sd * 0.4 * u)} ${f(fy + dir * 1.7 * u)}`, w: 1.35 * u });
      }
    }
    // tail down into a curl
    let d = `M ${f(x)} ${f(y + 5.5 * u)} L ${f(x)} ${f(y + 10 * u)} `;
    for (let i = 0; i <= 30; i++) { const t = i / 30, th = Math.PI + t * Math.PI * 1.6, r = 2.6 * u * (1 - t * 0.55); d += `L ${f(x + 2.6 * u + r * Math.cos(th))} ${f(y + 10 * u + r * Math.sin(th))} `; }
    out.strokes.push({ d, w: 2.2 * u });
    eng.push(`M ${f(x - 1.4 * u)} ${f(y - 4 * u)} L ${f(x + 1.4 * u)} ${f(y - 4 * u)} M ${f(x - 1.6 * u)} ${f(y - 1 * u)} L ${f(x + 1.6 * u)} ${f(y - 1 * u)} M ${f(x - 1.4 * u)} ${f(y + 2 * u)} L ${f(x + 1.4 * u)} ${f(y + 2 * u)}`);
  } else {
    // eye-and-spiral totem: a domed head with a ringed eye, an S-spiral below with curled ends
    const u = S / 32;
    const hw = 5.6 * u, top = y - 17 * u, hb = y - 7 * u;
    out.fills.push(`M ${f(x - hw)} ${f(hb)} L ${f(x - hw)} ${f(top + hw)} A ${f(hw)} ${f(hw)} 0 0 1 ${f(x + hw)} ${f(top + hw)} L ${f(x + hw)} ${f(hb)} Z`);
    out.holes.push(circ(x, top + hw + 0.4 * u, 2.6 * u));
    out.fills.push(circ(x, top + hw + 0.4 * u, 1.3 * u));
    // S: from under the head, curl left then sweep right and curl back at the foot
    const r = 4 * u, c1y = hb + 1.2 * u + r, c2y = c1y + 2 * r + 0.6 * u;
    let d = `M ${f(x)} ${f(hb - 0.5)} `;
    for (let i = 0; i <= 40; i++) { const t = i / 40, th = -Math.PI / 2 - t * Math.PI, rr = r; d += `L ${f(x + rr * Math.cos(th))} ${f(c1y + rr * Math.sin(th))} `; }
    for (let i = 0; i <= 40; i++) { const t = i / 40, th = -Math.PI / 2 + t * Math.PI * 1.55, rr = r * (1 - t * 0.5); d += `L ${f(x + rr * Math.cos(th))} ${f(c2y + rr * Math.sin(th))} `; }
    out.strokes.push({ d, w: 3.1 * u });
    out.fills.push(circ(x, c1y + r, 1.7 * u));
  }
}

/** Classic tall fleur-de-lis in a W x H box from (x - W/2, y0): spear petal, curled side petals, waist band, short foot. */
function fleurDeLis(out: Shapes, eng: string[], x: number, y0: number, H: number, W: number) {
  const X = (u: number) => f(x + u * W), Y = (v: number) => f(y0 + v * H);
  const pt2 = (u: number, v: number) => `${X(u)} ${Y(v)}`;
  // central spear petal
  out.fills.push(`M ${pt2(0, 0)} C ${pt2(0.17, 0.13)} ${pt2(0.17, 0.33)} ${pt2(0.07, 0.6)} L ${pt2(-0.07, 0.6)} C ${pt2(-0.17, 0.33)} ${pt2(-0.17, 0.13)} ${pt2(0, 0)} Z`);
  for (const sd of [-1, 1]) {
    const u = (n: number) => n * sd;
    // side petal: rises out of the band, arcs up and over, curls back down into a round tip
    out.fills.push(`M ${pt2(u(0.05), 0.6)} C ${pt2(u(0.1), 0.38)} ${pt2(u(0.3), 0.2)} ${pt2(u(0.43), 0.29)}` +
      ` C ${pt2(u(0.53), 0.36)} ${pt2(u(0.5), 0.52)} ${pt2(u(0.39), 0.52)} C ${pt2(u(0.32), 0.52)} ${pt2(u(0.31), 0.45)} ${pt2(u(0.36), 0.42)}` +
      ` C ${pt2(u(0.29), 0.39)} ${pt2(u(0.19), 0.47)} ${pt2(u(0.16), 0.62)} Z`);
    // little side foot curling outward under the band
    out.fills.push(`M ${pt2(u(0.04), 0.68)} C ${pt2(u(0.16), 0.7)} ${pt2(u(0.27), 0.77)} ${pt2(u(0.25), 0.88)} C ${pt2(u(0.21), 0.81)} ${pt2(u(0.14), 0.77)} ${pt2(u(0.04), 0.77)} Z`);
    eng.push(`M ${pt2(u(0.1), 0.56)} C ${pt2(u(0.16), 0.4)} ${pt2(u(0.3), 0.29)} ${pt2(u(0.4), 0.33)}`);
  }
  // waist band and the short lower foot
  out.fills.push(roundRect(x - 0.27 * W, y0 + 0.6 * H, 0.54 * W, 0.085 * H, Math.min(2, 0.04 * H)));
  out.fills.push(`M ${pt2(-0.07, 0.68)} L ${pt2(0.07, 0.68)} C ${pt2(0.08, 0.8)} ${pt2(0.045, 0.92)} ${pt2(0, 1)} C ${pt2(-0.045, 0.92)} ${pt2(-0.08, 0.8)} ${pt2(-0.07, 0.68)} Z`);
  eng.push(`M ${pt2(0, 0.08)} L ${pt2(0, 0.55)}`);
  out.rivets.push([x, y0 + 0.643 * H, Math.min(1.5, 0.03 * H)]);
}

/** Compact winged gear: a small cog with swept feather wings folded up beside it, and a short drop below. */
function wingedGear(out: Shapes, eng: string[], x: number, yTop: number, yBot: number, maxW: number) {
  const H = yBot - yTop;
  const gy = yTop + H * 0.6, ro = Math.min(10.5, maxW * 0.31, H * 0.2), ri = ro * 0.7, teeth = 8;
  let d = "";
  for (let k = 0; k < teeth; k++) {
    const a0 = (k / teeth) * Math.PI * 2, w = (Math.PI * 2) / teeth;
    const pts = [[ri, a0], [ro, a0 + w * 0.14], [ro, a0 + w * 0.46], [ri, a0 + w * 0.6]] as const;
    for (const [rr, a] of pts) d += `${d ? "L" : "M"} ${f(x + rr * Math.sin(a))} ${f(gy - rr * Math.cos(a))} `;
  }
  out.fills.push(d + "Z");
  // wings: three swept feathers each side, fanned up and out but kept inside the gap
  const half = maxW / 2 - 1;
  for (const sd of [-1, 1]) {
    const feathers = [[22, 1.0, 4.2], [46, 0.85, 3.7], [70, 0.7, 3.2]] as const; // degrees from vertical
    feathers.forEach(([off, k, w], j) => {
      const deg = -90 + sd * off, a = (deg * Math.PI) / 180;
      const sx = x + sd * ro * 0.62, sy = gy - ro * 0.42 + j * 1.9;
      const byW = (half - ro * 0.62) / Math.max(0.05, Math.abs(Math.cos(a)));
      const byH = (sy - yTop - 1) / Math.max(0.05, Math.abs(Math.sin(a)));
      const len = Math.min(byW, byH, (gy - yTop) * 1.05 * k);
      out.fills.push(bud(sx, sy, len, w, deg));
      eng.push(`M ${f(sx + Math.cos(a) * len * 0.3)} ${f(sy + Math.sin(a) * len * 0.3)} L ${f(sx + Math.cos(a) * len * 0.82)} ${f(sy + Math.sin(a) * len * 0.82)}`);
    });
  }
  // short drop below the gear to fill the height
  out.fills.push(bud(x, gy + ro * 0.8, Math.max(3, yBot - (gy + ro * 0.8) - 1), 2.4, 90));
  out.rivets.push([x, gy, Math.min(2.4, ro * 0.3)]);
  // engraved hub ring and spokes so the cog reads as a gear at this size
  eng.push(circ(x, gy, ri * 0.72));
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; eng.push(`M ${f(x + 2.6 * Math.sin(a))} ${f(gy - 2.6 * Math.cos(a))} L ${f(x + ri * 0.72 * Math.sin(a))} ${f(gy - ri * 0.72 * Math.cos(a))}`); }
}

/** Quimbaya-style double spiral: two opposed spirals joined by an S stem, a disc boss and two hanging bangles. */
function quimbayaSpiral(out: Shapes, eng: string[], x: number, y0: number, H: number, W: number) {
  const rs = Math.min(W / 2 - 1.5, H * 0.21);
  const spiral = (cx: number, cy: number, dir: 1 | -1, startDeg: number) => {
    const N = 90, turns = 2.15; let d = "";
    for (let i = 0; i <= N; i++) {
      const t = i / N, th = (startDeg * Math.PI) / 180 + dir * t * turns * Math.PI * 2, rr = rs * (1 - t * 0.82);
      d += `${i ? "L" : "M"} ${f(cx + rr * Math.cos(th))} ${f(cy + rr * Math.sin(th))} `;
    }
    return d;
  };
  // side-by-side pair, like the Quimbaya nose ornaments: each spiral starts at the shared base and winds inward
  void rs;
  const r2 = Math.min(W / 4 - 0.3, H * 0.17), yc = y0 + r2 + 1.5;
  const spiral2 = (cx: number, dir: 1 | -1) => {
    const N = 90, turns = 1.9; let d = "";
    for (let i = 0; i <= N; i++) {
      const t = i / N, th = Math.PI / 2 + dir * t * turns * Math.PI * 2, rr = r2 * (1 - t * 0.8);
      d += `${i ? "L" : "M"} ${f(cx + rr * Math.cos(th))} ${f(yc + rr * Math.sin(th))} `;
    }
    return d;
  };
  out.strokes.push({ d: spiral2(x - r2, 1), w: 2.2 });
  out.strokes.push({ d: spiral2(x + r2, -1), w: 2.2 });
  out.strokes.push({ d: `M ${f(x - r2)} ${f(yc + r2)} L ${f(x + r2)} ${f(yc + r2)}`, w: 2.2 }); // shared base
  // stem down to a disc, then a crossbar with two hanging bangles
  const yd = y0 + H * 0.62, yb = Math.min(y0 + H - 2.4, yd + H * 0.24);
  out.strokes.push({ d: `M ${f(x)} ${f(yc + r2)} L ${f(x)} ${f(yd)}`, w: 1.8 });
  out.fills.push(circ(x, yd, 3.4));
  out.strokes.push({ d: `M ${f(x - r2 * 0.9)} ${f(yd + 4.5)} L ${f(x + r2 * 0.9)} ${f(yd + 4.5)}`, w: 1.4 });
  for (const sd of [-1, 0, 1]) {
    const bx = x + sd * r2 * 0.9;
    out.strokes.push({ d: `M ${f(bx)} ${f(yd + 4.5)} L ${f(bx)} ${f(yb - 2)}`, w: 1 });
    out.fills.push(circ(bx, yb, sd === 0 ? 2.3 : 1.9));
  }
  eng.push(circ(x, yd, 1.6));
}

/** Muisca tunjo: flat, geometric votive figure. Fan headdress, square face, long trapezoid body, wire arms, short legs. */
function tunjo(out: Shapes, eng: string[], x: number, y0: number, H: number, W: number) {
  const Y = (v: number) => y0 + v * H;
  // fan headdress: a half-disc with three short rays on top
  const hr = W * 0.5;
  out.fills.push(`M ${f(x - hr)} ${f(Y(0.2))} A ${f(hr)} ${f(H * 0.17)} 0 0 1 ${f(x + hr)} ${f(Y(0.2))} Z`);
  for (const u of [-0.32, 0, 0.32]) out.fills.push(roundRect(x + u * W - 1, Y(0.0), 2, H * 0.08, 1));
  // face
  out.fills.push(roundRect(x - W * 0.27, Y(0.18), W * 0.54, H * 0.17, 1.6));
  // body: long trapezoid, wider at the shoulders
  out.fills.push(`M ${f(x - W * 0.32)} ${f(Y(0.36))} L ${f(x + W * 0.32)} ${f(Y(0.36))} L ${f(x + W * 0.2)} ${f(Y(0.84))} L ${f(x - W * 0.2)} ${f(Y(0.84))} Z`);
  // legs
  for (const sd of [-1, 1]) out.fills.push(roundRect(x + sd * W * 0.11 - W * 0.07, Y(0.83), W * 0.14, H * 0.16, 1));
  // wire features: eyes, nose, mouth, arms folded across the chest, belt, ear spools
  eng.push(`M ${f(x - W * 0.17)} ${f(Y(0.245))} L ${f(x - W * 0.05)} ${f(Y(0.245))} M ${f(x + W * 0.05)} ${f(Y(0.245))} L ${f(x + W * 0.17)} ${f(Y(0.245))}`);
  eng.push(`M ${f(x)} ${f(Y(0.23))} L ${f(x)} ${f(Y(0.29))} M ${f(x - W * 0.09)} ${f(Y(0.315))} L ${f(x + W * 0.09)} ${f(Y(0.315))}`);
  eng.push(`M ${f(x - W * 0.28)} ${f(Y(0.4))} L ${f(x - W * 0.04)} ${f(Y(0.55))} L ${f(x + W * 0.16)} ${f(Y(0.47))}`);
  eng.push(`M ${f(x + W * 0.28)} ${f(Y(0.4))} L ${f(x + W * 0.04)} ${f(Y(0.55))} L ${f(x - W * 0.16)} ${f(Y(0.47))}`);
  eng.push(`M ${f(x - W * 0.24)} ${f(Y(0.66))} L ${f(x + W * 0.24)} ${f(Y(0.66))}`);
  for (const sd of [-1, 1]) out.fills.push(circ(x + sd * W * 0.33, Y(0.27), Math.min(2.2, W * 0.08)));
}

function buildD(g: Geo, kind: string): Plate {
  const { dials, h } = g;
  const cy = dials[1].cy, R = dials[1].r;
  const out: Shapes = { fills: [], strokes: [], holes: dials.map((d) => circ(d.cx, d.cy, R + 0.4)), rivets: [], beads: [] };
  const eng: string[] = [];
  const gold = emptyShapes(), goldEng: string[] = [], goldEtch: string[] = [];
  const crisp: { d: string; slot: string; x: number; y: number; ring: number }[] = [];
  // round 5: orn=6 / orn=7 (with an "e" suffix for the etched figure) replace everything in each gap
  const sheet = g.orn && /^(8|9|10|11)$/.test(g.orn) ? emptySheet() : null;
  const piece = g.orn && /^[67]e?$/.test(g.orn) ? { style: (g.orn[0] === "6" ? "A" : "B") as "A" | "B", etched: g.orn.endsWith("e") } : null;
  const top = Math.max(2.5, g.top), bottom = h - 2.5;
  const k = R / 41.8; // 1 at the approved 110px
  const Ro = R + 4.6;
  for (const d of dials) {
    out.fills.push(circ(d.cx, d.cy, Ro));
    out.beads.push({ d: circ(d.cx, d.cy, R + 2.9), w: 1.1 });
  }
  const up = cy - 6 - top, down = bottom - (cy + 6);
  for (let i = 0; i < 2; i++) {
    const A = dials[i], B = dials[i + 1], m = (A.cx + B.cx) / 2;
    const ax = A.cx + Ro - 1.2, bx = B.cx - Ro + 1.2, gap = bx - ax;
    const ornTop = top + 1.5, ornBot = Math.min(A.pt, B.pt) - 2.5;
    if (sheet && g.orn) {
      // round 6: flat hammered sheet gold; nothing else in the gap, the sheet itself carries the top bar
      buildSheet(g.orn, sheet, A, B, Ro, top, Math.min(A.pt, B.pt) - 2.5);
      continue;
    }
    if (piece) {
      // only the top rail stays, and it is recast in gold as one piece with the spirals and the figure
      const ft = P(A, Ro - 0.8, -62), fb = P(B, Ro - 0.8, 242);
      const railD = `M ${xy(ft)} C ${f(ft[0] + gap * 0.35)} ${f(top + 2.2)} ${f(fb[0] - gap * 0.35)} ${f(top + 2.2)} ${xy(fb)}`;
      const railY = (ft[1] + 6 * (top + 2.2) + fb[1]) / 8;
      spiralFigure(piece.style, piece.etched, gold, goldEng, goldEtch, A, B, R, Ro, railD, railY, Math.min(A.pt, B.pt) - 2.5);
      continue;
    }
    if (g.orn === "0") {
      // round 8: the plain d3 gap. No boss, lyre or bud; the interlaced bars and rails below carry it.
    } else if (g.orn) {
      // gap ornaments replace the central lyre: fleur-de-lis in gap 1, winged gear in gap 2
      const maxW = gap - 5;
      const oh = ornBot - ornTop;
      if (/^14[abc]$/.test(g.orn)) {
        // round 10: the spiral gear with clean teeth, drawn as a crisp layer over the casting (no relief blur)
        const S = Math.min(maxW * 0.62, oh * 0.42) * g.gearScale; // round 12: gearscale=1.1|1.15|1.2
        const gx = Math.round(m), gy = Math.round(cy - 1); // whole-pixel centre
        const gp = crispGearPath(g.orn[2], gx, gy, S);
        const slot = spiralSlot(gx, gy, 0.6, gp.rr * 0.66, 2.1, Math.max(1, S * 0.05));
        out.holes.push(slot); // the slot shows wood, not the bars behind
        crisp.push({ d: gp.d, slot, x: gx, y: gy, ring: gp.rr * 0.8 });
      } else if (/^(14|15|16|17)$/.test(g.orn)) {
        // round 9: one small, calm symbol at the waist, the same in both gaps, over the plain interlaced bars
        const S = Math.min(maxW * 0.62, oh * 0.42) * (g.orn === "16" || g.orn === "17" ? 1.32 : 1);
        brassSymbol(g.orn, out, eng, m, cy - 1, S);
      } else if (g.orn === "12" || g.orn === "13") {
        // round 7: treated exactly like the orn=1 fleur-de-lis (same box, d3 openwork kept around it);
        // orn=13 casts the same piece in Scout's warmer gold instead of the d3 brass
        // a little wider than the fleur: the arcs and wings sit up where the gap between the rings is widest
        taironaWinged(g.orn === "12" ? out : gold, g.orn === "12" ? eng : goldEng, m, ornTop, oh, Math.min(maxW * 1.22, oh * 0.78));
      } else if (g.orn === "3" || g.orn === "4" || g.orn === "5") {
        // round 4: the same Colombian gold ornament in both gaps, cast separately in Scout's palette
        colombianOrnament(g.orn, gold, goldEng, m, ornTop, oh, Math.min(maxW, oh * 0.62));
      } else if (g.orn === "2") {
        // Museo del Oro set: Quimbaya double spiral in gap 1, Muisca tunjo in gap 2
        if (i === 0) quimbayaSpiral(out, eng, m, ornTop, oh, Math.min(maxW, oh * 0.6));
        else tunjo(out, eng, m, ornTop, oh, Math.min(maxW * 0.8, oh * 0.48));
      } else if (i === 0) fleurDeLis(out, eng, m, ornTop, oh, Math.min(maxW, oh * 0.62));
      else wingedGear(out, eng, m, ornTop, ornBot, maxW);
    } else {
      // the waist boss and its rivet, as in D
      out.fills.push(circ(m, cy, 5.2));
      out.rivets.push([m, cy, 2.1]);
      // slim lyre: stems rise from the boss and scroll outward just under the melt plate
      for (const sd of [-1, 1]) {
        out.fills.push(tendril(m + sd * 2.2, cy - 4.5, -90 - sd * 2, up * 1.12, 0, sd * 0.62, 3, 3.8, 1.9));
      }
      out.fills.push(bud(m, cy - 6, up - 4, 3.6, -90));
    }
    if (kind === "d1") {
      // faithful D: taller, slimmer lyres; a hanging pair of arms and a seed-pod; a thin stem to each ring
      for (const sd of [-1, 1]) out.fills.push(tendril(m + sd * 2.2, cy + 4.5, 90 + sd * 2, down * 1.1, 0, -sd * 0.7, 3, 3.4, 1.7));
      out.fills.push(bud(m, cy + 6, down - 3, 3, 90));
      out.strokes.push({ d: `M ${f(ax)} ${f(cy)} L ${f(m - 4)} ${f(cy)} M ${f(m + 4)} ${f(cy)} L ${f(bx)} ${f(cy)}`, w: 2.2 });
    } else if (kind === "d2") {
      // D + a thin linking arch over the waist and a garland swag under it, with drop buds
      const a0 = P(A, Ro - 0.8, -38), b0 = P(B, Ro - 0.8, 218);
      const archTop = top + 5.5;
      out.strokes.push({ d: `M ${xy(a0)} C ${f(a0[0] + gap * 0.22)} ${f(archTop)} ${f(b0[0] - gap * 0.22)} ${f(archTop)} ${xy(b0)}`, w: 2 });
      const s0 = P(A, Ro - 0.8, 34), s1 = P(B, Ro - 0.8, 146), sag = Math.min(bottom - 6, cy + Ro * 0.78);
      out.strokes.push({ d: `M ${xy(s0)} Q ${f(m)} ${f(sag + (sag - s0[1]) * 0.9)} ${xy(s1)}`, w: 1.9 });
      const yS = (s0[1] + 2 * (sag + (sag - s0[1]) * 0.9) + s1[1]) / 4; // swag low point
      out.fills.push(bud(m, yS, Math.min(6.5, bottom - yS - 1), 2.6, 90));
      for (const sd of [-1, 1]) out.fills.push(bud(m + sd * gap * 0.27, yS - 2.6, 4.2, 1.9, 90));
      out.strokes.push({ d: `M ${f(m)} ${f(cy + 5)} L ${f(m)} ${f(yS - 1)}`, w: 1.6 });
    } else {
      // d3: interlaced whiplashes off each ring cross at the waist and curl back, inside a thin open frame
      const tA = P(A, Ro - 1, -24), tB = P(B, Ro - 1, 204), lA = P(A, Ro - 1, 24), lB = P(B, Ro - 1, 156);
      if (g.bars === "long") {
        // round 12 (bars=long): just two long bars, ring to ring, crossing at the waist; no curled ends
        const dir = (deg: number, L: number) => [Math.cos((deg * Math.PI) / 180) * L, Math.sin((deg * Math.PI) / 180) * L];
        const L = gap * 0.42;
        for (const [p0, h0, p1, h1] of [[tA, 20, lB, 200], [lA, -20, tB, 160]] as const) {
          const [ax0, ay0] = dir(h0, L), [bx0, by0] = dir(h1, L);
          out.strokes.push({ d: `M ${xy(p0)} C ${f(p0[0] + ax0)} ${f(p0[1] + ay0)} ${f(p1[0] + bx0)} ${f(p1[1] + by0)} ${xy(p1)}`, w: 2.3 });
        }
      } else {
        out.fills.push(tendril(tA[0], tA[1], 20, gap * 0.95, 0, 0.16, 1.6, 2.8, 1.6));
        out.fills.push(tendril(tB[0], tB[1], 160, gap * 0.95, 0, -0.16, 1.6, 2.8, 1.6));
        out.fills.push(tendril(lA[0], lA[1], -20, gap * 0.95, 0, -0.16, 1.6, 2.8, 1.6));
        out.fills.push(tendril(lB[0], lB[1], 200, gap * 0.95, 0, 0.16, 1.6, 2.8, 1.6));
      }
      // open frame: a thin rail across the top and one under the boss
      const ft = P(A, Ro - 0.8, -62), fb = P(B, Ro - 0.8, 242);
      out.strokes.push({ d: `M ${xy(ft)} C ${f(ft[0] + gap * 0.35)} ${f(top + 2.2)} ${f(fb[0] - gap * 0.35)} ${f(top + 2.2)} ${xy(fb)}`, w: 1.7 });
      const gb = P(A, Ro - 0.8, 58), hb = P(B, Ro - 0.8, 122), yb = Math.min(bottom - 2, cy + Ro * 0.92);
      out.strokes.push({ d: `M ${xy(gb)} C ${f(gb[0] + gap * 0.3)} ${f(yb)} ${f(hb[0] - gap * 0.3)} ${f(yb)} ${xy(hb)}`, w: 1.7 });
      if (!g.orn) out.fills.push(bud(m, cy + 6, Math.max(3, yb - cy - 7), 2.6, 90));
    }
  }
  // corner tendrils off the outer rings, scaled to the dial (D drew these at full 110px size)
  for (const sd of [-1, 1]) {
    const d = sd < 0 ? dials[0] : dials[2];
    const mh = (hh: number) => (sd < 0 ? hh : 180 - hh);
    const t0 = P(d, Ro - 1.2, sd < 0 ? 228 : -48), b0 = P(d, Ro - 1.2, sd < 0 ? 140 : 40);
    out.fills.push(tendril(t0[0], t0[1], mh(-150), 36 * k, 0, -sd * 0.85, 2, 4.4, 1.9));
    out.fills.push(tendril(b0[0], b0[1], mh(165), Math.min(60 * k, (bottom - b0[1]) * 2.2), sd * 0.02, sd * 0.16, 1, 4.2, 1.9));
    out.rivets.push([d.cx + sd * (Ro - 2.3), cy, 1.9]);
  }
  // label cartouche behind each name plate, as in D, clamped inside the box
  for (const d of dials) {
    const aw = d.pw + 9, y0 = d.pt - 2.5, y1 = Math.min(d.pb + 2.5, bottom);
    out.fills.push(roundRect(d.cx - aw / 2, y0, aw, y1 - y0, 6.5));
  }
  return { shapes: out, engrave: eng, gold: gold.fills.length || gold.strokes.length ? { shapes: gold, engrave: goldEng, etch: goldEtch, behind: !!piece } : undefined, sheet: sheet ?? undefined, crisp: crisp.length ? crisp : undefined };
}

function buildPlate(g: Geo, kind: string): Plate {
  if (kind.startsWith("d")) return buildD(g, kind);
  const { dials, h } = g;
  const cy = dials[1].cy, r = dials[1].r;
  const out: Shapes = { fills: [], strokes: [], holes: dials.map((d) => circ(d.cx, d.cy, d.r + 0.4)), rivets: [], beads: [] };
  const eng: string[] = [];
  const k = Math.min(1, r / 41.8);
  const capTop = cy - 3, capBot = h - 3 - cy;
  if (kind === "a") {
    // (a) Lobed backplate: one swelling lobe per dial, filled waists that pinch in a soft curve.
    const RL = Math.min(r + 6.5, capTop, capBot);
    for (const d of dials) out.fills.push(circ(d.cx, d.cy, RL));
    for (let i = 0; i < 2; i++) {
      const A = dials[i], B = dials[i + 1], m = (A.cx + B.cx) / 2, nh = RL * 0.74, s = (m - A.cx) * 0.62;
      out.fills.push(`M ${f(A.cx)} ${f(cy - RL)} C ${f(A.cx + s)} ${f(cy - RL)} ${f(m - 6)} ${f(cy - nh)} ${f(m)} ${f(cy - nh)} C ${f(m + 6)} ${f(cy - nh)} ${f(B.cx - s)} ${f(cy - RL)} ${f(B.cx)} ${f(cy - RL)}` +
        ` L ${f(B.cx)} ${f(cy + RL)} C ${f(B.cx - s)} ${f(cy + RL)} ${f(m + 6)} ${f(cy + nh)} ${f(m)} ${f(cy + nh)} C ${f(m - 6)} ${f(cy + nh)} ${f(A.cx + s)} ${f(cy + RL)} ${f(A.cx)} ${f(cy + RL)} Z`);
      // engraved lily in each waist: a stem with two whiplash curls
      eng.push(`M ${f(m)} ${f(cy - nh + 4)} L ${f(m)} ${f(cy + nh - 4)}`);
      for (const sd of [-1, 1]) {
        eng.push(curlLine(m, cy - 2, -90 + sd * 30, 12, 0, sd * 0.32, 1.6));
        eng.push(curlLine(m, cy + 4, 90 - sd * 30, 9, 0, -sd * 0.38, 1.6));
      }
      out.rivets.push([m, cy + 1, 2.2]);
    }
    // scalloped ears at both ends
    for (const sd of [-1, 1]) {
      const d = sd < 0 ? dials[0] : dials[2];
      const ex = d.cx + sd * (RL + 3);
      out.fills.push(circ(ex, cy - 9, 7.5), circ(ex, cy + 9, 7.5), circ(d.cx + sd * (RL - 2), cy, 10));
      out.rivets.push([ex, cy - 9, 2], [ex, cy + 9, 2]);
      eng.push(`M ${xy(P(d, RL - 3, sd < 0 ? 120 : 60))} A ${f(RL - 3)} ${f(RL - 3)} 0 0 ${sd < 0 ? 1 : 0} ${xy(P(d, RL - 3, sd < 0 ? 240 : -60))}`);
    }
  } else if (kind === "b") {
    // (b) Whiplash plate: the top edge rises from each dial into an ogee point between them,
    // the bottom sags in soft curves, and the ends flick out into curled tendrils.
    const R = Math.min(r + 5.5, capTop + 2, capBot);
    const tipY = Math.max(2.5, g.top - 0.5);
    const [d0, d1, d2] = dials;
    const tan = (deg: number) => { const a = (deg * Math.PI) / 180; return [-Math.sin(a), Math.cos(a)] as const; };
    const ogee = (A: Dial, B: Dial) => {
      const m = (A.cx + B.cx) / 2, p = P(A, R, -35), q = P(B, R, 215), tp = tan(-35), tq = tan(215);
      return ` C ${f(p[0] + tp[0] * 9)} ${f(p[1] + tp[1] * 9)} ${f(m - 1.2)} ${f(tipY + 15)} ${f(m)} ${f(tipY)}` +
        ` C ${f(m + 1.2)} ${f(tipY + 15)} ${f(q[0] - tq[0] * 9)} ${f(q[1] - tq[1] * 9)} ${xy(q)}`;
    };
    const sag = (B: Dial, A: Dial) => {
      const m = (A.cx + B.cx) / 2, yb = cy + R * 0.66, x = P(B, R, 125), y = P(A, R, 55), tx = tan(125), ty = tan(55);
      return ` C ${f(x[0] + tx[0] * 6)} ${f(x[1] + tx[1] * 6)} ${f(m + 7)} ${f(yb)} ${f(m)} ${f(yb)}` +
        ` C ${f(m - 7)} ${f(yb)} ${f(y[0] - ty[0] * 6)} ${f(y[1] - ty[1] * 6)} ${xy(y)}`;
    };
    const arc = (d: Dial, a1: number, large: 0 | 1) => ` A ${f(R)} ${f(R)} 0 ${large} 1 ${xy(P(d, R, a1))}`;
    out.fills.push(`M ${xy(P(d0, R, 125))}` + arc(d0, -35, 1) + ogee(d0, d1) + arc(d1, -35, 0) + ogee(d1, d2) + arc(d2, 125, 1) +
      sag(d2, d1) + arc(d1, 125, 0) + sag(d1, d0) + arc(d0, 125, 0) + " Z");
    endFlourish(g, out, eng, R, k * 1.1);
    for (const [A, B] of [[d0, d1], [d1, d2]] as const) {
      const m = (A.cx + B.cx) / 2;
      out.fills.push(bud(m, tipY + 14, -9, 3.2, 90)); // small raised bud just under each point
      eng.push(curlLine(m - 1, cy + R * 0.5, -90, R * 0.95, 0, -0.06, 1), curlLine(m + 1, cy + R * 0.5, -90, R * 0.95, 0, 0.06, 1));
      out.rivets.push([m, cy + R * 0.32, 2.1]);
    }
    // centre crest: a little cast fleur under the middle dial, between the plates of the outer two
  } else {
    // (c) Soft pill / cloud: a rounded band behind all three, swelling round each dial, tendrils off the ends.
    const Hc = Math.min(r * 0.86, capTop - 3, capBot - 3);
    const Rb = Math.min(r + 4.5, capTop, capBot);
    const x0 = dials[0].cx - r - 4, x1 = dials[2].cx + r + 4;
    out.fills.push(roundRect(x0, cy - Hc, x1 - x0, 2 * Hc, Hc));
    for (const d of dials) out.fills.push(circ(d.cx, d.cy, Rb));
    endFlourish(g, out, eng, Rb, k * 1.15);
    const ins = 3;
    eng.push(roundRect(x0 + ins, cy - Hc + ins + 2, x1 - x0 - 2 * ins, 2 * (Hc - ins - 2), Hc - ins - 2));
    for (let i = 0; i < 2; i++) {
      const m = (dials[i].cx + dials[i + 1].cx) / 2, gapW = dials[i + 1].cx - dials[i].cx - 2 * Rb;
      // cloud billows: one soft swell in each waist, two smaller ones either side, so the edge rolls instead of running straight
      // scalloped lower edge: three soft billows hanging under each waist (the top has no room to swell)
      const rr = Math.min(9, gapW / 4 + 3);
      out.fills.push(circ(m, cy + Hc - rr * 0.35, rr));
      for (const sd of [-1, 1]) out.fills.push(circ(m + sd * rr * 1.45, cy + Hc - rr * 0.65, rr * 0.8));
      // and a gentle dip in the top edge, cut as a shallow scallop
      out.holes.push(circ(m, cy - Hc - rr * 1.6 + 2.2, rr * 1.6));
      out.rivets.push([m, cy + 2, 2.2]);
      eng.push(curlLine(m, cy - 3, -90 - 40, 10, 0, 0.3, 1.5), curlLine(m, cy - 3, -90 + 40, 10, 0, -0.3, 1.5));
    }
  }
  cartouches(g, out);
  return { shapes: out, engrave: eng };
}

export function GaugeSurround() {
  const ref = useRef<SVGSVGElement>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  useLayoutEffect(() => {
    const host = ref.current?.parentElement;
    if (!host) return;
    const run = () => setGeo(measure(host));
    const firstMeasure = requestAnimationFrame(run);
    const ro = new ResizeObserver(run);
    ro.observe(host);
    const mo = new MutationObserver(run);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-plate", "data-compact", "data-orn", "data-bars", "data-gearscale"] });
    host.querySelectorAll(".gauge-unit").forEach((e) => ro.observe(e));
    return () => { cancelAnimationFrame(firstMeasure); ro.disconnect(); mo.disconnect(); };
  }, []);
  // inline position too, so the svg can never take part in the layout it measures
  const pos = { position: "absolute", left: 0, top: 0 } as const;
  const plate = geo?.plate ? buildPlate(geo, geo.plate) : null;
  const s = geo ? (plate ? plate.shapes : build(geo)) : null;
  const id = "gauge-surround";
  const goldPiece = geo && plate?.gold ? (
    <CastPiece id={`${id}-gold`} box={{ x: 0, y: 0, w: geo.w, h: geo.h }} shapes={plate.gold.shapes} fine stops={plate.gold.behind ? FIGURE_GOLD : COLOMBIAN_GOLD} tone={geo.h} lift={1.5}>
          <g fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
            {plate.gold.engrave.map((d, i) => <path key={`l${i}`} d={d} stroke="#D6B97F" strokeOpacity="0.45" strokeWidth="0.6" transform="translate(0.4 0.5)" />)}
            {plate.gold.engrave.map((d, i) => <path key={`d${i}`} d={d} stroke="#2a1a08" strokeOpacity="0.7" strokeWidth="0.7" />)}
            {/* etched variant: very faint, shallow lines in place of the cut-outs */}
            {(plate.gold.etch ?? []).map((d, i) => <path key={`el${i}`} d={d} stroke="#D6B97F" strokeOpacity="0.3" strokeWidth="0.45" transform="translate(0.3 0.4)" />)}
            {(plate.gold.etch ?? []).map((d, i) => <path key={`ed${i}`} d={d} stroke="#643E0F" strokeOpacity="0.42" strokeWidth="0.5" />)}
          </g>
        </CastPiece>
  ) : null;
  return (
    <svg ref={ref} className="gauge-surround" style={pos} data-wrap={geo?.plate ? `plate-${geo.plate}` : "D"} aria-hidden="true" width={geo?.w ?? 0} height={geo?.h ?? 0} viewBox={geo ? `0 0 ${geo.w} ${geo.h}` : undefined}>
      {plate?.gold?.behind ? goldPiece : null}
      {geo && s ? (
        <CastPiece id={id} box={{ x: 0, y: 0, w: geo.w, h: geo.h }} shapes={s}>
          {plate ? (
            <g fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
              {/* engraved line: dark cut, light catch on the lower-right lip */}
              {plate.engrave.map((d, i) => <path key={`l${i}`} d={d} stroke="#fff1c8" strokeOpacity="0.32" strokeWidth="0.7" transform="translate(0.45 0.6)" />)}
              {plate.engrave.map((d, i) => <path key={`d${i}`} d={d} stroke="#2a1a08" strokeOpacity="0.6" strokeWidth="0.75" />)}
            </g>
          ) : null}
          {/* socket: the dial sits down in the casting, shadow upper-left lip, light catch lower-right */}
          {geo.dials.map((d, i) => (
            <g key={i} fill="none">
              <circle cx={d.cx} cy={d.cy} r={d.r + 1.1} stroke="#1c1005" strokeOpacity="0.7" strokeWidth="1.6" />
              <circle cx={d.cx} cy={d.cy} r={d.r + 2.6} stroke="#fff2c4" strokeOpacity="0.4" strokeWidth="0.7" strokeDasharray={`${d.r * 1.6} ${d.r * 20}`} strokeDashoffset={-d.r * 0.2} />
            </g>
          ))}
        </CastPiece>
      ) : null}
      {plate?.gold && !plate.gold.behind ? goldPiece : null}
      {geo && plate?.crisp ? (
        <g className="crisp-gear" pointerEvents="none">
          <defs>
            {/* the d3 brass stops, run top to bottom over each gear so it reads lit like the casting */}
            <linearGradient id={`${id}-gear-brass`} x1="0.2" y1="0" x2="0.45" y2="1">
              <stop offset="0" stopColor="#ecc677" />
              <stop offset="0.35" stopColor="#c8953e" />
              <stop offset="0.72" stopColor="#9a6a28" />
              <stop offset="1" stopColor="#5e3d15" />
            </linearGradient>
            <radialGradient id={`${id}-gear-sheen`} cx="0.32" cy="0.28" r="0.8">
              <stop offset="0" stopColor="#fff6d6" stopOpacity="0.18" />
              <stop offset="0.5" stopColor="#fff6d6" stopOpacity="0" />
              <stop offset="1" stopColor="#3a2208" stopOpacity="0.38" />
            </radialGradient>
            {plate.crisp.map((c, i) => (
              <clipPath key={i} id={`${id}-gear-clip-${i}`}><path d={`${c.d} ${c.slot}`} clipRule="evenodd" /></clipPath>
            ))}
          </defs>
          {plate.crisp.map((c, i) => (
            <g key={i}>
              <path d={`${c.d} ${c.slot}`} fillRule="evenodd" fill={`url(#${id}-gear-brass)`} />
              <path d={`${c.d} ${c.slot}`} fillRule="evenodd" fill={`url(#${id}-gear-sheen)`} />
              <g clipPath={`url(#${id}-gear-clip-${i})`} fill="none" strokeLinejoin="miter">
                {/* crisp highlight on the lit (upper) edge of every tooth, shadow on the lower edge */}
                <path d={`${c.d} ${c.slot}`} stroke="#fff3cc" strokeOpacity="0.72" strokeWidth="1.1" transform="translate(0.5 0.6)" />
                <path d={`${c.d} ${c.slot}`} stroke="#4a2c0c" strokeOpacity="0.75" strokeWidth="1.1" transform="translate(-0.5 -0.6)" />
              </g>
              <circle cx={c.x} cy={c.y} r={c.ring} fill="none" stroke="#fff3cc" strokeOpacity="0.45" strokeWidth="0.5" transform="translate(0.35 0.4)" />
              <circle cx={c.x} cy={c.y} r={c.ring} fill="none" stroke="#2a1a08" strokeOpacity="0.75" strokeWidth="0.6" />
              <path d={`${c.d} ${c.slot}`} fill="none" stroke="#2a1a08" strokeWidth="0.6" strokeLinejoin="miter" />
            </g>
          ))}
        </g>
      ) : null}
      {geo && plate?.sheet ? <SheetPiece id={`${id}-sheet`} w={geo.w} h={geo.h} s={plate.sheet} /> : null}
    </svg>
  );
}
