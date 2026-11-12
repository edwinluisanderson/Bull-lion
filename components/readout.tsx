import { AssayDialog } from "@/components/assay-dialog";
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
            <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
              <circle cx="16" cy="16" r="12.2" fill="#2a1c10" stroke="#e6cb82" strokeWidth="1.7" />
              <circle cx="16" cy="16" r="9.3" fill="none" stroke="#6e5318" strokeWidth="0.9" />
              <circle cx="16" cy="11.15" r="1.35" fill="#f0d78c" />
              <path
                d="M16 14.35v7.15"
                fill="none"
                stroke="#f0d78c"
                strokeWidth="1.9"
                strokeLinecap="round"
              />
            </svg>
          </button>
        }
      />
      <p className="readout-kicker">Spot Price</p>
      <p className="readout-value" data-testid="melt-value">
        {formatUsd(total)}
      </p>
      <p className="readout-stack">
        {pieces} {noun} · {weight.face} {weight.detail} · {metal.name}
      </p>
      {metal.quotedUnit === "lb" ? (
        <p className="readout-each">
          Copper on the wire is {formatUsd(metal.quotedPrice)}/lb. The reels use{" "}
          {formatUsd(metal.usdPerTroyOz)}/oz t.
        </p>
      ) : null}
    </section>
  );
}
