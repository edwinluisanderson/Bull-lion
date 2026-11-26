import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { abbreviateMelt, MELT_FLAP_COLUMNS } from "@/lib/melt-abbrev";
import { FLAP_MELT } from "@/lib/split-flap";
import { formatTotalAmount } from "@/lib/stack-total";

const table = readFileSync(new URL("../components/stack-table.tsx", import.meta.url), "utf8");

test("a melt that fits seven flaps stays whole", () => {
  assert.equal(MELT_FLAP_COLUMNS, FLAP_MELT);
  assert.equal(abbreviateMelt(null), "-");
  assert.equal(abbreviateMelt(0), "$0");
  assert.equal(abbreviateMelt(8000), "$8,000");
  assert.equal(abbreviateMelt(99999), "$99,999");
  assert.equal(abbreviateMelt(99999.4), "$99,999");
  assert.equal([...abbreviateMelt(99999)].length <= FLAP_MELT, true);
});

test("large melts abbreviate and round onto the next suffix at the boundary", () => {
  assert.equal(abbreviateMelt(100000), "$100.0K");
  assert.equal(abbreviateMelt(123456.78), "$123.5K");
  assert.equal(abbreviateMelt(123449), "$123.4K");
  assert.equal(abbreviateMelt(999949), "$999.9K");
  assert.equal(abbreviateMelt(999950), "$1.0M");
  assert.equal(abbreviateMelt(999949.5), "$1.0M");
  assert.notEqual(abbreviateMelt(999950), "$1000.0K");
  assert.notEqual(abbreviateMelt(999950), "$999.9K");
  assert.equal(abbreviateMelt(9999999.99), "$10.0M");
  assert.equal(abbreviateMelt(1000000), "$1.0M");
  assert.equal(abbreviateMelt(1234567), "$1.2M");
  assert.equal(abbreviateMelt(999950000), "$1.0B");
  assert.notEqual(abbreviateMelt(999950000), "$1000.0M");
  for (const value of [100000, 123456.78, 999950, 9999999.99, 999950000]) {
    assert.equal([...abbreviateMelt(value)].length <= FLAP_MELT, true);
  }
});

test("the card row abbreviates and the total board keeps the full amount", () => {
  assert.match(table, /cardMoneyRow\(line\.qty, rowMelt\(/);
  assert.match(table, /cardMoneyRow\(line\.qty, melt\)/);
  assert.match(table, /formatTotalAmount\(/);
  assert.equal(formatTotalAmount(9999999.99), "$10,000,000");
  assert.equal(abbreviateMelt(9999999.99), "$10.0M");
  assert.notEqual(formatTotalAmount(123456.78), abbreviateMelt(123456.78));
});
