"use client";
import { useId } from "react";
import { GaugeNamePlate } from "@/components/gauge-nameplate";
import { needlePivotStyle } from "@/lib/gauge-needle";

/* Steampunk restyle parts: brass bezel, ivory face, glass, black lance needle. */

function pt(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
}
function arcPath(cx: number, cy: number, r: number, start: number, sweep: number) {
  const f = pt(cx, cy, r, start);
  const t = pt(cx, cy, r, start + sweep);
  return `M ${f.x} ${f.y} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${t.x} ${t.y}`;
}

function useSvgId() {
  return "g" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
}

function Defs({ id, x1, y1, x2, y2, fcx, fcy, fr }: { id: string; x1: number; y1: number; x2: number; y2: number; fcx: number; fcy: number; fr: number }) {
  return (
    <defs>
      {/* Bezel brass: lit from upper-left, warm reflection band at the bottom */}
      <linearGradient id={`${id}-brass`} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
        <stop offset="0" stopColor="#fff1c1" />
        <stop offset="0.2" stopColor="#ecc978" />
        <stop offset="0.48" stopColor="#b98a3e" />
        <stop offset="0.78" stopColor="#6f4a1c" />
        <stop offset="1" stopColor="#c99b4a" />
      </linearGradient>
      {/* Inner bevel: reversed so the face reads as recessed */}
      <linearGradient id={`${id}-bevel`} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
        <stop offset="0" stopColor="#4a2f10" />
        <stop offset="0.55" stopColor="#8a6328" />
        <stop offset="1" stopColor="#fbe7ad" />
      </linearGradient>
      <radialGradient id={`${id}-ivory`} gradientUnits="userSpaceOnUse" cx={fcx} cy={fcy - fr * 0.25} r={fr * 1.15}>
        <stop offset="0" stopColor="#fffbf2" />
        <stop offset="0.6" stopColor="#f6eedb" />
        <stop offset="1" stopColor="#e2cfa8" />
      </radialGradient>
      {/* Soft shadow the bezel throws onto the face */}
      <radialGradient id={`${id}-rim`} gradientUnits="userSpaceOnUse" cx={fcx} cy={fcy} r={fr}>
        <stop offset="0.78" stopColor="#5a3c14" stopOpacity="0" />
        <stop offset="1" stopColor="#5a3c14" stopOpacity="0.32" />
      </radialGradient>
      <linearGradient id={`${id}-glass`} gradientUnits="userSpaceOnUse" x1="0" y1={fcy - fr} x2="0" y2={fcy + fr * 0.2}>
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.30" />
        <stop offset="0.42" stopColor="#ffffff" stopOpacity="0.05" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      <radialGradient id={`${id}-spec`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${id}-hub`} cx="0.35" cy="0.3" r="0.75">
        <stop offset="0" stopColor="#fff4cc" />
        <stop offset="0.45" stopColor="#c99d4c" />
        <stop offset="1" stopColor="#5e3f15" />
      </radialGradient>
    </defs>
  );
}

/** Lance needle drawn pointing up from (cx, cy) with tip at (cx, cy - len). */
function Needle({ cx, cy, len, angle, s, tail = 6 }: { cx: number; cy: number; len: number; angle: number; s: number; tail?: number }) {
  const tip = cy - len;
  const d =
    `M ${cx} ${tip} L ${cx + 1.0 * s} ${tip + 9 * s} L ${cx + 2.6 * s} ${tip + 11.5 * s} L ${cx + 1.15 * s} ${tip + 13.5 * s}` +
    ` L ${cx + 1.9 * s} ${cy} L ${cx} ${cy + tail * s} L ${cx - 1.9 * s} ${cy} L ${cx - 1.15 * s} ${tip + 13.5 * s}` +
    ` L ${cx - 2.6 * s} ${tip + 11.5 * s} L ${cx - 1.0 * s} ${tip + 9 * s} Z`;
  return (
    <g className="gauge-needle" style={needlePivotStyle(angle, cx, cy)}>
      <g transform={`translate(${1.1 * s} ${1.6 * s})`} opacity="0.28">
        <path d={d} fill="#2b1a08" />
      </g>
      <path d={d} fill="#0d0b09" />
      <circle cx={cx} cy={cy} r={(tail > 5 ? 2.1 : 1.5) * s} fill="#0d0b09" />
    </g>
  );
}

function Glass({ id, clip, cx, cy, r }: { id: string; clip: string; cx: number; cy: number; r: number }) {
  return (
    <g clipPath={`url(#${clip})`} pointerEvents="none">
      <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill={`url(#${id}-glass)`} />
      <ellipse
        cx={cx - r * 0.34}
        cy={cy - r * 0.55}
        rx={r * 0.46}
        ry={r * 0.16}
        transform={`rotate(-24 ${cx - r * 0.34} ${cy - r * 0.55})`}
        fill={`url(#${id}-spec)`}
        opacity="0.7"
      />
      <path d={arcPath(cx, cy, r - 1.4, -78, 52)} fill="none" stroke="#ffffff" strokeOpacity="0.6" strokeWidth={r * 0.035} strokeLinecap="round" />
      <path d={arcPath(cx, cy, r - 1.6, 100, 50)} fill="none" stroke="#ffffff" strokeOpacity="0.22" strokeWidth={r * 0.025} strokeLinecap="round" />
    </g>
  );
}

function sector(cx: number, cy: number, rIn: number, rOut: number, a0: number, a1: number) {
  const p0 = pt(cx, cy, rOut, a0), p1 = pt(cx, cy, rOut, a1), q1 = pt(cx, cy, rIn, a1), q0 = pt(cx, cy, rIn, a0);
  const big = a1 - a0 > 180 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${rOut} ${rOut} 0 ${big} 1 ${p1.x} ${p1.y} L ${q1.x} ${q1.y} A ${rIn} ${rIn} 0 ${big} 0 ${q0.x} ${q0.y} Z`;
}

function SegmentFace({ cx, cy, rIn, rOut, start, sweep, segments }: { cx: number; cy: number; rIn: number; rOut: number; start: number; sweep: number; segments: { mark: string; fill: string }[] }) {
  const n = segments.length;
  const step = sweep / n;
  const rText = (rIn + rOut) / 2 + 0.6;
  return (
    <g className="gauge-segments">
      {segments.map((seg, i) => (
        <path key={`s${i}`} d={sector(cx, cy, rIn, rOut, start + i * step, start + (i + 1) * step)} fill={seg.fill} />
      ))}
      {/* faint inner/outer lip so the band reads as inlaid enamel */}
      <path d={arcPath(cx, cy, rIn, start, sweep)} fill="none" stroke="#2a1a0c" strokeOpacity="0.55" strokeWidth="0.6" />
      <path d={arcPath(cx, cy, rOut, start, sweep)} fill="none" stroke="#2a1a0c" strokeOpacity="0.4" strokeWidth="0.5" />
      {Array.from({ length: n + 1 }, (_, i) => {
        const a = pt(cx, cy, rIn - 0.4, start + i * step), b = pt(cx, cy, rOut + 0.3, start + i * step);
        return <line key={`d${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#1f140a" strokeWidth="1" strokeLinecap="round" />;
      })}
      {segments.map((seg, i) => {
        const c = pt(cx, cy, rText, start + (i + 0.5) * step);
        return (
          <text key={`t${i}`} x={c.x} y={c.y} textAnchor="middle" dominantBaseline="central" fill="#140b04" fontSize="15" fontWeight="800" fontFamily="var(--font-reel), sans-serif" style={{ letterSpacing: 0, fill: "#140b04", fontSize: "15px", fontFamily: "var(--font-reel), sans-serif" }}>
            {seg.mark}
          </text>
        );
      })}
    </g>
  );
}

