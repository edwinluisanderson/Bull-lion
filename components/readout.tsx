import { formatUsd } from "@/lib/format";
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

  return (
    <section
      className={spinning ? "readout is-spinning" : "readout"}
      aria-busy={spinning}
    >
      <p className="readout-kicker">{metal.name} Spot Price</p>
      <p className="readout-value" data-testid="melt-value">
        {formatUsd(total)}
      </p>
      <p className="readout-stack readout-spec">
        {weight.face} {weight.detail} · {pieces} {noun}
      </p>
    </section>
  );
}
