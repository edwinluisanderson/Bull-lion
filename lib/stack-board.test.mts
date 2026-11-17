import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { FLAP_GAIN, FLAP_MAX_PER_WINDOW, nextFlapSound } from "@/lib/flap-sound";
import { flapFrames, padFlap } from "@/lib/split-flap";
import {
  STACK_STORAGE_KEY,
  defaultLineDescription,
  flapMoney,
  grandTotal,
  parseStack,
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
  assert.equal(separate[1]?.id, "b");
  assert.equal(separate[1]?.qty, 2);

  const otherWeight = proposeAdd(first.lines, { ...gold, grams: 1, weightLabel: "1 g", description: "Gold 1 g" }, "c");
  assert.equal(otherWeight.status, "added");
  assert.equal(otherWeight.lines.length, 2);
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

test("the scrap plate grows a split-flap stack and the flaps stay quiet when sound is off", () => {
  assert.match(machine, /<StackTable/);
  assert.match(machine, /className="scrap-readout-gap"/);
  assert.match(table, /Add to stack/);
  assert.match(table, /Combine/);
  assert.match(table, /Keep separate/);
  assert.match(table, /Grand total/);
  assert.match(table, /readStack\(window\.localStorage\)/);
  assert.match(table, /writeStack\(window\.localStorage, lines\)/);
  assert.match(table, /resolveAdd\(lines, pending, choice\)/);
  assert.match(table, /Remove \$\{line\.description\}/);
  assert.match(flap, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.gear-panel \{[^}]*margin-top:\s*20px/);
  assert.match(css, /\.flap-top span,\s*\.flap-bottom span,\s*\.flap-leaf span \{[^}]*transform:\s*translateY\(2px\)/);
  assert.match(css, /\.split-stack \{/);
  assert.match(css, /\.flap-leaf \{[^}]*animation:\s*flap-turn 70ms linear/);
  const reduced = css
    .split("@media (prefers-reduced-motion: reduce)")
    .slice(1)
    .find((part) => part.includes(".flap-leaf"));
  assert.match(reduced ?? "", /\.flap-leaf \{[^}]*animation:\s*none/);
  assert.match(sound, /spinSoundEnabled\(\)/);
  assert.equal(FLAP_GAIN < 0.15, true);
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
