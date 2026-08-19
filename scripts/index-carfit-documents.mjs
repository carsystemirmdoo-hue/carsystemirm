#!/usr/bin/env node
/**
 * C.A.R.FIT Phase 2, step 1 — document identity index.
 *
 * Phase 1 associated documents by page link and, failing that, by file name.
 * That left 160 of 302 unassociated, because the file name is the weakest
 * signal the corpus offers and several sheets carry names that match nothing.
 *
 * This step stops relying on the file name and collects every identity signal a
 * document actually carries: its internal PDF title, the article numbers
 * printed in its body, the product names it mentions, its component role, its
 * language as evidenced by content, its revision date, its page headers, and
 * its WordPress attachment metadata.
 *
 * The 2026 catalogue is parsed here too, as an entity-resolution source rather
 * than as technical evidence. It is the only place that states, in one table,
 * which article number is the product and which is its hardener:
 *
 *     4-240-1000  2K US Filler, 1L, Grey     ← main product
 *     4-241-0250  Hardener, 0.25L            ← component of the same family
 *
 * Output:
 *   data/knowledge/carfit-document-identity.generated.json
 *   data/knowledge/carfit-article-registry.generated.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { extractPdfBatch } from "./lib/rm-pdf-text.mjs";

const documents = JSON.parse(readFileSync("data/knowledge/carfit-documents.generated.json", "utf8"));
const catalog = JSON.parse(readFileSync("data/knowledge/carfit-catalog.generated.json", "utf8"));
const generatedAt = new Date().toISOString();

const TEXT_CACHE = ".cache/carfit/all-doc-text.json";

/* -------------------------------------------------------------------------- */
/* Text                                                                       */
/* -------------------------------------------------------------------------- */

const onDisk = documents.documents.filter(
  (entry) => entry.localPath && !entry.error && existsSync(entry.localPath),
);

/** Cache is a speed-up, not an input. */
function buildTextCache() {
  const byKey = {};
  const BATCH = 30;
  for (let index = 0; index < onDisk.length; index += BATCH) {
    const slice = onDisk.slice(index, index + BATCH);
    const results = extractPdfBatch(slice.map((entry) => entry.localPath));
    slice.forEach((entry, offset) => {
      const result = results[offset];
      byKey[entry.sha256] = {
        pages: result?.pages ?? [],
        meta: result?.meta ?? {},
        file: entry.fileName,
      };
    });
  }
  return byKey;
}

let text;
if (existsSync(TEXT_CACHE)) {
  text = JSON.parse(readFileSync(TEXT_CACHE, "utf8"));
} else {
  text = buildTextCache();
  mkdirSync(path.dirname(TEXT_CACHE), { recursive: true });
  writeFileSync(TEXT_CACHE, JSON.stringify(text));
}

/* -------------------------------------------------------------------------- */
/* Normalisation                                                              */
/* -------------------------------------------------------------------------- */

const CONFUSABLES = {
  "С": "C", "х": "x", "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M",
  "Н": "H", "О": "O", "Р": "P", "Т": "T", "Х": "X", "а": "a", "е": "e",
  "о": "o", "р": "p", "с": "c",
};

/**
 * The manufacturer's own copy mixes Cyrillic look-alikes into Latin words
 * ("20°С"). Folded here so that a value in a PDF and the same value on a web
 * page compare equal; Phase 1 folded only the website side.
 */
const fold = (value) => String(value ?? "").replace(/[Ѐ-ӿ]/g, (char) => CONFUSABLES[char] ?? char);

const normaliseName = (value) =>
  fold(value)
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const ARTICLE_RE = /\b(\d-\d{3}-\d{4})\b/g;

/* -------------------------------------------------------------------------- */
/* Component roles                                                            */
/* -------------------------------------------------------------------------- */

/**
 * A component role is what stops a clearcoat's density being attributed to its
 * hardener. Ordered: the first match wins, and `main` is only assigned when no
 * component word is present.
 */
