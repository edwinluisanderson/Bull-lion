"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { SplitFlap } from "@/components/split-flap";
import { SwipeCard } from "@/components/swipe-card";
import { unlockReelClick } from "@/lib/reel-click";
import {
  FLAP_DESCRIPTION_INLINE,
  FLAP_DESCRIPTION_LONG,
  FLAP_MELT,
  FLAP_METAL,
  FLAP_QTY,
  FLAP_WEIGHT,
  descriptionNeedsOwnRow,
  flapAdvance,
} from "@/lib/split-flap";
import {
  defaultLineDescription,
  flapMoney,
  grandTotal,
  proposeAdd,
  readStack,
  removeLine,
  renameLine,
  resolveAdd,
  rowMelt,
  writeStack,
  type StackDraft,
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
}: {
  selection: StackSelection | null;
  quotes: readonly StackQuote[];
}) {
  const [lines, setLines] = useState<StackLine[]>([]);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState<StackDraft | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    setLines(readStack(window.localStorage));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    writeStack(window.localStorage, lines);
  }, [lines, ready]);

  function draftFromSelection(): StackDraft | null {
    if (!selection || !(selection.qty > 0) || !(selection.grams > 0)) return null;
    return {
      symbol: selection.symbol,
      mark: selection.mark,
      weightLabel: selection.weightLabel,
      grams: selection.grams,
      qty: selection.qty,
      description: defaultLineDescription(selection.name, selection.weightLabel, FLAP_DESCRIPTION_INLINE),
    };
  }

  function addCurrent() {
    const draft = draftFromSelection();
    if (!draft) return;
    unlockReelClick();
    const result = proposeAdd(lines, draft);
    if (result.status === "needs-choice") {
      setPending(draft);
      return;
    }
    setLines(result.lines);
  }

  function choose(choice: "combine" | "separate") {
    if (!pending) return;
    unlockReelClick();
    setLines(resolveAdd(lines, pending, choice));
    setPending(null);
  }

  const melts = lines.map((line) => rowMelt(priceFor(quotes, line.symbol), line.grams, line.qty));
  const total = grandTotal(melts);

  const prompt =
    pending && typeof document !== "undefined"
      ? createPortal(
          <div className="stack-prompt-back" role="presentation">
            <div className="stack-prompt" role="dialog" aria-modal="true" aria-labelledby="stack-prompt-title">
              <p className="stack-prompt-kicker">Stack</p>
              <h2 id="stack-prompt-title">Same metal and weight</h2>
              <p>
                {pending.description} is already on a line. Combine the quantity onto that line, or keep this one
                separate?
              </p>
              <div className="stack-prompt-actions">
                <button type="button" className="stack-choice" onClick={() => choose("combine")}>
                  Combine
                </button>
                <button type="button" className="stack-choice is-quiet" onClick={() => choose("separate")}>
                  Keep separate
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <section className="split-stack" aria-label="Stack">
      <div className="split-stack-head">
        <p className="split-stack-title">Stack</p>
        <button type="button" className="stack-add" onClick={addCurrent} disabled={!selection}>
          Add to stack
        </button>
      </div>
      {lines.length === 0 ? <p className="split-empty">The board is clear.</p> : null}
      <ul className="split-rows">
        {lines.map((line, index) => {
          const melt = melts[index] ?? null;
          const longDescription = descriptionNeedsOwnRow(line.description);
          const descriptionWidth = longDescription ? FLAP_DESCRIPTION_LONG : FLAP_DESCRIPTION_INLINE;
          const factsEm =
            flapAdvance(line.mark, FLAP_METAL) +
            flapAdvance(line.weightLabel, FLAP_WEIGHT) +
            flapAdvance(String(line.qty), FLAP_QTY) +
            flapAdvance(flapMoney(melt), FLAP_MELT);
          const descEm = Math.max(0.5, flapAdvance(line.description, descriptionWidth));
          // 1px between tiles, 4px between the four fact fields, 2px of rounding slack.
          const factsGaps = (FLAP_METAL + FLAP_WEIGHT + FLAP_QTY + FLAP_MELT - 4) + 4 * 3 + 2;
          // The short description shares its row with the remove button.
          const descGaps = descriptionWidth - 1 + (longDescription ? 2 : 4 + 20);
          const description = editing === line.id ? (
            <input
              className="stack-name"
              aria-label={`Description for ${line.description}`}
              defaultValue={line.description}
              autoFocus
              onBlur={(event) => {
                setLines(renameLine(lines, line.id, event.target.value));
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
              <SplitFlap text={line.description} width={descriptionWidth} />
            </button>
          );
          return (
            <SwipeCard
              key={line.id}
              id={line.id}
              label={line.description}
              open={openId === line.id}
              onOpen={() => setOpenId(line.id)}
              onClose={() => setOpenId((current) => (current === line.id ? null : current))}
              onDelete={() => {
                setOpenId((current) => (current === line.id ? null : current));
                setLines(removeLine(lines, line.id));
              }}
            >
            <div
              className="stack-card"
              data-rows={longDescription ? 3 : 2}
              style={{
                ["--facts-em" as string]: factsEm.toFixed(3),
                ["--facts-gaps" as string]: `${factsGaps}px`,
                ["--desc-em" as string]: descEm.toFixed(3),
                ["--desc-gaps" as string]: `${descGaps}px`,
              }}
            >
              <span className="sr-only">
                {line.mark}, {line.weightLabel}, quantity {line.qty}, {line.description}, melt {flapMoney(melt)}
              </span>
              <div className="stack-card-row">
                <span className="stack-field">
                  <span className="stack-kicker">Metal</span>
                  <SplitFlap text={line.mark} width={FLAP_METAL} />
                </span>
                <span className="stack-field">
                  <span className="stack-kicker">Weight</span>
                  <SplitFlap text={line.weightLabel} width={FLAP_WEIGHT} />
                </span>
                <span className="stack-field">
                  <span className="stack-kicker">Qty</span>
                  <SplitFlap text={String(line.qty)} width={FLAP_QTY} />
                </span>
                <span className="stack-field stack-field-melt">
                  <span className="stack-kicker">Melt</span>
                  <SplitFlap text={flapMoney(melt)} width={FLAP_MELT} />
                </span>
              </div>
              <div className="stack-card-row">
                {longDescription ? null : (
                  <span className="stack-field">
                    <span className="stack-kicker">Description</span>
                    {description}
                  </span>
                )}
                <button
                  type="button"
                  className="stack-remove"
                  aria-label={`Remove ${line.description}`}
                  onClick={() => setLines(removeLine(lines, line.id))}
                >
                  ×
                </button>
              </div>
              {longDescription ? (
                <div className="stack-card-row">
                  <span className="stack-field">
                    <span className="stack-kicker">Description</span>
                    {description}
                  </span>
                </div>
              ) : null}
            </div>
            </SwipeCard>
          );
        })}
      </ul>
      {lines.length > 0 ? (
        <div className="split-total" style={{ ["--total-em" as string]: flapAdvance(flapMoney(total), FLAP_MELT).toFixed(3) }}>
          <span className="split-total-label">Grand total</span>
          <SplitFlap text={flapMoney(total)} width={FLAP_MELT} />
        </div>
      ) : null}
      {prompt}
    </section>
  );
}
