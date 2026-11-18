"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { SplitFlap } from "@/components/split-flap";
import { unlockFlapSamples, watchFlapBoard } from "@/lib/flap-sound";
import { emptyPullAdd, finishPullCascade, notePullAdd, type PullAddResult } from "@/lib/pull-stack";
import { SwipeCard } from "@/components/swipe-card";
import { unlockReelClick } from "@/lib/reel-click";
import {
  FLAP_BOARD_COLUMNS,
  FLAP_DESCRIPTION,
  FLAP_MELT,
  FLAP_METAL,
  FLAP_QTY,
  FLAP_TOTAL_COLUMNS,
  FLAP_WEIGHT,
  fitFlapMoney,
  rightFlap,
} from "@/lib/split-flap";
import {
  flapMoney,
  grandTotal,
  insertCascade,
  readStack,
  removeLine,
  renameLine,
  rowMelt,
  STACK_CASCADE_MS,
  writeStack,
  type StackFace,
  type StackLine,
} from "@/lib/stack-board";

export type StackSelection = {
  symbol: string;
  mark: string;
  name: string;
  grams: number;
  weightLabel: string;
  qty: number;
};

export type StackQuote = {
  symbol: string;
  usdPerTroyOz: number;
};

function priceFor(quotes: readonly StackQuote[], symbol: string): number | null {
  const quote = quotes.find((entry) => entry.symbol === symbol);
  return quote && Number.isFinite(quote.usdPerTroyOz) ? quote.usdPerTroyOz : null;
}

