#!/usr/bin/env node
/**
 * Phase 5 — C.A.R.FIT document acquisition.
 *
 * Two discovery sources are unioned, because neither is complete on its own:
 *
 *   1. the WordPress media library (301 PDFs) — the manufacturer's full upload
 *      set, including sheets not linked from any product page;
 *   2. the `Downloads` block of each product post — the only place that says
 *      *which product* a sheet belongs to.
 *
 * Type is decided by content, not by file name. Roughly a fifth of the library
 * uses a newer `C.A.R.FIT-<Product>_DE_de.pdf` convention that reveals nothing,
 * and guessing from the name would misfile safety sheets as technical ones.
 * The first page is read and matched against the document's own title block.
 *
 * Files are staged outside `public/`. Nothing here is published.
 *
 * Output:
 *   assets/manufacturer/carfit/documents/*
 *   data/knowledge/carfit-documents.generated.json
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { extractPdfBatch } from "./lib/rm-pdf-text.mjs";

const API = "https://carfitrepair.com/wp-json/wp/v2";
const OUT_DIR = "assets/manufacturer/carfit/documents";
const OUT = "data/knowledge/carfit-documents.generated.json";
const CACHE_DIR = ".cache/carfit";
const accessedAt = new Date().toISOString();

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(CACHE_DIR, { recursive: true });

const catalog = JSON.parse(readFileSync("data/knowledge/carfit-catalog.generated.json", "utf8"));

async function fetchJson(url, cacheKey) {
  const file = path.join(CACHE_DIR, `${cacheKey}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const response = await fetch(url, {
    headers: { "User-Agent": "Carsystem-knowledge-acquisition/1.0" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const data = await response.json();
  writeFileSync(file, JSON.stringify(data));
  return data;
}

/* -------------------------------------------------------------------------- */
/* Discovery                                                                  */
/* -------------------------------------------------------------------------- */

const media = [];
for (let page = 1; page <= 4; page += 1) {
  const batch = await fetchJson(
    `${API}/media?per_page=100&media_type=application&page=${page}`,
    `media-app-${page}`,
  );
  if (!Array.isArray(batch) || !batch.length) break;
  media.push(...batch);
}

/** url → the products whose Downloads block links it. */
const linkedBy = new Map();
const malformed = [];
for (const product of catalog.products) {
  for (const link of product.documentLinks) {
    // The source contains at least one broken href (`https://./#…pdf`). It is
    // recorded as a gap rather than silently dropped.
    if (!/^https:\/\/carfitrepair\.com\//.test(link)) {
      malformed.push({ productSlug: product.slug, productName: product.officialName, href: link });
      continue;
    }
    const bucket = linkedBy.get(link) ?? [];
    bucket.push(product);
    linkedBy.set(link, bucket);
  }
}

const urls = new Map();
for (const item of media) {
  if (!item.source_url?.toLowerCase().endsWith(".pdf")) continue;
  urls.set(item.source_url, { sourceUrl: item.source_url, mediaId: item.id, discoveredVia: "media-library" });
}
for (const link of linkedBy.keys()) {
  const existing = urls.get(link);
  if (existing) existing.discoveredVia = "media-library+product-page";
  else urls.set(link, { sourceUrl: link, discoveredVia: "product-page" });
}

/* -------------------------------------------------------------------------- */
/* Download                                                                   */
/* -------------------------------------------------------------------------- */

async function download(entry) {
  const fileName = decodeURIComponent(entry.sourceUrl.split("/").pop());
  const localPath = path.join(OUT_DIR, fileName);

  if (existsSync(localPath) && statSync(localPath).size > 0) {
    const bytes = readFileSync(localPath);
    return { ...entry, fileName, localPath, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), reused: true };
  }

  try {
    const response = await fetch(entry.sourceUrl, {
      headers: { "User-Agent": "Carsystem-knowledge-acquisition/1.0" },
    });
    if (!response.ok) return { ...entry, fileName, error: `HTTP ${response.status}` };
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.subarray(0, 5).toString("latin1").startsWith("%PDF")) {
      return { ...entry, fileName, error: "not a PDF" };
    }
    writeFileSync(localPath, buffer);
    return { ...entry, fileName, localPath, bytes: buffer.length, sha256: createHash("sha256").update(buffer).digest("hex"), reused: false };
  } catch (error) {
    return { ...entry, fileName, error: error.message };
  }
}

// Serial with a short pause: the manufacturer's host throttled parallel bursts
// during the Carsystem run, and a throttled request that returns HTML is worse
// than a slow one.
const downloaded = [];
for (const entry of urls.values()) {
  downloaded.push(await download(entry));
  await new Promise((resolve) => setTimeout(resolve, 120));
}

