import { rowMelt, type StackLine } from "@/lib/stack-board";

/** Columns follow the card: metal, item, quantity, weight, the spot used, and the melt. */
export const STACK_CSV_COLUMNS = [
  "Metal",
  "Item",
  "Quantity",
  "Weight",
  "Grams",
  "Spot USD per troy oz",
  "Melt USD",
] as const;

export type StackCsvQuote = {
  symbol: string;
  usdPerTroyOz: number;
};

function csvField(value: string | number): string {
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

/** Plain digits so Excel and Sheets keep the cell numeric. */
function csvNumber(value: number, digits: number): string {
  if (!Number.isFinite(value)) return "";
  return String(Number(value.toFixed(digits)));
}

export function stackCsvFilename(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `bull-lion-stack-${year}-${month}-${day}.csv`;
}

function quoteFor(quotes: readonly StackCsvQuote[], symbol: string): number | null {
  const quote = quotes.find((entry) => entry.symbol === symbol);
  return quote && Number.isFinite(quote.usdPerTroyOz) ? quote.usdPerTroyOz : null;
}

/**
 * UTF-8 with a BOM and CRLF, so Excel and Google Sheets open the columns cleanly.
 * An empty stack is still a valid sheet: the header and a zero Total, and nothing else.
 */
export function stackToCsv(lines: readonly StackLine[], quotes: readonly StackCsvQuote[]): string {
  const body = lines.map((line) => {
    const spot = quoteFor(quotes, line.symbol);
    const melt = rowMelt(spot, line.grams, line.qty);
    return [
      line.mark,
      line.description,
      String(Math.round(line.qty)),
      line.weightLabel,
      csvNumber(line.grams, 7),
      spot == null ? "" : csvNumber(spot, 4),
      melt == null ? "" : String(Math.round(melt)),
    ];
  });
  const quantity = lines.reduce((sum, line) => sum + Math.round(line.qty), 0);
  const meltTotal = lines.reduce((sum, line) => {
    const spot = quoteFor(quotes, line.symbol);
    const melt = rowMelt(spot, line.grams, line.qty);
    return sum + (melt == null ? 0 : Math.round(melt));
  }, 0);
  const total = ["Total", "", String(quantity), "", "", "", String(meltTotal)];
  const rows = [STACK_CSV_COLUMNS, ...body, total].map((row) => row.map(csvField).join(","));
  return `\uFEFF${rows.join("\r\n")}\r\n`;
}
