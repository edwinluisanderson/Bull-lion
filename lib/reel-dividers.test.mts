import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { DIVIDER_BRIGHT, DIVIDER_DIM, dividerLevels } from "@/lib/reel-dividers";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("both dividers rest just under the old lit brightness", () => {
  const still = dividerLevels([false, false, false]);
  assert.equal(still.left, DIVIDER_DIM);
  assert.equal(still.right, DIVIDER_DIM);
  assert.ok(DIVIDER_DIM < DIVIDER_BRIGHT);
  assert.ok(DIVIDER_BRIGHT - DIVIDER_DIM <= 0.1);
  assert.equal(DIVIDER_BRIGHT, 0.35);
});

test("a moving reel lights only the dividers beside it", () => {
  assert.deepEqual(dividerLevels([true, false, false]), { left: DIVIDER_BRIGHT, right: DIVIDER_DIM });
  assert.deepEqual(dividerLevels([false, false, true]), { left: DIVIDER_DIM, right: DIVIDER_BRIGHT });
  assert.deepEqual(dividerLevels([false, true, false]), { left: DIVIDER_BRIGHT, right: DIVIDER_BRIGHT });
  assert.deepEqual(dividerLevels([true, false, true]), { left: DIVIDER_BRIGHT, right: DIVIDER_BRIGHT });
  assert.ok(dividerLevels([true, true, true]).left <= DIVIDER_BRIGHT);
  assert.ok(dividerLevels([true, true, true]).right <= DIVIDER_BRIGHT);
  assert.match(css, new RegExp(`opacity:\\s*${DIVIDER_DIM}`));
  assert.match(css, new RegExp(`opacity:\\s*${DIVIDER_BRIGHT}`));
  const seam = css.match(/\.reel-column \+ \.reel-column::after\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(seam, /top:\s*var\(--reel-name\)/);
  assert.match(seam, /height:\s*var\(--reel-window\)/);
  assert.match(seam, /width:\s*1px/);
  assert.match(seam, /background:\s*#c6a15a/);
  assert.equal(seam.includes("clip-path"), false);
  assert.equal(seam.includes("linear-gradient"), false);
});
