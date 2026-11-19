import { WEIGHT_DIAL_MIN_DEG, WEIGHT_DIAL_SWEEP_DEG } from "@/lib/weight-dial";
import { RoundGaugeRestyle } from "@/components/gauge-restyle";

export function Gauge({ label, fraction = 0, stops, index = 0, segments, needle, face, stackBand, rampPos, rampTone }: { label: string; fraction?: number; stops?: number; index?: number; segments?: { mark: string; fill: string }[]; needle?: 1 | 2 | 3 | 4 | "4b" | 5 | "5b" | 6; face?: 1 | 2 | 3 | 4; stackBand?: "a" | "b"; rampPos?: "inner" | "mid"; rampTone?: "blue" | "green" }) {
  const counted = stops != null && stops > 0;
  const clamped = Math.min(1, Math.max(0, fraction));
  // Same sweep as the Weight dial: 332° clockwise, 28° gap at the bottom.
  const n = counted ? stops : 8; // Stack: one tick per count (COUNTS has 8)
  const ticks = Array.from({ length: n }, (_, i) => WEIGHT_DIAL_MIN_DEG + (i / (n - 1)) * WEIGHT_DIAL_SWEEP_DEG);
  const f = counted ? Math.min(n - 1, Math.max(0, index)) / (n - 1) : clamped;
  // Segmented selector (mockup): needle points at the centre of the selected segment.
  const angle = segments && segments.length
    ? WEIGHT_DIAL_MIN_DEG + ((Math.min(segments.length - 1, Math.max(0, index)) + 0.5) / segments.length) * WEIGHT_DIAL_SWEEP_DEG
    : WEIGHT_DIAL_MIN_DEG + f * WEIGHT_DIAL_SWEEP_DEG;
  return (
    <RoundGaugeRestyle label={label} angle={angle} tickAngles={ticks} scaleStart={WEIGHT_DIAL_MIN_DEG} scaleSweep={WEIGHT_DIAL_SWEEP_DEG} className="weight-dial gauge--round-b" segments={segments} needle={needle} face={face} faceKind="stack" stackBand={stackBand} rampPos={rampPos} rampTone={rampTone} />
  );
}
