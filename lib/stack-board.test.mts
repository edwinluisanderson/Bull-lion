import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { FLAP_GAIN, FLAP_MAX_PER_WINDOW, nextFlapSound } from "@/lib/flap-sound";
import { FLAP_BOARD_COLUMNS, FLAP_DESCRIPTION, FLAP_MELT, FLAP_METAL, FLAP_QTY, FLAP_TOTAL_COLUMNS, FLAP_TOTAL_LABEL_COLUMNS, FLAP_WEIGHT, fitFlapMoney, flapFrames, flapText, padFlap, rightFlap } from "@/lib/split-flap";
import {
  STACK_STORAGE_KEY,
  defaultLineDescription,
  flapMoney,
  grandTotal,
  parseStack,
  insertCascade,
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
import { TROY_OUNCE_GRAMS, meltValue } from "@/lib/value";

const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");
const table = readFileSync(new URL("../components/stack-table.tsx", import.meta.url), "utf8");
const flap = readFileSync(new URL("../components/split-flap.tsx", import.meta.url), "utf8");
const sound = readFileSync(new URL("../lib/flap-sound.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

const gold: StackDraft = {
  symbol: "XAU",
  mark: "Au",
  weightLabel: "1 oz",
  grams: TROY_OUNCE_GRAMS,
  qty: 1,
  description: "Gold 1 oz",
};

function memory() {
  const bag = new Map<string, string>();
  return {
    getItem: (key: string) => bag.get(key) ?? null,
    setItem: (key: string, value: string) => {
      bag.set(key, value);
    },
  };
}

test("split flaps walk forward and jump when motion is reduced", () => {
  assert.deepEqual(flapFrames("A", "C"), ["B", "C"]);
  assert.deepEqual(flapFrames("A", "A"), []);
  assert.deepEqual(flapFrames("C", "A", true), ["A"]);
  assert.equal(padFlap("gold 1 oz", 6), "GOLD 1");
  assert.equal(flapFrames(" ", "A").at(-1), "A");
  assert.equal(FLAP_DESCRIPTION, FLAP_BOARD_COLUMNS);
  assert.equal(FLAP_BOARD_COLUMNS, FLAP_METAL + FLAP_WEIGHT + FLAP_QTY + FLAP_MELT);
  const long = "Pocket coin from the old drawer";
  assert.ok(flapText(long).length > FLAP_DESCRIPTION);
  assert.equal(padFlap(long, FLAP_DESCRIPTION), "POCKET COIN FROM TH");
  assert.equal(padFlap("Gold 1 oz", FLAP_DESCRIPTION).trimEnd(), "GOLD 1 OZ");
});

test("adding a line asks before combining the same metal and weight", () => {
  const first = proposeAdd([], gold, "a");
  assert.equal(first.status, "added");
  assert.equal(first.lines.length, 1);
  assert.equal(first.lines[0]?.description, "Gold 1 oz");
  assert.equal(defaultLineDescription("Gold", "1 oz"), "Gold 1 oz");
  assert.equal(defaultLineDescription("Platinum", "1 oz", 12), "Platinum");

  const again = proposeAdd(first.lines, { ...gold, qty: 2, description: "Gold 1 oz" }, "b");
  assert.equal(again.status, "needs-choice");
  if (again.status !== "needs-choice") return;
  assert.equal(again.matchId, "a");
  assert.equal(again.lines.length, 1);

  const combined = resolveAdd(first.lines, { ...gold, qty: 2 }, "combine", "b");
  assert.equal(combined.length, 1);
  assert.equal(combined[0]?.qty, 3);

  const separate = resolveAdd(first.lines, { ...gold, qty: 2 }, "separate", "b");
  assert.equal(separate.length, 2);
  assert.equal(separate[0]?.id, "b");
  assert.equal(separate[0]?.qty, 2);
  assert.equal(separate[1]?.id, "a");

  const otherWeight = proposeAdd(first.lines, { ...gold, grams: 1, weightLabel: "1 g", description: "Gold 1 g" }, "c");
  assert.equal(otherWeight.status, "added");
  assert.equal(otherWeight.lines.length, 2);
});

test("new lines stay newest-first and the cascade walks downward", () => {
  const older = proposeAdd([], gold, "a");
  assert.equal(older.status, "added");
  const newer = proposeAdd(older.lines, { ...gold, grams: 1, weightLabel: "1 g", description: "Gold 1 g" }, "b");
  assert.equal(newer.status, "added");
  if (newer.status !== "added") return;
  assert.deepEqual(newer.lines.map((line) => line.id), ["b", "a"]);

  const incoming = {
    ...gold,
    id: "c",
    grams: 31.1034768,
    weightLabel: "1 oz",
    qty: 1,
    description: "Pocket coin from the old drawer",
  };
  const frames = insertCascade(newer.lines, incoming);
  assert.equal(frames[0]?.at(-1), null);
  assert.equal(frames[1]?.at(-1)?.id, "a");
  assert.equal(frames[1]?.[1]?.id, "a");
  assert.equal(frames[2]?.[1]?.id, "b");
  assert.equal(frames.at(-1)?.[0]?.id, "c");
  assert.deepEqual(
    frames.at(-1)?.map((face) => face?.id),
    ["c", "b", "a"],
  );
  assert.equal(padFlap(frames[1]?.at(-1)?.description ?? "", FLAP_DESCRIPTION).trimEnd(), "GOLD 1 OZ");

  const longExisting = newer.lines.map((line, index) =>
    index === 1 ? { ...line, description: "Pocket coin from the old drawer" } : line,
  );
  const shifted = insertCascade(longExisting, { ...incoming, id: "d", description: "Gold 1 oz" });
  const landed = shifted[1]?.at(-1);
  assert.equal(landed?.id, "a");
  assert.equal(padFlap(landed?.description ?? "", FLAP_DESCRIPTION), "POCKET COIN FROM TH");

  const combined = resolveAdd(newer.lines, { ...gold, grams: 1, qty: 4, description: "Gold 1 g" }, "combine", "z");
  assert.deepEqual(combined.map((line) => line.id), ["b", "a"]);
  assert.equal(combined[0]?.qty, 5);

  const store = memory();
  writeStack(store, newer.lines);
  assert.deepEqual(readStack(store).map((line) => line.id), ["b", "a"]);
});

test("removing a line and renaming it leave the rest of the board", () => {
  const lines = proposeAdd([], gold, "a").lines;
  const named = renameLine(lines, "a", "  Pocket coin  ");
  assert.equal(named[0]?.description, "Pocket coin");
  assert.deepEqual(renameLine(named, "a", "   "), named);
  assert.deepEqual(removeLine(named, "a"), []);
  assert.equal(removeLine(named, "missing").length, 1);
});

test("row melt and the grand total follow the live spot", () => {
  const one = rowMelt(4000, TROY_OUNCE_GRAMS, 2);
  assert.equal(one, meltValue(4000, TROY_OUNCE_GRAMS, 2));
  assert.equal(one, 8000);
  assert.equal(rowMelt(null, TROY_OUNCE_GRAMS, 2), null);
  assert.equal(grandTotal([]), null);
  assert.equal(grandTotal([8000, null, 2000]), 10000);
  assert.equal(flapMoney(8000), "$8,000");
  assert.equal(flapMoney(null), "-");
});

test("the stack survives a reload and drops a broken record", () => {
  const store = memory();
  const lines: StackLine[] = proposeAdd([], gold, "a").lines;
  writeStack(store, lines);
  assert.equal(store.getItem(STACK_STORAGE_KEY)?.includes("\"id\":\"a\""), true);
  assert.deepEqual(readStack(store), lines);
  store.setItem(STACK_STORAGE_KEY, "{not json");
  assert.deepEqual(parseStack("{not json"), []);
  assert.deepEqual(readStack(store), []);
  store.setItem(STACK_STORAGE_KEY, JSON.stringify([{ id: "x", symbol: "XAU" }]));
  assert.deepEqual(readStack(store), []);
});

test("the melt total label stays put and the value sits on the right of a fixed field", () => {
  assert.equal(FLAP_TOTAL_COLUMNS, 11);
  assert.equal(fitFlapMoney("$99,999,999", FLAP_TOTAL_COLUMNS), "$99,999,999");
  assert.equal(fitFlapMoney("$1,234,567", FLAP_TOTAL_COLUMNS), " $1,234,567");
  assert.equal(fitFlapMoney("$999,999,999", FLAP_TOTAL_COLUMNS), " $999999999");
  assert.equal(fitFlapMoney("$99,999,999,999", FLAP_TOTAL_COLUMNS), "$9999999999");
  assert.equal(FLAP_TOTAL_LABEL_COLUMNS + FLAP_TOTAL_COLUMNS, FLAP_BOARD_COLUMNS);
  const narrow = fitFlapMoney("$30", FLAP_TOTAL_COLUMNS);
  const wide = fitFlapMoney("$10,000", FLAP_TOTAL_COLUMNS);
  assert.equal(narrow.length, wide.length);
  assert.equal(narrow.endsWith("$30"), true);
  assert.equal(wide.endsWith("$10,000"), true);
  assert.equal(narrow.startsWith(" "), true);
  assert.match(table, />Total</);
  assert.match(table, /fitFlapMoney\(flapMoney\(total\), FLAP_TOTAL_COLUMNS\)/);
  assert.equal(table.includes("Melt Total"), false);
  assert.equal(table.includes("Stack Total"), false);
  assert.equal(table.includes("--total-em"), false);
});

test("My Stack sits between the cabinet and the scrap plate", () => {
  const cabinet = machine.indexOf('className="cabinet"');
  const stack = machine.indexOf('className="stack-plate"');
  const panel = machine.indexOf('className="gear-panel"');
  assert.ok(cabinet > 0 && cabinet < stack && stack < panel);
  const plate = machine.slice(stack, panel);
  assert.match(plate, /<StackTable/);
  assert.equal(plate.includes("scrap-readout"), false);
  assert.equal(plate.includes("<Gear"), false);
  const scrap = machine.slice(panel);
  assert.equal(scrap.includes("<StackTable"), false);
  assert.match(scrap, /className="scrap-readout"/);
  assert.match(scrap, /className="scrap-readout-gap"/);
  assert.equal(plate.includes('className="rivet"'), false);
  assert.match(css, /\.stack-plate \{[^}]*width:\s*auto/);
  assert.match(css, /\.stack-plate \{[^}]*margin:\s*20px 0 0/);
  assert.match(css, /\.stack-plate \{[^}]*padding:\s*0/);
  assert.match(css, /\.stack-plate \{[^}]*background:\s*none/);
  assert.match(css, /\.stack-plate \{[^}]*box-shadow:\s*none/);
  assert.equal(css.includes(".stack-plate::after"), false);
  assert.match(css, /\.split-stack \{[^}]*width:\s*100%/);
  assert.match(css, /\.split-stack \{[^}]*padding:\s*0/);
  assert.match(css, /\.split-stack \{[^}]*background:\s*none/);
  assert.match(css, /\.stack-plate:has\(\.stack-swipe\.is-raised\) \{[^}]*overflow:\s*visible/);
});

test("the split-flap stack keeps its board and the flaps stay quiet when sound is off", () => {
  assert.match(machine, /<StackTable/);
  assert.match(machine, /className="scrap-readout-gap"/);
  assert.equal(table.includes("Add to stack"), false);
  assert.equal(table.includes("stack-add"), false);
  assert.equal(table.includes("addCurrent"), false);
  assert.equal(table.includes("Keep separate"), false);
  assert.match(table, />Total</);
  assert.equal(table.includes("Grand total"), false);
  assert.equal(table.includes("--total-em"), false);
  assert.match(table, /readStack\(window\.localStorage\)/);
  assert.match(table, /writeStack\(window\.localStorage, lines\)/);
  assert.equal(table.includes("resolveAdd"), false);
  assert.match(table, /Remove \$\{line\.description\}/);
  assert.match(flap, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.gear-panel \{[^}]*margin-top:\s*20px/);
  assert.match(css, /\.flap-top span,\s*\.flap-bottom span,\s*\.flap-leaf span \{[^}]*transform:\s*translateY\(0\.06em\)/);
  assert.match(table, />My Stack</);
  assert.match(css, /\.split-stack-title \{[^}]*text-transform:\s*none/);
  assert.match(css, /\.stack-card \{[^}]*--flap-font:\s*clamp\(\s*16px,/);
  assert.match(css, /\.stack-card \{[^}]*grid-template-columns:\s*repeat\(var\(--flap-cols/);
  assert.match(css, /\.stack-card \{[^}]*column-gap:\s*2px/);
  assert.match(css, /\.split-stack-title \{[^}]*font-size:\s*1\.5rem/);
  assert.match(css, /\.split-stack-title \{[^}]*text-align:\s*center/);
  assert.match(css, /\.split-stack-head \{[^}]*justify-content:\s*center/);
  assert.match(css, /\.split-total-label \{[^}]*font-size:\s*1\.25rem/);
  assert.match(css, /\.split-total \{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto/);
  assert.match(css, /\.split-total \{[^}]*--flap-font:\s*1\.25rem/);
  assert.match(css, /\.split-total-label \{[^}]*text-align:\s*left/);
  assert.match(css, /\.split-total-label \{[^}]*text-transform:\s*none/);
  assert.match(css, /\.split-total-label \{[^}]*font-family:\s*var\(--font-body\)/);
  assert.match(css, /\.split-total-label \{[^}]*font-variant:\s*normal/);
  assert.match(css, /\.split-total-label \{[^}]*font-size:\s*1\.25rem/);
  assert.match(css, /\.flap-tile \{[^}]*background:\s*#000/);
  assert.match(css, /\.flap-top,\s*\.flap-bottom,\s*\.flap-leaf \{[^}]*background:\s*#000/);
  assert.match(css, /\.flap-bottom \{[^}]*border-top:\s*1px solid #1f1f1f/);
  assert.match(css, /\.stack-card \{[^}]*box-shadow:[^}]*#c4963e/);
  assert.match(table, /data-rows=\{2\}/);
  assert.equal(table.includes("descriptionNeedsOwnRow"), false);
  assert.equal(table.includes("data-rows={3}"), false);
  assert.match(table, /width=\{FLAP_DESCRIPTION\}/);
  assert.match(table, /gridRow: 1 \}\}>\s*Description/);
  assert.match(table, /gridRow: 3 \}\}>\s*Metal/);
  assert.match(table, /insertCascade\(existing, incoming\)/);
  assert.match(table, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.split-stack \{/);
  assert.match(css, /\.flap-leaf \{[^}]*animation:\s*flap-turn 70ms linear/);
  const reduced = css
    .split("@media (prefers-reduced-motion: reduce)")
    .slice(1)
    .find((part) => part.includes(".flap-leaf"));
  assert.match(reduced ?? "", /\.flap-leaf \{[^}]*animation:\s*none/);
  assert.match(sound, /spinSoundEnabled\(\)/);
  assert.ok(FLAP_GAIN > 0.07 && FLAP_GAIN < 0.1);
  assert.equal(FLAP_MAX_PER_WINDOW, 2);
  assert.match(sound, /createWaveShaper\(\)/);
  assert.equal(sound.includes("FLAP_SUM_LIMIT"), true);
  const first = nextFlapSound({ stamp: 0, count: 0 }, 10);
  assert.equal(first.play, true);
  let gate = first.gate;
  let plays = 1;
  for (let index = 0; index < 6; index += 1) {
    const next = nextFlapSound(gate, 12);
    gate = next.gate;
    if (next.play) plays += 1;
  }
  assert.equal(plays, FLAP_MAX_PER_WINDOW);
  const later = nextFlapSound(gate, 12 + 45);
  assert.equal(later.play, true);
});
