"use client";

import { useEffect, useId, useState, type CSSProperties } from "react";

import {
  NIXIE_COMMA,
  NIXIE_CYCLE_MS,
  NIXIE_DASH,
  NIXIE_DIGITS,
  NIXIE_DOLLAR,
  NIXIE_DIGIT_FRAME,
  NIXIE_GLYPH,
  NIXIE_STAGGER_MS,
  cyclingDigit,
  NIXIE_SLOT_COUNT,
  nixieSlots,
  type NixieColumn,
} from "@/lib/nixie";

const TUBE_VIEWBOX = "5.2 0 13.6 64";

function Shell({ id }: { id: string }) {
  return (
    <svg className="nixie-shell" viewBox="0 0 10 64" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="18%" stopColor="#d5e7ee" stopOpacity="0.08" />
          <stop offset="58%" stopColor="#ffffff" stopOpacity="0.03" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.16" />
        </linearGradient>
      </defs>
      <rect x="0.35" y="1.1" width="9.3" height="61.8" rx="4.65" fill={`url(#${id}-glass)`} stroke="#f4fbff" strokeOpacity="0.42" strokeWidth="0.35" />
      <rect x="1.15" y="6" width="1.15" height="52" rx="0.55" fill="#ffffff" fillOpacity="0.16" />
    </svg>
  );
}

function HaloDefs({ id }: { id: string }) {
  return (
    <defs>
      <radialGradient id={`${id}-halo`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#ff7a1a" stopOpacity="0.55" />
        <stop offset="55%" stopColor="#ff7a1a" stopOpacity="0.12" />
        <stop offset="100%" stopColor="#ff7a1a" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

function placeOf(key: string): number {
  const place = Number(key.slice(2));
  return Number.isFinite(place) ? place : 0;
}

function DigitTube({
  column,
  shown,
  spare,
}: {
  column: Extract<NixieColumn, { kind: "digit" }>;
  shown: number | null;
  spare: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const delay = `${column.order * NIXIE_STAGGER_MS}ms`;
  return (
    <div className={spare ? "nixie-tube is-spare" : "nixie-tube"} data-kind="digit" data-digit={shown ?? ""} style={{ "--nixie-delay": delay } as CSSProperties}>
      <Shell id={id} />
      <svg className="nixie-face" data-digit={shown ?? ""} viewBox={TUBE_VIEWBOX} preserveAspectRatio="none" aria-hidden="true">
        <HaloDefs id={id} />
        <g transform={NIXIE_DIGIT_FRAME}>
          {shown === null ? null : <circle className="nixie-halo is-on" cx="12" cy="32" r="6.2" fill={`url(#${id}-halo)`} />}
          {NIXIE_DIGITS.map((digit) => (
            <g key={digit} className={digit === shown ? "is-on" : undefined}>
              <path className="nixie-glow" d={NIXIE_GLYPH[digit]} />
              {digit === shown ? null : <path className="nixie-mesh" d={NIXIE_GLYPH[digit]} />}
              <path className="nixie-cathode" d={NIXIE_GLYPH[digit]} />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

function SymbolTube({
  kind,
  glyph,
  lit,
  spare,
}: {
  kind: "dollar" | "comma" | "dot" | "mark";
  glyph?: string;
  lit: boolean;
  spare: boolean;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <div className={spare ? "nixie-tube is-spare" : "nixie-tube"} data-kind={kind} data-lit={lit ? "true" : "false"}>
      <Shell id={id} />
      <svg className="nixie-face" viewBox={TUBE_VIEWBOX} preserveAspectRatio="none" aria-hidden="true">
        <HaloDefs id={id} />
        <g transform={NIXIE_DIGIT_FRAME}>
          {lit ? <circle className="nixie-halo is-on" cx="12" cy={kind === "comma" || kind === "dot" ? 40 : 32} r={kind === "dot" ? 2.4 : 5.4} fill={`url(#${id}-halo)`} /> : null}
          {kind === "dot" ? (
            <circle className={lit ? "nixie-dot is-on" : "nixie-dot"} cx="12" cy="40" r="1.7" />
          ) : (
            <g className={lit ? "is-on" : undefined}>
              <path className="nixie-glow" d={glyph} />
              {lit ? null : <path className="nixie-mesh" d={glyph} />}
              <path className="nixie-cathode" d={glyph} />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}

function Tube({ column, tick, spare }: { column: NixieColumn; tick: number | null; spare: boolean }) {
  if (column.kind === "digit") {
    const shown = tick === null ? column.digit : cyclingDigit(column.place ?? placeOf(column.key), tick);
    return <DigitTube column={column} shown={shown} spare={spare} />;
  }
  if (column.kind === "dollar") return <SymbolTube kind="dollar" glyph={NIXIE_DOLLAR} lit={column.lit} spare={spare} />;
  if (column.kind === "comma") return <SymbolTube kind="comma" glyph={NIXIE_COMMA} lit={tick === null ? column.lit : false} spare={spare} />;
  if (column.kind === "dot") return <SymbolTube kind="dot" lit={column.lit} spare={spare} />;
  return <SymbolTube kind="mark" glyph={NIXIE_DASH} lit={false} spare={spare} />;
}

/** The centered Nixie row. `value` is the same formatted melt string the plate shows. */
export function NixieReadout({
  value,
  spinning = false,
}: {
  value: string;
  spinning?: boolean;
}) {
  const [forced, setForced] = useState<string | null>(null);
  const shownValue = forced ?? value;
  const columns = nixieSlots(shownValue, NIXIE_SLOT_COUNT);
  const [tick, setTick] = useState(0);
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("nixie");
    if (next) setForced(next);
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const cycling = spinning && !reduce;
  useEffect(() => {
    if (!cycling) return;
    const id = window.setInterval(() => setTick((n) => n + 1), NIXIE_CYCLE_MS);
    return () => window.clearInterval(id);
  }, [cycling]);

  const tubesClass = ["nixie-tubes", "is-centered", cycling ? "is-cycling" : ""].filter(Boolean).join(" ");
  const row = (
    <div
      className="gear-panel-nixie is-centered"
      data-testid="nixie-centered"
      data-value={shownValue}
      data-slots={columns.length}
      data-cycling={cycling ? "true" : "false"}
    >
      <div className="nixie-plate" aria-hidden="true" />
      <div className={tubesClass}>
        {columns.map((column) => (
          <Tube
            key={column.key}
            column={column}
            tick={cycling && (column.kind !== "digit" || column.digit !== null) ? tick : null}
            spare={false}
          />
        ))}
      </div>
    </div>
  );
  return (
    <div className="gear-panel-nixie-live">
      <div className="nixie-bezel" aria-label={shownValue}>
        <div className="nixie-viewport">{row}</div>
      </div>
    </div>
  );
}