const COMPONENT_ROLES = [
  { role: "hardener", re: /\b(härter|haerter|hardener|durcisseur|activator|aktivator)\b/i },
  { role: "thinner", re: /\b(verdünner|verduenner|thinner|diluant|beispritzverdünnung)\b/i },
  { role: "additive", re: /\b(additiv|additive|beschleuniger|accelerator|elastifizierer)\b/i },
  { role: "component-b", re: /\bkomponente\s*b\b|\bcomponent\s*b\b|\bteil\s*b\b/i },
  { role: "component-a", re: /\bkomponente\s*a\b|\bcomponent\s*a\b|\bteil\s*a\b/i },
];

const roleOf = (text) => COMPONENT_ROLES.find((entry) => entry.re.test(text ?? ""))?.role ?? "main";

/* -------------------------------------------------------------------------- */
/* Catalogue → article registry                                               */
/* -------------------------------------------------------------------------- */

const catalogueDocument = documents.documents.find((entry) => entry.documentType === "catalogue");
const cataloguePages = catalogueDocument ? (text[catalogueDocument.sha256]?.pages ?? []) : [];

/**
 * Rows read from the catalogue's `Articles / Description / Beschreibung` tables.
 * The family heading is the block title printed above each table.
 */
const articleRegistry = new Map();
const registryRows = [];

cataloguePages.forEach((pageText, pageIndex) => {
  const lines = fold(pageText).split("\n").map((line) => line.trim()).filter(Boolean);
  let family;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    // Block titles are printed in capitals just above the article table.
    if (/^[A-ZÄÖÜ0-9][A-ZÄÖÜ0-9 .,:&\/+°-]{5,60}$/.test(line) && !/^ARTICLES/i.test(line) && !/CAR REFINISH/i.test(line)) {
      family = line.trim();
    }

    const match = /^(\d-\d{3}-\d{4})\s+(.{0,160})$/.exec(line);
    if (!match) continue;

    // The description continues on following lines until the next article row.
    const continuation = [];
    for (let ahead = index + 1; ahead < lines.length && continuation.length < 3; ahead += 1) {
      if (/^\d-\d{3}-\d{4}\b/.test(lines[ahead])) break;
      if (/^(Articles|EN|DE|FR)$/i.test(lines[ahead])) break;
      continuation.push(lines[ahead]);
    }

    const description = `${match[2]} ${continuation.join(" ")}`.trim();
    const row = {
      articleNumber: match[1],
      description: description.slice(0, 220),
      family,
      componentRole: roleOf(description),
      cataloguePage: pageIndex + 1,
      // Marketing prose in this catalogue is not technical evidence; the row is
      // kept for entity resolution and carries its own provenance.
      sourceType: "manufacturer-catalogue",
      status: "machine-extracted",
    };
    registryRows.push(row);

    const bucket = articleRegistry.get(match[1]) ?? [];
    bucket.push(row);
    articleRegistry.set(match[1], bucket);
  }
});

/**
 * Trilingual family headings.
 *
 * The catalogue prints `EN` / `DE` / `FR` markers followed by the same family
 * name in each language. That is the manufacturer's own EN↔DE bridge, and it is
 * what lets an English sheet titled "Rapid Air Clear Coat VOC" reach the German
 * product page "Rapid Air Klarlack VOC" without guessing at a translation.
 */
const nameBridge = [];
cataloguePages.forEach((pageText, pageIndex) => {
  const lines = fold(pageText).split("\n").map((line) => line.trim()).filter(Boolean);
  for (let index = 0; index + 5 < lines.length; index += 1) {
    if (lines[index] !== "EN" || lines[index + 1] !== "DE" || lines[index + 2] !== "FR") continue;
    const [en, de, fr] = [lines[index + 3], lines[index + 4], lines[index + 5]];
    if (!en || !de || en.length < 4 || de.length < 4) continue;
    nameBridge.push({ en, de, fr, cataloguePage: pageIndex + 1 });
  }
});

