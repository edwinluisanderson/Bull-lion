/**
 * Ported from Gee's PR #41 test plate (6ebbdd7): brass plate, engraved letters stacked so a
 * dark recess shows above the cut and a light edge below it. Mockup adds end rivets and a fixed 11px size.
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