export function StackTable({
  selection,
  quotes,
  pullSerial = 0,
}: {
  selection: StackSelection | null;
  quotes: readonly StackQuote[];
  /** Increments once each time a full pull starts a spin. */
  pullSerial?: number;
}) {
  const [lines, setLines] = useState<StackLine[]>([]);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [shift, setShift] = useState<StackFace[][] | null>(null);
  const [shiftStep, setShiftStep] = useState(0);
  const finalRef = useRef<StackLine[] | null>(null);
  const linesRef = useRef(lines);
  const phaseRef = useRef(emptyPullAdd());
  const seenPull = useRef(0);
  const selectionRef = useRef(selection);
  const quotesRef = useRef(quotes);
  const boardRef = useRef<HTMLElement>(null);
  linesRef.current = lines;
  selectionRef.current = selection;
  quotesRef.current = quotes;

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    return watchFlapBoard(board);
  }, []);

  useEffect(() => {
    const stored = readStack(window.localStorage);
    phaseRef.current = { ...phaseRef.current, lines: stored };
    setLines(stored);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    writeStack(window.localStorage, lines);
  }, [lines, ready]);

  useEffect(() => {
    if (!shift) return;
    if (shiftStep === shift.length - 1 && finalRef.current) {
      setLines(finalRef.current);
      finalRef.current = null;
    }
    const done = shiftStep >= shift.length - 1;
    const timer = window.setTimeout(() => {
      if (done) {
        setShift(null);
        setShiftStep(0);
        phaseRef.current = { ...phaseRef.current, cascading: false };
        applyPull(finishPullCascade(phaseRef.current));
        return;
      }
      setShiftStep((step) => step + 1);
    }, STACK_CASCADE_MS);
    return () => window.clearTimeout(timer);
  }, [shift, shiftStep]);

  function motionReduced(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function landNewest(existing: readonly StackLine[], incoming: StackLine, finalLines: StackLine[]) {
    phaseRef.current = { ...phaseRef.current, lines: finalLines, cascading: !motionReduced() };
    if (motionReduced()) {
      setShift(null);
      setShiftStep(0);
      finalRef.current = null;
      setLines(finalLines);
      applyPull(finishPullCascade(phaseRef.current));
      return;
    }
    finalRef.current = finalLines;
    setShiftStep(0);
    setShift(insertCascade(existing, incoming));
  }

  function applyPull(result: PullAddResult) {
    phaseRef.current = result.phase;
    if (!result.playNow || !result.draft) return;
    const incoming = result.phase.lines[0];
    if (!incoming) return;
    unlockReelClick();
    unlockFlapSamples();
    landNewest(result.from, incoming, result.phase.lines);
  }

  useEffect(() => {
    if (!ready) return;
    if (pullSerial === seenPull.current) return;
    seenPull.current = pullSerial;
    if (pullSerial === 0) return;
    const shown = selectionRef.current;
    const price = shown ? priceFor(quotesRef.current, shown.symbol) : null;
    const result = notePullAdd(phaseRef.current, shown, price, FLAP_DESCRIPTION);
    applyPull(result);
  }, [pullSerial, ready]);

  const shown: StackFace[] = shift ? (shift[shiftStep] ?? shift[0] ?? []) : lines;
  const melts = lines.map((line) => rowMelt(priceFor(quotes, line.symbol), line.grams, line.qty));
  const total = grandTotal(melts);

  return (
    <section ref={boardRef} className="split-stack" aria-label="My Stack">
      <div className="split-stack-head">
        <p className="split-stack-title">My Stack</p>
      </div>
      {shown.length === 0 ? <p className="split-empty">The board is clear.</p> : null}
      <ul className="split-rows">
        {shown.map((line, index) => {
          const blank = line == null;
          const melt = blank ? null : rowMelt(priceFor(quotes, line.symbol), line.grams, line.qty);
          const mark = blank ? "" : line.mark;
          const weightLabel = blank ? "" : line.weightLabel;
          const qtyLabel = blank ? "" : String(line.qty);
          const descriptionText = blank ? "" : line.description;
          const weightStart = FLAP_METAL + 1;
          const qtyStart = weightStart + FLAP_WEIGHT;
          const meltStart = qtyStart + FLAP_QTY;
          const description = blank || shift ? (
            <SplitFlap text={descriptionText} width={FLAP_DESCRIPTION} />
          ) : editing === line.id ? (
            <input
              className="stack-name"
              aria-label={`Description for ${line.description}`}
              defaultValue={line.description}
              autoFocus
              onBlur={(event) => {
                const next = renameLine(lines, line.id, event.target.value);
                phaseRef.current = { ...phaseRef.current, lines: next };
                setLines(next);
                setEditing(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") setEditing(null);
              }}
            />
          ) : (
            <button
              type="button"
              className="stack-edit"
              aria-label={`Edit description, ${line.description}`}
              onClick={() => setEditing(line.id)}
            >
              <SplitFlap text={line.description} width={FLAP_DESCRIPTION} />
            </button>
          );
          const remove = blank ? null : (
            <button
              type="button"
              className="stack-remove"
              aria-label={`Remove ${line.description}`}
              disabled={shift !== null}
              onClick={() => {
                const next = removeLine(lines, line.id);
                phaseRef.current = { ...phaseRef.current, lines: next };
                setLines(next);
              }}
            >
              ×
            </button>
          );
          return (
            <SwipeCard
              key={index}
              id={line ? `${line.id}-${index}` : `blank-${index}`}
              label={line?.description ?? "entry"}
              open={line != null && openId === line.id}
              locked={shift !== null || blank}
              onOpen={() => {
                if (line) setOpenId(line.id);
              }}
              onClose={() => {
                if (!line) return;
                setOpenId((current) => (current === line.id ? null : current));
              }}
              onDelete={() => {
                if (!line || shift) return;
                setOpenId((current) => (current === line.id ? null : current));
                const next = removeLine(lines, line.id);
                phaseRef.current = { ...phaseRef.current, lines: next };
                setLines(next);
              }}
            >
            <div className="stack-card" data-rows={2} style={{ ["--flap-cols" as string]: FLAP_BOARD_COLUMNS }}>
              {blank ? null : (
                <span className="sr-only">
                  {line.mark}, {line.weightLabel}, quantity {line.qty}, {line.description}, melt {flapMoney(melt)}
                </span>
              )}
              <span className="stack-kicker" style={{ gridColumn: `1 / span ${FLAP_METAL}`, gridRow: 1 }}>
                Metal
              </span>
              <span className="stack-kicker" style={{ gridColumn: `${weightStart} / span ${FLAP_WEIGHT}`, gridRow: 1 }}>
                Weight
              </span>
              <span className="stack-kicker" style={{ gridColumn: `${qtyStart} / span ${FLAP_QTY}`, gridRow: 1 }}>
                Qty
              </span>
              <span className="stack-kicker" style={{ gridColumn: `${meltStart} / span ${FLAP_MELT}`, gridRow: 1 }}>
                Melt
              </span>
              <span className="stack-span" style={{ gridColumn: `1 / span ${FLAP_METAL}`, gridRow: 2 }}>
                <SplitFlap text={mark} width={FLAP_METAL} />
              </span>
              <span className="stack-span" style={{ gridColumn: `${weightStart} / span ${FLAP_WEIGHT}`, gridRow: 2 }}>
                <SplitFlap text={weightLabel} width={FLAP_WEIGHT} />
              </span>
              <span className="stack-span" style={{ gridColumn: `${qtyStart} / span ${FLAP_QTY}`, gridRow: 2 }}>
                <SplitFlap text={qtyLabel} width={FLAP_QTY} />
              </span>
              <span className="stack-span" style={{ gridColumn: `${meltStart} / span ${FLAP_MELT}`, gridRow: 2 }}>
                <SplitFlap text={blank ? "" : flapMoney(melt)} width={FLAP_MELT} />
              </span>
              <span className="stack-kicker stack-kicker-next" style={{ gridColumn: "1 / -1", gridRow: 3 }}>
                Description
              </span>
              <span className="stack-span" style={{ gridColumn: "1 / -1", gridRow: 4 }}>
                {description}
              </span>
              {remove}
            </div>
            </SwipeCard>
          );
        })}
      </ul>
      {lines.length > 0 ? (
        <div className="split-total">
          <span className="split-total-label">Total</span>
          <span className="split-total-flaps" style={{ ["--total-flaps" as string]: FLAP_TOTAL_COLUMNS }}>
            <SplitFlap text={fitFlapMoney(flapMoney(total), FLAP_TOTAL_COLUMNS)} width={FLAP_TOTAL_COLUMNS} />
          </span>
        </div>
      ) : null}
    </section>
  );
}