/** Article numbers the catalogue lists against more than one distinct description. */
const catalogueDuplicates = [...articleRegistry.entries()]
  .filter(([, rows]) => new Set(rows.map((row) => normaliseName(row.description).slice(0, 40))).size > 1)
  .map(([articleNumber, rows]) => ({
    articleNumber,
    descriptions: rows.map((row) => row.description.slice(0, 80)),
    pages: rows.map((row) => row.cataloguePage),
  }));

/* -------------------------------------------------------------------------- */
/* Website catalogue index                                                    */
/* -------------------------------------------------------------------------- */

const productByArticle = new Map();
for (const product of catalog.products) {
  for (const variant of product.variants) {
    const bucket = productByArticle.get(variant.articleNumber) ?? [];
    bucket.push({ product, variant });
    productByArticle.set(variant.articleNumber, bucket);
  }
}

const productNameTokens = catalog.products.map((product) => ({
  product,
  tokens: normaliseName(product.officialName).split(" ").filter((token) => token.length > 2),
}));

/* -------------------------------------------------------------------------- */
/* Identity index                                                             */
/* -------------------------------------------------------------------------- */

const REVISION_RE = /\b(?:ausgabe|version|stand|revision|rev\.?)\s*[:.]?\s*([0-9]{1,2}\s*\/\s*[0-9]{2,4}|[0-9.]{6,10})/i;
const DATE_RE = /\b(0?[1-9]|[12][0-9]|3[01])[.\/](0?[1-9]|1[0-2])[.\/](20\d{2})\b/;

function detectLanguage(body) {
  const german = (body.match(/\b(und|der|die|das|mit|für|nicht|Trocknung|Untergrund|Verarbeitung)\b/gi) ?? []).length;
  const english = (body.match(/\b(and|the|with|for|not|drying|substrate|application|surface)\b/gi) ?? []).length;
  const french = (body.match(/\b(et|le|la|les|pour|avec|séchage|surface|application)\b/gi) ?? []).length;
  const ranked = [["de", german], ["en", english], ["fr", french]].sort((a, b) => b[1] - a[1]);
  if (!ranked[0][1]) return "unknown";
  return ranked[0][1] > ranked[1][1] * 1.3 ? ranked[0][0] : "mixed";
}

const identities = [];
const seenHashes = new Map();

for (const entry of documents.documents) {
  const extracted = entry.sha256 ? text[entry.sha256] : undefined;
  const pages = extracted?.pages ?? [];
  const body = fold(pages.join("\n"));
  const head = fold(pages[0] ?? "").slice(0, 1500);

  // Same bytes under a different name is not independent evidence.
  const duplicateOf = entry.sha256 ? seenHashes.get(entry.sha256) : undefined;
  if (entry.sha256 && !duplicateOf) seenHashes.set(entry.sha256, entry.fileName);

  const articleNumbers = [...new Set([...body.matchAll(ARTICLE_RE)].map((match) => match[1]))];

  // Product names the document actually mentions, matched whole so that
  // "Klarlack" inside "2K Klarlack Spray" cannot attach several products.
  const haystack = normaliseName(`${entry.fileName} ${extracted?.meta?.Title ?? ""} ${head}`);
  const mentionedProducts = productNameTokens
    .filter((candidate) => candidate.tokens.length >= 2 && candidate.tokens.every((token) => haystack.includes(token)))
    .map((candidate) => ({ slug: candidate.product.slug, officialName: candidate.product.officialName }));

  const internalTitle = extracted?.meta?.Title?.trim() || undefined;

  /**
   * The role is read from what the document calls *itself* — its internal title
   * and file name — never from the page body. Any two-component sheet mentions
   * its hardener and thinner in the mixing instructions, so scanning the body
   * labelled the zinc spray a thinner.
   */
  const roleSource = `${internalTitle ?? ""} ${entry.fileName}`;

  identities.push({
    sha256: entry.sha256,
    fileName: entry.fileName,
    sourceUrl: entry.sourceUrl,
    mediaId: entry.mediaId,
    documentType: entry.documentType,
    classificationConfidence: entry.classificationConfidence,
    discoveredVia: entry.discoveredVia,
    error: entry.error,

    // -- identity signals --
    internalTitle,
    pdfAuthor: extracted?.meta?.Author?.trim() || undefined,
    pdfSubject: extracted?.meta?.Subject?.trim() || undefined,
    pageHeader: pages[0] ? fold(pages[0]).split("\n").find((line) => line.trim().length > 5)?.slice(0, 120) : undefined,
    articleNumbers,
    articleNumberCount: articleNumbers.length,
    mentionedProducts,
    componentRole: roleOf(roleSource),
    languageFromContent: detectLanguage(body),
    languageFromFileName: entry.language,
    revision: REVISION_RE.exec(body)?.[1]?.replace(/\s+/g, "") || undefined,
    documentDate: DATE_RE.exec(body)?.[0] || undefined,
    pageCount: pages.length,
    textLength: body.length,
    readable: body.trim().length > 0,

    // -- existing association from Phase 1 --
    linkConfidence: entry.linkConfidence,
    appliesToProducts: entry.appliesToProducts ?? [],

    duplicateOfFileName: duplicateOf,
  });
}

