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
  assert.match(card, /fromEditor\(document\.activeElement\)/);
  const keys = card.slice(card.indexOf("onKeyDown="), card.indexOf("onBeforeInput="));
  assert.equal(keys.includes("depart("), false);
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

test("tapping the metal, the weight, or the purity opens no editor", () => {
  assert.match(table, /data-fixed="metal"/);
  assert.match(table, /data-fixed=\{part\}/);
  assert.match(table, /lockFlap\(layout\.weight, layout\.weightSpan, "weight"\)/);
  assert.match(table, /lockFlap\(layout\.purity, layout\.puritySpan, "purity"\)/);
  const metal = table.slice(table.indexOf('data-fixed="metal"'), table.indexOf("stack-span", table.indexOf('data-fixed="metal"')));
  assert.equal(metal.includes("<button"), false);
  assert.equal(metal.includes("setEditing"), false);
  const locks = table.slice(table.indexOf("const lockFlap"), table.indexOf("const description"));
  assert.equal(locks.includes("setEditing"), false);
  assert.equal(locks.includes("<button"), false);
  assert.equal(table.includes("editWeight"), false);
  assert.equal(table.includes("weight-edit"), false);
  const edit = table.indexOf('className="stack-edit"');
  assert.ok(edit > table.indexOf("layout.descriptionSpan"));
  assert.match(table, /aria-label=\{`Edit description/);
});
