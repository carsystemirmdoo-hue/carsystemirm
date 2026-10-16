/**
 * Otpremljen fajl lagera → pročitan izveštaj (dok. 65). Format se prepoznaje po
 * SADRŽAJU (XLSX je ZIP: „PK"), ne po ekstenziji. Originalni fajl se nigde ne čuva —
 * samo SHA-256, veličina i pročitane stavke (šifra, naziv, količina).
 */

import { createHash } from "node:crypto";
import { readXlsxCells, XlsxReadError } from "../import/xlsx/readXlsx.mjs";
import { CsvReadError, readCsvGrid } from "./csvGrid.mjs";
import { parseStockReport, STOCK_REPORT_PARSER } from "./stockReport.mjs";
import { MAX_PDF_PAGES, parseStockPdf, STOCK_PDF_PARSER } from "./stockReportPdf.mjs";

export const MAX_STOCK_FILE_BYTES = 4 * 1024 * 1024;

/**
 * @param {Uint8Array} bytes
 * @returns {{ sha256: string, bytes: number, format: "xlsx" | "csv" | "pdf", sheet: string | null, report: ReturnType<typeof parseStockReport> }}
 */
export function readStockFile(bytes) {
  const buf = Buffer.from(bytes);
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const base = { sha256, bytes: buf.length };
  const fail = (format, code, detail) => ({
    ...base,
    format,
    sheet: null,
    report: { ...parseStockReport([]), ok: false, errors: [{ code, detail }], warnings: [], parser: STOCK_REPORT_PARSER },
  });
  if (buf.length === 0) return fail("csv", "prazan_fajl");
  if (buf.length > MAX_STOCK_FILE_BYTES) return fail("csv", "fajl_prevelik");

  if (buf[0] === 0x50 && buf[1] === 0x4b) {
    let sheets;
    try {
      sheets = readXlsxCells(buf);
    } catch (error) {
      if (error instanceof XlsxReadError) return fail("xlsx", "xlsx_neispravan", error.message);
      throw error;
    }
    // Izveštaj je na jednom listu (u primeru „Page1"); bira se list sa zaglavljem „STANJE ZALIHA".
    const candidates = sheets.map((s) => ({ s, r: parseStockReport(s.rows) })).filter((x) => !x.r.errors.some((e) => e.code === "nije_stanje_zaliha"));
    if (candidates.length === 0) return fail("xlsx", "nije_stanje_zaliha");
    if (candidates.length > 1) return fail("xlsx", "vise_listova_sa_izvestajem", candidates.map((c) => c.s.name).join(", "));
    return { ...base, format: "xlsx", sheet: candidates[0].s.name, report: candidates[0].r };
  }

  let grid;
  try {
    grid = readCsvGrid(buf);
  } catch (error) {
    if (error instanceof CsvReadError) return fail("csv", "csv_neispravan", error.message);
    throw error;
  }
  return { ...base, format: "csv", sheet: null, report: parseStockReport(grid.rows) };
}

/** PDF počinje sa `%PDF-` (tačno na početku; prepoznaje se po sadržaju, ne po ekstenziji). */
export const isPdf = (buf) => buf.length >= 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-";

/**
 * Isto kao `readStockFile`, uz PDF (tekstualni sloj, `unpdf` lokalno — bez mreže i bez OCR-a).
 * PDF bez teksta ili sa drugim rasporedom se odbija; original se ne čuva.
 * @param {Uint8Array} bytes
 */
export async function readStockFileAsync(bytes) {
  const buf = Buffer.from(bytes);
  if (!isPdf(buf) || buf.length > MAX_STOCK_FILE_BYTES) return readStockFile(bytes);
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const base = { sha256, bytes: buf.length, format: /** @type {const} */ ("pdf"), sheet: null };
  let doc;
  try {
    const { getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    if (pdf.numPages > MAX_PDF_PAGES) {
      return { ...base, report: { ...parseStockReport([]), ok: false, errors: [{ code: "pdf_previse_strana", detail: String(pdf.numPages) }], warnings: [], parser: STOCK_PDF_PARSER } };
    }
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const content = await (await pdf.getPage(n)).getTextContent();
      pages.push(
        content.items
          .filter((i) => typeof i.str === "string" && Array.isArray(i.transform))
          .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: typeof i.width === "number" ? i.width : 0 })),
      );
    }
    doc = { numPages: pdf.numPages, pages };
  } catch (error) {
    return { ...base, report: { ...parseStockReport([]), ok: false, errors: [{ code: "pdf_neispravan", detail: String(error?.name ?? "") }], warnings: [], parser: STOCK_PDF_PARSER } };
  }
  return { ...base, report: parseStockPdf(doc) };
}
