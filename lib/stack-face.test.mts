import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { MONEY_OVER, presentMoney } from "@/lib/melt-abbrev";
import {
  cardBottom,
  cardDetail,
  cardMoneyRow,
  clampDescription,
  commitDescription,
  compactWeight,
  descriptionCap,
  detailLayout,
  metalTone,
} from "@/lib/stack-face";
import { stackExport, stackExportChoices, stackSheetRows } from "@/lib/stack-export";
import { arrivalShowsBlank, CHAIN_INSET_PX, CHAIN_PAY_MS, STACK_LOWER_MS } from "@/lib/stack-motion";
import { FLAP_ALPHABET, FLAP_CAP_MS, FLAP_DESCRIPTION, FLAP_STEP_MS, flapFrames, flapStride } from "@/lib/split-flap";
import type { StackLine } from "@/lib/stack-board";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const table = readFileSync(new URL("../components/stack-table.tsx", import.meta.url), "utf8");

test("the description row drops the space before the unit and keeps the percent", () => {
  assert.equal(FLAP_ALPHABET.includes("%"), true);
  assert.equal(compactWeight("12.5 g"), "12.5G");
  assert.equal(compactWeight("1 oz"), "1OZ");
  assert.equal(compactWeight("1/10 oz"), "1/10OZ");
  assert.equal(cardDetail("12.5 g", "Junk 90%").trimEnd(), "12.5G JUNK 90%");
  assert.equal(cardDetail("12.5 g", "Junk 90%").length, FLAP_DESCRIPTION);
  assert.equal(metalTone("Au"), "gold");
  assert.equal(metalTone("Ag"), "silver");
});

test("only the description flaps are editable, and the cap stays inside the row", () => {
  const junk = detailLayout("12.5 g", "Junk 90%");
  assert.equal(junk.weight, "12.5G");
  assert.equal(junk.description, "JUNK");
  assert.equal(junk.purity, "90%");
  assert.equal(junk.descriptionCap, 4);
  assert.equal(junk.weightSpan?.length, 5);
  assert.equal(junk.descriptionSpan?.length, 4);
  assert.equal(junk.puritySpan?.length, 3);
  assert.equal(junk.row.trimEnd(), "12.5G JUNK 90%");
  assert.equal([...junk.row].length, FLAP_DESCRIPTION);

  assert.equal(descriptionCap("1 oz", "Maple"), 10);
  assert.equal(descriptionCap("1/10 oz", "Coin"), 7);
  const long = detailLayout("1 oz", "Pocket coin from the old drawer");
  assert.equal(long.descriptionCap, 10);
  assert.equal(long.description, "POCKET COI");
  assert.equal([...long.row].length, FLAP_DESCRIPTION);
  assert.equal(commitDescription("Pocket coin from the old drawer", "POCKET COI", 10), "POCKET COIN FROM THE OLD DRAWER");
  assert.equal(commitDescription("Junk 90%", "COIN", 4), "COIN 90%");
  assert.equal(clampDescription("PASTE THIS WHOLE SENTENCE", 4), "PAST");
  assert.equal(cardDetail("12.5 g", "Junk 90%").trimEnd(), "12.5G JUNK 90%");
});

test("quantity sits on the left and the melt on the right", () => {
  assert.equal(cardBottom(2, "$1,994"), "2       $1,994");
  assert.equal(cardBottom(2, "$1,994").length, FLAP_DESCRIPTION);
  const row = cardMoneyRow(1, 310);
  assert.equal(row.rounded, false);
  assert.equal(row.text.endsWith("$310"), true);
  assert.equal(row.text.startsWith("1"), true);
});

test("money abbreviates with a rounded flag and OVER is the last resort", () => {
  const dollars = presentMoney(310, 7);
  assert.equal(dollars.text, "$310");
  assert.equal(dollars.rounded, false);
  const big = presentMoney(123456.78, 7);
  assert.equal(big.text, "$123.5K");
  assert.equal(big.rounded, true);
  assert.equal(big.exact, "$123,457");
  const over = presentMoney(1_000_000_000_000_000, 3);
  assert.equal(over.rounded, true);
  assert.equal([...over.text].length <= 3, true);
  assert.notEqual(over.text.includes("9"), true);
});