/* -------------------------------------------------------------------------- */
/* Classification by content                                                  */
/* -------------------------------------------------------------------------- */

const readable = downloaded.filter((entry) => entry.localPath && !entry.error);
const firstPage = new Map();
const BATCH = 40;
for (let index = 0; index < readable.length; index += BATCH) {
  const slice = readable.slice(index, index + BATCH);
  for (const result of extractPdfBatch(slice.map((entry) => entry.localPath))) {
    // First three pages, not one: several sheets open with a rasterised header
    // and put the description overleaf, which read as "unreadable" from page 1.
    firstPage.set(result.path, result.ok ? result.pages.slice(0, 3).join("\n") : "");
  }
}

/**
 * Classification by structure, not by title.
 *
 * A title-only test fails badly here: the sheets call themselves
 * "Produktdatenblatt", "Technical Information", "TECHNICAL DATA", or nothing at
 * all when the heading is a rasterised logo. What is stable is the *shape* —
 * an SDS carries numbered regulatory sections and H/P statements, a TDS carries
 * a product description plus application and substrate blocks.
 *
 * The library also holds documents that are not product documentation at all
 * (a GDPR customer form). Those get their own class rather than being counted
 * as an extraction gap.
 */
function classify(entry) {
  const head = (firstPage.get(entry.localPath) ?? "").slice(0, 6000);
  if (!head.trim()) return "unreadable";

  // The file name is weak evidence on its own but decisive alongside content:
  // "Kundendatenblatt_DSGVO" names the form that its body only hints at.
  const corpus = `${entry.fileName}\n${head}`;
  const score = (patterns) => patterns.filter((pattern) => pattern.test(corpus)).length;

  const administrative = score([
    /kundendatenblatt/i, /dsgvo|datenschutz-?grundverordnung/i,
    /rechnungsadresse/i, /bestellformular/i, /allgemeine geschäftsbedingungen/i,
  ]);
  if (administrative >= 2) return "administrative";

  const sds = score([
    /sicherheitsdatenblatt|safety data sheet/i,
    /abschnitt\s*\d|section\s*\d\s*[:.]/i,
    /produktidentifikator|product identifier/i,
    /\bH\d{3}\b/, /\bP\d{3}\b/,
    /gefahrenhinweis|hazard statement|signalwort|signal word/i,
    /1907\/2006|reach/i,
  ]);

  const tds = score([
    /technisches?\s+(merkblatt|datenblatt)|technical data sheet|technical information|produktdatenblatt|product data sheet/i,
    /produktbeschreibung|product description|\bbeschreibung\b|\bdescription\b/i,
    /anwendung|application|verarbeitung|processing/i,
    /untergrund|substrate|oberfläche/i,
    /technische daten|technical data/i,
    /mischungsverhältnis|mixing ratio|trockenzeit|drying time/i,
    /eigenschaften|properties|lagerung|storage|shelf life|haltbarkeit/i,
  ]);

  const catalogue = score([
    /\bkatalog\b|\bcatalogue\b|\bcatalog\b/i,
    /inhaltsverzeichnis|table of contents/i,
    /preisliste|price list/i,
    /refinishing consumables/i,
  ]);

  // A 100-page catalogue trips every TDS marker at once, so it is decided first.
  if (catalogue >= 2) return "catalogue";
  if (sds >= 3 && sds > tds) return "sds";
  if (tds >= 2 && tds >= sds) return "tds";
  if (/konformität|declaration of conformity|zertifikat|certificate/i.test(head)) return "declaration";
  if (sds >= 2) return "sds";

  /**
   * Last resort only, and recorded as such. The file name never overrides
   * content — it is consulted when the content scored too low to decide either
   * way, which happens on the few sheets that are almost entirely prose.
   */
  if (/technical-data-sheet|technisches-datenblatt|produktdatenblatt/i.test(entry.fileName)) {
    return "tds:by-filename";
  }
  if (/sicherheitsdatenblatt|safety-data-sheet/i.test(entry.fileName)) return "sds:by-filename";
  return "unclassified";
}

/* -------------------------------------------------------------------------- */
/* Attribution                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Only 117 of 302 documents are linked from a product page, which would leave
 * most of the corpus unattributed. The rest are matched on the file name, which
 * encodes the product ("car-fit-2k-us-fueller-41-technisches-datenblatt.pdf").
 *
 * Page links always win, and a file-name match is recorded with lower
 * confidence so the expert can see which attribution was inferred. A match must
 * cover the whole product name — a partial hit like "Klarlack" inside
 * "2K Klarlack Spray" would attach one product's sheet to several others.
 */
