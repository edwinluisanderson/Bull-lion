import { releaseCommitsSpin } from "@/lib/drum";
import {
  defaultLineDescription,
  resolveAdd,
  rowMelt,
  type StackDraft,
  type StackLine,
} from "@/lib/stack-board";

/** Same lock the handle already uses so a second commit in one gesture cannot add twice. */
export const PULL_REPEAT_MS = 450;

export type ShownSelection = {
  symbol: string;
  mark: string;
  name: string;
  grams: number;
  weightLabel: string;
  qty: number;
};

export type PullAddPhase = {
  lines: StackLine[];
  /** Pulls that arrived while a cascade was still playing, oldest first. */
  queued: StackDraft[];
  cascading: boolean;
  lastSpinAt: number;
};

export type PullAddResult = {
  phase: PullAddPhase;
  /** True when this call started a spin. A locked or partial pull is false. */
  started: boolean;
  /** The line this pull will add. Null when the spin adds nothing. */
  draft: StackDraft | null;
  /** Melt of the captured selection, from the quote showing at the pull. */
  melt: number | null;
  /** False when the line is waiting behind a cascade that is already playing. */
  playNow: boolean;
  /** Cards the cascade animates away from. */
  from: StackLine[];
};

export function emptyPullAdd(lastSpinAt = -1e15): PullAddPhase {
  return { lines: [], queued: [], cascading: false, lastSpinAt };
}

/** A repeat inside the lock does not start another spin and does not add a line. */
export function pullStartsSpin(now: number, lastSpinAt: number, repeatMs = PULL_REPEAT_MS): boolean {
  return Number.isFinite(now) && Number.isFinite(lastSpinAt) && now - lastSpinAt >= repeatMs;
}

/** Stage C is the bottom of the throw. A shorter pull is not a spin. */
export function fullPullReached(travel: number): boolean {
  return releaseCommitsSpin(travel);
}

export function draftFromShown(selection: ShownSelection | null, descriptionWidth: number): StackDraft | null {
  if (!selection || !(selection.qty > 0) || !(selection.grams > 0)) return null;
  if (!selection.symbol || !selection.mark) return null;
  return {
    symbol: selection.symbol,
    mark: selection.mark,
    weightLabel: selection.weightLabel,
    grams: selection.grams,
    qty: selection.qty,
    description: defaultLineDescription(selection.name, selection.weightLabel, descriptionWidth),
  };
}

/**
 * The spin has already been accepted. Capture the selection showing before the
 * wheels move. A match still becomes its own line; the combine dialog stays on
 * the Add button. A pull during a cascade waits, so it is still one line.
 */
export function notePullAdd(
  phase: PullAddPhase,
  selection: ShownSelection | null,
  pricePerTroyOz: number | null,
  descriptionWidth: number,
): PullAddResult {
  const from = phase.lines;
  const draft = draftFromShown(selection, descriptionWidth);
  if (!draft) {
    return { phase, started: true, draft: null, melt: null, playNow: false, from };
  }
  const melt = rowMelt(pricePerTroyOz, draft.grams, draft.qty);
  if (phase.cascading || phase.queued.length > 0) {
    return {
      phase: { ...phase, queued: [...phase.queued, draft] },
      started: true,
      draft,
      melt,
      playNow: false,
      from,
    };
  }
  return {
    phase: { ...phase, lines: resolveAdd(phase.lines, draft, "separate"), cascading: true },
    started: true,
    draft,
    melt,
    playNow: true,
    from,
  };
}

/**
 * Partial throws add nothing and do not spend the spin lock.
 * A full throw inside the lock adds nothing.
 * A full throw that starts a spin adds the selection showing at that moment.
 */
export function acceptPull(
  phase: PullAddPhase,
  selection: ShownSelection | null,
  now: number,
  travel: number,
  pricePerTroyOz: number | null,
  descriptionWidth: number,
): PullAddResult {
  if (!fullPullReached(travel) || !pullStartsSpin(now, phase.lastSpinAt)) {
    return { phase, started: false, draft: null, melt: null, playNow: false, from: phase.lines };
  }
  const result = notePullAdd({ ...phase, lastSpinAt: now }, selection, pricePerTroyOz, descriptionWidth);
  return { ...result, phase: { ...result.phase, lastSpinAt: now } };
}

/** The cascade finished. The next queued pull plays, or the board is idle. */
export function finishPullCascade(phase: PullAddPhase): PullAddResult {
  const [draft, ...queued] = phase.queued;
  if (!draft) {
    return {
      phase: { ...phase, cascading: false, queued: [] },
      started: true,
      draft: null,
      melt: null,
      playNow: false,
      from: phase.lines,
    };
  }
  const from = phase.lines;
  return {
    phase: { ...phase, lines: resolveAdd(from, draft, "separate"), queued, cascading: true },
    started: true,
    draft,
    melt: null,
    playNow: true,
    from,
  };
}
