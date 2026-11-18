import {
  permanentWeightGrams, weightDialAngle, weightDialIndex, weightDialTickAngles, weightDialValues,
  WEIGHT_DIAL_MIN_DEG, WEIGHT_DIAL_SWEEP_DEG,
} from "@/lib/weight-dial";
import { RoundGaugeRestyle } from "@/components/gauge-restyle";

export function WeightDial({ grams }: { grams: number }) {
  const values = weightDialValues(permanentWeightGrams());
  const angle = weightDialAngle(weightDialIndex(values, grams), values.length);
  return (
    <RoundGaugeRestyle label="WEIGHT" angle={angle} tickAngles={weightDialTickAngles()} scaleStart={WEIGHT_DIAL_MIN_DEG} scaleSweep={WEIGHT_DIAL_SWEEP_DEG} className="weight-dial" />
  );
}
