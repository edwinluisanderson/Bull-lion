import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  foldMetalNamePosition,
  metalNameAt,
  nextMetalNamePosition,
} from "@/lib/metal-name-wheel";
import { METAL_CATALOG } from "@/lib/metals";

const names = METAL_CATALOG.map((metal) => metal.name);
const count = names.length;
const readout = readFileSync(new URL("../components/readout.tsx", import.meta.url), "utf8");
const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");
const wheel = readFileSync(new URL("../components/metal-name-wheel.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("each metal selection settles on that metal's name", () => {
  assert.deepEqual(names, ["Gold", "Silver", "Platinum", "Palladium", "Copper"]);
  names.forEach((name, index) => {
    const settled = nextMetalNamePosition(0, index, count);
    assert.equal(metalNameAt(settled, names), name);
    assert.equal(metalNameAt(foldMetalNamePosition(settled, count), names), name);
  });
});

test("the drum follows the reel forward, including the wrap from copper back to gold", () => {
  let position = 0;
  for (const index of [1, 2, 3, 4, 0, 1]) {
    position = nextMetalNamePosition(position, index, count);
    assert.equal(metalNameAt(position, names), names[index]);
  }
  assert.equal(position, 6);
  assert.equal(foldMetalNamePosition(position, count), 1);
  assert.equal(metalNameAt(foldMetalNamePosition(position, count), names), "Silver");
});

test("a backward step from gold rolls onto copper", () => {
  const position = nextMetalNamePosition(0, count - 1, count);
  assert.equal(position, -1);
  assert.equal(metalNameAt(position, names), "Copper");
  assert.equal(metalNameAt(foldMetalNamePosition(position, count), names), "Copper");
});

test("the melt plate wheel lists every metal in reel order and names the selection", () => {
  assert.match(readout, /<MetalNameWheel metals=\{metals\} index=\{index\} \/>/);
  assert.match(machine, /metals=\{book\.metals\}/);
  assert.match(wheel, /nextMetalNamePosition\(current, safeIndex, count\)/);
  assert.match(wheel, /data-testid="metal-name-wheel"/);
  assert.match(wheel, /data-metal=\{name\}/);
  assert.match(wheel, /aria-label=\{name\}/);
  assert.match(wheel, /metals\.map\(\(metal\) =>/);
  const heading = readout.slice(readout.indexOf('className="melt-heading"'), readout.indexOf("melt-digits"));
  assert.match(heading, /<MetalNameWheel /);
  assert.match(heading, /Melt Price/);
  assert.equal(heading.includes("plate-title"), false);
});

test("the name drum is bare brass under glass and rests under reduced motion", () => {
  const rule = css.match(/\.metal-name-wheel \{[^}]*\}/)?.[0] ?? "";
  assert.match(rule, /overflow:\s*hidden/);
  assert.match(rule, /--metal-name-row:\s*2\.35rem/);
  assert.match(rule, /background:\s*linear-gradient\(180deg/);
  assert.equal(rule.includes("border"), false);
  assert.match(css, /\.metal-name-drum \{[^}]*display:\s*flex/);
  assert.match(css, /\.metal-name-glass \{[^}]*pointer-events:\s*none/);
  assert.match(css, /\.metal-name-face \{[^}]*font-family:\s*var\(--font-display\), Palatino, serif/);
  assert.match(css, /\.metal-name-wheel\.is-animated \.metal-name-drum \{[^}]*cubic-bezier\(0\.18, 0\.7, 0\.22, 1\)/);
  const reduced = css.split("@media (prefers-reduced-motion: reduce)").slice(1).join("\n");
  assert.match(reduced, /\.metal-name-drum \{[^}]*transition:\s*none/);
});
