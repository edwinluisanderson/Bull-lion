import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { FLAP_DESCRIPTION } from "@/lib/split-flap";
import {
  acceptPull,
  emptyPullAdd,
  finishPullCascade,
  fullPullReached,
  notePullAdd,
  pullStartsSpin,
  PULL_REPEAT_MS,
  type ShownSelection,
} from "@/lib/pull-stack";
import { rowMelt } from "@/lib/stack-board";
import { TROY_OUNCE_GRAMS } from "@/lib/value";

const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");
const table = readFileSync(new URL("../components/stack-table.tsx", import.meta.url), "utf8");
const lever = readFileSync(new URL("../components/lever.tsx", import.meta.url), "utf8");
const flap = readFileSync(new URL("../components/split-flap.tsx", import.meta.url), "utf8");

const gold: ShownSelection = {
  symbol: "XAU",
  mark: "Au",
  name: "Gold",
  grams: TROY_OUNCE_GRAMS,
  weightLabel: "1 oz",
  qty: 1,
};

const silver: ShownSelection = {
  symbol: "XAG",
  mark: "Ag",
  name: "Silver",
  grams: TROY_OUNCE_GRAMS,
  weightLabel: "1 oz",
  qty: 3,
};

test("a partial pull never reaches the spin and adds nothing", () => {
  assert.equal(fullPullReached(0), false);
  assert.equal(fullPullReached(0.75), false);
  assert.equal(fullPullReached(0.849), false);
  assert.equal(fullPullReached(0.85), true);
  const before = emptyPullAdd();
  const partial = acceptPull(before, gold, 1_000, 0.84, 2300, FLAP_DESCRIPTION);
  assert.equal(partial.started, false);
  assert.equal(partial.draft, null);
  assert.equal(partial.phase.lines.length, 0);
  assert.equal(partial.phase.lastSpinAt, before.lastSpinAt);
});

test("one full pull adds the selection that was showing, including its melt", () => {
  const price = 2300;
  const added = acceptPull(emptyPullAdd(), gold, 1_000, 1, price, FLAP_DESCRIPTION);
  assert.equal(added.started, true);
  assert.equal(added.playNow, true);
  assert.equal(added.phase.lines.length, 1);
  const line = added.phase.lines[0];
  assert.ok(line);
  assert.equal(line.symbol, gold.symbol);
  assert.equal(line.mark, gold.mark);
  assert.equal(line.weightLabel, gold.weightLabel);
  assert.equal(line.grams, gold.grams);
  assert.equal(line.qty, gold.qty);
  assert.equal(line.description, "Gold 1 oz");
  assert.equal(added.melt, rowMelt(price, gold.grams, gold.qty));
  assert.equal(added.melt, 2300);
});

test("a second commit inside the lock does not add another line", () => {
  const first = acceptPull(emptyPullAdd(), gold, 1_000, 1, 2300, FLAP_DESCRIPTION);
  const again = acceptPull(first.phase, gold, 1_000 + PULL_REPEAT_MS - 1, 1, 2300, FLAP_DESCRIPTION);
  assert.equal(pullStartsSpin(1_000 + PULL_REPEAT_MS - 1, first.phase.lastSpinAt), false);
  assert.equal(again.started, false);
  assert.equal(again.phase.lines.length, 1);
  assert.equal(again.phase, first.phase);
});

test("a full pull while a spin is still cascading queues exactly one new line", () => {
  const first = acceptPull(emptyPullAdd(), gold, 1_000, 1, 2300, FLAP_DESCRIPTION);
  assert.equal(first.phase.cascading, true);
  const second = acceptPull(first.phase, silver, 1_000 + PULL_REPEAT_MS, 1, 28, FLAP_DESCRIPTION);
  assert.equal(second.started, true);
  assert.equal(second.playNow, false);
  assert.equal(second.phase.lines.length, 1);
  assert.equal(second.phase.lines[0]?.symbol, "XAU");
  assert.equal(second.phase.queued.length, 1);
  assert.equal(second.draft?.symbol, "XAG");
  assert.equal(second.draft?.qty, 3);
  assert.equal(second.melt, rowMelt(28, silver.grams, silver.qty));
  const landed = finishPullCascade(second.phase);
  assert.equal(landed.playNow, true);
  assert.equal(landed.phase.queued.length, 0);
  assert.equal(landed.phase.lines.length, 2);
  assert.equal(landed.phase.lines[0]?.symbol, "XAG");
  assert.equal(landed.phase.lines[0]?.qty, 3);
  assert.equal(landed.phase.lines[1]?.symbol, "XAU");
  const idle = finishPullCascade(landed.phase);
  assert.equal(idle.playNow, false);
  assert.equal(idle.phase.cascading, false);
  assert.equal(idle.phase.lines.length, 2);
});

