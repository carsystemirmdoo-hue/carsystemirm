#!/usr/bin/env node
/**
 * C.A.R.FIT sync, korak 2 — RAW dataset zvaničnog PDF kataloga.
 *
 * Adresa PDF-a se ne upisuje u kod: čita se sa zvanične stranice
 * carfitrepair.com/en/katalog/ (dFlip flipbook, polje `source`). Ako sajt
 * objavi novo izdanje, ovaj korak ga sam nađe i prijavi promenu imena fajla.
 *
 * Katalog je trojezičan (EN/DE/FR) u istom redu tabele, bez graničnika između
 * jezika. Zato RAW čuva CEO red (`rowText`) — ništa se ne odseca nagađanjem.
 * `descriptionEn` postoji samo kada se može dokazati (red je isti tekst ponovljen
 * tri puta, ili tabela ima samo jednu kolonu opisa).
 *
 * Gramatika tabele (pypdf, običan tekst):
 *   „Articles Description … Pcs./pack”   → zaglavlje, otvara tabelu
 *   „N-NNN-NNNN <tekst> <kom>”            → red; tekst sme da se prelomi u više linija
 *   red je završen kada se završi celim brojem (kom. u pakovanju)
 *   tabelu zatvara: novo zaglavlje ili prva linija posle završenog reda koja ne
 *   počinje šifrom.
 *
 * Izlaz: data/carfit-sync/raw/catalogue-<izdanje>.generated.json
 *
 *   node scripts/carfit-sync/acquire-catalogue.mjs [--refresh]
 */

import { statSync } from "node:fs";
import path from "node:path";

import { cachedFetch, sha256, writeJson } from "../carsystem-sync/lib/http.mjs";
import { extractPdfBatch, normaliseText } from "../lib/rm-pdf-text.mjs";
import { CACHE_DIR, CATALOGUE, PATHS, PDF_CACHE_DIR } from "./lib/config.mjs";
import { clean, parseDescriptor } from "./lib/html.mjs";

const refresh = process.argv.includes("--refresh");

/* -- 1. Otkrivanje zvaničnog PDF-a ---------------------------------------------- */

