"use client";

import { useLayoutEffect, useState } from "react";

import { AssayDialog, AssayInfoIcon } from "@/components/assay-dialog";
import { RoundedLight } from "@/components/rounded-light";
import { WheelReadout } from "@/components/wheel-readout";
import { formatStamp, formatWholeDollars } from "@/lib/format";
import { meltPlateRounded, meltWheelLabel } from "@/lib/melt-wheels";
import { presentMoney } from "@/lib/melt-abbrev";
import { LIVE_WIRE_TICK_MS, liveWireState } from "@/lib/live-wire";
import type { WeightSpec } from "@/lib/metals";
import type { MetalQuote, PriceBook } from "@/lib/price-book";
import { meltValue } from "@/lib/value";
import { formatStackPhrase } from "@/lib/weight-label";

export function Readout({
  metal,
  weight,
  pieces,
  spinning: _spinning,
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
  const plateRounded = meltPlateRounded(total);
  const plateMoney = presentMoney(total, "$9,999,999".length);
  const [exactOpen, setExactOpen] = useState(false);
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
      <div className="nameplate melt-plate" data-snap="melt">
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
        {plateRounded ? (
          <p className="melt-overflow">
            {plateMoney.text}
            <RoundedLight exact={formatWholeDollars(total)} open={exactOpen} onToggle={() => setExactOpen((open) => !open)} />
          </p>
        ) : (
          <WheelReadout value={meltWheelLabel(total)} />
        )}
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
