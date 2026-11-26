import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { METAL_CATALOG } from "@/lib/metals";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const readout = readFileSync(new URL("../components/readout.tsx", import.meta.url), "utf8");

/** Letter-spacing that pulls each Rye 30px name toward one ink width. */
const TRACK_EM: Record<string, number> = {
  Gold: 0.12,
  Silver: 0.12,
  Copper: 0.12,
  Platinum: 0.02,
  Palladium: -0.02,
};

function trackBlock(name: string) {
  const marker = `data-metal="${name}"`;
  const at = css.indexOf(marker);
  assert.ok(at >= 0, name);
  return css.slice(at, css.indexOf("}", at));
}

test("every melt title has a letter-spacing inside the subtle range", () => {
  assert.match(readout, /data-metal=\{metal\.name\}/);
  assert.match(css, /\.melt-plate \.plate-title \{[^}]*letter-spacing:\s*var\(--title-track\)/);
  assert.match(css, /\.melt-plate \.plate-title \{[^}]*padding-left:\s*max\(0em, var\(--title-track\)\)/);
  assert.match(
    css,
    /\.melt-plate \.plate-title \{[^}]*padding-right:\s*max\(0em, calc\(-1 \* var\(--title-track\)\)\)/,
  );
  assert.match(css, /\.melt-plate \.plate-title \{[^}]*font-size:\s*30px/);
  assert.equal(css.includes("scaleX"), false);
  assert.match(css, /\.split-stack-title \{[^}]*letter-spacing:\s*0\.03em/);
  assert.match(css, /\.split-stack-title \{[^}]*font-size:\s*30px/);

  for (const metal of METAL_CATALOG) {
    const em = TRACK_EM[metal.name];
    assert.equal(typeof em, "number", metal.name);
    assert.ok(em >= -0.02 && em <= 0.12, `${metal.name} ${em}`);
    const block = trackBlock(metal.name);
    const written = em < 0 ? `${em}em` : `${em}em`;
    assert.match(block, new RegExp(`--title-track:\\s*${written.replace(".", "\\.")}`));
  }
});
