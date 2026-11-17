import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { formatWholeDollars } from "@/lib/format";
import {
  NIXIE_CYCLE_MS,
  NIXIE_DIGIT_PLACES,
  NIXIE_DIGITS,
  NIXIE_DOLLAR,
  NIXIE_HEIGHT_OVER_FONT,
  NIXIE_IGNITE_MS,
  NIXIE_SPOT_HEADROOM,
  NIXIE_STAGGER_MS,
  NIXIE_SLOT_COUNT,
  NIXIE_TUBE_ASPECT,
  nixieGap,
  nixiePlateWidth,
  nixieTubeWidth,
  cyclingDigit,
  litDigit,
  maxMeltLabel,
  nixieBank,
  nixieCentered,
  nixieColumns,
  nixieSlots,
  nixieTubeCount,
  nixieTubeHeight,
  nixieWindowWidth,
} from "@/lib/nixie";

const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");
const readout = readFileSync(new URL("../components/readout.tsx", import.meta.url), "utf8");
const nixie = readFileSync(new URL("../components/nixie-readout.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function textOf(columns: ReturnType<typeof nixieBank>): string {
  return columns
    .map((column) => {
      if (column.kind === "digit") return column.digit === null ? "·" : String(column.digit);
      if (column.kind === "dollar") return column.lit ? "$" : "·";
      if (column.kind === "comma") return column.lit ? "," : "·";
      if (column.kind === "dot") return ".";
      return column.char;
    })
    .join("");
}

test("the test nixie mirrors the melt value and lights only the needed cathodes", () => {
  const label = formatWholeDollars(3926.5);
  const columns = nixieBank(label);
  assert.equal(label, "$3,927");
  assert.equal(textOf(columns), "$····3,927");
  const digits = columns.filter((column) => column.kind === "digit");
  assert.equal(digits.length, NIXIE_DIGIT_PLACES);
  assert.deepEqual(digits.map((column) => litDigit(column)), [null, null, null, 3, 9, 2, 7]);
  assert.equal(columns.some((column) => column.kind === "dot"), false);
  assert.match(nixie, /NIXIE_DIGITS\.map\(\(digit\)/);
  assert.match(nixie, /d=\{NIXIE_GLYPH\[digit\]\}/);
  assert.match(nixie, /digit === shown \? "is-on"/);
  assert.equal(NIXIE_DIGITS.length, 10);
  assert.equal(nixie.includes("feGaussianBlur"), false);
  assert.match(NIXIE_DOLLAR, /M12 22\.4V42\.4/);

  const full = nixieBank("$9,999,999");
  assert.equal(textOf(full), "$9,999,999");
  assert.deepEqual(
    full.filter((column) => column.kind === "digit").map((column) => litDigit(column)),
    [9, 9, 9, 9, 9, 9, 9],
  );

  const cents = nixieBank("$1,234.50");
  assert.equal(cents.some((column) => column.kind === "dot"), true);
  assert.equal(textOf(cents), "$····1,234.50");
  assert.equal(nixieColumns("$1,234.50").some((column) => column.kind === "dot"), true);
  assert.equal(textOf(nixieCentered("$3,927")), "$3,927");
  assert.equal(textOf(nixieCentered("$189")), "$189");
  assert.equal(textOf(nixieCentered("$9,999,999")), "$9,999,999");

  assert.equal(nixieTubeCount(), NIXIE_SLOT_COUNT);
  const slots = nixieSlots("$3,927", 13);
  assert.equal(slots.length, 13);
  assert.equal(textOf(slots), "···$3,927····");
  assert.equal(textOf(nixieSlots("$2", 13)), "·····$2······");
  assert.equal(nixieSlots("$9,999,999", 13).length, 13);
  assert.equal(textOf(nixieSlots("$9,999,999", 13)), "·$9,999,999··");
});

test("the scrap plate is the same width as the melt plate", () => {
  assert.match(css, /\.gear-panel \{[^}]*width:\s*calc\(100% - 1\.8rem\)/);
  assert.match(css, /\.melt-stack \{[^}]*margin:\s*0\.35rem 0\.9rem 0/);
  assert.match(css, /\.melt-plate \{[^}]*width:\s*100%/);
  for (const [viewport, width] of [
    [320, 264],
    [390, 334],
    [1440, 1011.2],
  ] as const) {
    assert.ok(
      Math.abs(nixiePlateWidth(viewport) - width) < 0.05,
      `${viewport}px scrap plate ${nixiePlateWidth(viewport)} is not the melt plate ${width}`,
    );
  }
});

test("the centered nixie fits the largest melt value", () => {
  const label = maxMeltLabel();
  assert.equal(NIXIE_SPOT_HEADROOM, 10_000);
  assert.equal(label.startsWith("$"), true);
  assert.ok(label.length >= 12);
  assert.equal(NIXIE_SLOT_COUNT, label.length + 1);
  for (const viewport of [320, 390, 1440]) {
    const glass = nixieTubeWidth(viewport);
    const face = nixieTubeHeight(viewport) * NIXIE_TUBE_ASPECT;
    assert.equal(nixieTubeCount(), 13);
    assert.ok(glass > face, `${viewport}px glass ${glass} is not wider than the digit face ${face}`);
    assert.ok(nixieGap(viewport) >= 3 && nixieGap(viewport) <= 5);
  }
  assert.equal(nixieCentered(label).length, label.length);
});

test("the bottom-plate nixie follows the same melt state as the plate", () => {
  assert.equal(machine.includes("NixieReadout centered"), false);
  assert.match(
    machine,
    /<NixieReadout spinning=\{spinning\} value=\{metal \? formatWholeDollars\(meltValue\(metal\.usdPerTroyOz, weight\.grams, pieces\)\) : "—"\} \/>/,
  );
  assert.equal((machine.match(/<NixieReadout /g) ?? []).length, 1);
  assert.match(nixie, /nixieSlots\(shownValue, NIXIE_SLOT_COUNT\)/);
  assert.match(css, /\.gear-panel-nixie \{[^}]*width:\s*100%/);
  assert.match(css, /\.gear-panel-nixie-live \{[^}]*justify-content:\s*center/);
  assert.match(css, /\.nixie-tubes\.is-centered \.nixie-tube \{[^}]*flex:\s*1 1 0/);
  assert.equal(NIXIE_HEIGHT_OVER_FONT, 2.497);
  assert.equal(NIXIE_TUBE_ASPECT, 0.238);
  assert.match(css, /\.nixie-tubes\.is-centered \{[^}]*gap:\s*clamp\(3px, 0\.35vw, 5px\)/);
  assert.match(css, /\.nixie-face \{[^}]*width:\s*calc\(var\(--nixie-h\) \* 0\.238\)/);
  assert.match(css, /@media \(max-width: 340px\) \{[^}]*\.nixie-face \{[^}]*width:\s*calc\(var\(--nixie-h\) \* 0\.205\)/);
  assert.match(css, /@media \(min-width: 900px\) \{[^}]*--nixie-h:\s*calc\(clamp\(1\.8rem, 6vw, 3rem\) \* 3\.62\)/);
  assert.match(readout, /const total = meltValue\(metal\.usdPerTroyOz, weight\.grams, pieces\)/);
  assert.match(readout, /<RollingPrice value=\{formatWholeDollars\(total\)\} \/>/);
  assert.equal(readout.includes("NixieReadout"), false);
  assert.equal(NIXIE_IGNITE_MS, 620);
  assert.equal(NIXIE_STAGGER_MS, 50);
  assert.equal(NIXIE_CYCLE_MS, 60);
  assert.equal(NIXIE_DIGIT_PLACES, 7);
  assert.deepEqual(
    [0, 1, 2, 3].map((tick) => cyclingDigit(1, tick)),
    [1, 2, 3, 4],
  );
  assert.match(nixie, /column\.order \* NIXIE_STAGGER_MS/);
  assert.match(nixie, /setInterval\(\(\) => setTick\(\(n\) => n \+ 1\), NIXIE_CYCLE_MS\)/);
  assert.match(nixie, /prefers-reduced-motion: reduce/);
  assert.match(css, /transition-delay:\s*var\(--nixie-delay\)/);
  assert.match(css, /\.nixie-cathode \{[^}]*0\.62s cubic-bezier\(0\.16, 0\.84, 0\.24, 1\)/);
  assert.match(css, /\.nixie-tube \{[^}]*--nixie-h:\s*calc\(clamp\(1\.8rem, 6vw, 3rem\) \* 2\.497\)/);
  assert.match(css, /\.nixie-plate \{[^}]*background:\s*#000/);
  assert.match(css, /\.nixie-plate \{[^}]*top:\s*-4px/);
  assert.match(css, /\.nixie-plate \{[^}]*left:\s*-8px/);
  assert.match(nixie, /className="nixie-plate"/);
  assert.match(css, /\.nixie-tubes\.is-cycling \.nixie-cathode,[\s\S]*?transition:\s*none/);
  const reduced = css.split("@media (prefers-reduced-motion: reduce)").slice(1).find((block) => block.includes(".nixie-cathode"));
  assert.match(reduced ?? "", /\.nixie-cathode,[\s\S]*?transition:\s*none/);
});