function lance(cx: number, cy: number, len: number, s: number, tail: number) {
  const tip = cy - len;
  return `M ${cx} ${tip} L ${cx + 1.0 * s} ${tip + 9 * s} L ${cx + 2.6 * s} ${tip + 11.5 * s} L ${cx + 1.15 * s} ${tip + 13.5 * s}` +
    ` L ${cx + 1.9 * s} ${cy} L ${cx} ${cy + tail * s} L ${cx - 1.9 * s} ${cy} L ${cx - 1.15 * s} ${tip + 13.5 * s}` +
    ` L ${cx - 2.6 * s} ${tip + 11.5 * s} L ${cx - 1.0 * s} ${tip + 9 * s} Z`;
}

/**
 * MOCKUP: bolder METAL needles. 1 = longer (halfway into the symbol band), 1.5x thicker, ivory halo.
 * 2 = 1 + #ff7a1a tip on the outer third. 3 = 1 but full length to the segment edge, counterweight, big hub.
 */
function SegNeedle({ id, cx, cy, angle, variant, rIn, rOut }: { id: string; cx: number; cy: number; angle: number; variant: 1 | 2 | 3 | 4 | "4b"; rIn: number; rOut: number }) {
  const s = 0.93;
  const len = variant === 3 ? rOut - 0.8 : rIn + (rOut - rIn) * 0.5;
  const d = lance(cx, cy, len, s, variant === 3 ? 3 : 4);
  const hubR = variant === 3 ? 5.6 : 4.4;
  const tipClip = `${id}-tip`;
  // 4 = deep steampunk red, 4b = brighter red; both with a darker edge, ivory halo and the brass hub
  const red = variant === 4 ? { body: "#b3121b", edge: "#5e070c" } : variant === "4b" ? { body: "#e0281f", edge: "#7a0f0a" } : null;
  return (
    <>
      <g className="gauge-needle" style={needlePivotStyle(angle, cx, cy)}>
        <g transform={`translate(${1.1 * s} ${1.6 * s})`} opacity="0.3"><path d={d} fill="#2b1a08" /></g>
        {variant === 3 ? (
          <>
            <path d={`M ${cx - 1.3} ${cy} L ${cx - 1.1} ${cy + 7.5} L ${cx + 1.1} ${cy + 7.5} L ${cx + 1.3} ${cy} Z`} fill="#0d0b09" stroke="#fbf3df" strokeWidth="0.9" strokeOpacity="0.9" paintOrder="stroke" />
            <circle cx={cx} cy={cy + 8.6} r="3" fill="#0d0b09" stroke="#fbf3df" strokeWidth="0.9" strokeOpacity="0.9" paintOrder="stroke" />
            <circle cx={cx - 0.8} cy={cy + 7.8} r="0.9" fill="#6b6259" />
          </>
        ) : null}
        {/* halo first so the needle reads over the letters */}
        <path d={d} fill="none" stroke="#fbf3df" strokeOpacity="0.95" strokeWidth="1.5" strokeLinejoin="round" />
        {red ? (
          <>
            <linearGradient id={`${id}-red`} gradientUnits="userSpaceOnUse" x1={cx - 2.6} y1="0" x2={cx + 2.6} y2="0">
              <stop offset="0" stopColor={red.edge} />
              <stop offset="0.45" stopColor={red.body} />
              <stop offset="0.55" stopColor={red.body} />
              <stop offset="1" stopColor={red.edge} />
            </linearGradient>
            <path d={d} fill={`url(#${id}-red)`} stroke={red.edge} strokeWidth="0.45" strokeLinejoin="round" />
          </>
        ) : (
          <path d={d} fill="#0d0b09" />
        )}
        {variant === 2 ? (
          <>
            <clipPath id={tipClip}><rect x={cx - 6} y={cy - len - 1} width="12" height={len / 3 + 1} /></clipPath>
            <path d={d} fill="#ff7a1a" clipPath={`url(#${tipClip})`} />
            <path d={d} fill="none" stroke="#5a1d00" strokeWidth="0.35" clipPath={`url(#${tipClip})`} />
          </>
        ) : null}
      </g>
      <circle cx={cx} cy={cy} r={hubR + 0.6} fill="#fbf3df" opacity="0.6" />
      <circle cx={cx} cy={cy} r={hubR} fill={`url(#${id}-hub)`} stroke="#3a2610" strokeWidth="0.7" />
      <circle cx={cx} cy={cy} r={hubR * 0.42} fill={`url(#${id}-hub)`} stroke="#2a1a08" strokeWidth="0.35" />
    </>
  );
}

