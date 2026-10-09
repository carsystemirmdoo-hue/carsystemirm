import { createHash } from "node:crypto";
import { getDocumentProxy } from "unpdf";
import { parseStockPriceReport, StockReportFormatError } from "./stockPriceReport.mjs";

/**
 * PDF → pozicionirani tekst po strani → `parseStockPriceReport`.
 *
 * `unpdf` radi lokalno, bez mreže. Fajl se ne čuva ovde; vraća se i SHA-256
 * sadržaja, po kome se isto otpremanje prepoznaje i ne pravi duplikat.
 */
export const MAX_REPORT_BYTES = 15 * 1024 * 1024;
export const MAX_REPORT_PAGES = 400;

/** @param {Uint8Array} bytes */
export async function readStockPriceReport(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) throw new StockReportFormatError("prazan", "Fajl je prazan.");
  if (bytes.byteLength > MAX_REPORT_BYTES) throw new StockReportFormatError("prevelik", `Fajl je veći od ${MAX_REPORT_BYTES / 1024 / 1024} MB.`);
  if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") throw new StockReportFormatError("nije_pdf", "Fajl nije PDF.");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  let pdf;
  try {
    // Kopija: pdf.js preuzima (detach) bafer koji dobije.
    pdf = await getDocumentProxy(new Uint8Array(bytes));
  } catch {
    throw new StockReportFormatError("nije_pdf", "PDF nije moguće pročitati (oštećen ili zaštićen lozinkom).");
  }
  if (pdf.numPages > MAX_REPORT_PAGES) throw new StockReportFormatError("prevelik", `PDF ima ${pdf.numPages} strana (najviše ${MAX_REPORT_PAGES}).`);
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n += 1) {
    const content = await (await pdf.getPage(n)).getTextContent();
    const items = [];
    for (const raw of content.items) {
      const c = /** @type {{ str?: unknown, transform?: unknown, width?: unknown }} */ (raw);
      if (typeof c.str !== "string" || !Array.isArray(c.transform) || typeof c.width !== "number") continue;
      items.push({ str: c.str, x: c.transform[4], y: c.transform[5], w: c.width });
    }
    pages.push({ items });
  }
  return { sha256, bytes: bytes.byteLength, ...parseStockPriceReport(pages) };
}