test("a long roll stays under the cap and still moves forward", () => {
  assert.equal(flapStride(2), 1);
  assert.equal(flapStride(FLAP_ALPHABET.length - 1) >= 2, true);
  const frames = flapFrames("9", "0");
  assert.equal(frames.at(-1), "0");
  assert.equal(frames.length * FLAP_STEP_MS <= FLAP_CAP_MS, true);
  assert.equal(frames.length < FLAP_ALPHABET.length - 1, true);
  const short = flapFrames("A", "C");
  assert.deepEqual(short, ["B", "C"]);
});

test("downloads keep one card row and a full-precision total", () => {
  const line: StackLine = {
    id: "a",
    symbol: "XAU",
    mark: "Au",
    weightLabel: "1 oz",
    grams: 31.1034768,
    qty: 1,
    description: "Maple",
  };
  const rows = stackSheetRows([line], [{ symbol: "XAU", usdPerTroyOz: 3760.55 }]);
  assert.equal(rows.length, 3);
  assert.equal(rows[1]?.[1], "Maple");
  assert.equal(rows[1]?.[6], "3760.55");
  assert.equal(rows[2]?.[0], "Total");
  assert.equal(rows[2]?.[6], "3760.55");
  const labels = stackExportChoices().map((choice) => choice.label);
  assert.deepEqual(labels, [
    "CSV (.csv)",
    "Excel spreadsheet (.xlsx)",
    "OpenDocument spreadsheet (.ods)",
    "Google Sheets (.xlsx, upload to Google Drive)",
  ]);
  const sheet = stackExport("xlsx", [line], [{ symbol: "XAU", usdPerTroyOz: 3760.55 }], new Date(2026, 10, 18));
  assert.equal(sheet.filename.endsWith(".xlsx"), true);
  assert.equal(sheet.bytes[0], 0x50);
  assert.equal(sheet.bytes[1], 0x4b);
  const ods = stackExport("ods", [line], [{ symbol: "XAU", usdPerTroyOz: 3760.55 }]);
  assert.equal(ods.bytes[0], 0x50);
  assert.match(table, /stackExportChoices\(/);
  assert.match(table, /disabled=\{downloadLines\.length === 0\}/);
});

test("a new card stays blank until the chain has paid out", () => {
  assert.equal(CHAIN_INSET_PX, 96);
  assert.equal(CHAIN_PAY_MS > 0, true);
  assert.equal(STACK_LOWER_MS, 250);
  assert.equal(arrivalShowsBlank("drop"), true);
  assert.equal(arrivalShowsBlank("flip"), false);
  assert.equal(arrivalShowsBlank(null), false);
  assert.match(css, /left:\s*100px/);
  assert.equal(css.includes(".stack-rails"), false);
  assert.equal(table.includes("stack-rails"), false);
  assert.equal(css.includes("chain-reel"), false);
  assert.match(css, /animation:\s*stack-lower 250ms ease-out both/);
  assert.match(css, /translateY\(calc\(-1 \* var\(--pay-drop\)\)\)/);
  assert.match(table, /is-arriving/);
  assert.match(table, /STACK_LOWER_MS/);
  assert.match(table, /motionReduced\(\)/);
  const arrival = table.slice(table.indexOf("function beginArrival"));
  assert.ok(arrival.indexOf("motionReduced()") < arrival.indexOf("setLoweringId"));
});

test("the plates hang from the twist-in links and the background rail is gone", () => {
  assert.equal(css.includes(".stack-rails"), false);
  assert.equal(table.includes("stack-rails"), false);
  assert.equal(css.includes(".is-winch"), false);
  assert.match(css, /\.split-stack \{[^}]*clip-path:\s*inset\(0 -200vw -120px -200vw\)/);
  assert.match(css, /\.mock-link\.is-left \{[^}]*--link14-bR/);
  assert.match(css, /\.mock-link\.is-right \{[^}]*--link14-bL/);
  assert.equal(css.includes(".split-stack.is-arriving .split-stack-head > .mock-link"), false);
  assert.match(css, /\.stack-swipe\.is-rising\.is-reel-card \{[^}]*z-index:\s*0/);
  assert.match(css, /\.stack-swipe\.is-reeled \.mock-link \{[^}]*translateY\(calc\(-1 \* var\(--lift/);
  assert.match(css, /\.split-total \{[^}]*position:\s*relative/);
  assert.match(css, /animation:\s*stack-lower 250ms ease-out both/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.split-stack\.is-arriving \.split-rows[\s\S]*?animation:\s*none/);
});

test("the name plate is at least a card tall and arriving rings stay under it", () => {
  assert.match(css, /\.split-stack-head \{[^}]*min-height:\s*calc\(100cqw \* 58\.25 \/ 292\.8 \+ 8px\)/);
  assert.match(css, /\.split-stack-head \{[^}]*border-radius:\s*14px/);
  assert.match(css, /\.split-stack-head \{[^}]*background:\s*var\(--brass-plate\)/);
  assert.match(css, /\.split-stack-head \{[^}]*z-index:\s*5/);
  assert.match(css, /\.split-stack \{[^}]*clip-path:\s*inset\(0 -200vw -120px -200vw\)/);
  assert.equal(css.includes(".split-stack.is-arriving .split-stack-head > .mock-link"), false);
  assert.match(css, /\.split-stack\.is-arriving \.split-rows,\s*\.split-stack\.is-arriving \.split-total \{[^}]*z-index:\s*2/);
  assert.match(table, /hanging=\{true\}/);
  assert.match(table, /lines\.length === 0/);
  assert.match(css, /\.split-total > \.mock-plate::before \{[^}]*content:\s*none/);
  assert.match(css, /\.split-total > \.mock-link \{[^}]*top:\s*calc\(-13px - var\(--pw\)\)/);
  const board = css.slice(css.indexOf(".stack-card {\n  position: relative"), css.indexOf(".stack-kicker-next"));
  assert.match(board, /linear-gradient\(#0f0f0f, #0f0f0f\) content-box/);
  assert.equal(board.includes("padding-box"), false);
  assert.match(css, /\.stack-swipe\.is-raised \.stack-card \{[^}]*box-shadow:\s*none/);
  assert.match(css, /\.stack-swipe-face \{[^}]*clip-path:\s*inset\(8px round 3px\)/);
  assert.match(css, /\.stack-edit\.is-locked \{[^}]*pointer-events:\s*none/);
});

test("the stack column stays a centered 480px band and the phone card still hugs", () => {
  assert.match(css, /\.split-stack \{[^}]*max-width:\s*480px/);
  assert.match(css, /\.split-stack \{[^}]*margin:\s*0 auto/);
  assert.match(css, /\.split-stack \{[^}]*width:\s*100%/);
  assert.match(css, /\.split-stack \{[^}]*container-type:\s*inline-size/);
  assert.match(css, /\.stack-card \{[^}]*padding:\s*calc\(8px - var\(--pw\)\)/);
  assert.equal(css.includes("@media (min-width: 480px)"), false);
  const cardRule = css.slice(css.indexOf(".stack-card {"), css.indexOf(".stack-card {") + 500);
  assert.equal(cardRule.includes("container-type"), false);
  assert.match(cardRule, /--card-h:\s*calc\(100cqw \* 58\.25 \/ 292\.8\)/);
  const phoneColumn = 320 - 2 * 0.85 * 16;
  assert.equal(phoneColumn, 292.8);
  assert.ok(Math.abs((phoneColumn * 58.25) / 292.8 - 58.25) < 1e-9);
  const desktopColumn = 390 - 2 * 0.85 * 16;
  const desktopHeight = (desktopColumn * 58.25) / 292.8;
  assert.ok(Math.abs(desktopHeight / desktopColumn - 58.25 / 292.8) < 0.001);
  assert.ok(desktopHeight < 80);
});
