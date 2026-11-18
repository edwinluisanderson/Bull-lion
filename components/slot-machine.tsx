"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Gauge } from "@/components/gauge";
import { WeightDial } from "@/components/weight-dial";
import { Gear } from "@/components/gear";
import { SteampunkLight, SteampunkLightCast } from "@/components/steampunk-light";
import { WheelLamps } from "@/components/wheel-lamps";
import { pulseWheelLamp } from "@/lib/wheel-lamp";
import { RollingPrice } from "@/components/rolling-price";
import { StackTable } from "@/components/stack-table";
import { PullBall } from "@/components/lever";
import { Readout } from "@/components/readout";
import { Reel, type ReelSymbol } from "@/components/reel";
import { weightShowsDollars } from "@/lib/affordable-weight";
import {
  copperCountAdjustment,
  holdAfterMotion,
  holdForPull,
  IDLE_COUNT_GUARD,
  notePullStarted,
} from "@/lib/count-guard";
import { formatTroyOunces, formatUsd, formatWholeDollars } from "@/lib/format";
import {
  COUNTS,
  DEFAULT_COUNT_INDEX,
  DEFAULT_METAL_INDEX,
  DEFAULT_WEIGHT_INDEX,
  WEIGHTS,
} from "@/lib/metals";
import { LIVE_SPOT_NOTE, parsePriceBook, type PriceBook } from "@/lib/price-book";
import { settleReels } from "@/lib/haptics";
import { pullStartsSpin } from "@/lib/pull-stack";
import { installAppAudioUnlock, preloadAppSounds } from "@/lib/sound-preload";
import { playSpinOverlay, spinOverlayFor } from "@/lib/spin-overlay";
import { meltValue } from "@/lib/value";
import { LAMP_FULL, LAMP_LOW, LAMP_MEDIUM, LAMP_OFF, STEAMPUNK_LIGHT_COUNT } from "@/lib/steampunk-light";
import {
  weightStretchBetween,
  weightStretchLabel,
  weightStretchOrigin,
} from "@/lib/weight-stretch";

