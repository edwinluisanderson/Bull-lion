import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { formatWholeDollars } from "@/lib/format";
import { NIXIE_DIGITS, NIXIE_IGNITE_MS, NIXIE_STAGGER_MS, litDigit, nixieColumns } from "@/lib/nixie";

const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");
const readout = readFileSync(new URL("../components/readout.tsx", import.meta.url), "utf8");
const nixie = readFileSync(new URL("../components/nixie-readout.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("the test nixie mirrors the melt value and lights only the needed cathodes", () => {
  const label = formatWholeDollars(3926.5);
  const columns = nixieColumns(label);
  assert.equal(label, "$3,927");
  assert.equal(
    columns
      .map((column) => (column.kind === "digit" ? String(column.digit) : column.kind === "mark" ? column.char : column.kind === "dollar" ? "$" : column.kind === "comma" ? "," : "."))
      .join(""),
    "$3,927",
  );
  const digits = columns.filter((column) => column.kind === "digit");
  assert.deepEqual(digits.map((column) => litDigit(column)), [3, 9, 2, 7]);
  assert.equal(columns.some((column) => column.kind === "dot"), false);
  assert.match(nixie, /NIXIE_DIGITS\.map\(\(digit\)/);
  assert.match(nixie, /d=\{NIXIE_GLYPH\[digit\]\}/);
  assert.match(nixie, /digit === column\.digit \? "is-on"/);
  assert.equal(NIXIE_DIGITS.length, 10);
  assert.equal(nixie.includes("feGaussianBlur"), false);

  const cents = nixieColumns("$1,234.50");
  assert.equal(cents.some((column) => column.kind === "dot"), true);
  assert.equal(cents.some((column) => column.kind === "comma"), true);
  assert.deepEqual(
    cents.filter((column) => column.kind === "digit").map((column) => litDigit(column)),
    [1, 2, 3, 4, 5, 0],
  );
});

test("the bottom-plate nixie follows the same melt state as the plate", () => {
  assert.match(
    machine,
    /<NixieReadout value=\{metal \? formatWholeDollars\(meltValue\(metal\.usdPerTroyOz, weight\.grams, pieces\)\) : "—"\} \/>/,
  );
  assert.match(readout, /const total = meltValue\(metal\.usdPerTroyOz, weight\.grams, pieces\)/);
  assert.match(readout, /<RollingPrice value=\{formatWholeDollars\(total\)\} \/>/);
  assert.equal(readout.includes("NixieReadout"), false);
  assert.equal(NIXIE_IGNITE_MS, 620);
  assert.equal(NIXIE_STAGGER_MS, 50);
  assert.match(nixie, /column\.order \* NIXIE_STAGGER_MS/);
  assert.match(css, /transition-delay:\s*var\(--nixie-delay\)/);
  assert.match(css, /\.nixie-cathode \{[^}]*0\.62s cubic-bezier\(0\.16, 0\.84, 0\.24, 1\)/);
  assert.match(css, /\.gear-panel-nixie \{[^}]*bottom:\s*58px/);
  assert.match(css, /\.gear-panel-nixie \{[^}]*left:\s*50%/);
  const reduced = css.split("@media (prefers-reduced-motion: reduce)").slice(1).find((block) => block.includes(".nixie-cathode"));
  assert.match(reduced ?? "", /\.nixie-cathode,[\s\S]*?transition:\s*none/);
});
