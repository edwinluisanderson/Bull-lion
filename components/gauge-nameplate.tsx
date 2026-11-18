/**
 * Test name plate. The letters are the same size as a cabinet gauge label.
 * They are stacked so a dark recess shows above the cut and a light edge shows below it.
 */
export function GaugeNamePlate({ label }: { label: string }) {
  return (
    <span className="gauge-nameplate" aria-hidden="true">
      <span className="gauge-nameplate-shade">{label}</span>
      <span className="gauge-nameplate-light">{label}</span>
      <span className="gauge-nameplate-cut">{label}</span>
    </span>
  );
}