/**
 * MOCKUP (?needle=5|5b): vintage pressure-gauge pointer. Long, thin, tapered deep-red needle from a small
 * dark hub with a brass dot, a short stubby counterweight, and a small flared arrowhead at the tip.
 * 5b runs to the segment edge with an outlined (hollow) arrowhead so the symbol shows through.
 */
function ArrowNeedle({ id, cx, cy, angle, len, hollow }: { id: string; cx: number; cy: number; angle: number; len: number; hollow: boolean }) {
  const body = "#b3121b", edge = "#5e070c", halo = "#fbf3df";
  const T = cy - len;            // tip
  const ah = 5.2;                // arrowhead length
  const yb = T + ah;             // arrowhead base
  const bw = 2.5;                // half-width of the barbs
  const sw0 = 1.25, sw1 = 0.45;  // shaft half-width at the hub and under the arrowhead
  const tail = 5.8, tw = 1.7;    // counterweight length and half-width
  // shaft + counterweight (solid in both)
  const shaft = `M ${cx + sw1} ${yb - 0.3} L ${cx + sw0} ${cy} L ${cx + tw} ${cy + tail - tw}` +
    ` A ${tw} ${tw} 0 0 1 ${cx - tw} ${cy + tail - tw} L ${cx - sw0} ${cy} L ${cx - sw1} ${yb - 0.3} Z`;
  // flared arrowhead: concave sides sweeping out to sharp barbs, notched back to the shaft
  const head = `M ${cx} ${T} Q ${cx + 0.7} ${T + ah * 0.55} ${cx + bw} ${yb + 1.3} L ${cx + sw1 + 0.15} ${yb}` +
    ` L ${cx - sw1 - 0.15} ${yb} L ${cx - bw} ${yb + 1.3} Q ${cx - 0.7} ${T + ah * 0.55} ${cx} ${T} Z`;
  const solid = hollow ? shaft : `${shaft} ${head}`;
  return (
    <>
      <g className="gauge-needle" style={needlePivotStyle(angle, cx, cy)}>
        <g transform="translate(1 1.4)" opacity="0.28"><path d={`${shaft} ${head}`} fill="#2b1a08" /></g>
        <path d={solid} fill="none" stroke={halo} strokeOpacity="0.95" strokeWidth="1.3" strokeLinejoin="round" />
        {hollow ? <path d={head} fill="none" stroke={halo} strokeOpacity="0.95" strokeWidth="2.1" strokeLinejoin="round" /> : null}
        <path d={solid} fill={body} stroke={edge} strokeWidth="0.4" strokeLinejoin="round" />
        {hollow ? <path d={head} fill="none" stroke={body} strokeWidth="0.95" strokeLinejoin="round" /> : null}
        {hollow ? <path d={head} fill="none" stroke={edge} strokeWidth="0.25" strokeLinejoin="round" /> : null}
        {/* faint highlight down one side of the shaft */}
        <path d={`M ${cx - 0.35} ${yb + 1} L ${cx - 0.75} ${cy - 3}`} stroke="#ff8a7a" strokeOpacity="0.45" strokeWidth="0.35" />
      </g>
      <circle cx={cx} cy={cy} r="3.6" fill={halo} opacity="0.55" />
      <circle cx={cx} cy={cy} r="3.1" fill="#16100b" stroke="#000" strokeWidth="0.4" />
      <circle cx={cx} cy={cy} r="1.25" fill={`url(#${id}-hub)`} />
    </>
  );
}

