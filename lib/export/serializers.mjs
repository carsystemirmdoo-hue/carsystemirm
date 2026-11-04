/**
 * Serijalizacija izveštaja u CSV, XLSX i PDF.
 *
 * Bez spoljnih biblioteka: XLSX se piše kao pravi Office Open XML (`xlsx.mjs`,
 * ZIP iz `node:zlib`), a PDF kao jednostavan dokument. Time izvoz ne uvodi
 * nijednu novu zavisnost ni trošak (vidi COST_CONTROL.md).
 *
 * Svaki izvoz nosi zaglavlje sa vremenom nastanka i primenjenim filterima —
 * bez toga se kasnije ne zna nad čim je izveštaj napravljen.
 *
 * Tabelarni izlazi (CSV i XLSX) prolaze kroz `guardSpreadsheetValue`
 * pre serijalizacije — vidi `lib/export/spreadsheet-safety.mjs` za razlog.
 */

import { guardSpreadsheetValue } from "./spreadsheet-safety.mjs";
import { buildXlsx } from "./xlsx.mjs";

/**
 * @typedef {object} ReportMeta
 * @property {string} title
 * @property {string} generatedAt
 * @property {string} generatedBy
 * @property {{ label: string, value: string }[]} filters
 * @property {string} [note]
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function cell(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}


/**
 * CSV sa `;` razdvajačem — Excel na srpskom podrazumevano tako čita.
 *
 * @param {string[]} columns
 * @param {unknown[][]} rows
 * @param {ReportMeta} meta
 */
export function toCsv(columns, rows, meta) {
  // Redosled je bitan: prvo neutralizacija formule, pa tek onda navođenje.
  // Obrnuto ne pomaže — Excel prvo raščlani CSV pa tek onda čita `=` u ćeliji,
  // pa navodnici ne zaustavljaju ništa.
  const quote = (value) => {
    // Uz `;` razdvajač srpski Excel očekuje i decimalni zarez; sa tačkom bi
    // „3777829.36“ pročitao kao tekst (ili datum), pa zbir u Excelu ne radi.
    if (typeof value === "number" && Number.isFinite(value)) return String(value).replace(".", ",");
    const text = cell(guardSpreadsheetValue(value));
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const head = [
    `# ${meta.title}`,
    `# Izvezeno: ${meta.generatedAt}`,
    `# Izvezao: ${meta.generatedBy}`,
    ...meta.filters.map((f) => `# ${f.label}: ${f.value}`),
  ];
  if (meta.note) head.push(`# ${meta.note}`);

  return [
    ...head,
    "",
    columns.map(quote).join(";"),
    ...rows.map((row) => row.map(quote).join(";")),
  ].join("\r\n");
}

/**
 * Pravi .xlsx (Office Open XML) — vidi `xlsx.mjs`.
 *
 * Tip ćelije se određuje isključivo ovde: broj ostaje broj, sve ostalo je
 * tekst (`inlineStr`). Pisač nigde ne emituje `<f>`, pa string ćelija
 * strukturno ne može postati formula — to je prva, jača garancija.
 *
 * Druga je `guardSpreadsheetValue`: štiti od onoga što se dešava POSLE —
 * kada neko otvori izveštaj i sačuva ga kao CSV, ili kopira ćelije u drugu
 * svesku, gde tip ćelije više ne postoji.
 *
 * @param {string[]} columns
 * @param {unknown[][]} rows
 * @param {ReportMeta} meta
 * @returns {Uint8Array}
 */
export function toXlsx(columns, rows, meta) {
  const metaRows = [
    [meta.title],
    ["Izvezeno", meta.generatedAt],
    ["Izvezao", meta.generatedBy],
    ...meta.filters.map((f) => [f.label, f.value]),
  ];
  if (meta.note) metaRows.push([meta.note]);
  metaRows.push([]);

  const toCells = (values, bold = false) =>
    values.map((raw) => {
      const value = guardSpreadsheetValue(raw);
      const isNumber = typeof value === "number" && Number.isFinite(value);
      return { value: isNumber ? value : cell(value), bold };
    });

  return buildXlsx(
    [
      ...metaRows.map((row, index) => toCells(row, index === 0)),
      toCells(columns, true),
      ...rows.map((row) => toCells(row)),
    ],
    { widths: columns.map((_, index) => (index === 0 ? 40 : 16)) },
  );
}

/**
 * Minimalan PDF (jedna ili više strana, monospace font).
 *
 * @param {string[]} columns
 * @param {unknown[][]} rows
 * @param {ReportMeta} meta
 */
export function toPdf(columns, rows, meta) {
  const widths = columns.map((column, index) =>
    Math.min(
      28,
      Math.max(
        column.length,
        ...rows.slice(0, 400).map((row) => cell(row[index]).length),
      ),
    ),
  );
  const line = (values) =>
    values
      .map((value, index) => cell(value).slice(0, widths[index]).padEnd(widths[index]))
      .join(" ");

  const header = [
    meta.title,
    `Izvezeno: ${meta.generatedAt}   Izvezao: ${meta.generatedBy}`,
    ...meta.filters.map((f) => `${f.label}: ${f.value}`),
  ];
  if (meta.note) header.push(meta.note);

  const body = [
    ...header,
    "",
    line(columns),
    "-".repeat(Math.min(180, widths.reduce((a, b) => a + b + 1, 0))),
    ...rows.map((row) => line(row)),
  ];

  const ROWS_PER_PAGE = 46;
  const pages = [];
  for (let index = 0; index < body.length; index += ROWS_PER_PAGE) {
    pages.push(body.slice(index, index + ROWS_PER_PAGE));
  }
  if (pages.length === 0) pages.push(header);

  const objects = [];
  const pageIds = pages.map((_, index) => 4 + index * 2);

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  );
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>");

  pages.forEach((page, index) => {
    const content = `BT /F1 8 Tf 12 TL 28 812 Td\n${page
      .map((text) => `(${pdfEscape(text)}) Tj T*`)
      .join("\n")}\nET`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Rotate 0 /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageIds[index] + 1} 0 R >>`,
    );
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return pdf;
}

function pdfEscape(value) {
  // Courier je Latin-1; slova van tog opsega se prenose bez dijakritike da bi
  // dokument ostao čitljiv umesto da prikaže smeće.
  return cell(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[\\()]/g, (match) => `\\${match}`)
    .replace(/[^\x20-\x7e]/g, "?");
}

export const EXPORT_FORMATS = {
  csv: { extension: "csv", mime: "text/csv; charset=utf-8", render: toCsv },
  xlsx: {
    extension: "xlsx",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    render: toXlsx,
  },
  pdf: { extension: "pdf", mime: "application/pdf", render: toPdf },
};
