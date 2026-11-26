import { rowMelt, type StackLine } from "@/lib/stack-board";
import { STACK_CSV_COLUMNS, stackToCsv, type StackCsvQuote } from "@/lib/stack-csv";
import { textFile, zipStored } from "@/lib/zip-store";

export type StackExportKind = "csv" | "xlsx" | "ods" | "sheets";

export type StackExport = {
  id: StackExportKind;
  label: string;
  extension: string;
  detail: string;
  filename: string;
  mime: string;
  bytes: Uint8Array;
};

const EXPORTS: readonly { id: StackExportKind; label: string; extension: string; detail: string; mime: string }[] = [
  {
    id: "csv",
    label: "CSV (.csv)",
    extension: "csv",
    detail: "One row per card, plus a total, as plain text.",
    mime: "text/csv;charset=utf-8",
  },
  {
    id: "xlsx",
    label: "Excel spreadsheet (.xlsx)",
    extension: "xlsx",
    detail: "The same rows in an Excel workbook.",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  {
    id: "ods",
    label: "OpenDocument spreadsheet (.ods)",
    extension: "ods",
    detail: "The same rows for LibreOffice and other spreadsheet apps.",
    mime: "application/vnd.oasis.opendocument.spreadsheet",
  },
  {
    id: "sheets",
    label: "Google Sheets (.xlsx, upload to Google Drive)",
    extension: "xlsx",
    detail: "An Excel file to upload to Google Drive. There is no signed-in export.",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
];

function quoteFor(quotes: readonly StackCsvQuote[], symbol: string): number | null {
  const quote = quotes.find((entry) => entry.symbol === symbol);
  return quote && Number.isFinite(quote.usdPerTroyOz) ? quote.usdPerTroyOz : null;
}

function money(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "";
  return String(Number(value.toFixed(2)));
}

/** One row per card, then a Total row. Figures stay exact. Nothing is abbreviated. */
export function stackSheetRows(lines: readonly StackLine[], quotes: readonly StackCsvQuote[]): string[][] {
  const body = lines.map((line) => {
    const spot = quoteFor(quotes, line.symbol);
    const melt = rowMelt(spot, line.grams, line.qty);
    return [
      line.mark,
      line.description,
      String(Math.round(line.qty)),
      line.weightLabel,
      String(line.grams),
      spot == null ? "" : String(spot),
      money(melt),
    ];
  });
  const quantity = lines.reduce((sum, line) => sum + Math.round(line.qty), 0);
  const meltTotal = lines.reduce((sum, line) => {
    const melt = rowMelt(quoteFor(quotes, line.symbol), line.grams, line.qty);
    return sum + (melt == null ? 0 : Math.round(melt * 100) / 100);
  }, 0);
  return [[...STACK_CSV_COLUMNS], ...body, ["Total", "", String(quantity), "", "", "", money(meltTotal)]];
}

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function sheetXml(rows: readonly (readonly string[])[]): string {
  const body = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, column) => {
          const ref = `${String.fromCharCode(65 + column)}${rowIndex + 1}`;
          const numeric = value !== "" && /^-?\d+(\.\d+)?$/.test(value);
          if (numeric) return `<c r="${ref}"><v>${value}</v></c>`;
          return `<c r="${ref}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

function workbookZip(rows: readonly (readonly string[])[]): Uint8Array {
  return zipStored([
    textFile(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
    ),
    textFile(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    ),
    textFile(
      "xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="My Stack" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    textFile(
      "xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
    ),
    textFile("xl/worksheets/sheet1.xml", sheetXml(rows)),
  ]);
}

function odsZip(rows: readonly (readonly string[])[]): Uint8Array {
  const table = rows
    .map((row) => {
      const cells = row
        .map((value) => {
          const numeric = value !== "" && /^-?\d+(\.\d+)?$/.test(value);
          if (numeric) return `<table:table-cell office:value-type="float" office:value="${value}"><text:p>${value}</text:p></table:table-cell>`;
          return `<table:table-cell office:value-type="string"><text:p>${xml(value)}</text:p></table:table-cell>`;
        })
        .join("");
      return `<table:table-row>${cells}</table:table-row>`;
    })
    .join("");
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0">
<office:body><office:spreadsheet><table:table table:name="My Stack">${table}</table:table></office:spreadsheet></office:body>
</office:document-content>`;
  return zipStored([
    textFile("mimetype", "application/vnd.oasis.opendocument.spreadsheet"),
    textFile(
      "META-INF/manifest.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
<manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/>
<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`,
    ),
    textFile("content.xml", content),
  ]);
}

function datedName(date: Date, extension: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `bull-lion-stack-${year}-${month}-${day}.${extension}`;
}

export function stackExportChoices(): readonly { id: StackExportKind; label: string; detail: string }[] {
  return EXPORTS.map(({ id, label, detail }) => ({ id, label, detail }));
}

/** A downloadable file. Sheets is the Excel workbook, meant to be uploaded. */
export function stackExport(
  kind: StackExportKind,
  lines: readonly StackLine[],
  quotes: readonly StackCsvQuote[],
  date = new Date(),
): StackExport {
  const spec = EXPORTS.find((entry) => entry.id === kind) ?? EXPORTS[0];
  if (!spec) throw new Error("missing export");
  const rows = stackSheetRows(lines, quotes);
  const bytes =
    spec.id === "csv"
      ? new TextEncoder().encode(stackToCsv(lines, quotes))
      : spec.id === "ods"
        ? odsZip(rows)
        : workbookZip(rows);
  return {
    id: spec.id,
    label: spec.label,
    extension: spec.extension,
    detail: spec.detail,
    filename: datedName(date, spec.extension),
    mime: spec.mime,
    bytes,
  };
}
