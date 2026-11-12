import { formatQuote } from "@/lib/format";
import type { MetalQuote } from "@/lib/price-book";

export function SpotStrip({
  metals,
  selectedSymbol,
  onSelect,
}: {
  metals: MetalQuote[];
  selectedSymbol: string;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="spot-strip" aria-label="Spot prices">
      {metals.map((metal, index) => {
        const selected = metal.symbol === selectedSymbol;
        return (
          <button
            key={metal.symbol}
            type="button"
            className={selected ? "spot-chip is-selected" : "spot-chip"}
            aria-pressed={selected}
            onClick={() => onSelect(index)}
          >
            <small>
              {metal.mark} {metal.name}
              {metal.fallback ? " · sample" : ""}
            </small>
            <strong>{formatQuote(metal.quotedPrice, metal.quotedUnit)}</strong>
          </button>
        );
      })}
    </div>
  );
}
