import { halfCircleNeedleAngle } from "@/lib/metal-dial";

/**
 * Test restyle of the STACK gauge only.
 * Same arc, ticks, needle, and angle as components/gauge.tsx.
 * The face, bezel, and glass are new. Ticks and the label are darkened
 * so they stay readable on the ivory face.
 */
export function StackGaugeTest({ fraction = 0 }: { fraction?: number }) {
  const clamped = Math.min(1, Math.max(0, fraction));
  const angle = halfCircleNeedleAngle(clamped);
  const tickAngles = Array.from({ length: 7 }, (_, tick) => -90 + tick * 30);

  return (
    <svg className="gauge scrap-gauge-test" viewBox="0 0 120 96" aria-hidden="true">
      <defs>
        <linearGradient id="scrap-gauge-brass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f8e7b8" />
          <stop offset="0.28" stopColor="#d7b56a" />
          <stop offset="0.62" stopColor="#a3783c" />
          <stop offset="1" stopColor="#5c3d18" />
        </linearGradient>
        <radialGradient id="scrap-gauge-ivory" cx="50%" cy="42%" r="68%">
          <stop offset="0" stopColor="#fffaf1" />
          <stop offset="0.72" stopColor="#f4ead6" />
          <stop offset="1" stopColor="#e4d2b0" />
        </radialGradient>
        <linearGradient id="scrap-gauge-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.42" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M8 78 A52 52 0 1 1 112 78"
        fill="none"
        stroke="#1a0e08"
        strokeWidth="8"
        strokeLinecap="round"
        opacity="0.4"
        transform="translate(0 2)"
      />
      <path
        d="M8 78 A52 52 0 1 1 112 78"
        fill="none"
        stroke="#3a2410"
        strokeWidth="15"
        strokeLinecap="round"
      />
      <path
        d="M8 78 A52 52 0 1 1 112 78"
        fill="none"
        stroke="url(#scrap-gauge-brass)"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <path
        d="M8 78 A52 52 0 1 1 112 78"
        fill="none"
        stroke="#f8e7b8"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M18 78 A42 42 0 1 1 102 78 Z" fill="url(#scrap-gauge-ivory)" />
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
        <line
          x1="60"
          y1="78"
          x2="60"
          y2="40"
          stroke="#2a1c10"
          strokeWidth="4.2"
          strokeLinecap="round"
        />
        <line
          x1="60"
          y1="78"
          x2="60"
          y2="40"
          stroke="#f4e2b0"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </g>
      <circle cx="60" cy="78" r="5" fill="#e6cb82" stroke="#6e5318" strokeWidth="1" />
      <path d="M18 78 A42 42 0 1 1 102 78 Z" fill="url(#scrap-gauge-glass)" />
      <path
        d="M28 70 A34 34 0 0 1 92 70"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.55"
      />
      <text x="60" y="94" textAnchor="middle">
        STACK
      </text>
    </svg>
  );
}
