import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { STACK_CSV_COLUMNS, stackCsvFilename, stackToCsv } from "@/lib/stack-csv";
import { TROY_OUNCE_GRAMS } from "@/lib/value";
import type { StackLine } from "@/lib/stack-board";

const table = readFileSync(new URL("../components/stack-table.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

const gold: StackLine = {
  id: "a",
  symbol: "XAU",
  mark: "Au",
  weightLabel: "1 oz",
  grams: TROY_OUNCE_GRAMS,
  qty: 2,
  description: 'Gold "maple", 1 oz',
};

test("the filename is the local calendar day", () => {
  assert.equal(stackCsvFilename(new Date(2026, 10, 18)), "bull-lion-stack-2026-11-18.csv");
  assert.equal(stackCsvFilename(new Date(2026, 0, 5)), "bull-lion-stack-2026-01-05.csv");
});

test("a stack row quotes commas and quotes, and the numbers stay plain", () => {
  const csv = stackToCsv([gold], [{ symbol: "XAU", usdPerTroyOz: 3760.5 }]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.endsWith("\r\n"));
  const rows = csv.slice(1).trim().split("\r\n");
  assert.deepEqual(rows[0].split(","), [...STACK_CSV_COLUMNS]);
  assert.equal(rows[1], 'Au,"Gold ""maple"", 1 oz",2,1 oz,31.1034768,3760.5,7521');
  assert.equal(rows[2], "Total,,2,,,,7521");
  assert.equal(rows[1].includes("$"), false);
});

test("spot dust rounds to four decimals and grams keep the troy ounce", () => {
  const silver: StackLine = {
    id: "s",
    symbol: "XAG",
    mark: "Ag",
    weightLabel: "10 oz",
    grams: TROY_OUNCE_GRAMS * 10,
    qty: 1,
    description: "Silver 10 oz",
  };
  const csv = stackToCsv([silver], [{ symbol: "XAG", usdPerTroyOz: 45.825001 }]);
  const row = csv.slice(1).trim().split("\r\n")[1];
  assert.equal(row, "Ag,Silver 10 oz,1,10 oz,311.034768,45.825,458.25");
});

test("a missing spot leaves the melt blank and the Total skips it", () => {
  const csv = stackToCsv([gold], []);
  const rows = csv.slice(1).trim().split("\r\n");
  assert.equal(rows[1], 'Au,"Gold ""maple"", 1 oz",2,1 oz,31.1034768,,');
  assert.equal(rows[2], "Total,,2,,,,0");
});

test("an empty stack is a header and a zero Total, and the button stays disabled", () => {
  const csv = stackToCsv([], []);
  const rows = csv.slice(1).trim().split("\r\n");
  assert.deepEqual(rows, [[...STACK_CSV_COLUMNS].join(","), "Total,,0,,,,0"]);
  assert.match(table, /aria-label="Download My Stack"/);
  assert.match(table, /id="stack-gem"/);
  assert.equal(table.includes('stroke="#40e0d0"'), false);
  assert.match(table, /disabled=\{downloadLines\.length === 0\}/);
  assert.match(css, /\.stack-download \{[^}]*width:\s*44px/);
  assert.match(css, /\.stack-download svg \{[^}]*width:\s*44px/);
  assert.match(css, /\.stack-download:disabled \{[^}]*opacity:\s*0\.4/);
  assert.match(table, /stackCsvFilename\(new Date\(\)\)/);
});
