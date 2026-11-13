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
      <div className="marquee melt-marquee">
        <Gear className="gear marquee-gear" />
        <div className="nameplate">
          <span className="rivet" data-corner="tl" />
          <span className="rivet" data-corner="tr" />
          <span className="rivet" data-corner="bl" />
          <span className="rivet" data-corner="br" />
          <p className="plate-title">{metal.name}</p>
        </div>
        <Gear className="gear marquee-gear gear-reverse" />
      </div>
      <section
        className={spinning ? "readout is-spinning" : "readout"}
        aria-busy={spinning}
      >
        <p className="readout-kicker">Melt Price</p>
        <RollingPrice value={formatWholeDollars(total)} />
      </section>
      <div className="marquee melt-marquee">
        <Gear className="gear marquee-gear" />
        <div className="nameplate">
          <span className="rivet" data-corner="tl" />
          <span className="rivet" data-corner="tr" />
          <span className="rivet" data-corner="bl" />
          <span className="rivet" data-corner="br" />
          <p className="tagline">
            {weight.face} {weight.detail} · {pieces} {noun}
          </p>
        </div>
        <Gear className="gear marquee-gear gear-reverse" />
      </div>
    </div>
  );
}