const INK = "#22160b";
function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(",")})`;
}
/** Small ingot (trapezoid bar) centred on (x, y), width w. */
function ingot(x: number, y: number, w: number) {
  const h = w * 0.42, t = w * 0.62;
  return `M ${x - w / 2} ${y + h / 2} L ${x + w / 2} ${y + h / 2} L ${x + t / 2} ${y - h / 2} L ${x - t / 2} ${y - h / 2} Z`;
}
/** One coin seen slightly from above: an edge band with an ellipse face. */
function Coin({ x, y, w }: { x: number; y: number; w: number }) {
  const ry = w * 0.24, edge = w * 0.2;
  return (
    <g>
      <path d={`M ${x - w / 2} ${y} v ${edge} a ${w / 2} ${ry} 0 0 0 ${w} 0 v ${-edge} Z`} fill={INK} />
      <ellipse cx={x} cy={y} rx={w / 2} ry={ry} fill="#5a3d1c" stroke={INK} strokeWidth="0.55" />
    </g>
  );
}

/** MOCKUP: low-to-high cue for the WEIGHT and STACK faces. 1 wedge band, 2 end icons, 3 minus/plus. */
function FaceCue({ cx, cy, r, start, sweep, face, kind }: { cx: number; cy: number; r: number; start: number; sweep: number; face: 1 | 2 | 3; kind: "weight" | "stack" }) {
  if (face === 1) {
    // wedge band just inside the tick ring: hairline at the low end, ~4.6 units at the high end, pale to amber
    const N = 48, rO = r - 8.6, parts = [];
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N;
      const w0 = 0.35 + 4.3 * Math.pow(t0, 1.15), w1 = 0.35 + 4.3 * Math.pow(t1, 1.15);
      const a0 = start + sweep * t0, a1 = start + sweep * t1 + 0.4;
      const p0 = pt(cx, cy, rO, a0), p1 = pt(cx, cy, rO, a1), q1 = pt(cx, cy, rO - w1, a1), q0 = pt(cx, cy, rO - w0, a0);
      parts.push(<path key={i} d={`M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} L ${q1.x} ${q1.y} L ${q0.x} ${q0.y} Z`} fill={mix("#e9d6a6", "#b8661a", Math.pow(t0, 0.9))} />);
    }
    const e = pt(cx, cy, rO - 4.65, start + sweep), e2 = pt(cx, cy, rO, start + sweep);
    return (
      <g className="gauge-cue">
        {parts}
        <line x1={e.x} y1={e.y} x2={e2.x} y2={e2.y} stroke="#6b3a0c" strokeWidth="0.5" />
      </g>
    );
  }
  // icons and marks sit inside the scale, just above each end of the bottom gap
  const lo = pt(cx, cy, r - 15, start + 30), hi = pt(cx, cy, r - 15, start + sweep - 30);
  if (face === 3) {
    const s = 4, w = 1.9;
    return (
      <g className="gauge-cue" fill={INK}>
        <rect x={lo.x - s} y={lo.y - w / 2} width={s * 2} height={w} rx={0.5} />
        <rect x={hi.x - s} y={hi.y - w / 2} width={s * 2} height={w} rx={0.5} />
        <rect x={hi.x - w / 2} y={hi.y - s} width={w} height={s * 2} rx={0.5} />
      </g>
    );
  }
  if (kind === "weight") {
    // one small ingot on the left, a big one on the right
    return (
      <g className="gauge-cue">
        <path d={ingot(lo.x, lo.y + 0.6, 6.4)} fill={INK} />
        <path d={ingot(hi.x, hi.y, 13)} fill={INK} />
        <path d={`M ${hi.x - 2.2} ${hi.y - 0.6} L ${hi.x + 2.2} ${hi.y - 0.6}`} stroke="#c9a35a" strokeWidth="0.55" strokeLinecap="round" />
      </g>
    );
  }
  // stack: a single coin on the left, a stack of coins on the right
  return (
    <g className="gauge-cue">
      <Coin x={lo.x} y={lo.y - 0.6} w={7} />
      {[0, 1, 2, 3].map((i) => <Coin key={i} x={hi.x} y={hi.y + 4 - i * 2.6} w={8.6} />)}
    </g>
  );
}

/** Ice cyan at the low end to deep cobalt/navy at the high end, shared by WEIGHT and STACK. */
const RAMP_STOPS: [number, string][] = [[0, "#cfeefa"], [0.28, "#8fdcf0"], [0.72, "#1f4fa8"], [1, "#0f2350"]];
/** Colombian emerald "money" ramp: pale mint into a rich, slightly blue-green gem tone. */
const EMERALD_STOPS: [number, string][] = [[0, "#d8f6e8"], [0.28, "#9fe3c6"], [0.6, "#0f9d6e"], [0.82, "#046244"], [1, "#023a2a"]];
export type RampTone = "blue" | "green";
export function rampColor(t: number, tone: RampTone = "blue") {
  const stops = tone === "green" ? EMERALD_STOPS : RAMP_STOPS;
  for (let i = 1; i < stops.length; i++) {
    const [ta, ca] = stops[i - 1], [tb, cb] = stops[i];
    if (t <= tb) return mix(ca, cb, (t - ta) / (tb - ta));
  }
  return stops[stops.length - 1][1];
}
export const RAMP_IN = 12, RAMP_OUT = 23.7; // the inner ring: hub side of the old scale arc
/** ?ramppos=mid: the same ring moved out half of the way from the inner position to the face edge (30.2). */
export const RAMP_MID_SHIFT = (30.2 - RAMP_OUT) / 2;
/** Ramp outer radius at scale fraction t: a hairline on the inner circle at the low end, the full ring at the high end. */
export const rampEdge = (t: number, off = 0) => RAMP_IN + off + 0.35 + (RAMP_OUT - RAMP_IN - 0.35) * Math.pow(t, 1.05);

/**
 * MOCKUP (?face=4): ramp in the inner ring, rising from the inner circle (hairline at the low end) to the
 * full ring at the high end, ice cyan to navy, with one crisp dark outline following the ramp's edges.
 */
function RingWedge({ cx, cy, start, sweep, off = 0, tone = "blue" }: { cx: number; cy: number; start: number; sweep: number; off?: number; tone?: RampTone }) {
  const rin = RAMP_IN + off;
  const N = 72, parts = [];
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N;
    const a0 = start + sweep * t0, a1 = start + sweep * t1 + (i < N - 1 ? 0.4 : 0);
    const p0 = pt(cx, cy, rin, a0), p1 = pt(cx, cy, rin, a1), q1 = pt(cx, cy, rampEdge(t1, off), a1), q0 = pt(cx, cy, rampEdge(t0, off), a0);
    parts.push(<path key={i} d={`M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} L ${q1.x} ${q1.y} L ${q0.x} ${q0.y} Z`} fill={rampColor((t0 + t1) / 2, tone)} />);
  }
  // single outline: inner arc out, sloped edge back, closing end cap
  let d = "";
  for (let i = 0; i <= N; i++) { const q = pt(cx, cy, rampEdge(i / N, off), start + sweep * (i / N)); d += `${i ? "L" : "M"} ${q.x} ${q.y} `; }
  const endIn = pt(cx, cy, rin, start + sweep), st = pt(cx, cy, rin, start);
  d += `L ${endIn.x} ${endIn.y} A ${rin} ${rin} 0 1 0 ${st.x} ${st.y} Z`;
  return (
    <g className="gauge-ring-wedge">
      {parts}
      {tone === "green" ? <EmeraldSheen cx={cx} cy={cy} start={start} sweep={sweep} off={off} /> : null}
      <path d={d} fill="none" stroke={tone === "green" ? "#012219" : "#0b1530"} strokeWidth="0.6" strokeLinejoin="round" />
    </g>
  );
}

/** Subtle gem sheen on the emerald ramp: a soft light streak a third of the way into the band, plus a fine facet line. */
function EmeraldSheen({ cx, cy, start, sweep, off }: { cx: number; cy: number; start: number; sweep: number; off: number }) {
  const N = 48, rin = RAMP_IN + off;
  const line = (k: number, t0: number) => {
    let d = "";
    for (let i = 0; i <= N; i++) {
      const t = t0 + (1 - t0) * (i / N), r = rin + (rampEdge(t, off) - rin) * k;
      const q = pt(cx, cy, r, start + sweep * t); d += `${i ? "L" : "M"} ${q.x} ${q.y} `;
    }
    return d;
  };
  return (
    <g pointerEvents="none" strokeLinecap="round" fill="none">
      <path d={line(0.34, 0.3)} stroke="#e9fff6" strokeOpacity="0.28" strokeWidth="1.1" />
      <path d={line(0.72, 0.45)} stroke="#c8ffe9" strokeOpacity="0.22" strokeWidth="0.35" />
    </g>
  );
}

/** Tick inside the ramp ring: ivory where it crosses the dark part of the ramp, dark ink elsewhere. */
function RampTick({ cx, cy, deg, t, off = 0 }: { cx: number; cy: number; deg: number; t: number; off?: number }) {
  const r0 = 15.8 + off, r1 = RAMP_OUT + off - 0.3, edge = Math.min(r1, rampEdge(t, off));
  const dark = "#1f150b", light = "#f6efdc";
  const onRamp = edge > r0;
  const a = pt(cx, cy, r0, deg), m = pt(cx, cy, Math.max(r0, edge), deg), b = pt(cx, cy, r1, deg);
  const rampInk = t > 0.42 ? light : dark;
  return (
    <g>
      {onRamp ? <line x1={a.x} y1={a.y} x2={m.x} y2={m.y} stroke={rampInk} strokeWidth="1.2" strokeLinecap="butt" /> : null}
      {edge < r1 ? <line x1={m.x} y1={m.y} x2={b.x} y2={b.y} stroke={dark} strokeWidth="1.2" strokeLinecap="butt" /> : null}
    </g>
  );
}

/**
 * MOCKUP (?needle=6): needle 4's tapered red lance, red hub with a brass dot, and a water-level-gauge
 * counterweight: a short stem ending in a small crescent whose horns point back, away from the tip.
 */
function CrescentNeedle({ id, cx, cy, angle, len }: { id: string; cx: number; cy: number; angle: number; len: number }) {
  const body = "#b3121b", edge = "#5e070c", halo = "#fbf3df";
  const s = 0.93;
  const lanceD = lance(cx, cy, len, s, 0.5);
  // crescent below the hub (opposite the tip): outer arc over the top, inner arc back; horns at the bottom
  const hy = cy + 12.6, hx = 3.3; // horn tips (crescent unchanged, moved out to make room for the stem)
  const crescent = `M ${cx - hx} ${hy} A 3.55 3.55 0 1 1 ${cx + hx} ${hy} A 3.4 3.4 0 0 0 ${cx - hx} ${hy} Z`;
  // solid tail stem, as thick as the lance where it meets the hub (1.9 * s each side), easing slightly into the crescent
  const sb = 1.9 * s, se = 1.45;
  const stem = `M ${cx - sb} ${cy} L ${cx - se} ${hy - 4.2} L ${cx + se} ${hy - 4.2} L ${cx + sb} ${cy} Z`;
  const all = `${lanceD} ${stem} ${crescent}`;
  return (
    <>
      <radialGradient id={`${id}-redhub`} cx="0.36" cy="0.32" r="0.75">
        <stop offset="0" stopColor="#ff6a5c" />
        <stop offset="0.45" stopColor={body} />
        <stop offset="1" stopColor="#4a0509" />
      </radialGradient>
      <linearGradient id={`${id}-redbody`} gradientUnits="userSpaceOnUse" x1={cx - 2.4} y1="0" x2={cx + 2.4} y2="0">
        <stop offset="0" stopColor={edge} />
        <stop offset="0.42" stopColor={body} />
        <stop offset="0.58" stopColor={body} />
        <stop offset="1" stopColor={edge} />
      </linearGradient>
      <g className="gauge-needle" style={needlePivotStyle(angle, cx, cy)}>
        <g transform="translate(1 1.4)" opacity="0.28"><path d={all} fill="#2b1a08" /></g>
        <path d={all} fill="none" stroke={halo} strokeOpacity="0.95" strokeWidth="1.3" strokeLinejoin="round" />
        <path d={all} fill={`url(#${id}-redbody)`} stroke={edge} strokeWidth="0.4" strokeLinejoin="round" />
      </g>
      <circle cx={cx} cy={cy} r="4.4" fill={halo} opacity="0.6" />
      <circle cx={cx} cy={cy} r="3.8" fill={`url(#${id}-redhub)`} stroke={edge} strokeWidth="0.5" />
      <circle cx={cx} cy={cy} r="1.3" fill={`url(#${id}-hub)`} stroke="#3a2610" strokeWidth="0.25" />
    </>
  );
}

