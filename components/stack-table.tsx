"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { RoundedLight } from "@/components/rounded-light";
import { SplitFlap } from "@/components/split-flap";
import { DELETE_SHOOT_MS } from "@/lib/delete-alarm";
import {
  COVER_FRAME_MS,
  COVER_SLIDE_MS,
  advanceDeleteCover,
  beginDeleteCover,
  deleteRowLocked,
  queuedCoverId,
  type DeleteCover,
} from "@/lib/delete-cover";
import { playSwipeTone, unlockFlapSamples } from "@/lib/flap-sound";
import { emptyPullAdd, finishPullCascade, notePullAdd, type PullAddResult } from "@/lib/pull-stack";
import { DescriptionFlaps } from "@/components/description-flaps";
import { SwipeCard } from "@/components/swipe-card";
import { unlockReelClick } from "@/lib/reel-click";
import {
  FLAP_BOARD_COLUMNS,
  FLAP_CAP_MS,
  FLAP_DESCRIPTION,
  flapText,
  FLAP_TOTAL_COLUMNS,
  FLAP_TOTAL_WORD_COLUMNS,
} from "@/lib/split-flap";
import {
  flapMoney,
  readStack,
  CLEAR_STACK_EVENT,
  TEMP_CLEAR_ALL,
  clearAllLines,
  removeLine,
  renameLine,
  rowMelt,
  STACK_CASCADE_MS,
  writeStack,
  type StackFace,
  type StackLine,
} from "@/lib/stack-board";
import {
  TOTAL_BOARD_ID,
  TOTAL_WORD_ID,
  priceCascade,
  rectIntersectsViewport,
  seedCascade,
  settleCascade,
  startCascade,
  syncCascadeLines,
  type CascadeBoard,
  type CascadeEffect,
  type CascadeSlot,
} from "@/lib/stack-cascade";
import { backspaceFlap, moveFlapCursor, openFlapCursor, pasteFlaps, typeFlapChar } from "@/lib/flap-edit";
import { commitDescription, detailLayout, cardMoneyRow, metalTone, type FlapSpan } from "@/lib/stack-face";
import { freshCardSnaps } from "@/lib/stack-flips";
import { STACK_LOWER_MS } from "@/lib/stack-motion";
import { stackCsvFilename } from "@/lib/stack-csv";
import { stackExport, stackExportChoices, type StackExportKind } from "@/lib/stack-export";
import { formatTotalAmount, totalBoardCopy } from "@/lib/stack-total";

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
  const [editDraft, setEditDraft] = useState("");
  const [editCursor, setEditCursor] = useState(0);
  const draftRef = useRef<{ id: string; text: string; cursor: number; cap: number } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [cover, setCover] = useState<DeleteCover | null>(null);
  const [shift, setShift] = useState<StackFace[][] | null>(null);
  const [shiftStep, setShiftStep] = useState(0);
  const finalRef = useRef<StackLine[] | null>(null);
  const linesRef = useRef(lines);
  const phaseRef = useRef(emptyPullAdd());
  const seenPull = useRef(0);
  const selectionRef = useRef(selection);
  const quotesRef = useRef(quotes);
  const boardRef = useRef<HTMLElement>(null);
  const cardNodes = useRef(new Map<string, HTMLElement>());
  const totalNode = useRef<HTMLDivElement>(null);
  const slotsRef = useRef<CascadeSlot[] | null>(null);
  const cascadeTimers = useRef(new Map<string, number>());
  const quoteSeen = useRef<string | null>(null);
  const linesSeen = useRef<string | null>(null);
  const beginRef = useRef<(id: string) => void>(() => {});
  const [cascadeSlots, setCascadeSlots] = useState<CascadeSlot[] | null>(null);
  const decidedCards = useRef(new Set<string>());
  const introFlip = useRef(new Set<string>());
  const snapFresh = useRef(new Set<string>());
  const [introVersion, setIntroVersion] = useState(0);
  const payingRef = useRef<string | null>(null);
  const loweringRef = useRef<string | null>(null);
  const paidRef = useRef<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [loweringId, setLoweringId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [precise, setPrecise] = useState<string | null>(null);
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
  const quoteKey = quotes.map((quote) => `${quote.symbol}:${quote.usdPerTroyOz}`).join("|");
  const lineKey = lines.map((line) => `${line.id}:${line.symbol}:${line.grams}:${line.qty}`).join("|");

  const elementVisible = useCallback((node: Element | null): boolean => {
    if (!node) return false;
    const view = node.ownerDocument?.defaultView;
    if (!view) return false;
    return rectIntersectsViewport(node.getBoundingClientRect(), { width: view.innerWidth, height: view.innerHeight });
  }, []);

  const measureVisible = useCallback(
    (id: string): boolean => {
      if (id === TOTAL_BOARD_ID) return elementVisible(totalNode.current);
      return elementVisible(cardNodes.current.get(id) ?? null);
    },
    [elementVisible],
  );

  const buildBoards = useCallback((): CascadeBoard[] => {
    const rows = linesRef.current;
    const priced = quotesRef.current;
    const next: CascadeBoard[] = rows.map((line) => ({
      id: line.id,
      live: cardMoneyRow(line.qty, rowMelt(priceFor(priced, line.symbol), line.grams, line.qty)).text,
      visible: measureVisible(line.id),
    }));
    const sum = rows.reduce((total, line) => {
      const melt = rowMelt(priceFor(priced, line.symbol), line.grams, line.qty);
      return total + (melt ?? 0);
    }, 0);
    const copy = totalBoardCopy(rows.length, formatTotalAmount(rows.length === 0 ? null : sum));
    const visible = measureVisible(TOTAL_BOARD_ID);
    next.push({ id: TOTAL_WORD_ID, live: copy.top, visible });
    next.push({ id: TOTAL_BOARD_ID, live: copy.bottom, visible });
    return next;
  }, [measureVisible]);

  const armEffects = useCallback((effects: readonly CascadeEffect[], now: number) => {
    for (const effect of effects) {
      if (effect.type === "cancel") {
        const timer = cascadeTimers.current.get(effect.id);
        if (timer !== undefined) window.clearTimeout(timer);
        cascadeTimers.current.delete(effect.id);
      } else if (effect.type === "schedule") {
        const existing = cascadeTimers.current.get(effect.id);
        if (existing !== undefined) window.clearTimeout(existing);
        const delay = Math.max(0, effect.at - now);
        const id = effect.id;
        const timer = window.setTimeout(() => {
          cascadeTimers.current.delete(id);
          beginRef.current(id);
        }, delay);
        cascadeTimers.current.set(id, timer);
      }
    }
  }, []);

  const adoptCascade = useCallback(
    (slots: CascadeSlot[], effects: readonly CascadeEffect[], now: number) => {
      slotsRef.current = slots;
      setCascadeSlots(slots);
      armEffects(effects, now);
    },
    [armEffects],
  );

  beginRef.current = (id: string) => {
    const slots = slotsRef.current;
    if (!slots) return;
    const now = performance.now();
    const step = startCascade(slots, id, now, measureVisible(id), motionReduced());
    adoptCascade(step.slots, step.effects, now);
  };

  function settleBoard(id: string) {
    const slots = slotsRef.current;
    if (!slots?.some((slot) => slot.id === id && slot.status === "flipping")) return;
    const now = performance.now();
    const step = settleCascade(slots, id, now, motionReduced(), buildBoards());
    adoptCascade(step.slots, step.effects, now);
  }

  function faceFor(id: string, live: string): { text: string; instant: boolean } {
    const slot = cascadeSlots?.find((entry) => entry.id === id);
    if (!slot) return { text: live, instant: false };
    return { text: slot.committed, instant: !slot.animate };
  }

  useEffect(() => () => window.cancelAnimationFrame(queueFrame.current), []);

  useEffect(() => {
    const timers = cascadeTimers.current;
    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer);
      timers.clear();
    };
  }, []);

  useLayoutEffect(() => {
    if (!ready) return;
    let changed = false;
    for (const line of linesRef.current) {
      if (payingRef.current === line.id || loweringRef.current === line.id) continue;
      if (decidedCards.current.has(line.id)) continue;
      decidedCards.current.add(line.id);
      const node = cardNodes.current.get(line.id) ?? null;
      const view = node?.ownerDocument?.defaultView ?? null;
      const snaps = freshCardSnaps(
        node ? node.getBoundingClientRect() : null,
        view ? { width: view.innerWidth, height: view.innerHeight } : null,
      );
      if (snaps) {
        snapFresh.current.add(line.id);
        if (paidRef.current === line.id) releaseQueue(line.id);
      } else introFlip.current.add(line.id);
      changed = true;
    }
    if (changed) setIntroVersion((version) => version + 1);
  }, [ready, lineKey, payingId, loweringId]);

  useEffect(() => {
    snapFresh.current.clear();
  }, [introVersion]);

  useLayoutEffect(() => {
    if (!ready) return;
    const boards = buildBoards();
    const now = performance.now();
    if (quoteSeen.current === null) {
      quoteSeen.current = quoteKey;
      linesSeen.current = lineKey;
      const seeded = seedCascade(boards).map((slot) => ({ ...slot, animate: slot.visible }));
      slotsRef.current = seeded;
      setCascadeSlots(seeded);
      return;
    }
    const quoteChanged = quoteSeen.current !== quoteKey;
    const linesChanged = linesSeen.current !== lineKey;
    quoteSeen.current = quoteKey;
    linesSeen.current = lineKey;
    if (!quoteChanged && !linesChanged) return;
    const step = quoteChanged
      ? priceCascade(slotsRef.current ?? [], boards, now, motionReduced())
      : syncCascadeLines(slotsRef.current ?? [], boards);
    adoptCascade(step.slots, step.effects, now);
  }, [ready, quoteKey, lineKey, buildBoards, adoptCascade]);

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
    if (!TEMP_CLEAR_ALL) return;
    const onClear = () => {
      if (linesRef.current.length === 0) return;
      window.cancelAnimationFrame(queueFrame.current);
      queuedDelete.current = null;
      finalRef.current = null;
      playSwipeTone("clunk");
      phaseRef.current = { ...emptyPullAdd(), lines: clearAllLines() };
      setOpenId(null);
      draftRef.current = null;
      setEditing(null);
      setCover(null);
      setShift(null);
      setShiftStep(0);
      setLines(clearAllLines());
    };
    window.addEventListener(CLEAR_STACK_EVENT, onClear);
    return () => window.removeEventListener(CLEAR_STACK_EVENT, onClear);
  }, []);

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
    const timer = window.setTimeout(() => {
      const id = cover.id;
      if (advanceDeleteCover(cover) !== "remove") return;
      const kept = removeLine(linesRef.current, id);
      const queued = queuedCoverId(id, queuedDelete.current);
      queuedDelete.current = null;
      phaseRef.current = { ...phaseRef.current, lines: kept };
      setCover(null);
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
    return () => window.clearTimeout(timer);
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

  function commitDescriptionDraft(id: string) {
    const draft = draftRef.current;
    if (!draft || draft.id !== id) return;
    draftRef.current = null;
    const line = linesRef.current.find((entry) => entry.id === id);
    setEditing((current) => (current === id ? null : current));
    if (!line) return;
    const next = commitDescription(line.description, draft.text, draft.cap);
    if (!next || next === flapText(line.description).trim()) return;
    const renamed = renameLine(linesRef.current, line.id, next);
    phaseRef.current = { ...phaseRef.current, lines: renamed };
    setLines(renamed);
  }

  function cancelDescriptionDraft(id: string) {
    if (draftRef.current?.id === id) draftRef.current = null;
    setEditing((current) => (current === id ? null : current));
  }

  function activateDescription(id: string, shown: string, cap: number, index: number) {
    const current = draftRef.current;
    if (current && current.id !== id) commitDescriptionDraft(current.id);
    if (!draftRef.current || draftRef.current.id !== id) {
      const opened = openFlapCursor(shown, cap, index);
      draftRef.current = { id, ...opened };
      setEditing(id);
      setEditDraft(opened.text);
      setEditCursor(opened.cursor);
      return;
    }
    const moved = moveFlapCursor(draftRef.current, index);
    draftRef.current = { id, ...moved };
    setEditCursor(moved.cursor);
  }

  function moveDescription(id: string, index: number) {
    const draft = draftRef.current;
    if (!draft || draft.id !== id) return;
    const moved = moveFlapCursor(draft, index);
    draftRef.current = { id, ...moved };
    setEditCursor(moved.cursor);
  }

  function publishDescription(id: string, next: { text: string; cursor: number; cap: number }) {
    draftRef.current = { id, ...next };
    setEditDraft(next.text);
    setEditCursor(next.cursor);
  }

  function typeDescription(id: string, raw: string) {
    const draft = draftRef.current;
    if (!draft || draft.id !== id) return;
    const chars = [...flapText(raw)];
    if (chars.length === 0) return;
    const next = chars.length === 1 ? typeFlapChar(draft, chars[0] ?? "") : pasteFlaps(draft, raw);
    publishDescription(id, next);
  }

  function backspaceDescription(id: string) {
    const draft = draftRef.current;
    if (!draft || draft.id !== id) return;
    publishDescription(id, backspaceFlap(draft));
  }

  function pasteDescription(id: string, raw: string) {
    const draft = draftRef.current;
    if (!draft || draft.id !== id) return;
    publishDescription(id, pasteFlaps(draft, raw));
  }

  function releaseQueue(id?: string) {
    if (id && paidRef.current !== id) return;
    if (!phaseRef.current.cascading && paidRef.current == null) return;
    paidRef.current = null;
    payingRef.current = null;
    loweringRef.current = null;
    setPayingId(null);
    setLoweringId(null);
    phaseRef.current = { ...phaseRef.current, cascading: false };
    const result = finishPullCascade(phaseRef.current);
    phaseRef.current = result.phase;
    if (!result.playNow || !result.draft) return;
    const incoming = result.phase.lines[0];
    if (!incoming) return;
    unlockReelClick();
    unlockFlapSamples();
    beginArrival(result.phase.lines);
  }

  function beginArrival(finalLines: StackLine[]) {
    const incoming = finalLines[0];
    phaseRef.current = { ...phaseRef.current, lines: finalLines, cascading: true };
    setShift(null);
    setShiftStep(0);
    finalRef.current = null;
    setLines(finalLines);
    if (!incoming || motionReduced()) {
      releaseQueue();
      return;
    }
    paidRef.current = incoming.id;
    loweringRef.current = incoming.id;
    setLoweringId(incoming.id);
    window.setTimeout(() => {
      if (loweringRef.current !== incoming.id) return;
      loweringRef.current = null;
      setLoweringId(null);
    }, STACK_LOWER_MS);
    window.setTimeout(() => {
      if (paidRef.current === incoming.id) releaseQueue(incoming.id);
    }, STACK_LOWER_MS + FLAP_CAP_MS + 400);
  }

  function landNewest(finalLines: StackLine[]) {
    beginArrival(finalLines);
  }

  function applyPull(result: PullAddResult) {
    phaseRef.current = result.phase;
    if (!result.playNow || !result.draft) return;
    const incoming = result.phase.lines[0];
    if (!incoming) return;
    unlockReelClick();
    unlockFlapSamples();
    landNewest(result.phase.lines);
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

  function downloadStack(kind: StackExportKind) {
    if (downloadLines.length === 0) return;
    playSwipeTone("detent");
    const file = stackExport(kind, downloadLines, quotesRef.current);
    const blob = new Blob([file.bytes.buffer.slice(file.bytes.byteOffset, file.bytes.byteOffset + file.bytes.byteLength) as ArrayBuffer], { type: file.mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = kind === "csv" ? stackCsvFilename(new Date()) : file.filename;
    link.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  }

  const shown: StackFace[] = shift ? (shift[shiftStep] ?? shift[0] ?? []) : lines;
  const stackSum = lines.reduce((sum, line) => {
    const melt = rowMelt(priceFor(quotes, line.symbol), line.grams, line.qty);
    return sum + (melt ?? 0);
  }, 0);
  const totalCopy = totalBoardCopy(lines.length, formatTotalAmount(lines.length === 0 ? null : stackSum));
  const wordFace = faceFor(TOTAL_WORD_ID, totalCopy.top);
  const amountFace = faceFor(TOTAL_BOARD_ID, totalCopy.bottom);

  return (
    <section ref={boardRef} className={`split-stack${loweringId ? " is-arriving" : ""}`} aria-label="My Stack">
      <div className="split-stack-head">
        <span className="mock-hole is-bottom is-left" aria-hidden="true" />
        <span className="mock-hole is-bottom is-right" aria-hidden="true" />
        {lines.length === 0 ? (
          <>
            <span className="mock-link is-left" aria-hidden="true" />
            <span className="mock-link is-right" aria-hidden="true" />
          </>
        ) : null}
        <span className="rivet" data-corner="tl" />
        <span className="rivet" data-corner="tr" />
        <span className="rivet" data-corner="bl" />
        <span className="rivet" data-corner="br" />
        <p className="split-stack-title">My Stack</p>
        <button
          type="button"
          className={`stack-download${downloadLines.length > 0 ? " is-live" : ""}`}
          aria-label="Download My Stack"
          aria-expanded={exportOpen}
          disabled={downloadLines.length === 0}
          onClick={() => setExportOpen((open) => !open)}
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
        {exportOpen ? (
          <div className="stack-export" role="dialog" aria-label="Download My Stack">
            {stackExportChoices().map((choice) => (
              <button key={choice.id} type="button" onClick={() => downloadStack(choice.id)}>
                <strong>{choice.label}</strong>
                <span>{choice.detail}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <ul className="split-rows">
        {shown.map((line, index) => {
          const blank = line == null;
          const dropping = line != null && (payingId === line.id || loweringId === line.id);
          const melt = blank ? null : rowMelt(priceFor(quotes, line.symbol), line.grams, line.qty);
          const money = blank || !line ? null : cardMoneyRow(line.qty, melt);
          const meltFace = blank || !line || !money ? null : faceFor(line.id, money.text);
          const boardInstant = line
            ? dropping
              ? true
              : snapFresh.current.has(line.id)
                ? true
                : introFlip.current.has(line.id)
                  ? false
                  : (meltFace?.instant ?? false)
            : false;
          void introVersion;
          const layout = line && !dropping ? detailLayout(line.weightLabel, line.description) : null;
          const detailText = layout?.row ?? "";
          const bottomText = dropping ? "" : (meltFace?.text ?? "");
          const holdFixed = (event: { preventDefault: () => void; stopPropagation: () => void }) => {
            event.preventDefault();
            event.stopPropagation();
          };
          const lockFlap = (text: string, span: FlapSpan | null, part: "weight" | "purity" | "gap") =>
            span ? (
              <span
                className="stack-lock"
                data-fixed={part}
                style={{ gridColumn: `${span.start} / span ${span.length}` }}
                onPointerDown={holdFixed}
                onMouseDown={holdFixed}
              >
                <SplitFlap text={text} width={span.length} instant={boardInstant} />
              </span>
            ) : null;
          const description = layout == null ? (
            <SplitFlap text={detailText} width={FLAP_DESCRIPTION} instant={boardInstant || dropping} />
          ) : (
            <>
              {lockFlap(layout.weight, layout.weightSpan, "weight")}
              {lockFlap(" ", layout.leadGap, "gap")}
              {layout.descriptionSpan && line ? (
                <DescriptionFlaps
                  label={line.description}
                  text={editing === line.id ? editDraft : layout.description}
                  cap={layout.descriptionCap}
                  active={editing === line.id}
                  cursor={editCursor}
                  instant={boardInstant}
                  style={{ gridColumn: `${layout.descriptionSpan.start} / span ${layout.descriptionSpan.length}` }}
                  onActivate={(index) => activateDescription(line.id, layout.description, layout.descriptionCap, index)}
                  onMove={(index) => moveDescription(line.id, index)}
                  onType={(raw) => typeDescription(line.id, raw)}
                  onBackspace={() => backspaceDescription(line.id)}
                  onPaste={(raw) => pasteDescription(line.id, raw)}
                  onCommit={() => commitDescriptionDraft(line.id)}
                  onCancel={() => cancelDescriptionDraft(line.id)}
                />
              ) : null}
              {lockFlap(" ", layout.tailGap, "gap")}
              {lockFlap(layout.purity, layout.puritySpan, "purity")}
            </>
          );
          const rising = cover != null && cover.phase === "slide" && index >= cover.index;
          const above = cover != null && cover.phase === "slide" && index === cover.index - 1;
          const coverRole = above ? "front" : "row";
          const remove = blank ? null : (
            <button
              type="button"
              className="stack-remove"
              aria-label={`Remove ${line.description}`}
              disabled={shift !== null || cover !== null}
              onClick={() => requestDelete(line.id)}
            >
              ×
            </button>
          );
          return (
            <SwipeCard
              key={line == null ? `blank-${index}` : line.id}
              id={line ? line.id : `blank-${index}`}
              label={line?.description ?? "entry"}
              open={line != null && openId === line.id}
              locked={deleteRowLocked(shift !== null, blank, cover?.id ?? null, line?.id ?? null)}
              leaving={line != null && cover?.id === line.id}
              winch={cover?.phase === "slide" && index === cover.index - 1}
              paying={false}
              lowering={false}
              hanging={true}
              rising={rising}
              reelCard={rising && line != null && line.id === cover?.id}
              cover={coverRole}
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
            <div
              className={`stack-card${payingId === line?.id ? " is-paying" : ""}`}
              data-rows={2}
              ref={(node) => {
                if (!line) return;
                if (node) cardNodes.current.set(line.id, node);
                else cardNodes.current.delete(line.id);
              }}
              style={{ ["--flap-cols" as string]: FLAP_BOARD_COLUMNS }}
            >
              {blank ? null : (
                <span className="sr-only">
                  {line.mark}, {line.weightLabel}, quantity {line.qty}, {line.description}, melt {flapMoney(melt)}
                </span>
              )}
              <span
                className="stack-metal"
                data-fixed="metal"
                data-tone={blank || !line || dropping ? "silver" : metalTone(line.mark)}
                style={{ gridColumn: "1 / span 2", gridRow: 1 }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                <span className="stack-face-top" aria-hidden="true" />
                <span className="stack-face-bottom" aria-hidden="true" />
                <span className="stack-face-label">{blank || dropping ? "" : line.mark.toUpperCase()}</span>
                <span className="flap-stack" aria-hidden="true" />
              </span>
              <span className="stack-span" style={{ gridColumn: "3 / -1", gridRow: 1 }}>
                {description}
              </span>
              <span className="stack-qty" style={{ gridColumn: "1 / span 2", gridRow: 2 }}>
                <span className="stack-face-top" aria-hidden="true" />
                <span className="stack-face-bottom" aria-hidden="true" />
                <span className="stack-face-label">{blank || dropping ? "" : "QTY"}</span>
                <span className="flap-stack" aria-hidden="true" />
              </span>
              <span className="stack-span" style={{ gridColumn: "3 / -1", gridRow: 2 }}>
                <SplitFlap
                  text={bottomText}
                  width={FLAP_DESCRIPTION}
                  instant={boardInstant}
                  onSettled={
                    line
                      ? () => {
                          introFlip.current.delete(line.id);
                          settleBoard(line.id);
                          if (paidRef.current === line.id) releaseQueue(line.id);
                        }
                      : undefined
                  }
                />
              </span>
              {money && money.rounded ? (
                <RoundedLight
                  exact={money.exact}
                  open={precise === line?.id}
                  onToggle={() => setPrecise((current) => (current === line?.id ? null : line?.id ?? null))}
                />
              ) : null}
              {remove}
            </div>
            </SwipeCard>
          );
        })}
      </ul>
      <div
        ref={totalNode}
        className={`split-total${cover?.phase === "slide" ? " is-rising" : ""}${cover?.phase === "slide" && !cover.tail ? " is-cover-front" : ""}${cover?.phase === "slide" && cover.tail ? " is-rise" : ""}`}
      >
        {lines.length > 0 ? (
          <>
            <span className="mock-link is-left" aria-hidden="true" />
            <span className="mock-link is-right" aria-hidden="true" />
          </>
        ) : null}
        <span className="mock-plate" aria-hidden="true" />
        <span className="mock-slot" aria-hidden="true" />
        <span className="mock-glow" aria-hidden="true" />
        <span className="mock-hole is-top is-left" aria-hidden="true" />
        <span className="mock-hole is-top is-right" aria-hidden="true" />
        <span className="sr-only">
          {lines.length === 0 ? "Let's get stacking!" : `My hoard ${formatTotalAmount(stackSum)}`}
        </span>
        <span className={`split-total-word${lines.length === 0 ? "" : " is-start"}`}>
          <SplitFlap
            text={wordFace.text}
            width={FLAP_TOTAL_WORD_COLUMNS}
            instant={wordFace.instant}
            onSettled={() => settleBoard(TOTAL_WORD_ID)}
          />
        </span>
        <span className="split-total-amount" style={{ ["--total-flaps" as string]: FLAP_TOTAL_COLUMNS }}>
          <SplitFlap
            text={amountFace.text}
            width={FLAP_TOTAL_COLUMNS}
            instant={amountFace.instant}
            onSettled={() => settleBoard(TOTAL_BOARD_ID)}
          />
        </span>
        {totalCopy.rounded ? (
          <RoundedLight
            exact={totalCopy.exact}
            open={precise === TOTAL_BOARD_ID}
            onToggle={() => setPrecise((current) => (current === TOTAL_BOARD_ID ? null : TOTAL_BOARD_ID))}
          />
        ) : null}
      </div>
    </section>
  );
}
