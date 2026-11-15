import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function block(selector: string) {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, selector);
  return css.slice(start, css.indexOf("}", start));
}

test("the melt plate uses the wheels plate's middle brass band", () => {
  const plate = css.match(/--brass-plate:\s*([^;]+);/)?.[1] ?? "";
  assert.equal(
    plate,
    "linear-gradient(180deg, #f3e2ad 0%, #c4963e 28%, #7a5a22 62%, #e6cb82 100%)",
  );
  assert.match(block(".window-frame"), /background:\s*var\(--brass-plate\)/);
  const nameplate = block(".nameplate");
  assert.match(nameplate, /background:\s*var\(--brass-plate\)/);
  assert.doesNotMatch(nameplate, /#6e5318|#d7b15e|rgba\(255, 255, 255, 0\.28\)/);
});
