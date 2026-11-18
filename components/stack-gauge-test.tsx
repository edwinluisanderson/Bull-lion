import { halfCircleNeedleAngle } from "@/lib/metal-dial";

/**
 * Test restyle of the STACK gauge only.
 * The arc, tick endpoints, needle line, hub, label, and viewBox match
 * components/gauge.tsx. Colors are the restyle: ivory face, brass bezel,
 * glass, and a solid black needle.
 */
export function StackGaugeTest({ fraction = 0 }: { fraction?: number }) {
  const clamped = Math.min(1, Math.max(0, fraction));
  const angle = halfCircleNeedleAngle(clamped);
  const tickAngles = Array.from({ length: 7 }, (_, tick) => -90 + tick * 30);
  const arc = "M16 78 A44 44 0 1 1 104 78";

  return (
    <svg className="gauge scrap-gauge-test" viewBox="0 0 120 96" aria-hidden="true">
      <defs>
        <linearGradient id="scrap-gauge-brass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f8e7b8" />
          <stop offset="0.28" stopColor="#d7b56a" />
          <stop offset="0.62" stopColor="#a3783c" />
          <stop offset="1" stopColor="#5c3d18" />
        </linearGradient>
        <linearGradient id="scrap-gauge-brass-edge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff6d8" />
          <stop offset="0.45" stopColor="#e6cb82" />
          <stop offset="1" stopColor="#8a6230" />
        </linearGradient>
        <radialGradient id="scrap-gauge-ivory" cx="50%" cy="38%" r="70%">
          <stop offset="0" stopColor="#fffaf1" />
          <stop offset="0.7" stopColor="#f4ead6" />
          <stop offset="1" stopColor="#e4d2b0" />
        </radialGradient>
        <linearGradient id="scrap-gauge-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="0.38" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${arc} Z`} fill="url(#scrap-gauge-ivory)" />
      <path d={`${arc} Z`} fill="url(#scrap-gauge-glass)" />
      <path d={arc} fill="none" stroke="url(#scrap-gauge-brass)" strokeWidth="12" strokeLinecap="round" />
      <path d={arc} fill="none" stroke="url(#scrap-gauge-brass-edge)" strokeWidth="3" strokeLinecap="round" />
      {tickAngles.map((degrees, tick) => {
        const tickAngle = (degrees * Math.PI) / 180;
        const inner = 34;
        const outer = 42;
        const cx = 60;
        const cy = 78;
        return (
          <line
            key={tick}
            x1={cx + Math.sin(tickAngle) * inner}
            y1={cy - Math.cos(tickAngle) * inner}
            x2={cx + Math.sin(tickAngle) * outer}
            y2={cy - Math.cos(tickAngle) * outer}
            stroke="#2a1c10"
            strokeWidth="1.5"
          />
        );
      })}
      <g className="gauge-needle" transform={`rotate(${angle} 60 78)`}>
        <line x1="60" y1="78" x2="60" y2="40" stroke="#111" strokeWidth="2.4" strokeLinecap="round" />
      </g>
      <circle cx="60" cy="78" r="5" fill="#1a120c" stroke="#3a2814" strokeWidth="1" />
      <text x="60" y="94" textAnchor="middle">
        STACK
      </text>
    </svg>
  );
}
