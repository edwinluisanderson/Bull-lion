import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  backspaceFlap,
  cursorFromTap,
  moveFlapCursor,
  openFlapCursor,
  pasteFlaps,
  typeFlapChar,
} from "@/lib/flap-edit";

const editor = readFileSync(new URL("../components/description-flaps.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const card = readFileSync(new URL("../components/swipe-card.tsx", import.meta.url), "utf8");

test("typing overwrites the highlighted flap and the highlight advances", () => {
  const opened = openFlapCursor("JUNK", 4, 0);
  assert.equal(opened.cursor, 0);
  const typed = typeFlapChar(opened, "q");
  assert.equal(typed.text, "QUNK");
  assert.equal(typed.cursor, 1);
  const next = typeFlapChar(typed, "!");
  assert.equal(next.text, "Q!NK");
  assert.equal(next.cursor, 2);
  assert.equal(typeFlapChar(opened, "ü").text, "JUNK");
});

test("the highlight stops on the last description flap", () => {
  let state = openFlapCursor("", 4, 3);
  state = typeFlapChar(state, "Z");
  assert.equal(state.text, "   Z");
  assert.equal(state.cursor, 3);
  state = typeFlapChar(state, "Q");
  assert.equal(state.text, "   Z");
  assert.equal(state.cursor, 3);
  assert.equal([...state.text].length <= state.cap, true);
  const full = typeFlapChar(typeFlapChar(openFlapCursor("", 2, 0), "A"), "B");
  assert.equal(full.text, "AB");
  assert.equal(full.cursor, 1);
  assert.equal(typeFlapChar(full, "C").text, "AB");
});

test("backspace clears the highlighted flap, or the previous one when it is empty", () => {
  const cleared = backspaceFlap(openFlapCursor("JUNK", 4, 2));
  assert.equal(cleared.text, "JU K");
  assert.equal(cleared.cursor, 1);
  const previous = backspaceFlap(openFlapCursor("JU K", 4, 2));
  assert.equal(previous.text, "J  K");
  assert.equal(previous.cursor, 1);
  const first = backspaceFlap(openFlapCursor("JUNK", 4, 0));
  assert.equal(first.text, " UNK");
  assert.equal(first.cursor, 0);
  const empty = backspaceFlap(openFlapCursor("", 4, 0));
  assert.equal(empty.text, "");
  assert.equal(empty.cursor, 0);
});

test("paste fills flaps from the highlight and stops at the cap", () => {
  const mid = pasteFlaps(openFlapCursor("JUNK", 6, 1), "coin");
  assert.equal(mid.text, "JCOIN");
  assert.equal(mid.cursor, 5);
  const capped = pasteFlaps(openFlapCursor("JUNK", 4, 0), "PASTE THIS WHOLE SENTENCE");
  assert.equal(capped.text, "PASK");
  assert.equal(capped.cursor, 3);
  assert.equal(capped.text.length <= capped.cap, true);
  const tail = pasteFlaps(openFlapCursor("JUNK", 4, 3), "XYZ");
  assert.equal(tail.text, "JUNK");
  assert.equal(tail.cursor, 3);
  const emptyTail = pasteFlaps(openFlapCursor("JUN", 4, 3), "XYZ");
  assert.equal(emptyTail.text, "JUNX");
  assert.equal(emptyTail.cursor, 3);
  assert.equal(pasteFlaps(openFlapCursor("JUNK", 4, 0), "###").text, "JUNK");
});

test("tapping a description flap moves the highlight there", () => {
  const state = openFlapCursor("JUNK", 6, 0);
  assert.equal(moveFlapCursor(state, 4).cursor, 4);
  assert.equal(moveFlapCursor(state, 4).text, "JUNK");
  assert.equal(moveFlapCursor(state, 99).cursor, 5);
  assert.equal(cursorFromTap(3, 0, 100, 6), 3);
  assert.equal(cursorFromTap(null, 50, 100, 4), 2);
  assert.equal(cursorFromTap(null, 99, 100, 4), 3);
  assert.equal(cursorFromTap(-1, 0, 100, 4), 0);
});

test("the description editor types into the flaps and keeps Backspace off the card", () => {
  assert.match(editor, /className="stack-key"/);
  assert.match(editor, /fontSize:\s*"16px"/);
  assert.match(editor, /onPaste/);
  assert.match(editor, /deleteContentBackward/);
  assert.match(editor, /typeFlapChar|onType/);
  assert.match(editor, /backspaceFlap|onBackspace/);
  assert.match(editor, /cursorFromTap/);
  assert.match(editor, /preventScroll:\s*true/);
  assert.equal(editor.includes("depart("), false);
  assert.match(css, /\.stack-key \{[^}]*font-size:\s*16px/);
  assert.match(css, /\.stack-key \{[^}]*opacity:\s*0/);
  assert.match(css, /\.flap-tile\.is-cursor/);
  const keys = card.slice(card.indexOf("onKeyDown="), card.indexOf("onBeforeInput="));
  assert.equal(keys.includes("depart("), false);
  assert.match(card, /fromEditor\(event\.target\)/);
  assert.match(card, /fromEditor\(document\.activeElement\)/);
});
