import { Gear } from "@/components/gear";
import { RollingPrice } from "@/components/rolling-price";
import { formatWholeDollars } from "@/lib/format";
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
    <div className="melt-stack">
      <div className="nameplate melt-plate">
        <Gear className="gear melt-gear melt-gear-left" />
        <p className="melt-name">{metal.name}</p>
        <Gear className="gear melt-gear melt-gear-right gear-reverse" />
      </div>
      <section
        className={spinning ? "readout is-spinning" : "readout"}
        aria-busy={spinning}
      >
        <p className="readout-kicker">Melt Price</p>
        <RollingPrice value={formatWholeDollars(total)} />
      </section>
      <div className="nameplate melt-plate">
        <Gear className="gear melt-gear melt-gear-left" />
        <p className="melt-spec">
          {weight.face} {weight.detail} · {pieces} {noun}
        </p>
        <Gear className="gear melt-gear melt-gear-right gear-reverse" />
      </div>
    </div>
  );
}
