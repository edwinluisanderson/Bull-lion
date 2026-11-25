import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { blockEmptyEditorDelete, isDeleteIntent, swallowCardDelete } from "@/lib/editor-keys";

const card = readFileSync(new URL("../components/swipe-card.tsx", import.meta.url), "utf8");
const table = readFileSync(new URL("../components/stack-table.tsx", import.meta.url), "utf8");

const input = { tagName: "INPUT" };
const face = { tagName: "DIV" };

test("a desktop Backspace or Delete in the editor never deletes the card", () => {
  assert.equal(swallowCardDelete(input, { key: "Backspace", keyCode: 8 }), true);
  assert.equal(swallowCardDelete(input, { key: "Delete", keyCode: 46 }), true);
  assert.equal(blockEmptyEditorDelete("JUNK", { key: "Backspace" }), false);
  assert.equal(blockEmptyEditorDelete("", { key: "Backspace", keyCode: 8 }), true);
  assert.equal(blockEmptyEditorDelete("", { key: "Delete", keyCode: 46 }), true);
  assert.equal(swallowCardDelete(face, { key: "Backspace" }), false);
  assert.equal(isDeleteIntent({ key: "Backspace" }), true);
  assert.match(card, /fromEditor\(event\.target\)/);
  assert.match(card, /if \(event\.key !== "Backspace" && event\.key !== "Delete"\) return/);
  assert.match(table, /event\.stopPropagation\(\)/);
  assert.match(table, /blockEmptyEditorDelete/);
});

test("an Android soft-keyboard delete stays in the editor", () => {
  assert.equal(swallowCardDelete(input, { key: "Unidentified", keyCode: 229 }), true);
  assert.equal(swallowCardDelete(input, { inputType: "deleteContentBackward" }), true);
  assert.equal(blockEmptyEditorDelete("", { key: "Unidentified", keyCode: 229 }), true);
  assert.equal(blockEmptyEditorDelete("", { inputType: "deleteContentBackward" }), true);
  assert.equal(blockEmptyEditorDelete("A", { inputType: "deleteContentBackward" }), false);
  assert.equal(swallowCardDelete(face, { key: "Unidentified", keyCode: 229 }), false);
  assert.equal(swallowCardDelete({ tagName: "TEXTAREA" }, { key: "Backspace" }), true);
  assert.equal(swallowCardDelete({ tagName: "DIV", isContentEditable: true }, { key: "Delete" }), true);
  assert.match(card, /deleteContentBackward/);
  assert.match(table, /onBeforeInput/);
  assert.match(table, /maxLength=\{layout\.descriptionCap\}/);
  assert.match(table, /onPaste/);
});