/* ---------------- Round gauge, viewBox 0 0 96 82, pivot 48,42 ---------------- */
export function RoundGaugeRestyle({
  label,
  angle,
  tickAngles,
  scaleStart,
  scaleSweep,
  className = "",
  segments,
  needle,
  face,
  faceKind,
  stackBand,
  rampPos,
  rampTone,
}: {
  label: string;
  angle: number;
  tickAngles: number[];
  scaleStart: number;
  scaleSweep: number;
  className?: string;
  /** MOCKUP (compact): segmented selector face. One coloured wedge per option, symbol inside, no ticks. */
  segments?: { mark: string; fill: string }[];
  /** MOCKUP: METAL needle variants 1|2|3 (?needle=); undefined keeps the current short needle. */
  needle?: 1 | 2 | 3 | 4 | "4b" | 5 | "5b" | 6;
  /** MOCKUP (?face=1|2|3): "little on the left, a lot on the right" cue on the WEIGHT / STACK faces. */
  face?: 1 | 2 | 3 | 4;
  faceKind?: "weight" | "stack";
  /** face 4 STACK colour: a = copper to oxblood, b = verdigris. */
  stackBand?: "a" | "b";
  /** ?ramppos=mid moves the face-4 ramp halfway out toward the face edge. */
  rampPos?: "inner" | "mid";
  rampTone?: RampTone;
}) {
  const id = useSvgId();
  const cx = 48, cy = 42, r = 32;
  // Segmented selector (mockup): thinner bezel band so the enamel face is as large as the ring allows.
  const outerR = 36.5, faceR = segments ? 32.8 : 31;
  const segIn = 10.2, segOut = faceR - 0.8;
  return (
    <div className={`gauge gauge--brass gauge-unit ${className}`} aria-hidden="true">
    <svg className="gauge-unit-face" viewBox="0 0 96 82">
      <Defs id={id} x1={18} y1={8} x2={78} y2={78} fcx={cx} fcy={cy} fr={faceR} />
      <clipPath id={`${id}-face`}><circle cx={cx} cy={cy} r={faceR} /></clipPath>
      <circle cx={cx} cy={cy} r={(outerR + faceR) / 2} fill="none" stroke={`url(#${id}-brass)`} strokeWidth={outerR - faceR} />
      <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="#2a1a08" strokeWidth="0.9" />
      <path d={arcPath(cx, cy, outerR - 1.1, -95, 80)} fill="none" stroke="#fff6d6" strokeOpacity="0.75" strokeWidth="0.8" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={faceR} fill={`url(#${id}-ivory)`} />
      <circle cx={cx} cy={cy} r={faceR} fill={`url(#${id}-rim)`} />
      <circle cx={cx} cy={cy} r={faceR} fill="none" stroke={`url(#${id}-bevel)`} strokeWidth="1.2" />
      {segments ? <SegmentFace cx={cx} cy={cy} rIn={segIn} rOut={segOut} start={scaleStart} sweep={scaleSweep} segments={segments} /> : null}
      {segments || face === 4 ? null : <path d={arcPath(cx, cy, r - 8.3, scaleStart, scaleSweep)} fill="none" stroke="#3a2712" strokeWidth="0.55" />}
      {face === 4 && !segments ? <RingWedge cx={cx} cy={cy} start={scaleStart} sweep={scaleSweep} off={rampPos === "mid" ? RAMP_MID_SHIFT : 0} tone={rampTone ?? "blue"} /> : null}
      {segments ? null : face === 4
        ? tickAngles.map((deg, i) => <RampTick key={i} cx={cx} cy={cy} off={rampPos === "mid" ? RAMP_MID_SHIFT : 0} deg={deg} t={(((deg - scaleStart) % 360) + 360) % 360 / scaleSweep} />)
        : tickAngles.map((deg, i) => {
            const a = pt(cx, cy, r - 8, deg), b = pt(cx, cy, r - 1.5, deg);
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#1f150b" strokeWidth="1.25" />;
          })}
      {face && face !== 4 && !segments ? <FaceCue cx={cx} cy={cy} r={r} start={scaleStart} sweep={scaleSweep} face={face} kind={faceKind ?? "weight"} /> : null}
      {needle === 6 ? (
        <CrescentNeedle id={id} cx={cx} cy={cy} angle={angle} len={segments ? segIn + (segOut - segIn) * 0.5 : 10.2 + (faceR - 0.8 - 10.2) * 0.5} />
      ) : needle === 5 || needle === "5b" ? (
        <ArrowNeedle id={id} cx={cx} cy={cy} angle={angle} hollow={needle === "5b"}
          len={segments ? (needle === 5 ? segIn + (segOut - segIn) * 0.5 : segOut - 0.8) : needle === 5 ? r - 7 : r - 1.8} />
      ) : segments && needle ? (
        <SegNeedle id={id} cx={cx} cy={cy} angle={angle} variant={needle} rIn={segIn} rOut={segOut} />
      ) : (
        <>
          <circle cx={cx} cy={cy} r="4.2" fill={`url(#${id}-hub)`} stroke="#3a2610" strokeWidth="0.7" />
          <Needle cx={cx} cy={cy} len={segments ? 15.5 : r - 8} angle={angle} s={segments ? 0.62 : 0.72} tail={segments ? 4 : 6} />
          <circle cx={cx} cy={cy} r="1.6" fill={`url(#${id}-hub)`} stroke="#2a1a08" strokeWidth="0.35" />
        </>
      )}
      <Glass id={id} clip={`${id}-face`} cx={cx} cy={cy} r={faceR} />
    </svg>
    <GaugeNamePlate label={label} />
    </div>
  );
}
