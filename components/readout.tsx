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
  const each = meltValue(metal.usdPerTroyOz, weight.grams, 1);
  const noun = pieces === 1 ? "piece" : "pieces";

  return (
    <section
      className={spinning ? "readout is-spinning" : "readout"}
      aria-busy={spinning}
    >
      <p className="readout-kicker">Spot Price</p>
      <p className="readout-value" data-testid="melt-value">
        {formatUsd(total)}
      </p>
      <p className="readout-stack">
        {pieces} {noun} · {weight.face} {weight.detail} · {metal.name}
      </p>
      <p className="readout-formula">
        {formatUsd(metal.usdPerTroyOz)} / oz t × {formatTroyOunces(weight.grams)} × {pieces}
      </p>
      {pieces > 1 ? <p className="readout-each">Each piece {formatUsd(each)}</p> : null}
      {metal.quotedUnit === "lb" ? (
        <p className="readout-each">
          Copper on the wire is {formatUsd(metal.quotedPrice)}/lb. The reels use{" "}
          {formatUsd(metal.usdPerTroyOz)}/oz t.
        </p>
      ) : null}
    </section>
  );
}
