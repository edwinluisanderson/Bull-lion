"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AssayDialog } from "@/components/assay-dialog";
import { Gauge } from "@/components/gauge";
import { Gear } from "@/components/gear";
import { Lever } from "@/components/lever";
import { Readout } from "@/components/readout";
import { Reel, type ReelSymbol } from "@/components/reel";
import { SpotStrip } from "@/components/spot-strip";
import { formatStamp, formatUsd } from "@/lib/format";
import {
  COUNTS,
  DEFAULT_COUNT_INDEX,
  DEFAULT_METAL_INDEX,
  DEFAULT_WEIGHT_INDEX,
  WEIGHTS,
} from "@/lib/metals";
import { parsePriceBook, type PriceBook } from "@/lib/price-book";
import { meltValue } from "@/lib/value";

function lampLabel(source: PriceBook["source"]): string {
  if (source === "live") return "Live wire";
  if (source === "partial") return "Partial feed";
  return "Sample card";
}

export function SlotMachine({ initialBook }: { initialBook: PriceBook }) {
  const [book, setBook] = useState(initialBook);
  const [metalIndex, setMetalIndex] = useState(DEFAULT_METAL_INDEX);
  const [weightIndex, setWeightIndex] = useState(DEFAULT_WEIGHT_INDEX);
  const [countIndex, setCountIndex] = useState(DEFAULT_COUNT_INDEX);
  const [spinToken, setSpinToken] = useState(0);
  const [metalLand, setMetalLand] = useState({ token: 0, index: DEFAULT_METAL_INDEX });
  const [motion, setMotion] = useState([false, false, false]);
  const lastPull = useRef(0);

  const metal = book.metals[metalIndex] ?? book.metals[0];
  const weight = WEIGHTS[weightIndex] ?? WEIGHTS[DEFAULT_WEIGHT_INDEX];
  const pieces = COUNTS[countIndex] ?? COUNTS[0];
  const spinning = motion.some(Boolean);

  const metalItems = useMemo<ReelSymbol[]>(
    () =>
      book.metals.map((entry) => ({
        key: entry.symbol,
        mark: entry.mark,
        detail: entry.name,
        tint: entry.tint,
      })),
    [book.metals],
  );

  const weightItems = useMemo<ReelSymbol[]>(
    () =>
      WEIGHTS.map((entry) => ({
        key: entry.id,
        mark: entry.face,
        detail: entry.detail,
        tint: "#f0d78c",
      })),
    [],
  );

  const countItems = useMemo<ReelSymbol[]>(
    () =>
      COUNTS.map((count) => ({
        key: String(count),
        mark: `×${count}`,
        detail: count === 1 ? "piece" : "pieces",
        tint: "#f0d78c",
      })),
    [],
  );

  const setReelMotion = useCallback((reel: number, moving: boolean) => {
    setMotion((current) => {
      if (current[reel] === moving) return current;
      const next = [...current];
      next[reel] = moving;
      return next;
    });
  }, []);

  const onMetalMotion = useCallback((moving: boolean) => setReelMotion(0, moving), [setReelMotion]);
  const onWeightMotion = useCallback((moving: boolean) => setReelMotion(1, moving), [setReelMotion]);
  const onCountMotion = useCallback((moving: boolean) => setReelMotion(2, moving), [setReelMotion]);

  const noun = pieces === 1 ? "piece" : "pieces";
  const total = metal ? meltValue(metal.usdPerTroyOz, weight.grams, pieces) : 0;
  const announcement = spinning
    ? "Reels in motion"
    : metal
      ? `${formatUsd(total)} melt value for ${pieces} ${noun} of ${weight.face} ${metal.name}`
      : "";

  useEffect(() => {
    let stopped = false;

    async function refresh() {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch("/api/prices", { cache: "no-store" });
        if (!response.ok) return;
        const next = parsePriceBook(await response.json());
        if (next && !stopped) setBook(next);
      } catch {
        /* Keep the book already on the glass. */
      }
    }

    const id = window.setInterval(() => void refresh(), 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  function pull() {
    const now = performance.now();
    if (now - lastPull.current < 450) return;
    lastPull.current = now;
    setSpinToken((token) => token + 1);
  }

  function selectMetal(index: number) {
    setMetalLand((current) => ({ token: current.token + 1, index }));
  }

  const sourceClass =
    book.source === "live" ? "lamp" : book.source === "partial" ? "lamp is-partial" : "lamp is-sample";

  return (
    <div className="workshop">
      <Gear className="gear bg-gear bg-gear-left" />
      <Gear className="gear bg-gear bg-gear-right" />
      <main className="machine-wrap">
        <section className="cabinet" aria-label="Bullion slot machine">
          <span className="rivet" data-corner="tl" />
          <span className="rivet" data-corner="tr" />
          <span className="rivet" data-corner="bl" />
          <span className="rivet" data-corner="br" />

          <header className="marquee">
            <Gear className="gear marquee-gear" />
            <div className="nameplate">
              <p className="eyebrow">Aurelian Assay Works · № 1889</p>
              <h1 className="plate-title">The Bullion Bandit</h1>
              <p className="tagline">Spin the reels. Read the melt.</p>
            </div>
            <Gear className="gear marquee-gear gear-reverse" />
          </header>

          <div className="gauge-row">
            <Gauge
              label="METAL"
              fraction={metalIndex / Math.max(1, book.metals.length - 1)}
            />
            <div className="bulbs" aria-hidden="true">
              {Array.from({ length: 7 }, (_, index) => (
                <span key={index} className={index % 2 === 0 ? "on" : undefined} />
              ))}
            </div>
            <Gauge
              label="STACK"
              fraction={countIndex / Math.max(1, COUNTS.length - 1)}
            />
          </div>

          <div className="playfield">
            <div className="window-frame">
              <span className="rivet frame-rivet" data-corner="tl" />
              <span className="rivet frame-rivet" data-corner="tr" />
              <span className="rivet frame-rivet" data-corner="bl" />
              <span className="rivet frame-rivet" data-corner="br" />
              <div className="reel-stage">
                <div className="reel-grid">
                <Reel
                  label="Metal"
                  items={metalItems}
                  initialIndex={DEFAULT_METAL_INDEX}
                  spinToken={spinToken}
                  spinOrder={0}
                  landToken={metalLand.token}
                  landIndex={metalLand.index}
                  onIndex={setMetalIndex}
                  onMotion={onMetalMotion}
                />
                <Reel
                  label="Weight"
                  items={weightItems}
                  initialIndex={DEFAULT_WEIGHT_INDEX}
                  spinToken={spinToken}
                  spinOrder={1}
                  landToken={0}
                  landIndex={0}
                  onIndex={setWeightIndex}
                  onMotion={onWeightMotion}
                />
                <Reel
                  label="Count"
                  items={countItems}
                  initialIndex={DEFAULT_COUNT_INDEX}
                  spinToken={spinToken}
                  spinOrder={2}
                  landToken={0}
                  landIndex={0}
                  onIndex={setCountIndex}
                  onMotion={onCountMotion}
                />
                </div>
                <div className="payline" aria-hidden="true" />
                <div className="glass" aria-hidden="true" />
              </div>
            </div>
            <Lever onPull={pull} />
          </div>

          <p className="hint">
            Drag or flick a reel. It coasts and snaps. Pull the lever to throw all
            three, or use the arrows and the keyboard.
          </p>

          {metal ? (
            <Readout metal={metal} weight={weight} pieces={pieces} spinning={spinning} />
          ) : null}

          <SpotStrip
            metals={book.metals}
            selectedSymbol={metal?.symbol ?? ""}
            onSelect={selectMetal}
          />

          <footer className="cabinet-foot">
            <p className={sourceClass} data-testid="price-source">
              <i />
              {lampLabel(book.source)}
              <span> · {formatStamp(book.fetchedAt)}</span>
            </p>
            <AssayDialog />
            <p className="fine-print">{book.note}</p>
          </footer>
        </section>
        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
      </main>
    </div>
  );
}
