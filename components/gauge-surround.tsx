"use client";
/**
 * MOCKUP ONLY (local/gauge-mockups-DO-NOT-PUSH): a cast-brass surround that wraps the three
 * round gauges, separate from each dial's own bezel. Geometry is measured from the dials so the
 * frame follows them at any width. This is the Art Nouveau casting (variant D).
 */
import { useLayoutEffect, useRef, useState } from "react";
import { CastPiece, circ, f, roundRect, bud, tendril, type CastShapes } from "@/components/cast-brass";

type Dial = { cx: number; cy: number; r: number; pw: number; pt: number; pb: number };
type Geo = { w: number; h: number; dials: Dial[]; rivL: number; rivR: number; frL: number; frR: number };

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
  return {
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
  const top = TOP_REVEAL, bottom = h - BOTTOM_REVEAL;

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
      out.fills.push(tendril(m + sd * 3.4, cy - 8, -90 - sd * 3, 56, 0, sd * 0.4, 3, 7, 3));
      out.fills.push(tendril(m + sd * 3.4, cy + 8, 90 + sd * 3, 44, 0, -sd * 0.46, 3, 6.4, 2.6));
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
    host.querySelectorAll(".gauge-unit").forEach((e) => ro.observe(e));
    return () => { cancelAnimationFrame(firstMeasure); ro.disconnect(); };
  }, []);
  // inline position too, so the svg can never take part in the layout it measures
  const pos = { position: "absolute", left: 0, top: 0 } as const;
  const s = geo ? build(geo) : null;
  const id = "gauge-surround";
  return (
    <svg ref={ref} className="gauge-surround" style={pos} data-wrap="D" aria-hidden="true" width={geo?.w ?? 0} height={geo?.h ?? 0} viewBox={geo ? `0 0 ${geo.w} ${geo.h}` : undefined}>
      {geo && s ? (
        <CastPiece id={id} box={{ x: 0, y: 0, w: geo.w, h: geo.h }} shapes={s}>
          {/* socket: the dial sits down in the casting, shadow upper-left lip, light catch lower-right */}
          {geo.dials.map((d, i) => (
            <g key={i} fill="none">
              <circle cx={d.cx} cy={d.cy} r={d.r + 1.1} stroke="#1c1005" strokeOpacity="0.7" strokeWidth="1.6" />
              <circle cx={d.cx} cy={d.cy} r={d.r + 2.6} stroke="#fff2c4" strokeOpacity="0.4" strokeWidth="0.7" strokeDasharray={`${d.r * 1.6} ${d.r * 20}`} strokeDashoffset={-d.r * 0.2} />
            </g>
          ))}
        </CastPiece>
      ) : null}
    </svg>
  );
}
