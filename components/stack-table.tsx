"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { SplitFlap } from "@/components/split-flap";
import { DELETE_SHOOT_MS } from "@/lib/delete-alarm";
import {
  COVER_FRAME_MS,
  COVER_SLIDE_MS,
  advanceDeleteCover,
  beginDeleteCover,
  collapseInset,
  deleteRowLocked,
  queuedCoverId,
  type DeleteCover,
} from "@/lib/delete-cover";
import { playSwipeTone, unlockFlapSamples, watchFlapBoard } from "@/lib/flap-sound";
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
import { stackCsvFilename, stackToCsv } from "@/lib/stack-csv";

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

function coverSlack(): HTMLDivElement {
  const existing = document.querySelector<HTMLDivElement>("[data-cover-slack]");
  if (existing) return existing;
  const spacer = document.createElement("div");
  spacer.dataset.coverSlack = "";
  spacer.style.pointerEvents = "none";
  document.body.appendChild(spacer);
  return spacer;
}

/** Drop slack that sits below the viewport. Slack still on screen stays, or the rows snap back. */
function releaseCoverSlack(): void {
  const spacer = document.querySelector<HTMLDivElement>("[data-cover-slack]");
  const root = document.scrollingElement;
  if (!spacer || !root) return;
  const spare = root.scrollHeight - root.clientHeight - root.scrollTop;
  const next = Math.max(0, spacer.offsetHeight - Math.floor(spare));
  if (next === spacer.offsetHeight) return;
  spacer.style.height = `${next}px`;
  if (next === 0) spacer.remove();
}

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
  const [cover, setCover] = useState<DeleteCover | null>(null);
  const [coverLive, setCoverLive] = useState(false);
  const [shift, setShift] = useState<StackFace[][] | null>(null);
  const [shiftStep, setShiftStep] = useState(0);
  const finalRef = useRef<StackLine[] | null>(null);
  const linesRef = useRef(lines);
  const phaseRef = useRef(emptyPullAdd());
  const seenPull = useRef(0);
  const selectionRef = useRef(selection);
  const quotesRef = useRef(quotes);
  const boardRef = useRef<HTMLElement>(null);
  const slackMark = useRef<string | null>(null);
  const queuedDelete = useRef<string | null>(null);
  const queueFrame = useRef(0);
  const coverRef = useRef<DeleteCover | null>(null);
  const shiftRef = useRef<StackFace[][] | null>(null);
  linesRef.current = lines;
  coverRef.current = cover;
  shiftRef.current = shift;
  selectionRef.current = selection;
  quotesRef.current = quotes;

  useEffect(() => () => window.cancelAnimationFrame(queueFrame.current), []);

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

  useLayoutEffect(() => {
    if (!cover || cover.tail) return;
    const marker = `${cover.id}:${cover.distance}`;
    if (slackMark.current === marker) return;
    slackMark.current = marker;
    const spacer = coverSlack();
    spacer.style.height = `${spacer.offsetHeight + cover.distance}px`;
  }, [cover]);

  useEffect(() => {
    if (cover) return;
    const release = () => releaseCoverSlack();
    release();
    document.addEventListener("scroll", release, { passive: true });
    return () => document.removeEventListener("scroll", release);
  }, [cover]);

  function measureRow(lineId: string): { rowHeight: number; totalHeight: number } {
    const node = document.querySelector(`[data-swipe-id="${CSS.escape(lineId)}"]`);
    const rowHeight = node instanceof HTMLElement ? node.offsetHeight : 0;
    const totalNode = boardRef.current?.querySelector(".split-total");
    const totalHeight = totalNode instanceof HTMLElement ? totalNode.offsetHeight : 0;
    return { rowHeight, totalHeight };
  }

  function armCover(lineId: string, rows: readonly StackLine[]) {
    const index = rows.findIndex((entry) => entry.id === lineId);
    if (index < 0) return;
    const { rowHeight, totalHeight } = measureRow(lineId);
    setOpenId((current) => (current === lineId ? null : current));
    setCoverLive(false);
    setCover(beginDeleteCover(lineId, index, rows.length, rowHeight, totalHeight));
  }

  function requestDelete(lineId: string) {
    if (shiftRef.current) return;
    const rows = linesRef.current;
    if (!rows.some((entry) => entry.id === lineId)) return;
    const active = coverRef.current;
    if (active) {
      if (active.id !== lineId) queuedDelete.current = lineId;
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const next = removeLine(rows, lineId);
      phaseRef.current = { ...phaseRef.current, lines: next };
      setOpenId((current) => (current === lineId ? null : current));
      setLines(next);
      return;
    }
    armCover(lineId, rows);
  }

  useEffect(() => {
    if (!cover) return;
    if (cover.phase === "shoot") {
      const timer = window.setTimeout(() => {
        setCover((current) => {
          if (!current || current.id !== cover.id || current.phase !== "shoot") return current;
          const next = advanceDeleteCover(current);
          return next === "remove" ? current : next;
        });
      }, DELETE_SHOOT_MS);
      return () => window.clearTimeout(timer);
    }
    const frame = window.requestAnimationFrame(() => setCoverLive(true));
    const timer = window.setTimeout(() => {
      const id = cover.id;
      if (advanceDeleteCover(cover) !== "remove") return;
      const kept = removeLine(linesRef.current, id);
      const queued = queuedCoverId(id, queuedDelete.current);
      queuedDelete.current = null;
      phaseRef.current = { ...phaseRef.current, lines: kept };
      setCover(null);
      setCoverLive(false);
      setLines(kept);
      if (!queued || !kept.some((line) => line.id === queued)) return;
      const nextId = queued;
      queueFrame.current = window.requestAnimationFrame(() => {
        if (coverRef.current) return;
        if (!linesRef.current.some((line) => line.id === nextId)) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          const quieter = removeLine(linesRef.current, nextId);
          phaseRef.current = { ...phaseRef.current, lines: quieter };
          setOpenId((current) => (current === nextId ? null : current));
          setLines(quieter);
          return;
        }
        armCover(nextId, linesRef.current);
      });
    }, COVER_SLIDE_MS + COVER_FRAME_MS);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [cover]);

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

  const downloadLines = phaseRef.current.cascading ? phaseRef.current.lines : lines;

  function downloadStack() {
    if (downloadLines.length === 0) return;
    playSwipeTone("detent");
    const csv = stackToCsv(downloadLines, quotesRef.current);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = stackCsvFilename(new Date());
    link.click();
    URL.revokeObjectURL(url);
  }

  const shown: StackFace[] = shift ? (shift[shiftStep] ?? shift[0] ?? []) : lines;
  const melts = lines.map((line) => rowMelt(priceFor(quotes, line.symbol), line.grams, line.qty));
  const total = grandTotal(melts);

  return (
    <section ref={boardRef} className="split-stack" aria-label="My Stack">
      <div className="split-stack-head">
        <p className="split-stack-title">My Stack</p>
        <button
          type="button"
          className="stack-download"
          aria-label="Download My Stack"
          disabled={downloadLines.length === 0}
          onClick={downloadStack}
        >
          <svg viewBox="2.85 2.85 26.3 26.3" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id="stack-gem" x1="10" y1="7" x2="22" y2="23" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#f7fffd" />
                <stop offset="0.18" stopColor="#b6fff4" />
                <stop offset="0.46" stopColor="#2ee0cf" />
                <stop offset="0.78" stopColor="#0f9f97" />
                <stop offset="1" stopColor="#083f4c" />
              </linearGradient>
              <linearGradient id="stack-gem-face" x1="12" y1="11" x2="20" y2="16" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#ffffff" stopOpacity="0.72" />
                <stop offset="0.42" stopColor="#9ff7ee" stopOpacity="0.15" />
                <stop offset="1" stopColor="#042f2e" stopOpacity="0.45" />
              </linearGradient>
            </defs>
            <circle cx="16" cy="16" r="12.2" fill="#2a1c10" stroke="#e6cb82" strokeWidth="1.7" />
            <circle cx="16" cy="16" r="9.3" fill="none" stroke="#6e5318" strokeWidth="0.9" />
            <g shapeRendering="geometricPrecision">
              <path
                d="M15.15 8.7h1.7v4.9h-1.7zM11.7 11.35 16 15.85 20.3 11.35h-1.85L16 13.9l-2.45-2.55zM10.35 17.25h11.3v4.15h-11.3zM12.15 17.25V19.7h7.7V17.25z"
                fill="#042f2e"
                fillRule="evenodd"
                transform="translate(0.35 0.4)"
                opacity="0.55"
              />
              <path d="M15.15 8.55h1.7v5.05h-1.7z" fill="url(#stack-gem)" stroke="#e7fffb" strokeWidth="0.28" />
              <path
                d="M11.55 11.15 16 15.8 20.45 11.15h-2.05L16 13.65l-2.4-2.5z"
                fill="url(#stack-gem)"
                stroke="#d9fffa"
                strokeWidth="0.28"
                strokeLinejoin="round"
              />
              <path d="M11.55 11.15 16 15.8V13.65l-2.4-2.5z" fill="url(#stack-gem-face)" />
              <path
                d="M10.2 17.05h11.6V21.5h-11.6zM12.05 17.05v2.5h7.9V17.05z"
                fill="url(#stack-gem)"
                fillRule="evenodd"
              />
              <path
                d="M15.3 8.75v4.5M11.9 11.4 15.7 15.15M10.45 17.3v3.85M12.2 19.4h4.2"
                fill="none"
                stroke="#f4fffd"
                strokeWidth="0.42"
                strokeLinecap="round"
                opacity="0.8"
              />
              <path d="M21.55 17.25v3.95" fill="none" stroke="#083344" strokeWidth="0.4" strokeLinecap="round" opacity="0.8" />
              <path d="M14.95 8.15 15.7 8.7 15.15 9.35 14.4 8.8z" fill="#ffffff" />
              <circle cx="11.15" cy="17.35" r="0.38" fill="#ffffff" opacity="0.9" />
            </g>
          </svg>
        </button>
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
          const sliding = cover != null && line != null && line.id === cover.id && cover.phase === "slide" && !cover.tail;
          const following = cover != null && cover.phase === "slide" && !cover.tail && index > cover.index;
          const coverRole = sliding ? (coverLive ? "over" : "arm") : following ? "front" : "row";
          const shell = cover != null && line != null && line.id === cover.id && cover.phase === "slide" && cover.tail
            ? {
                height: coverLive ? 0 : cover.rowHeight,
                marginTop: coverLive ? -collapseInset(true, cover.index) : 0,
              }
            : null;
          const remove = blank ? null : (
            <button
              type="button"
              className="stack-remove"
              aria-label={`Remove ${line.description}`}
              disabled={shift !== null || cover !== null}
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
              key={line ? line.id : `blank-${index}`}
              id={line ? line.id : `blank-${index}`}
              label={line?.description ?? "entry"}
              open={line != null && openId === line.id}
              locked={deleteRowLocked(shift !== null, blank, cover?.id ?? null, line?.id ?? null)}
              leaving={line != null && cover?.id === line.id}
              cover={coverRole}
              coverShift={sliding ? cover.distance : 0}
              shell={shell}
              onOpen={() => {
                if (line) setOpenId(line.id);
              }}
              onClose={() => {
                if (!line) return;
                setOpenId((current) => (current === line.id ? null : current));
              }}
              onDelete={() => {
                if (line) requestDelete(line.id);
              }}
              onDepart={() => {
                if (line) requestDelete(line.id);
              }}
            >
            <div className="stack-card" data-rows={2} style={{ ["--flap-cols" as string]: FLAP_BOARD_COLUMNS }}>
              {blank ? null : (
                <span className="sr-only">
                  {line.mark}, {line.weightLabel}, quantity {line.qty}, {line.description}, melt {flapMoney(melt)}
                </span>
              )}
              <span className="stack-kicker" style={{ gridColumn: "1 / -1", gridRow: 1 }}>
                Description
              </span>
              <span className="stack-span" style={{ gridColumn: "1 / -1", gridRow: 2 }}>
                {description}
              </span>
              <span className="stack-kicker stack-kicker-next" style={{ gridColumn: `1 / span ${FLAP_METAL}`, gridRow: 3 }}>
                Metal
              </span>
              <span className="stack-kicker stack-kicker-next" style={{ gridColumn: `${weightStart} / span ${FLAP_WEIGHT}`, gridRow: 3 }}>
                Weight
              </span>
              <span className="stack-kicker stack-kicker-next" style={{ gridColumn: `${qtyStart} / span ${FLAP_QTY}`, gridRow: 3 }}>
                Qty
              </span>
              <span className="stack-kicker stack-kicker-next" style={{ gridColumn: `${meltStart} / span ${FLAP_MELT}`, gridRow: 3 }}>
                Melt
              </span>
              <span className="stack-span" style={{ gridColumn: `1 / span ${FLAP_METAL}`, gridRow: 4 }}>
                <SplitFlap text={mark} width={FLAP_METAL} />
              </span>
              <span className="stack-span" style={{ gridColumn: `${weightStart} / span ${FLAP_WEIGHT}`, gridRow: 4 }}>
                <SplitFlap text={weightLabel} width={FLAP_WEIGHT} />
              </span>
              <span className="stack-span" style={{ gridColumn: `${qtyStart} / span ${FLAP_QTY}`, gridRow: 4 }}>
                <SplitFlap text={qtyLabel} width={FLAP_QTY} />
              </span>
              <span className="stack-span" style={{ gridColumn: `${meltStart} / span ${FLAP_MELT}`, gridRow: 4 }}>
                <SplitFlap text={blank ? "" : flapMoney(melt)} width={FLAP_MELT} />
              </span>
              {remove}
            </div>
            </SwipeCard>
          );
        })}
      </ul>
      {lines.length > 0 ? (
        <div
          className={`split-total${cover?.phase === "slide" && !cover.tail ? " is-cover-front" : ""}${cover?.phase === "slide" && cover.tail ? " is-rise" : ""}${cover?.phase === "slide" && cover.solo ? " is-collapsing" : ""}`}
          style={
            cover?.phase === "slide" && cover.solo
              ? { height: coverLive ? 0 : cover.totalHeight, marginTop: coverLive ? 0 : undefined }
              : undefined
          }
        >
          <span className="split-total-label">Total</span>
          <span className="split-total-flaps" style={{ ["--total-flaps" as string]: FLAP_TOTAL_COLUMNS }}>
            <SplitFlap text={fitFlapMoney(flapMoney(total), FLAP_TOTAL_COLUMNS)} width={FLAP_TOTAL_COLUMNS} />
          </span>
        </div>
      ) : null}
    </section>
  );
}
