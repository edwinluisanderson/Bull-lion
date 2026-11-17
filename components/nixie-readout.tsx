"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

import {
  NIXIE_COMMA,
  NIXIE_CYCLE_MS,
  NIXIE_DASH,
  NIXIE_DIGITS,
  NIXIE_DOLLAR,
  NIXIE_GLYPH,
  NIXIE_STAGGER_MS,
  cyclingDigit,
  nixieBank,
  nixieSlots,
  nixieTubeCount,
  type NixieColumn,
} from "@/lib/nixie";

function Glass({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="18%" stopColor="#d5e7ee" stopOpacity="0.08" />
          <stop offset="58%" stopColor="#ffffff" stopOpacity="0.03" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.16" />
        </linearGradient>
        <radialGradient id={`${id}-halo`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff7a1a" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#ff7a1a" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#ff7a1a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="2.2" y="1.2" width="19.6" height="61.6" rx="9.8" fill={`url(#${id}-glass)`} stroke="#f4fbff" strokeOpacity="0.42" strokeWidth="0.7" />
      <rect x="4.1" y="6" width="2.4" height="52" rx="1.2" fill="#ffffff" fillOpacity="0.16" />
    </>
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
    <svg className={spare ? "nixie-tube is-spare" : "nixie-tube"} data-kind="digit" data-digit={shown ?? ""} viewBox="0 0 24 64" aria-hidden="true" style={{ "--nixie-delay": delay } as CSSProperties}>
      <Glass id={id} />
      {shown === null ? null : <circle className="nixie-halo is-on" cx="12" cy="32" r="10" fill={`url(#${id}-halo)`} />}
      {NIXIE_DIGITS.map((digit) => (
        <g key={digit} className={digit === shown ? "is-on" : undefined}>
          <path className="nixie-glow" d={NIXIE_GLYPH[digit]} />
          {digit === shown ? null : <path className="nixie-mesh" d={NIXIE_GLYPH[digit]} />}
          <path className="nixie-cathode" d={NIXIE_GLYPH[digit]} />
        </g>
      ))}
    </svg>
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
    <svg className={spare ? "nixie-tube is-spare" : "nixie-tube"} data-kind={kind} data-lit={lit ? "true" : "false"} viewBox="0 0 24 64" aria-hidden="true">
      <Glass id={id} />
      {lit ? <circle className="nixie-halo is-on" cx="12" cy={kind === "comma" || kind === "dot" ? 40 : 32} r={kind === "dot" ? 6 : 9} fill={`url(#${id}-halo)`} /> : null}
      {kind === "dot" ? (
        <circle className={lit ? "nixie-dot is-on" : "nixie-dot"} cx="12" cy="40" r="1.7" />
      ) : (
        <g className={lit ? "is-on" : undefined}>
          <path className="nixie-glow" d={glyph} />
          {lit ? null : <path className="nixie-mesh" d={glyph} />}
          <path className="nixie-cathode" d={glyph} />
        </g>
      )}
    </svg>
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

/** A test nixie row. `value` is the same formatted melt string the plate shows. */
export function NixieReadout({
  value,
  spinning = false,
  centered = false,
}: {
  value: string;
  spinning?: boolean;
  /** Show only the tubes the value needs, centered as a group. */
  centered?: boolean;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [tubeCount, setTubeCount] = useState(13);
  const columns = centered ? nixieSlots(value, tubeCount) : nixieBank(value);
  const [tick, setTick] = useState(0);
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const cycling = spinning && !reduce;
  useEffect(() => {
    if (!centered) return;
    const node = frameRef.current;
    if (!node) return;
    const measure = () => {
      const width = node.clientWidth;
      const height = Math.min(104, Math.max(64, window.innerWidth * 0.08));
      setTubeCount(nixieTubeCount(width, height));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [centered]);
  useEffect(() => {
    if (!cycling) return;
    const id = window.setInterval(() => setTick((n) => n + 1), NIXIE_CYCLE_MS);
    return () => window.clearInterval(id);
  }, [cycling]);

  const tubesClass = ["nixie-tubes", cycling ? "is-cycling" : "", centered ? "is-centered" : ""].filter(Boolean).join(" ");
  const row = (
    <div
      className={centered ? "gear-panel-nixie is-centered" : "gear-panel-nixie"}
      ref={centered ? frameRef : undefined}
      data-testid={centered ? "nixie-centered" : "nixie-value"}
      data-value={value}
      data-slots={centered ? columns.length : undefined}
      data-cycling={cycling ? "true" : "false"}
    >
      <div className="nixie-plate" aria-hidden="true" />
      <div className={tubesClass}>
        {columns.map((column) => (
          <Tube
            key={column.key}
            column={column}
            tick={cycling && (!centered || column.kind !== "digit" || column.digit !== null) ? tick : null}
            spare={false}
          />
        ))}
      </div>
      <div className="nixie-window" />
    </div>
  );
  if (!centered) return row;
  return <div className="gear-panel-nixie-live">{row}</div>;
}
