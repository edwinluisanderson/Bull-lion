import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, selector);
  return match[1];
}

test("the selection triangles are 10px and mirrored behind the frame", () => {
  const payline = rule(".payline");
  const marks = rule(".payline::before,\n.payline::after");
  const stage = rule(".reel-stage");
  assert.match(marks, /border:\s*10px solid transparent/);
  assert.match(css, /\.payline::before \{\n\s*left: 0;/);
  assert.match(css, /\.payline::after \{\n\s*right: 0;/);
  assert.match(css, /\.payline::before \{[^}]*border-left-color/);
  assert.match(css, /\.payline::after \{[^}]*border-right-color/);
  assert.equal(payline.match(/z-index:\s*(\d+)/)?.[1], "3");
  assert.match(payline, /left:\s*2px/);
  assert.match(payline, /right:\s*2px/);
  assert.match(stage, /overflow:\s*hidden/);
});
