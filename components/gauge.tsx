export function Gauge({
  label,
  fraction,
}: {
  label: string;
  fraction: number;
}) {
  const clamped = Math.min(1, Math.max(0, fraction));
  const angle = -120 + clamped * 240;

  return (
    <svg className="gauge" viewBox="0 0 120 96" aria-hidden="true">
      <path
        d="M16 78 A44 44 0 1 1 104 78"
        fill="none"
        stroke="#140e09"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d="M16 78 A44 44 0 1 1 104 78"
        fill="none"
        stroke="#c6a15a"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {Array.from({ length: 9 }, (_, tick) => {
        const tickAngle = (-120 + tick * 30) * (Math.PI / 180);
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
            stroke="#f0d78c"
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
          stroke="#f4e2b0"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </g>
      <circle cx="60" cy="78" r="5" fill="#e6cb82" stroke="#6e5318" strokeWidth="1" />
      <text x="60" y="94" textAnchor="middle">
        {label}
      </text>
    </svg>
  );
}
