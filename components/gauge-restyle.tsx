"use client";
import { useId } from "react";
import { GaugeNamePlate } from "@/components/gauge-nameplate";

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
    <>
      <g transform={`translate(${1.1 * s} ${1.6 * s})`} opacity="0.28">
        <g className="gauge-needle" transform={`rotate(${angle} ${cx} ${cy})`}>
          <path d={d} fill="#2b1a08" />
        </g>
      </g>
      <g className="gauge-needle" transform={`rotate(${angle} ${cx} ${cy})`}>
        <path d={d} fill="#0d0b09" />
        <circle cx={cx} cy={cy + (tail - 1) * s} r={(tail > 5 ? 2.1 : 1.5) * s} fill="#0d0b09" />
      </g>
    </>
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

/* ---------------- Round gauge, viewBox 0 0 96 82, pivot 48,42 ---------------- */
export function RoundGaugeRestyle({
  label,
  angle,
  tickAngles,
  scaleStart,
  scaleSweep,
  className = "",
}: {
  label: string;
  angle: number;
  tickAngles: number[];
  scaleStart: number;
  scaleSweep: number;
  className?: string;
}) {
  const id = useSvgId();
  const cx = 48, cy = 42, r = 32;
  const outerR = 36.5, faceR = 31;
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
      <path d={arcPath(cx, cy, r - 8.3, scaleStart, scaleSweep)} fill="none" stroke="#3a2712" strokeWidth="0.55" />
      {tickAngles.map((deg, i) => {
        const a = pt(cx, cy, r - 8, deg), b = pt(cx, cy, r - 1.5, deg);
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#1f150b" strokeWidth="1.25" />;
      })}
      <circle cx={cx} cy={cy} r="4.2" fill={`url(#${id}-hub)`} stroke="#3a2610" strokeWidth="0.7" />
      <Needle cx={cx} cy={cy} len={r - 8} angle={angle} s={0.72} />
      <circle cx={cx} cy={cy} r="1.6" fill={`url(#${id}-hub)`} stroke="#2a1a08" strokeWidth="0.35" />
      <Glass id={id} clip={`${id}-face`} cx={cx} cy={cy} r={faceR} />
    </svg>
    <GaugeNamePlate label={label} />
    </div>
  );
}
