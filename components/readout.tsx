import { Gear } from "@/components/gear";
import { RollingPrice } from "@/components/rolling-price";
import { formatWholeDollars } from "@/lib/format";
import type { WeightSpec } from "@/lib/metals";
import type { MetalQuote } from "@/lib/price-book";
import { meltValue } from "@/lib/value";
import { formatStackPhrase } from "@/lib/weight-label";

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

  return (
    <div className="melt-stack">
      <div className="marquee melt-marquee">
        <Gear className="gear marquee-gear" />
        <div className="nameplate">
          <span className="rivet" data-corner="tl" />
          <span className="rivet" data-corner="tr" />
          <span className="rivet" data-corner="bl" />
          <span className="rivet" data-corner="br" />
          <p className="plate-title">{metal.name}</p>
          <section
            className={spinning ? "readout is-spinning" : "readout"}
            aria-busy={spinning}
          >
            <p className="readout-kicker">Melt Price</p>
            <RollingPrice value={formatWholeDollars(total)} />
          </section>
          <p className="tagline">{formatStackPhrase(weight, pieces)}</p>
        </div>
        <Gear className="gear marquee-gear gear-reverse" />
      </div>
    </div>
  );
}