const { body: listing } = await cachedFetch(CATALOGUE.listingPage, path.join(CACHE_DIR, "rest/katalog-page.html"), { refresh });
const pdfCandidates = [
  ...new Set(
    [...listing.toString("utf8").matchAll(/https?:\\?\/\\?\/carfitrepair\.com\\?\/wp-content\\?\/uploads[^"'\s<>]+?\.pdf/gi)].map((match) =>
      match[0].replace(/\\\//g, "/"),
    ),
  ),
];
if (!pdfCandidates.length) throw new Error(`Na ${CATALOGUE.listingPage} nije nađen nijedan PDF katalog.`);
const pdfUrl = pdfCandidates.find((url) => CATALOGUE.expectedFilePattern.test(url)) ?? pdfCandidates[0];
const editionMatchesConfig = CATALOGUE.expectedFilePattern.test(pdfUrl);

const pdfPath = path.join(PDF_CACHE_DIR, path.basename(new URL(pdfUrl).pathname));
const { body: pdfBody } = await cachedFetch(pdfUrl, pdfPath, { refresh });
const downloadedAt = statSync(pdfPath).mtime.toISOString();

const [extraction] = extractPdfBatch([pdfPath]);
if (!extraction.ok) throw new Error(`PDF nije pročitan: ${extraction.error}`);

/* -- 2. Parsiranje ---------------------------------------------------------------- */

const ARTICLE_AT_START = /^(\d-\d{3}-\d{3,5}[A-Za-z]?)\b\s*(.*)$/;
const TABLE_HEADER = /^Articles?\s+Description/i;
const RUNNING_HEADER = /CAR REFINISH CONSUMABLES|VERBRAUCHSMATERIALIEN/i;
const LANGUAGE_MARK = /^(EN|DE|FR)$/;
const ENDS_WITH_COUNT = /^(.*?)[\s,]+(\d{1,4})$/;

/**
 * Red se završava brojem komada u pakovanju. Dve zamke iz ovog PDF-a:
 *   - broj stoji SAM u sledećoj liniji („…w / durcisseur” / „6”),
 *   - prelomljen opis se slučajno završi brojem („…peinture rapide 200” / „ml (…)”):
 *     tada sledeća linija počinje malim slovom ili je sama broj → red traje.
 */
function endsRow(line, nextLine) {
  if (/^\d{1,4}$/.test(line)) return true;
  if (!ENDS_WITH_COUNT.test(line)) return false;
  if (nextLine === undefined) return true;
  return !/^[a-zà-ÿ(]/.test(nextLine) && !/^\d{1,4}$/.test(nextLine);
}

/** Isti tekst tri puta („Adapter A0 Adapter A0 Adapter A0”) → jedan. */
function collapseTriplicate(text) {
  const words = text.split(" ");
  if (words.length % 3 !== 0) return null;
  const third = words.length / 3;
  const a = words.slice(0, third).join(" ");
  return a === words.slice(third, 2 * third).join(" ") && a === words.slice(2 * third).join(" ") ? a : null;
}

const families = [];
const articles = [];
const pageFacts = [];

extraction.pages.forEach((pageText, pageIndex) => {
  const lines = normaliseText(pageText)
    .split("\n")
    .map((line) => clean(line))
    .filter(Boolean);

  const chapter = lines.find((line) => (line.match(/•/g) ?? []).length === 2 && !RUNNING_HEADER.test(line) && !/IMPORTANT INFORMATION/i.test(line)) ?? null;

  let currentFamily = null;
  let sinceLanguageMark = null; // linije između „FR” i zaglavlja tabele = nazivi porodice (EN, DE, FR)
  let table = null; // { singleDescriptionColumn, row }
  let tablesOnPage = 0;

  const closeRow = () => {
    if (!table?.row) return;
    const row = table.row;
    const text = clean(row.parts.join(" "));
    const counted = table.hasCountColumn ? ENDS_WITH_COUNT.exec(text) : null;
    const rowText = counted ? counted[1].trim() : text;
    const descriptionEn = table.singleDescriptionColumn ? rowText : collapseTriplicate(rowText);
    articles.push({
      articleNumber: row.articleNumber,
      pdfPage: pageIndex + 1,
      familyIndex: currentFamily ? families.indexOf(currentFamily) : null,
      rowText,
      descriptionEn,
      descriptionEnProven: Boolean(descriptionEn),
      pcsPerPack: counted ? Number(counted[2]) : null,
      attributes: parseDescriptor(descriptionEn ?? rowText),
    });
    if (currentFamily) currentFamily.articleNumbers.push(row.articleNumber);
    table.row = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (LANGUAGE_MARK.test(line)) {
      if (line === "FR") sinceLanguageMark = [];
      continue;
    }

    if (TABLE_HEADER.test(line)) {
      closeRow();
      tablesOnPage += 1;
      const headingLines = sinceLanguageMark ?? [];
      if (headingLines.length || !currentFamily) {
        currentFamily = {
          pdfPage: pageIndex + 1,
          chapter,
          name: headingLines[0] ?? null,
          headingLines,
          inheritedHeading: false,
          articleNumbers: [],
        };
        families.push(currentFamily);
      } else {
        // Druga tabela iste porodice (npr. diskovi pa trake) — bez novog naslova.
        currentFamily = { ...currentFamily, inheritedHeading: true, articleNumbers: [] };
        families.push(currentFamily);
      }
      sinceLanguageMark = null;
      table = {
        singleDescriptionColumn: !/Beschreibung/i.test(line) && !/Description.*Description/i.test(line),
        // Neke tabele nemaju kolonu „Pcs./pack” — tada broj komada ne postoji i ne sme da se čeka.
        hasCountColumn: /pcs/i.test(line),
        row: null,
      };
      continue;
    }

    if (table) {
      const start = ARTICLE_AT_START.exec(line);
      if (start) {
        closeRow();
        table.row = { articleNumber: start[1], parts: [start[2]] };
        if (table.hasCountColumn ? endsRow(start[2], lines[index + 1]) : table.singleDescriptionColumn) closeRow();
        continue;
      }
      if (table.row && !table.hasCountColumn && line.length > 70) {
        // Tabela bez kolone komada: ćelije su kratke, duga linija je već proza ispod tabele.
        closeRow();
        table = null;
      } else if (table.row) {
        table.row.parts.push(line);
        if (endsRow(line, lines[index + 1]) || table.row.parts.length >= 12) closeRow();
        continue;
      } else {
        // Linija posle završenog reda koja ne počinje šifrom → kraj tabele.
        table = null;
      }
    }

    if (sinceLanguageMark && sinceLanguageMark.length < 6) sinceLanguageMark.push(line);
  }
  closeRow();

  pageFacts.push({
    pdfPage: pageIndex + 1,
    chapter,
    tables: tablesOnPage,
    articleTokensOnPage: [...new Set(pageText.match(/\b\d-\d{3}-\d{3,5}[A-Za-z]?\b/g) ?? [])].length,
  });
});

/* -- 3. Kontrola parsera: svaki token oblika šifre u PDF-u mora biti u nekom redu -- */

const tokensInPdf = new Set(extraction.pages.flatMap((page) => page.match(/\b\d-\d{3}-\d{3,5}[A-Za-z]?\b/g) ?? []));
const parsedNumbers = new Set(articles.map((article) => article.articleNumber));
const tokensOutsideTables = [...tokensInPdf].filter((token) => !parsedNumbers.has(token)).sort();

const byNumber = new Map();
for (const article of articles) byNumber.set(article.articleNumber, [...(byNumber.get(article.articleNumber) ?? []), article]);
const duplicateRows = [...byNumber.entries()]
  .filter(([, rows]) => rows.length > 1)
  .map(([articleNumber, rows]) => ({
    articleNumber,
    rows: rows.map((row) => ({ pdfPage: row.pdfPage, rowText: row.rowText })),
    sameText: new Set(rows.map((row) => row.rowText)).size === 1,
  }));

writeJson(PATHS.rawCatalogue, {
  meta: {
    title: CATALOGUE.title,
    edition: CATALOGUE.edition,
    discoveredOn: CATALOGUE.listingPage,
    sourceUrl: pdfUrl,
    editionMatchesConfig,
    otherPdfsOnListingPage: pdfCandidates.filter((url) => url !== pdfUrl),
    sha256: sha256(pdfBody),
    bytes: pdfBody.length,
    pdfPages: extraction.pages.length,
    pdfMeta: extraction.meta ?? null,
    downloadedAt,
    languages: ["EN", "DE", "FR"],
    families: families.length,
    articleRows: articles.length,
    distinctArticleNumbers: parsedNumbers.size,
    rowsWithProvenEnglishDescription: articles.filter((article) => article.descriptionEnProven).length,
    rowsWithoutPackCount: articles.filter((article) => article.pcsPerPack === null).map((article) => article.articleNumber),
    duplicateRows,
    tokensOutsideTables,
  },
  pages: pageFacts,
  families: families.map((family, index) => ({ index, ...family })),
  articles,
});

console.log(
  `catalogue: ${path.basename(pdfPath)} · ${extraction.pages.length} str. · ${families.length} tabela/porodica · ` +
    `${parsedNumbers.size} šifara (van tabela: ${tokensOutsideTables.length}, dupli redovi: ${duplicateRows.length})`,
);
