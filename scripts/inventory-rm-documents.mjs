#!/usr/bin/env node
/**
 * Phase 3, step 1 — source inventory.
 *
 * Surveys every R-M PDF connected to a product and records whether it can be
 * read reliably enough to extract technical claims from. Nothing is extracted
 * here; a document that fails these checks is flagged and excluded from
 * extraction rather than parsed optimistically.
 *
 * Output: docs/seo/RM_SOURCE_INVENTORY.json + .md
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { extractPdfBatch } from "./lib/rm-pdf-text.mjs";

const rmData = JSON.parse(
  readFileSync("data/rm-imported-products.generated.json", "utf8"),
);
const products = rmData.products ?? [];

/** Section labels that mark a well-formed R-M "Technical Information" sheet. */
const TDS_MARKERS = [
  "Technical Information",
  "Mixing Ratio",
  "Application",
  "Drying",
  "Film thickness",
  "Potlife",
  "Nozzle",
];

const documents = [];
for (const product of products) {
  for (const [kind, href] of Object.entries(product.documents ?? {})) {
    if (!href) continue;
    const filePath = path.join("public", href.replace(/^\//, ""));
    documents.push({
      productSlug: product.slug,
      productName: product.canonicalName,
      productCode: product.productCode,
      category: product.taxonomy?.category,
      kind,
      href,
      filePath,
      exists: existsSync(filePath),
    });
  }
}

const present = documents.filter((doc) => doc.exists);
const extracted = extractPdfBatch(present.map((doc) => doc.filePath));
const byPath = new Map(extracted.map((entry) => [entry.path, entry]));

function detectLanguage(text) {
  // These sheets are English-only in this archive; the check exists so a
  // localised revision cannot be parsed by English-language regexes.
  const english = /\b(Application|Hardener|Thinner|Drying|Mixing Ratio)\b/.test(text);
  const german = /\b(Verarbeitung|Härter|Verdünnung|Trocknung)\b/.test(text);
  const french = /\b(Durcisseur|Diluant|Séchage|Application)\b/.test(text);
  if (german) return "de";
  if (french && !english) return "fr";
  return english ? "en" : "unknown";
}

const inventory = [];
for (const doc of present) {
  const entry = byPath.get(doc.filePath);
  const pages = entry?.pages ?? [];
  const fullText = pages.join("\n");
  const chars = fullText.replace(/\s/g, "").length;
  const pageCount = pages.length;
  const perPageChars = pages.map((page) => page.replace(/\s/g, "").length);
  const emptyPages = perPageChars.filter((count) => count < 40).length;

  const markersFound = TDS_MARKERS.filter((marker) => fullText.includes(marker));
  const isTds = doc.kind === "technicalDataSheet";

  /**
   * Coating sheets (clearcoats, primers, basecoats) carry the full section set.
   * Component sheets (hardeners, thinners, additives) legitimately carry only
   * "Application" and "Remarks" — their mixing parameters live in the coating's
   * sheet, not their own. Both are valid sources; they differ in yield, not in
   * trustworthiness, so this is a richness axis rather than a pass/fail one.
   */
  const isStructuredTds = isTds && markersFound.length >= 4;
  const isComponentTds = isTds && !isStructuredTds;

  // The two spray-gun columns ("Compliant Gravity Spray Gun" / "HVLP Spray
  // Gun") collapse into one line on extraction, so a two-gun sheet carries a
  // known column-merge ambiguity that the extractor must handle explicitly.
  const gunColumns = [
    /Compliant Gravity Spray Gun/.test(fullText),
    /HVLP Spray Gun/.test(fullText),
  ].filter(Boolean).length;

  const hasTables = /Nozzle Size|Drying at|Mixing Ratio/.test(fullText);
  const declaredPages = fullText.match(/Page \d+ of (\d+)/);
  const declaredTotal = declaredPages ? Number(declaredPages[1]) : undefined;
  const complete = declaredTotal ? declaredTotal === pageCount : undefined;

  // Revision date printed in the page header, e.g. "07/2026".
  const revision = fullText.match(/Page \d+ of \d+\s+(\d{2}\/\d{4})/)?.[1];

  const language = detectLanguage(fullText);

  // Readability problems only. Being the wrong *type* of document is handled
  // separately — a product-information sheet is not "broken", it simply is not
  // a technical source.
  const reasons = [];
  if (!entry?.ok) reasons.push("pypdf nije uspeo da otvori dokument");
  if (isTds) {
    if (chars < 200) {
      reasons.push("premalo izvučenog teksta — verovatno skenirana slika");
    }
    if (emptyPages > 0) reasons.push(`${emptyPages} stranica bez teksta`);
    if (complete === false) {
      reasons.push(`deklarisano ${declaredTotal} strana, izvučeno ${pageCount}`);
    }
    if (language !== "en") reasons.push(`jezik nije engleski (${language})`);
  }

  inventory.push({
    ...doc,
    bytes: statSync(doc.filePath).size,
    pageCount,
    chars,
    perPageChars,
    emptyPages,
    language,
    textExtractionReliable: reasons.length === 0,
    problems: reasons,
    isTds,
    isStructuredTds,
    isComponentTds,
    markersFound,
    hasTables,
    gunColumns,
    columnMergeRisk: gunColumns > 1,
    declaredTotalPages: declaredTotal,
    complete,
    revision,
  });
}

// Missing files
for (const doc of documents.filter((item) => !item.exists)) {
  inventory.push({
    ...doc,
    pageCount: 0,
    chars: 0,
    textExtractionReliable: false,
    problems: ["fajl ne postoji na disku"],
    isStructuredTds: false,
  });
}

/* -- Duplicate / revision detection ---------------------------------------- */

const byRevisionKey = new Map();
for (const item of inventory) {
  if (!item.isStructuredTds) continue;
  const key = `${item.productCode ?? item.productSlug}`;
  const bucket = byRevisionKey.get(key) ?? [];
  bucket.push(item);
  byRevisionKey.set(key, bucket);
}
const duplicateGroups = [...byRevisionKey.entries()]
  .filter(([, items]) => items.length > 1)
  .map(([key, items]) => ({
    key,
    documents: items.map((item) => ({ href: item.href, revision: item.revision })),
  }));

/* -- Summary --------------------------------------------------------------- */

const tds = inventory.filter((item) => item.kind === "technicalDataSheet");
const productInfo = inventory.filter((item) => item.kind === "productInformation");
// Eligible = is a TDS and reads reliably. Component sheets are included:
// low yield, but still a legitimate manufacturer technical source.
const extractable = inventory.filter(
  (item) => item.isTds && item.textExtractionReliable,
);

const summary = {
  generatedAt: new Date().toISOString(),
  products: products.length,
  documents: inventory.length,
  documentsPresent: present.length,
  documentsMissing: inventory.length - present.length,
  technicalDataSheets: tds.length,
  productInformationSheets: productInfo.length,
  coatingTds: inventory.filter((item) => item.isStructuredTds).length,
  componentTds: inventory.filter((item) => item.isComponentTds).length,
  extractionEligible: extractable.length,
  unreadable: inventory.filter(
    (item) => item.isTds && !item.textExtractionReliable,
  ).length,
  excludedByType: inventory.filter((item) => !item.isTds).length,
  columnMergeRisk: inventory.filter((item) => item.columnMergeRisk).length,
  totalPages: inventory.reduce((sum, item) => sum + item.pageCount, 0),
  languages: [...new Set(inventory.map((item) => item.language).filter(Boolean))],
  revisions: [...new Set(inventory.map((item) => item.revision).filter(Boolean))],
  duplicateGroups: duplicateGroups.length,
  productsWithoutTds: products.filter(
    (product) => !product.documents?.technicalDataSheet,
  ).map((product) => product.slug),
};

mkdirSync("docs/seo", { recursive: true });
writeFileSync(
  "docs/seo/RM_SOURCE_INVENTORY.json",
  `${JSON.stringify({ summary, duplicateGroups, documents: inventory }, null, 2)}\n`,
);

/* -- Markdown report -------------------------------------------------------- */

const lines = [];
lines.push("# R-M izvorna dokumentacija — inventar");
lines.push("");
lines.push(`Datum: ${summary.generatedAt.slice(0, 10)}`);
lines.push("");
lines.push(
  "Provera čitljivosti izvora pre bilo kakve ekstrakcije. Dokument koji ne prođe ove provere se ne parsira.",
);
lines.push("");
lines.push("| Metrika | Vrednost |");
lines.push("| --- | ---: |");
lines.push(`| R-M proizvoda | ${summary.products} |`);
lines.push(`| Dokumenata ukupno | ${summary.documents} |`);
lines.push(`| Tehničkih listova (TDS) | ${summary.technicalDataSheets} |`);
lines.push(`| Product information listova | ${summary.productInformationSheets} |`);
lines.push(`| — od toga sa punim setom sekcija (premazi) | ${summary.coatingTds} |`);
lines.push(`| — od toga komponentnih listova (učvršćivači, razređivači, aditivi) | ${summary.componentTds} |`);
lines.push(`| **Podobno za ekstrakciju** | **${summary.extractionEligible}** |`);
lines.push(`| Nečitljivih TDS-ova | ${summary.unreadable} |`);
lines.push(`| Isključeno po tipu dokumenta (product information) | ${summary.excludedByType} |`);
lines.push(`| Sa rizikom spajanja kolona | ${summary.columnMergeRisk} |`);
lines.push(`| Ukupno strana | ${summary.totalPages} |`);
lines.push(`| Jezici | ${summary.languages.join(", ")} |`);
lines.push(`| Revizije | ${summary.revisions.join(", ")} |`);
lines.push("");

if (summary.productsWithoutTds.length) {
  lines.push("## Proizvodi bez tehničkog lista");
  lines.push("");
  for (const slug of summary.productsWithoutTds) lines.push(`- \`${slug}\``);
  lines.push("");
}

const flagged = inventory.filter(
  (item) => item.isTds && !item.textExtractionReliable,
);
lines.push("## Problematični dokumenti");
lines.push("");
lines.push(
  "Obuhvata samo tehničke listove koji se ne mogu pouzdano pročitati. Product-information PDF-ovi nisu ovde — oni nisu pokvareni, nego nisu tehnički izvor.",
);
lines.push("");
if (flagged.length) {
  lines.push("| Dokument | Tip | Problem |");
  lines.push("| --- | --- | --- |");
  for (const item of flagged) {
    lines.push(`| \`${item.href}\` | ${item.kind} | ${item.problems.join("; ")} |`);
  }
} else {
  lines.push("Nema dokumenata koji su pali provere čitljivosti.");
}
lines.push("");

lines.push("## Poznata ograničenja ekstrakcije");
lines.push("");
lines.push(
  `- **Ligature.** PDF-ovi sadrže tipografske ligature (ﬁ, ﬂ, ﬀ), pa sirovi tekst daje "ﬂash oﬀ" i "ﬁlm". Sva obrada ide kroz \`normaliseText()\`.`,
);
lines.push(
  `- **Spojene kolone.** ${summary.columnMergeRisk} dokumenata ima dve kolone pištolja (Compliant Gravity + HVLP) koje se pri ekstrakciji spajaju u jedan red. Vrednosti dizne i pritiska u tim dokumentima se ne dodeljuju automatski.`,
);
lines.push(
  `- **Product information listovi (${summary.excludedByType}).** Provera sadržaja pokazuje da su to sačuvane veb-stranice sa linkom ka TDS-u (oko 177 znakova teksta, bez tehničkih vrednosti). Nisu izvor i ne ulaze u ekstrakciju.`,
);
lines.push(
  `- **Komponentni listovi (${summary.componentTds}).** Učvršćivači, razređivači i aditivi imaju samo sekcije "Application" i "Remarks". Njihovi parametri mešanja stoje u listu premaza, ne u sopstvenom. Čitljivi su, ali daju malo strukturiranih vrednosti.`,
);
lines.push("");

writeFileSync("docs/seo/RM_SOURCE_INVENTORY.md", `${lines.join("\n")}\n`);

console.log(JSON.stringify(summary, null, 2));
