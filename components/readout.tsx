"use client";

import { useLayoutEffect, useState } from "react";

import { AssayDialog, AssayInfoIcon } from "@/components/assay-dialog";
import { MetalNameWheel } from "@/components/metal-name-wheel";
import { NixieReadout } from "@/components/nixie-readout";
import { formatStamp, formatWholeDollars } from "@/lib/format";
import { LIVE_WIRE_TICK_MS, liveWireState } from "@/lib/live-wire";
import type { WeightSpec } from "@/lib/metals";
import type { MetalQuote, PriceBook } from "@/lib/price-book";
import { meltValue } from "@/lib/value";
import { formatStackPhrase } from "@/lib/weight-label";

export function Readout({
  metal,
  metals,
  weight,
  pieces,
  spinning,
  formula,
  source,
  fetchedAt,
}: {
  metal: MetalQuote;
  metals: readonly { symbol: string; name: string }[];
  weight: WeightSpec;
  pieces: number;
  spinning: boolean;
  formula?: string;
  source: PriceBook["source"];
  fetchedAt: string;
}) {
  const total = meltValue(metal.usdPerTroyOz, weight.grams, pieces);
  const index = Math.max(
    0,
    metals.findIndex((entry) => entry.symbol === metal.symbol),
  );
  const [now, setNow] = useState<number | null>(null);
  useLayoutEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, LIVE_WIRE_TICK_MS);
    return () => window.clearInterval(id);
  }, []);
  const wire =
    source === "sample" || now == null
      ? source === "sample"
        ? "red"
        : "green"
      : liveWireState(fetchedAt, now, false);

  return (
    <div className="melt-stack">
      <div className="nameplate melt-plate">
        <span className="rivet" data-corner="tl" />
        <span className="rivet" data-corner="tr" />
        <span className="rivet" data-corner="bl" />
        <span className="rivet" data-corner="br" />
        <AssayDialog
          formula={formula}
          trigger={
            <button type="button" className="assay-info" aria-label="Assay notes">
              <AssayInfoIcon />
            </button>
          }
        />
        <div className="melt-heading">
          <MetalNameWheel metals={metals} index={index} />
          <p className="readout-kicker melt-kicker">Melt Price</p>
        </div>
        <div className={spinning ? "melt-digits is-spinning" : "melt-digits"} aria-busy={spinning}>
          <NixieReadout spinning={spinning} value={formatWholeDollars(total)} />
        </div>
        <p className="tagline">{formatStackPhrase(weight, pieces)}</p>
        <p className="lamp" data-state={wire} data-testid="price-source">
          <i />
          Live wire
          <span> · {formatStamp(fetchedAt)}</span>
        </p>
      </div>
    </div>
  );
}