const normaliseName = (value) =>
  String(value)
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const productTokens = catalog.products.map((product) => ({
  product,
  tokens: normaliseName(product.officialName).split(" ").filter((token) => token.length > 2),
}));

function attributeByFileName(fileName) {
  const haystack = normaliseName(fileName.replace(/\.pdf$/i, ""));
  const scored = productTokens
    .map(({ product, tokens }) => {
      if (!tokens.length) return { product, score: 0 };
      const hits = tokens.filter((token) => haystack.includes(token)).length;
      return { product, score: hits / tokens.length, tokens: tokens.length };
    })
    // Every token of the product name must appear, and a one-token name like
    // "Klarlack" is too weak to attribute on its own.
    .filter((entry) => entry.score === 1 && entry.tokens >= 2);

  if (scored.length !== 1) return undefined;
  return scored[0].product;
}

const documents = downloaded.map((entry) => {
  const pageLinked = linkedBy.get(entry.sourceUrl) ?? [];
  const inferred = pageLinked.length || entry.error ? undefined : attributeByFileName(entry.fileName);
  const linked = pageLinked.length ? pageLinked : inferred ? [inferred] : [];
  const linkConfidence = pageLinked.length ? "page-link" : inferred ? "filename-match" : "unlinked";
  const raw = entry.error ? undefined : classify(entry);
  const documentType = raw?.replace(/:by-filename$/, "");
  const classificationConfidence = raw?.endsWith(":by-filename")
    ? "filename-fallback"
    : raw
      ? "content"
      : undefined;
  const head = (firstPage.get(entry.localPath) ?? "").slice(0, 400);

  return {
    ...entry,
    documentType,
    classificationConfidence,
    linkConfidence,
    // Kept so a human can audit a disputed classification without reopening
    // the PDF.
    classificationEvidence: entry.error ? undefined : head.replace(/\s+/g, " ").slice(0, 200),
    language: /_GB_en|_EN_|english|-en\.pdf/i.test(entry.fileName) ? "en" : "de",
    appliesToProducts: linked.map((product) => product.slug),
    appliesToProductNames: linked.map((product) => product.officialName),
    appliesToArticleNumbers: [...new Set(linked.flatMap((product) => product.articleNumbers))],
    manufacturer: "August Handel GmbH",
    brand: "C.A.R.FIT",
    accessedAt,
    published: false,
  };
});

const byType = {};
for (const document of documents) {
  byType[document.documentType ?? "(failed)"] = (byType[document.documentType ?? "(failed)"] ?? 0) + 1;
}

const distinct = new Set(documents.filter((entry) => entry.sha256).map((entry) => entry.sha256));

const summary = {
  generatedAt: accessedAt,
  brand: "C.A.R.FIT",
  manufacturer: "August Handel GmbH",
  mediaLibraryPdfs: media.filter((item) => item.source_url?.toLowerCase().endsWith(".pdf")).length,
  linkedFromProductPages: linkedBy.size,
  discoveredTotal: urls.size,
  downloaded: downloaded.filter((entry) => entry.localPath && !entry.reused).length,
  reusedFromDisk: downloaded.filter((entry) => entry.reused).length,
  failed: downloaded.filter((entry) => entry.error).length,
  malformedHrefsInSource: malformed.length,
  distinctByContent: distinct.size,
  byType,
  unclassified: documents.filter((entry) => entry.documentType === "unclassified").length,
  classifiedByFilenameFallback: documents.filter((entry) => entry.classificationConfidence === "filename-fallback").length,
  // Single-page PDFs that yield no text at all: scanned images. Reading them
  // would need OCR, which is a new dependency and is not added unilaterally.
  unreadableScans: documents.filter((entry) => entry.documentType === "unreadable").length,
  totalBytes: documents.reduce((total, entry) => total + (entry.bytes ?? 0), 0),
  productsWithTds: new Set(
    documents.filter((entry) => entry.documentType === "tds").flatMap((entry) => entry.appliesToProducts),
  ).size,
  productsWithSds: new Set(
    documents.filter((entry) => entry.documentType === "sds").flatMap((entry) => entry.appliesToProducts),
  ).size,
  linkedFromPage: documents.filter((entry) => entry.linkConfidence === "page-link").length,
  linkedByFileName: documents.filter((entry) => entry.linkConfidence === "filename-match").length,
  orphanDocuments: documents.filter((entry) => !entry.appliesToProducts.length && !entry.error).length,
  stagingDirectory: OUT_DIR,
  published: false,
};

mkdirSync("data/knowledge", { recursive: true });
writeFileSync(OUT, `${JSON.stringify({ summary, documents, malformedHrefs: malformed }, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
