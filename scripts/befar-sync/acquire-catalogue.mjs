#!/usr/bin/env node
/**
 * BEFAR sync, korak 2 — RAW dataset zvaničnog digitalnog kataloga.
 *
 * Adresa kataloga se ne upisuje u kod: uzima se iz RAW dataseta sajta (svaki
 * `_files/ugd/*.pdf` link sa zvaničnih stranica; trenutno ga nosi stranica
 * „Digital Catalog”). Format je PDF (Wix `ugd` dokument).
 *
 * Gramatika (pypdf, običan tekst):
 *   „COLOUR CODE DIMENSION (mm) BOX QUANTITY” / „PRODUCT CODE DIMENSION BOX QUANTITY”
 *   „<oznaka> <šifra> <dimenzija> [kom. u kutiji]”; oznaka ume da izostane
 *   (red nasleđuje oznaku prethodnog reda iste tabele) ili da se prelomi iznad reda.
 *
 * Katalog je dizajnerski PDF: naslovi porodica nisu vezani za tabele redosledom
 * teksta, pa se NE pogađa kojoj tabeli pripada koji naslov. Svaki red nosi
 * naslove SVOJE strane (`pageHeadings`); spajanje sa sajtom ide isključivo po šifri.
 *
 * Izlaz: data/befar-sync/raw/catalogue.generated.json
 */

import { statSync } from "node:fs";
import path from "node:path";

import { cachedFetch, readJson, sha256, writeJson } from "../carsystem-sync/lib/http.mjs";
import { extractPdfBatch, normaliseText } from "../lib/rm-pdf-text.mjs";
import { CATALOGUE, PATHS, PDF_CACHE_DIR, WEBSITE } from "./lib/config.mjs";

const refresh = process.argv.includes("--refresh");
const website = readJson(PATHS.rawWebsite);
if (!website) throw new Error("Nedostaje RAW dataset sajta — prvo acquire-website.");

const links = website.meta.cataloguePdfLinks;
if (!links.length) throw new Error("Na zvaničnom sajtu nije nađen nijedan link ka digitalnom katalogu (PDF).");
const pdfUrl = `${WEBSITE.en.origin}/${links[0]}`;
const pdfPath = path.join(PDF_CACHE_DIR, path.basename(links[0]));
const { body } = await cachedFetch(pdfUrl, pdfPath, { refresh });
const downloadedAt = statSync(pdfPath).mtime.toISOString();

const [extraction] = extractPdfBatch([pdfPath]);
if (!extraction.ok) throw new Error(`PDF nije pročitan: ${extraction.error}`);

