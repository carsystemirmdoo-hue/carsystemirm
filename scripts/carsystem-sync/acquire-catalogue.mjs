#!/usr/bin/env node
/**
 * Carsystem sync · korak 1b — RAW dataset iz zvaničnog PDF kataloga.
 *
 * Katalog je REFERENTNI dokument za aktuelni asortiman: artikal koji je u
 * njemu, jeste u ponudi za to izdanje. Sajt je bogatiji (slike, TDS/SDS,
 * opisi), ali katalog odlučuje „da li je ovo trenutno u asortimanu”.
 *
 * PDF je InDesign izvoz u kome je jedna PDF strana = dvolist (dve štampane
 * strane). Gramatika bloka proizvoda, ista kroz svih deset poglavlja:
 *
 *   NAZIV VELIKIM SLOVIMA          (1–3 reda)
 *   Podnaslov / tip proizvoda      (0–2 reda)
 *   Art.-No. Specification SP MOQ  zaglavlje tabele
 *   156.046 P 80 50 1000           red artikla = varijanta
 *
 * Tekstualni tok InDesign-a NE garantuje da sekcije (DESCRIPTION/BENEFITS…)
 * stoje uz svoj proizvod (str. 10–11: opis P.25 prethodi njegovom nazivu), pa
 * se iz PDF-a kao autoritativno uzima samo ono što je pozicijski pouzdano:
 * naziv, podnaslov, šifre artikala i red tabele. Sekcije se čitaju sa sajta.
 *
 * Ekstrakcija teksta: pypdf preko postojećeg `scripts/lib/rm-pdf-text.mjs`
 * (jedini PDF toolchain na ovoj mašini; nema novog dependency-ja).
 *
 * Upotreba: node scripts/carsystem-sync/acquire-catalogue.mjs [--refresh]
 * Izlaz:    data/carsystem-sync/raw/catalogue-<izdanje>.generated.json
 */

import { CATALOGUE, PATHS, PDF_CACHE_PATH } from "./lib/config.mjs";
import { cachedFetch, sha256, writeJson } from "./lib/http.mjs";
import { extractPdfBatch, toLines } from "../lib/rm-pdf-text.mjs";

const refresh = process.argv.includes("--refresh");

const { body, fromCache } = await cachedFetch(CATALOGUE.pdfUrl, PDF_CACHE_PATH, { refresh });
console.log(`${CATALOGUE.title}: ${(body.length / 1e6).toFixed(1)} MB (${fromCache ? "keš" : "preuzeto"})`);

const [extraction] = extractPdfBatch([PDF_CACHE_PATH]);
if (!extraction.ok) throw new Error(`PDF nije pročitan: ${extraction.error}`);

const ARTICLE_ROW = /^(\d{3}\.\d{3})\s*(.*)$/;
const TABLE_HEADER = /^Art\.-?\s?No\.?\b/i;
const SECTION_HEADINGS = new Set([
  "DESCRIPTION",
  "AREA OF APPLICATION",
  "AREAS OF APPLICATION",
  "BENEFITS",
  "BENEFIT",
  "APPLICATION ADVICE",
  "SCAN ME",
  "NEW",
]);

const isUpperLine = (line) =>
  /[A-ZÄÖÜ]/.test(line) && line === line.toUpperCase() && !ARTICLE_ROW.test(line) && !/^[\d\s]+$/.test(line);

/** Poglavlje dvolista: red ispod reda sa brojevima strana („10 11” → „ABRASIVES ABRASIVES”). */
function spreadInfo(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const numbers = /^(\d{1,3})(?:\s+(\d{1,3}))?$/.exec(lines[index]);
    if (!numbers || !lines[index + 1] || !isUpperLine(lines[index + 1])) continue;
    const words = lines[index + 1].split(/\s+/);
    const half = words.slice(0, Math.ceil(words.length / 2)).join(" ");
    const chapter = numbers[2] && words.length % 2 === 0 && half === words.slice(words.length / 2).join(" ")
      ? half
      : lines[index + 1];
    return { printedPages: [numbers[1], numbers[2]].filter(Boolean).map(Number), chapter };
  }
  return { printedPages: [], chapter: null };
}

const products = [];
const pageFacts = [];
let currentChapter = null;

