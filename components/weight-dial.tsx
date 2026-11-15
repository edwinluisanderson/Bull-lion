import {
  permanentWeightGrams,
  weightDialAngle,
  weightDialIndex,
  weightDialValues,
  WEIGHT_DIAL_MIN_DEG,
  WEIGHT_DIAL_SWEEP_DEG,
} from "@/lib/weight-dial";

function point(cx: number, cy: number, radius: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: cx + radius * Math.sin(radians),
    y: cy - radius * Math.cos(radians),
  };
}

function arc(cx: number, cy: number, radius: number, start: number, sweep: number) {
  const from = point(cx, cy, radius, start);
  const to = point(cx, cy, radius, start + sweep);
  const large = sweep > 180 ? 1 : 0;
  return `M ${from.x} ${from.y} A ${radius} ${radius} 0 ${large} 1 ${to.x} ${to.y}`;
}

export function WeightDial({ grams }: { grams: number }) {
  const values = weightDialValues(permanentWeightGrams(), grams);
  const angle = weightDialAngle(weightDialIndex(values, grams), values.length);
  const cx = 48;
  const cy = 42;
  const radius = 32;
  const track = arc(cx, cy, radius, WEIGHT_DIAL_MIN_DEG, WEIGHT_DIAL_SWEEP_DEG);

  return (
    <svg className="gauge weight-dial" viewBox="0 0 96 96" aria-hidden="true">
      <path d={track} fill="none" stroke="#140e09" strokeWidth="9" strokeLinecap="round" />
      <path d={track} fill="none" stroke="#c6a15a" strokeWidth="2.2" strokeLinecap="round" />
      {values.map((value, index) => {
        const tick = weightDialAngle(index, values.length);
        const inner = point(cx, cy, radius - 8, tick);
        const outer = point(cx, cy, radius - 1.5, tick);
        return (
          <line
            key={value}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke="#f0d78c"
            strokeWidth="1.2"
          />
        );
      })}
      <g className="gauge-needle" transform={`rotate(${angle} ${cx} ${cy})`}>
        <line
          x1={cx}
          y1={cy}
          x2={cx}
          y2={cy - radius + 8}
          stroke="#f4e2b0"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </g>
      <circle cx={cx} cy={cy} r="4.2" fill="#e6cb82" stroke="#6e5318" strokeWidth="1" />
      <text x="48" y="92" textAnchor="middle">
        WEIGHT
      </text>
    </svg>
  );
}
