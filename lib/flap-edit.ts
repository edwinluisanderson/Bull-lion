import { flapText, padFlap } from "@/lib/split-flap";

/** The description row while it is being typed, one flap at a time. */
export type FlapCursor = {
  text: string;
  cursor: number;
  cap: number;
};

function limit(cap: number): number {
  if (!Number.isFinite(cap)) return 0;
  return Math.max(0, Math.floor(cap));
}

function cells(text: string, cap: number): string[] {
  return [...padFlap(text, cap)];
}

/** Drop trailing blanks. Spaces between letters stay, so a cleared middle flap does too. */
export function flapsToDraft(chars: readonly string[]): string {
  return chars.join("").replace(/ +$/g, "");
}

function place(cursor: number, cap: number): number {
  if (cap <= 0) return 0;
  if (!Number.isFinite(cursor)) return 0;
  return Math.max(0, Math.min(cap - 1, Math.floor(cursor)));
}

export function openFlapCursor(text: string, cap: number, cursor = 0): FlapCursor {
  const width = limit(cap);
  const chars = cells(flapText(text), width);
  return { text: flapsToDraft(chars), cursor: place(cursor, width), cap: width };
}

/** Overwrite the highlighted flap and move the highlight one step to the right. */
export function typeFlapChar(state: FlapCursor, raw: string): FlapCursor {
  if (state.cap <= 0) return state;
  const char = [...flapText(raw)][0];
  if (!char) return state;
  const next = cells(state.text, state.cap);
  const at = place(state.cursor, state.cap);
  next[at] = char;
  return { text: flapsToDraft(next), cursor: Math.min(at + 1, state.cap - 1), cap: state.cap };
}

/**
 * Clear the highlighted flap and step back.
 * An empty flap clears the one before it instead. The first flap stays put.
 */
export function backspaceFlap(state: FlapCursor): FlapCursor {
  if (state.cap <= 0) return state;
  const next = cells(state.text, state.cap);
  const at = place(state.cursor, state.cap);
  if ((next[at] ?? " ") === " ") {
    if (at === 0) return { ...state, cursor: 0 };
    next[at - 1] = " ";
    return { text: flapsToDraft(next), cursor: at - 1, cap: state.cap };
  }
  next[at] = " ";
  return { text: flapsToDraft(next), cursor: Math.max(0, at - 1), cap: state.cap };
}

/** Write from the highlighted flap toward the right, and stop at the cap. */
export function pasteFlaps(state: FlapCursor, raw: string): FlapCursor {
  if (state.cap <= 0) return state;
  const incoming = [...flapText(raw)];
  if (incoming.length === 0) return state;
  const next = cells(state.text, state.cap);
  const start = place(state.cursor, state.cap);
  let at = start;
  let wrote = 0;
  for (const char of incoming) {
    if (at >= state.cap) break;
    next[at] = char;
    at += 1;
    wrote += 1;
  }
  return { text: flapsToDraft(next), cursor: Math.min(start + wrote, state.cap - 1), cap: state.cap };
}

export function moveFlapCursor(state: FlapCursor, index: number): FlapCursor {
  return { ...state, cursor: place(index, state.cap) };
}

/** A tapped tile wins. A tap between tiles uses the row position. */
export function cursorFromTap(tileIndex: number | null, offsetX: number, width: number, cap: number): number {
  const widthCap = limit(cap);
  if (widthCap <= 0) return 0;
  if (tileIndex != null && Number.isFinite(tileIndex) && tileIndex >= 0) return place(tileIndex, widthCap);
  if (!(width > 0) || !Number.isFinite(offsetX)) return 0;
  return place(Math.floor((offsetX / width) * widthCap), widthCap);
}