extraction.pages.forEach((pageText, pageIndex) => {
  const lines = toLines(pageText);
  const info = spreadInfo(lines);
  if (info.chapter) currentChapter = info.chapter;
  const newMarkers = lines.filter((line) => line === "NEW").length;
  let blocksOnPage = 0;

  lines.forEach((line, headerIndex) => {
    if (!TABLE_HEADER.test(line)) return;

    // Unazad do prve granice bloka (bullet, red artikla, naslov sekcije, kraj
    // rečenice). Naziv je najčešće velikim slovima, ali ne uvek („Pro Flex
    // JUPITER”), pa se prozor deli: od prvog reda velikim slovima naniže je
    // naziv, ostatak je podnaslov; bez takvog reda poslednja dva reda su
    // naziv + podnaslov.
    const window = [];
    let markedNew = false;
    for (let cursor = headerIndex - 1; cursor >= 0 && window.length < 4; cursor -= 1) {
      const candidate = lines[cursor];
      // Bedž „NEW” (i QR „SCAN ME”) stoji između podnaslova i tabele: pripada
      // OVOM bloku, pa je pozicijski pouzdan signal novog proizvoda.
      if (!window.length && (candidate === "NEW" || candidate === "SCAN ME")) {
        markedNew ||= candidate === "NEW";
        continue;
      }
      if (
        candidate.startsWith("∙") ||
        ARTICLE_ROW.test(candidate) ||
        TABLE_HEADER.test(candidate) ||
        SECTION_HEADINGS.has(candidate) ||
        /[.:;,]$/.test(candidate) ||
        /^For industrial/.test(candidate)
      ) {
        break;
      }
      window.unshift(candidate);
    }
    const firstUpper = window.findIndex((candidate) => isUpperLine(candidate));
    const scoped = firstUpper >= 0 ? window.slice(firstUpper) : window.slice(-2);
    const nameEnd = firstUpper >= 0 ? scoped.findIndex((candidate) => !isUpperLine(candidate)) : Math.min(1, scoped.length);
    const name = nameEnd === -1 ? scoped : scoped.slice(0, nameEnd);
    const subtitle = nameEnd === -1 ? [] : scoped.slice(nameEnd);

    const rows = [];
    for (let rowIndex = headerIndex + 1; rowIndex < lines.length; rowIndex += 1) {
      const row = ARTICLE_ROW.exec(lines[rowIndex]);
      if (row) {
        rows.push({ articleNumber: row[1], row: row[2].trim() });
        continue;
      }
      // Prelomljena specifikacija: red bez šifre, a odmah posle njega opet red
      // artikla. Velika slova NISU znak kraja tabele („Q-MAG 1 1”, „2 L 1 6” su
      // nastavci reda) — naziv sledećeg proizvoda nikad ne stoji tik iznad reda
      // artikla, jer između njih uvek dolazi zaglavlje tabele. Zaglavlje je zato
      // jedino što ovde prekida (inače bi se dve tabele pod jednim nazivom spojile).
      const next = lines[rowIndex + 1];
      if (rows.length && next && ARTICLE_ROW.test(next) && !TABLE_HEADER.test(lines[rowIndex])) {
        rows[rows.length - 1].row += ` ${lines[rowIndex]}`;
        continue;
      }
      break;
    }
    if (!rows.length) return;

    blocksOnPage += 1;
    products.push({
      pdfPage: pageIndex + 1,
      printedPages: info.printedPages,
      chapter: currentChapter,
      name: name.join(" ").replace(/\s+/g, " ").trim() || null,
      subtitle: subtitle.join(" ").replace(/\s+/g, " ").trim() || null,
      markedNew,
      tableHeader: line,
      articles: rows,
    });
  });

  pageFacts.push({ pdfPage: pageIndex + 1, ...info, chapter: currentChapter, productBlocks: blocksOnPage, newMarkers });
});

// Šifra van tabele (npr. u tekstu „use with 156.227”) nije varijanta; ali šifra
// koju tabelarni parser nije uhvatio jeste rupa u parseru i mora biti vidljiva.
const tabled = new Set(products.flatMap((product) => product.articles.map((article) => article.articleNumber)));
const mentionedOnly = new Map();
extraction.pages.forEach((pageText, pageIndex) => {
  for (const match of pageText.matchAll(/\b\d{3}\.\d{3}\b/g)) {
    if (!tabled.has(match[0]) && !mentionedOnly.has(match[0])) mentionedOnly.set(match[0], pageIndex + 1);
  }
});

const summary = {
  title: CATALOGUE.title,
  edition: CATALOGUE.edition,
  sourceUrl: CATALOGUE.pdfUrl,
  listedAt: CATALOGUE.listingPage,
  sha256: sha256(body),
  bytes: body.length,
  pdfPages: extraction.pages.length,
  pdfMeta: extraction.meta,
  productBlocks: products.length,
  blocksWithoutName: products.filter((product) => !product.name).length,
  articleRows: products.reduce((sum, product) => sum + product.articles.length, 0),
  distinctArticleNumbers: tabled.size,
  articleNumbersOutsideTables: mentionedOnly.size,
  newMarkers: pageFacts.reduce((sum, page) => sum + page.newMarkers, 0),
  blocksMarkedNew: products.filter((product) => product.markedNew).length,
  chapters: [...new Set(products.map((product) => product.chapter))],
};

writeJson(PATHS.rawCatalogue, {
  acquiredAt: new Date().toISOString().slice(0, 10),
  summary,
  pages: pageFacts,
  products,
  articleNumbersOutsideTables: [...mentionedOnly].map(([articleNumber, pdfPage]) => ({ articleNumber, pdfPage })),
});

console.log(JSON.stringify({ ...summary, pdfMeta: undefined }, null, 2));
