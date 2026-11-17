"use client";

import { useLayoutEffect, useState } from "react";

import { AssayDialog, AssayInfoIcon } from "@/components/assay-dialog";
import { RollingPrice } from "@/components/rolling-price";
import { formatStamp, formatWholeDollars } from "@/lib/format";
import { LIVE_WIRE_TICK_MS, liveWireState } from "@/lib/live-wire";
import type { WeightSpec } from "@/lib/metals";
import type { MetalQuote, PriceBook } from "@/lib/price-book";
import { meltValue } from "@/lib/value";
import { formatStackPhrase } from "@/lib/weight-label";

export function Readout({
  metal,
  weight,
  pieces,
  spinning,
  formula,
  source,
  fetchedAt,
}: {
  metal: MetalQuote;
  weight: WeightSpec;
  pieces: number;
  spinning: boolean;
  formula?: string;
  source: PriceBook["source"];
  fetchedAt: string;
}) {
  const total = meltValue(metal.usdPerTroyOz, weight.grams, pieces);
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
          <p className="plate-title">{metal.name}</p>
          <p className="readout-kicker melt-kicker">Melt Price</p>
        </div>
        <section
          className={spinning ? "readout melt-digits is-spinning" : "readout melt-digits"}
          aria-busy={spinning}
        >
          <RollingPrice value={formatWholeDollars(total)} />
        </section>
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
