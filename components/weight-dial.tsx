import {
  permanentWeightGrams, weightDialAngle, weightDialIndex, weightDialTickAngles, weightDialValues,
  WEIGHT_DIAL_MIN_DEG, WEIGHT_DIAL_SWEEP_DEG,
} from "@/lib/weight-dial";
import { RoundGaugeRestyle } from "@/components/gauge-restyle";

export function WeightDial({ grams, needle, face, rampPos, rampTone }: { grams: number; needle?: 5 | "5b" | 6; face?: 1 | 2 | 3 | 4; rampPos?: "inner" | "mid"; rampTone?: "blue" | "green" }) {
  const values = weightDialValues(permanentWeightGrams());
  const angle = weightDialAngle(weightDialIndex(values, grams), values.length);
  return (
    <RoundGaugeRestyle label="WEIGHT" angle={angle} tickAngles={weightDialTickAngles()} scaleStart={WEIGHT_DIAL_MIN_DEG} scaleSweep={WEIGHT_DIAL_SWEEP_DEG} className="weight-dial" needle={needle} face={face} faceKind="weight" rampPos={rampPos} rampTone={rampTone} />
  );
}
