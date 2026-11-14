import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readout = readFileSync(new URL("../components/readout.tsx", import.meta.url), "utf8");
const machine = readFileSync(new URL("../components/slot-machine.tsx", import.meta.url), "utf8");

test("the live wire sits under the stack line inside the melt plate", () => {
  const stack = readout.indexOf('className="tagline"');
  const wire = readout.indexOf('data-testid="price-source"');
  assert.ok(stack > 0);
  assert.ok(wire > stack);
  assert.match(readout, /className=\{[\s\S]*"lamp"/);
  assert.equal(machine.includes('data-testid="price-source"'), false);
  assert.equal(machine.includes('className="lamp"'), false);
});