export function SlotMachine({ initialBook }: { initialBook: PriceBook }) {
  const [book, setBook] = useState(initialBook);
  const [metalIndex, setMetalIndex] = useState(DEFAULT_METAL_INDEX);
  const [weightIndex, setWeightIndex] = useState(DEFAULT_WEIGHT_INDEX);
  const [countIndex, setCountIndex] = useState(DEFAULT_COUNT_INDEX);
  const [customPieces, setCustomPieces] = useState<number | null>(null);
  const [customGrams, setCustomGrams] = useState<number | null>(null);
  const [spinToken, setSpinToken] = useState(0);
  const [pullSerial, setPullSerial] = useState(0);
  const [bendDegrees, setBendDegrees] = useState(0);
  const [motion, setMotion] = useState([false, false, false]);
  const motionRef = useRef(motion);
  const [countGuard, setCountGuard] = useState(0);
  const [countGuardHold, setCountGuardHold] = useState(false);
  const [lampBrightness, setLampBrightness] = useState<number | undefined>(undefined);
  const [lampCompare, setLampCompare] = useState(false);
  const pullHold = useRef(IDLE_COUNT_GUARD);
  const lastPull = useRef(0);

  const metal = book.metals[metalIndex] ?? book.metals[0];
  const listedWeight = WEIGHTS[weightIndex] ?? WEIGHTS[DEFAULT_WEIGHT_INDEX];
  const customFace = customGrams == null ? null : weightStretchLabel(customGrams);
  const weight =
    customGrams == null || !customFace
      ? listedWeight
      : { id: `stretch-${customGrams}`, face: customFace.mark, detail: customFace.detail, grams: customGrams };
  const pieces = customPieces ?? COUNTS[countIndex] ?? COUNTS[0];
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

  const weightStops = useMemo(() => WEIGHTS.map((entry) => entry.grams), []);
  const weightItems = useMemo<ReelSymbol[]>(
    () =>
      WEIGHTS.map((entry) => ({
        key: entry.id,
        mark: entry.face,
        detail: entry.detail,
        tint: "var(--melt-digit)",
      })),
    [],
  );

  const countItems = useMemo<ReelSymbol[]>(() => {
    const copper = countGuardHold || metal?.symbol !== "HG" ? null : metal.usdPerTroyOz;
    const unaffordable =
      copper === null
        ? COUNTS.map(() => false)
        : COUNTS.map((count) => !weightShowsDollars(copper, weight.grams, count));
    const anyAffordable = unaffordable.some((gray) => !gray);
    return COUNTS.map((count, index) => ({
      key: String(count),
      mark: `×${count}`,
      detail: count === 1 ? "piece" : "pieces",
      tint: "var(--melt-digit)",
      disabled: anyAffordable ? unaffordable[index] : index !== COUNTS.length - 1,
    }));
  }, [countGuardHold, metal, weight.grams]);

  const setReelMotion = useCallback((reel: number, moving: boolean) => {
    const current = motionRef.current;
    if (current[reel] === moving) return;
    const next = [...current];
    next[reel] = moving;
    motionRef.current = next;
    settleReels(current, next);
    const step = holdAfterMotion(pullHold.current, next);
    pullHold.current = step.hold;
    setCountGuardHold(step.hold.holding);
    setMotion(next);
  }, []);

  const onMetalMotion = useCallback((moving: boolean) => setReelMotion(0, moving), [setReelMotion]);
  const onWeightMotion = useCallback((moving: boolean) => setReelMotion(1, moving), [setReelMotion]);
  const onCountMotion = useCallback((moving: boolean) => setReelMotion(2, moving), [setReelMotion]);

  const noun = pieces === 1 ? "piece" : "pieces";
  const total = metal ? meltValue(metal.usdPerTroyOz, weight.grams, pieces) : 0;
  const formula = metal
    ? `${formatUsd(metal.usdPerTroyOz)} / oz t × ${formatTroyOunces(weight.grams)} × ${pieces}`
    : undefined;
  const announcement = spinning
    ? "Reels in motion"
    : metal
      ? `${formatUsd(total)} melt value for ${pieces} ${noun} of ${weight.face} ${metal.name}`
      : "";

  useEffect(() => {
    preloadAppSounds();
    installAppAudioUnlock();
  }, []);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("lamps");
    if (raw === "compare") {
      setLampCompare(true);
      return;
    }
    if (raw === null) return;
    const next = Number(raw);
    if (Number.isFinite(next)) setLampBrightness(next);
  }, []);

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
    if (!pullStartsSpin(now, lastPull.current)) return;
    lastPull.current = now;
    setPullSerial((serial) => serial + 1);
    pullHold.current = holdForPull(pullHold.current);
    setCountGuardHold(true);
    setBendDegrees(0);
    setSpinToken((token) => token + 1);
    if (spinOverlayFor("pull")) playSpinOverlay();
  }

  useEffect(() => {
    if (spinToken === 0) return;
    const hold = notePullStarted(pullHold.current, motionRef.current);
    pullHold.current = hold;
    setCountGuardHold(hold.holding);
  }, [spinToken]);

  useEffect(() => {
    const next = copperCountAdjustment({
      holding: countGuardHold,
      metalSymbol: metal?.symbol,
      usdPerTroyOz: metal?.usdPerTroyOz ?? 0,
      grams: weight.grams,
      countIndex,
      customPieces,
      counts: COUNTS,
    });
    if (next.customPieces !== customPieces) setCustomPieces(next.customPieces);
    if (next.countIndex !== countIndex) setCountIndex(next.countIndex);
    if (next.guard) setCountGuard((token) => token + 1);
  }, [countGuardHold, metal?.symbol, metal?.usdPerTroyOz, weight.grams, countIndex, customPieces]);

  return (
    <div className="workshop">
      <main className="machine-wrap">
        <section className="cabinet" aria-label="Bullion slot machine">
          <span className="rivet" data-corner="tl" />
          <span className="rivet" data-corner="tr" />
          <span className="rivet" data-corner="bl" />
          <span className="rivet" data-corner="br" />

          <div className="cabinet-crest">
            <img
              className="bullion-logo"
              src="/bullion-logo.png"
              alt=""
              aria-hidden="true"
              width={276}
              height={300}
            />
          </div>

          {metal ? (
            <Readout
              metal={metal}
              weight={weight}
              pieces={pieces}
              spinning={spinning}
              formula={formula}
              source={book.source}
              fetchedAt={book.fetchedAt}
            />
          ) : null}

          <div className="between-plates">
            <div className="between-plates-dock" />
            <div className="gauge-row">
              <Gauge
                label="METAL"
                stops={book.metals.length}
                index={metalIndex}
              />
              <div className="gauge-center">
                <WeightDial grams={weight.grams} />
              </div>
              <Gauge
                label="STACK"
                fraction={countIndex / Math.max(1, COUNTS.length - 1)}
              />
            </div>
          </div>

          <div className="playfield" data-snap="wheels">
            <div className="window-frame">
              <span className="rivet frame-rivet" data-corner="tl" />
              <span className="rivet frame-rivet" data-corner="tr" />
              <span className="rivet frame-rivet" data-corner="bl" />
              <span className="rivet frame-rivet" data-corner="br" />
              <div className="reel-stage">
                <div className="reel-grid">
                <Reel
                  lampIndex={0}
                  label="Metal"
                  items={metalItems}
                  initialIndex={DEFAULT_METAL_INDEX}
                  spinToken={spinToken}
                  spinOrder={0}
                  bendDegrees={bendDegrees}
                  onIndex={(index) => {
                    pulseWheelLamp(0);
                    setMetalIndex(index);
                  }}
                  onMotion={onMetalMotion}
                />
                <Reel
                  lampIndex={1}
                  label="Weight"
                  items={weightItems}
                  initialIndex={DEFAULT_WEIGHT_INDEX}
                  spinToken={spinToken}
                  spinOrder={1}
                  bendDegrees={bendDegrees}
                  centerPieces={customGrams}
                  stretch={{
                    stops: weightStops,
                    isValueEnabled: () => true,
                    between: weightStretchBetween,
                    origin: weightStretchOrigin,
                    label: weightStretchLabel,
                  }}
                  onPieces={(grams) => {
                    const index = WEIGHTS.findIndex((entry) => entry.grams === grams);
                    if (index >= 0) {
                      setCustomGrams(null);
                      setWeightIndex(index);
                      return;
                    }
                    setCustomGrams(grams);
                  }}
                  onIndex={(index) => {
                    pulseWheelLamp(1);
                    setWeightIndex(index);
                    setCustomGrams(null);
                  }}
                  onMotion={onWeightMotion}
                  alternatePullStops
                />
                <Reel
                  lampIndex={2}
                  label="Count"
                  items={countItems}
                  initialIndex={DEFAULT_COUNT_INDEX}
                  spinToken={spinToken}
                  spinOrder={2}
                  bendDegrees={bendDegrees}
                  guardToken={countGuard}
                  guardIndex={countIndex}
                  centerPieces={customPieces}
                  stretch={{
                    stops: COUNTS,
                    isValueEnabled: (value) => {
                      if (metal?.symbol !== "HG") return true;
                      const marks = COUNTS.map((count) =>
                        weightShowsDollars(metal.usdPerTroyOz, weight.grams, count),
                      );
                      if (!marks.some(Boolean)) return value === COUNTS[COUNTS.length - 1];
                      return weightShowsDollars(metal.usdPerTroyOz, weight.grams, value);
                    },
                  }}
                  onPieces={(value) => {
                    const index = COUNTS.indexOf(value);
                    if (index >= 0) {
                      setCustomPieces(null);
                      setCountIndex(index);
                      return;
                    }
                    setCustomPieces(value);
                  }}
                  onIndex={(index) => {
                    pulseWheelLamp(2);
                    setCountIndex(index);
                    setCustomPieces(null);
                  }}
                  onMotion={onCountMotion}
                />
                </div>
                <div className="payline" aria-hidden="true" />
                <div className="glass" aria-hidden="true" />
              </div>
            </div>
            <PullBall onCommit={pull} onBend={setBendDegrees} />
          </div>

          <div className="cabinet-gears" aria-hidden="true">
            <WheelLamps />
          </div>

          {book.note === LIVE_SPOT_NOTE ? null : (
            <footer className="cabinet-foot">
              <p className="fine-print">{book.note}</p>
            </footer>
          )}
        </section>
        <div className="stack-plate" data-snap="stack">
          <StackTable
            selection={
              metal
                ? {
                    symbol: metal.symbol,
                    mark: metal.mark,
                    name: metal.name,
                    grams: weight.grams,
                    weightLabel: weight.face,
                    qty: pieces,
                  }
                : null
            }
            quotes={book.metals.map((entry) => ({ symbol: entry.symbol, usdPerTroyOz: entry.usdPerTroyOz }))}
            pullSerial={pullSerial}
          />
        </div>
        <div className="gear-panel">
          <span className="rivet" data-corner="tl" />
          <span className="rivet" data-corner="tr" />
          <span className="rivet" data-corner="bl" />
          <span className="rivet" data-corner="br" />
          <div className="gear-panel-stage" aria-hidden="true">
          <div className="gear-panel-lights">
            {Array.from({ length: STEAMPUNK_LIGHT_COUNT }, (_, index) => (
              <SteampunkLight key={index} brightness={lampBrightness} />
            ))}
          </div>
          <Gear className="gear bg-gear gear-panel-bg gear-panel-bg-left" />
          <Gear className="gear bg-gear gear-panel-bg gear-panel-bg-right" />
          <div className="gear-panel-row">
            <Gear className="gear marquee-gear" />
            <Gear className="gear marquee-gear gear-reverse" />
          </div>
          <div className="gear-panel-lighthouse">
            <div className="lighthouse-beam" />
            <SteampunkLight className="lighthouse-lamp" />
          </div>
          <SteampunkLightCast />
          </div>
          <div className="scrap-readout-gap" aria-hidden="true" />
          <div className="scrap-readout">
            <section className={spinning ? "readout is-spinning" : "readout"}>
              <RollingPrice value={metal ? formatWholeDollars(meltValue(metal.usdPerTroyOz, weight.grams, pieces)) : "—"} />
            </section>
          </div>
        </div>
        {lampCompare ? (
          <div className="lamp-compare">
            {(
              [
                [LAMP_OFF, "Off"],
                [LAMP_LOW, "Low"],
                [LAMP_MEDIUM, "Medium"],
                [LAMP_FULL, "Full"],
              ] as const
            ).map(([level, label]) => (
              <figure key={label}>
                <SteampunkLight brightness={level} />
                <figcaption>{label}</figcaption>
              </figure>
            ))}
          </div>
        ) : null}
        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
      </main>
    </div>
  );
}