test("a later full pull of the same metal and weight still adds its own line", () => {
  const first = acceptPull(emptyPullAdd(), gold, 1_000, 1, 2300, FLAP_DESCRIPTION);
  const idle = finishPullCascade(first.phase);
  const again = acceptPull(idle.phase, { ...gold, qty: 2 }, 2_000, 1, 2300, FLAP_DESCRIPTION);
  assert.equal(again.playNow, true);
  assert.equal(again.phase.lines.length, 2);
  assert.equal(again.phase.lines[0]?.qty, 2);
  assert.equal(again.phase.lines[1]?.qty, 1);
  assert.equal(again.phase.lines[0]?.id === again.phase.lines[1]?.id, false);
});

test("a pull adds its own line, and the board has no Add button", () => {
  const first = acceptPull(emptyPullAdd(), gold, 1_000, 1, 2300, FLAP_DESCRIPTION);
  const idle = finishPullCascade(first.phase);
  const pullAgain = notePullAdd(idle.phase, gold, 2300, FLAP_DESCRIPTION);
  assert.equal(pullAgain.phase.lines.length, idle.phase.lines.length + 1);
  assert.match(table, /notePullAdd\(/);
  assert.equal(table.includes("Add to stack"), false);
  assert.equal(table.includes("addCurrent"), false);
  assert.equal(table.includes("setPending"), false);
});

test("a drag launches at stage C, and the spin snapshots before the token", () => {
  assert.match(lever, /if \(stage === "c" && dragged\.current\) commitSpin\(\)/);
  assert.match(lever, /if \(travelRef\.current > 0\) glideHome\(committed\.current\)/);
  assert.match(lever, /function commitSpin\(\) \{\s*if \(committed\.current\) return;/);
  assert.equal(lever.includes("leverClunk"), false);
  assert.match(lever, /onKeyDown=\{[\s\S]*fullPull\(\)/);
  assert.equal(lever.includes("onClick"), false);
  assert.match(lever, /onCommit\(\)/);
  assert.equal(lever.includes("pullSerial"), false);
  assert.equal(lever.includes("notePullAdd"), false);
  assert.match(machine, /onCommit=\{pull\}/);
  const pull = machine.slice(machine.indexOf("function pull()"), machine.indexOf("useEffect(() => {\n    if (spinToken === 0)"));
  const gate = pull.indexOf("pullStartsSpin");
  const serial = pull.indexOf("setPullSerial");
  const token = pull.indexOf("setSpinToken");
  assert.ok(gate >= 0 && serial > gate && token > serial);
  assert.match(table, /unlockFlapSamples\(\)/);
  assert.match(table, /landNewest\(result\.phase\.lines\)/);
  assert.match(flap, /playFlapSound\(\)/);
  assert.match(table, /pullSerial/);
});

test("the pull ball keeps its 48px face and gains an invisible 12px grab ring", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const ring = css.match(/\.pull-ball::before \{[^}]*\}/)?.[0] ?? "";
  assert.match(ring, /content:\s*""/);
  assert.match(ring, /width:\s*max\(48px,\s*calc\(100% \+ 24px\)\)/);
  assert.match(ring, /height:\s*max\(48px,\s*calc\(100% \+ 24px\)\)/);
  assert.match(ring, /background:\s*transparent/);
  assert.match(ring, /clip-path:\s*inset\(0 0 12px 12px\)/);
  assert.match(css, /\.pull-handle \{[^}]*width:\s*48px/);
  assert.match(css, /\.pull-handle \{[^}]*height:\s*48px/);
  assert.match(css, /\.pull-ball \{[^}]*width:\s*100%/);
  assert.match(css, /\.pull-ball \{[^}]*padding:\s*0/);
});
