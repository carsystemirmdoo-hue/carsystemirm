#!/usr/bin/env node
/**
 * Carsystem Phase 2, step 1 — TDS inventory.
 *
 * 243 downloaded files is not 243 unique technical specifications. One sheet can
 * be referenced by several products, and the same product family can carry one
 * sheet across many article numbers. This step establishes the real unit of
 * work — the distinct document, identified by content hash — and records the
 * many-to-many relation between documents, products and article numbers before
 * a single value is extracted.
 *
 * Output: data/knowledge/carsystem-tds-inventory.generated.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { extractPdfBatch } from "./lib/rm-pdf-text.mjs";

const documents = JSON.parse(
  readFileSync("data/knowledge/carsystem-documents.generated.json", "utf8"),
);
const catalog = JSON.parse(
  readFileSync("data/knowledge/carsystem-catalog.generated.json", "utf8"),
);

const generatedAt = new Date().toISOString();
const productBySlug = new Map(catalog.products.map((product) => [product.slug, product]));

/**
 * Revision comes from the file name: `tm-fine-line-tape-blue-v03.pdf` → `v03`.
 * Zero-padded on the way in, because the manufacturer is inconsistent about it
 * (`-v2` and `-v02` both occur) and unpadded values sort wrongly against `v10`.
 */
function revisionOf(document) {
  const raw = document.revision ?? /[-_]v(\d+)\b/i.exec(document.fileName)?.[0];
  if (!raw) return undefined;
  const number = /(\d+)/.exec(raw)?.[1];
  return number ? `v${number.padStart(2, "0")}` : undefined;
}

/**
 * Language is declared per document by the acquisition step. It is kept here
 * rather than assumed, because a German-only sheet attached to a Serbian-named
 * local product is exactly the situation that later produces a cross-language
 * match rather than an exact one.
 */
const tdsDocuments = documents.documents.filter(
  (document) => document.documentType === "tds" && !document.error,
);

/** Content hash → one distinct technical specification. */
const byHash = new Map();

for (const document of tdsDocuments) {
  const entry = byHash.get(document.sha256) ?? {
    sha256: document.sha256,
    fileNames: new Set(),
    sourceUrls: new Set(),
    languages: new Set(),
    categories: new Set(),
    revisions: new Set(),
    productSlugs: new Set(),
    productNames: new Set(),
    articleNumbers: new Set(),
    localPath: document.localPath,
    bytes: document.bytes,
  };

  entry.fileNames.add(document.fileName);
  entry.sourceUrls.add(document.sourceUrl);
  entry.languages.add(document.language ?? "unknown");
  entry.categories.add(document.category ?? "unknown");
  const revision = revisionOf(document);
  if (revision) entry.revisions.add(revision);
  entry.productSlugs.add(document.productSlug);

  const product = productBySlug.get(document.productSlug);
  if (product) {
    entry.productNames.add(product.name);
    for (const article of product.articleNumbers ?? []) entry.articleNumbers.add(article);
    for (const variant of product.variants ?? []) {
      if (variant.articleNumber) entry.articleNumbers.add(variant.articleNumber);
    }
  }

  byHash.set(document.sha256, entry);
}

/* -------------------------------------------------------------------------- */
/* Readability — a PDF that yields no text is a gap, not a zero-claim sheet    */
/* -------------------------------------------------------------------------- */

const entries = [...byHash.values()];

// Batched: process startup dominates for 242 small files.
const extraction = new Map();
const BATCH = 40;
const readablePaths = entries.filter((entry) => existsSync(entry.localPath));
for (let index = 0; index < readablePaths.length; index += BATCH) {
  const slice = readablePaths.slice(index, index + BATCH);
  for (const result of extractPdfBatch(slice.map((entry) => entry.localPath))) {
    extraction.set(result.path, result);
  }
}

const records = [];
let unreadable = 0;
const charLengths = [];
const pageCounts = [];

for (const entry of entries) {
  const result = extraction.get(entry.localPath);
  const readError = !existsSync(entry.localPath)
    ? "file missing on disk"
    : result?.ok === false
      ? result.error
      : undefined;

  const pages = result?.pages ?? [];
  const text = pages.join("\n");
  const readable = !readError && text.trim().length > 0;
  if (!readable) unreadable += 1;
  else {
    charLengths.push(text.length);
    pageCounts.push(pages.length);
  }

  records.push({
    sha256: entry.sha256,
    localPath: entry.localPath,
    fileNames: [...entry.fileNames],
    sourceUrls: [...entry.sourceUrls],
    bytes: entry.bytes,
    language: [...entry.languages],
    categories: [...entry.categories],
    revision: [...entry.revisions].sort().pop(),
    revisionsSeen: [...entry.revisions].sort(),
    // The three-way relation. None of these is guaranteed to be 1.
    appliesToProducts: [...entry.productSlugs],
    appliesToProductNames: [...entry.productNames],
    appliesToArticleNumbers: [...entry.articleNumbers],
    productCount: entry.productSlugs.size,
    articleNumberCount: entry.articleNumbers.size,
    fileReferenceCount: entry.fileNames.size,
    pageCount: pages.length,
    textLength: text.length,
    readable,
    readError,
  });
}

const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
};

const sharedAcrossProducts = records.filter((record) => record.productCount > 1);
const withoutRevision = records.filter((record) => !record.revision);

const byCategory = {};
for (const record of records) {
  for (const category of record.categories) {
    byCategory[category] = (byCategory[category] ?? 0) + 1;
  }
}

const byLanguage = {};
for (const record of records) {
  for (const language of record.language) {
    byLanguage[language] = (byLanguage[language] ?? 0) + 1;
  }
}

const summary = {
  generatedAt,
  brand: "Carsystem",
  manufacturer: "Vosschemie GmbH",
  tdsFiles: tdsDocuments.length,
  distinctDocuments: records.length,
  sharedAcrossProducts: sharedAcrossProducts.length,
  unreadable,
  byLanguage,
  byCategory,
  revisionsPresent: records.length - withoutRevision.length,
  withoutRevision: withoutRevision.length,
  pageCountMin: Math.min(...pageCounts),
  pageCountMax: Math.max(...pageCounts),
  textLengthMedian: median(charLengths),
  productsCovered: new Set(records.flatMap((record) => record.appliesToProducts)).size,
  articleNumbersCovered: new Set(records.flatMap((record) => record.appliesToArticleNumbers)).size,
};

mkdirSync("data/knowledge", { recursive: true });
writeFileSync(
  "data/knowledge/carsystem-tds-inventory.generated.json",
  `${JSON.stringify({ summary, records }, null, 2)}\n`,
);

console.log(JSON.stringify(summary, null, 2));
