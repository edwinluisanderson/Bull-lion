import { AssayDialog, AssayInfoIcon } from "@/components/assay-dialog";
import { formatTroyOunces, formatUsd } from "@/lib/format";
import type { WeightSpec } from "@/lib/metals";
import type { MetalQuote } from "@/lib/price-book";
import { meltValue } from "@/lib/value";

export function Readout({
  metal,
  weight,
  pieces,
  spinning,
}: {
  metal: MetalQuote;
  weight: WeightSpec;
  pieces: number;
  spinning: boolean;
}) {
  const total = meltValue(metal.usdPerTroyOz, weight.grams, pieces);
  const noun = pieces === 1 ? "piece" : "pieces";
  const formula = `${formatUsd(metal.usdPerTroyOz)} / oz t × ${formatTroyOunces(weight.grams)} × ${pieces}`;

  return (
    <section
      className={spinning ? "readout is-spinning" : "readout"}
      aria-busy={spinning}
    >
      <AssayDialog
        formula={formula}
        trigger={
          <button type="button" className="assay-info" aria-label="Assay notes">
            <AssayInfoIcon />
          </button>
        }
      />
      <p className="readout-kicker">Spot Price</p>
      <p className="readout-value" data-testid="melt-value">
        {formatUsd(total)}
      </p>
      <p className="readout-stack readout-metal">{metal.name}</p>
      <p className="readout-stack readout-spec">
        {weight.face} {weight.detail} · {pieces} {noun}
      </p>
    </section>
  );
}