/* -------------------------------------------------------------------------- */

const summary = {
  generatedAt,
  brand: "C.A.R.FIT",
  manufacturer: "August Handel GmbH",
  documents: identities.length,
  distinctByContent: seenHashes.size,
  duplicateFiles: identities.filter((entry) => entry.duplicateOfFileName).length,
  readable: identities.filter((entry) => entry.readable).length,
  unreadable: identities.filter((entry) => !entry.readable && !entry.error).length,
  withInternalTitle: identities.filter((entry) => entry.internalTitle).length,
  withArticleNumbers: identities.filter((entry) => entry.articleNumberCount > 0).length,
  withMentionedProduct: identities.filter((entry) => entry.mentionedProducts.length).length,
  withRevision: identities.filter((entry) => entry.revision).length,
  byComponentRole: identities.reduce((counts, entry) => {
    counts[entry.componentRole] = (counts[entry.componentRole] ?? 0) + 1;
    return counts;
  }, {}),
  byLanguageFromContent: identities.reduce((counts, entry) => {
    counts[entry.languageFromContent] = (counts[entry.languageFromContent] ?? 0) + 1;
    return counts;
  }, {}),
  nameBridgeEntries: nameBridge.length,
  catalogue: {
    documentFound: Boolean(catalogueDocument),
    pages: cataloguePages.length,
    articleRows: registryRows.length,
    distinctArticleNumbers: articleRegistry.size,
    familiesNamed: new Set(registryRows.map((row) => row.family).filter(Boolean)).size,
    byComponentRole: registryRows.reduce((counts, row) => {
      counts[row.componentRole] = (counts[row.componentRole] ?? 0) + 1;
      return counts;
    }, {}),
    duplicateArticleNumbers: catalogueDuplicates.length,
  },
  articleNumbersOnWebsite: productByArticle.size,
  articleNumbersInCatalogueOnly: [...articleRegistry.keys()].filter((article) => !productByArticle.has(article)).length,
  articleNumbersOnWebsiteOnly: [...productByArticle.keys()].filter((article) => !articleRegistry.has(article)).length,
};

mkdirSync("data/knowledge", { recursive: true });
writeFileSync(
  "data/knowledge/carfit-document-identity.generated.json",
  `${JSON.stringify({ summary, identities }, null, 2)}\n`,
);
writeFileSync(
  "data/knowledge/carfit-article-registry.generated.json",
  `${JSON.stringify(
    {
      summary: { ...summary.catalogue, generatedAt, source: catalogueDocument?.sourceUrl },
      rows: registryRows,
      nameBridge,
      duplicates: catalogueDuplicates,
    },
    null,
    2,
  )}\n`,
);

console.log(JSON.stringify(summary, null, 2));