/** Šifra u katalogu; štamparska greška „O8401” (slovo O umesto nule) se svodi i beleži. */
const CODE_TOKEN = /^[O0-9]\d{4,5}[A-Z]{0,4}$/;
// Zaglavlja: „COLOUR CODE DIMENSION (mm) BOX QUANTITY”, „COLOUR CODE BOX QUANTITY”, „CODE ML DIMENSION BOX QUANTITY”.
const TABLE_HEADER = /^(?:(COLOU?R|PRODUCT|TYPE)\s+)?CODE\s+(?:ML\s+)?(?:DIMENSION|BOX QUANTITY)/i;
const UNIT = /(mm|cm|gr|g|ml|lt|m²|m2|m|pcs|pieces|standart|standard|\d)\.?$/i;
const NOISE = /^(www\.|\d{1,2}$|hardness level|\*|use with|soft \(|colou?r code|product code)/i;

const rows = [];
const pages = [];
extraction.pages.forEach((pageText, pageIndex) => {
  const lines = normaliseText(pageText).split("\n").map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const headings = [];
  // Legenda tvrdoće („WHITE:* * *”) i preporuke („APPLY WITH”) štampane na strani sunđera.
  const hardness = [];
  const applyWith = [];
  let column = null;
  let hasDimensionColumn = true;
  let lastLabel = null;
  let pendingLabel = [];
  let rowsOnPage = 0;

  for (const line of lines) {
    const header = TABLE_HEADER.exec(line);
    if (header) {
      hasDimensionColumn = /DIMENSION/i.test(line);
      column = (header[1] ?? "label").toLowerCase().replace("colour", "colour").replace("color", "colour");
      lastLabel = null;
      pendingLabel = [];
      continue;
    }
    const tokens = line.split(" ");
    const codeIndex = tokens.findIndex((token) => CODE_TOKEN.test(token) && /\d{4}/.test(token));
    const looksLikeRow = column && codeIndex >= 0 && codeIndex <= 4 && !/^\d+ ?x ?\d+/.test(tokens.slice(codeIndex).join(" "));
    if (looksLikeRow) {
      // „55407 ADV” — sufiks serije odvojen razmakom u štampi; pripada šifri (na sajtu: 55407ADV).
      if (/^(ADV|ORB|SND)$/.test(tokens[codeIndex + 1] ?? "")) tokens.splice(codeIndex, 2, `${tokens[codeIndex]}${tokens[codeIndex + 1]}`);
      const rawCode = tokens[codeIndex];
      const code = rawCode.replace(/^O/, "0");
      const inlineLabel = tokens.slice(0, codeIndex).join(" ");
      const label = [...pendingLabel, inlineLabel].filter(Boolean).join(" ") || lastLabel;
      let rest = tokens.slice(codeIndex + 1).join(" ");
      let boxQuantity = null;
      const quantity = /^(.*\S)\s+(\d{1,4})$/.exec(rest);
      if (quantity && UNIT.test(quantity[1])) {
        rest = quantity[1];
        boxQuantity = Number(quantity[2]);
      } else if (/^\d{1,4}$/.test(rest) && !hasDimensionColumn) {
        // Tabela bez kolone dimenzije („COLOUR CODE BOX QUANTITY”): jedini broj je količina u kutiji.
        boxQuantity = Number(rest);
        rest = "";
      }
      rows.push({ code, rawCode: rawCode === code ? null : rawCode, pdfPage: pageIndex + 1, column, label: label || null, dimension: rest || null, boxQuantity, rawLine: line });
      lastLabel = label || lastLabel;
      pendingLabel = [];
      rowsOnPage += 1;
      continue;
    }
    const legend = /^([A-Z]+)\s?:\s?((?:\*\s?)+)$/.exec(line);
    if (legend) {
      hardness.push({ colour: legend[1], stars: (legend[2].match(/\*/g) ?? []).length });
      continue;
    }
    if (/^(LIQUID|POLISH|CREAM|WAX|PAINT)\b.*\b(COMPOUND|PROTECTOR|POLISH|WAX)\b/i.test(line) && hardness.length && !column) {
      applyWith.push(line.replace(/\b0R\b/g, "OR"));
      continue;
    }
    if (NOISE.test(line)) continue;
    // Kratka linija velikim slovima neposredno iznad reda = prelomljena oznaka („LIQUID” / „COMPOUND”).
    if (column && /^[A-ZİĞÜŞÖÇ0-9 &+./-]{2,24}$/.test(line) && !/GR$|MM$/.test(line)) pendingLabel.push(line);
    if (/^[A-ZİĞÜŞÖÇ0-9 &+./'’-]{3,60}$/.test(line)) headings.push(line);
  }
  pages.push({
    pdfPage: pageIndex + 1,
    rows: rowsOnPage,
    // Sav ostali zvanični tekst strane (napomene „USE WITH…”, sadržaj setova): jedini opisni tekst koji Befar objavljuje.
    pageText: lines.filter((line) => !TABLE_HEADER.test(line) && !/^www\./i.test(line) && !/^\d{1,2}$/.test(line) && !/^[A-Z]+\s?:\s?(\*\s?)+$/.test(line) && !rows.some((row) => row.pdfPage === pageIndex + 1 && row.rawLine === line)),
    headings: [...new Set(headings)].slice(0, 24),
    // Preporuka se vezuje za boju po REDOSLEDU samo kada je broj linija isti; inače ostaje nevezana.
    hardnessLegend: hardness.map((entry, index) => ({ ...entry, applyWith: applyWith.length === hardness.length ? applyWith[index] : null })),
  });
});

const headingsByPage = new Map(pages.map((page) => [page.pdfPage, page.headings]));
for (const row of rows) row.pageHeadings = headingsByPage.get(row.pdfPage) ?? [];

/* -- Kontrola parsera -------------------------------------------------------------------- */

const tokensInPdf = new Set(extraction.pages.flatMap((page) => normaliseText(page).replace(/\b(\d{5,6}) (ADV|ORB|SND)\b/g, "$1$2").match(/\b[O0-9]\d{4,5}[A-Z]{0,4}\b/g) ?? []).filter((token) => !/^\d+(GR|MM|ML|CM)$/i.test(token)).map((token) => token.replace(/^O/, "0")));
const parsed = new Set(rows.map((row) => row.code));
const byCode = new Map();
for (const row of rows) byCode.set(row.code, [...(byCode.get(row.code) ?? []), row]);

writeJson(PATHS.rawCatalogue, {
  meta: {
    title: CATALOGUE.title,
    format: "PDF (Wix ugd dokument)",
    discoveredOn: website.pages.filter((page) => page.key).map((page) => page.url).find((url) => /blank/.test(url)) ?? null,
    sourceUrl: pdfUrl,
    sha256: sha256(body),
    bytes: body.length,
    pdfPages: extraction.pages.length,
    pdfMeta: extraction.meta ?? null,
    downloadedAt,
    codeRows: rows.length,
    distinctCodes: parsed.size,
    codesListedMoreThanOnce: [...byCode.entries()].filter(([, list]) => list.length > 1).map(([code, list]) => ({ code, pages: list.map((row) => row.pdfPage), sameDimension: new Set(list.map((row) => row.dimension)).size === 1 })),
    typographicCodes: rows.filter((row) => row.rawCode).map((row) => ({ printed: row.rawCode, read: row.code, pdfPage: row.pdfPage })),
    codeLikeTokensOutsideTables: [...tokensInPdf].filter((token) => !parsed.has(token)).sort(),
  },
  pages,
  rows,
});

console.log(`catalogue: ${path.basename(pdfPath)} · ${extraction.pages.length} str. · ${rows.length} redova · ${parsed.size} šifara · van tabela: ${[...tokensInPdf].filter((token) => !parsed.has(token)).length}`);
