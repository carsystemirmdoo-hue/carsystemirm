#!/usr/bin/env node
/**
 * baslac per-SKU documentation ↔ PDP matching.
 *
 * baslac's 102 acquired PDFs split into two populations (see
 * docs/BASLAC_DOCUMENT_SOURCE_MAP.md): 15 brand/system guides already
 * published through `/katalozi`, and 87 per-SKU technical data sheets that no
 * product page links to. This script decides — reproducibly — which of those
 * 87 may be attached to one of the four baslac products in the public model.
 *
 * Evidence ladder, strongest first:
 *   1 exact manufacturer article code   (`60-20` document ↔ `60-20` product)
 *   2 exact official product name
 *   3 strong normalized name + family/product corroboration
 *   4 an existing, verifiable pipeline result
 *       (data/knowledge/baslac-documents.generated.json carries the code the
 *        manufacturer's own file name encodes, plus sha256 and source URL)
 *
 * Only EXACT and HIGH_CONFIDENCE are safe to wire automatically. A shared line
 * prefix is NOT identity: `35-M214` and `35-M331` are mixing components inside
 * the `35 Line` system, and `35_Line.pdf` documents the line, not either can.
 * Attaching a line sheet to a component SKU would publish a document that may
 * belong to a different variant, package or product — exactly what the
 * REVIEW/AMBIGUOUS/CONFLICT buckets exist to prevent.
 *
 * Output: data/knowledge/baslac-document-match.generated.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const MANIFEST = "data/knowledge/baslac-documents.generated.json";
const CATALOG_SOURCE = "lib/carsystem-data.ts";
const LIBRARY_SOURCE = "lib/documents.ts";
const OUTPUT = "data/knowledge/baslac-document-match.generated.json";

const generatedAt = new Date().toISOString();

/* -------------------------------------------------------------------------- */
/* 1. Our assortment                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Slugs that actually reach the public model. `legacyProducts` holds archived
 * records (e.g. `baslac-900-basecoat`) that are only pulled into
 * `productRecords` on demand — matching those would invent PDPs that do not
 * exist.
 */
function readLiveSlugs(source) {
  const start = source.indexOf("const productRecords: CarsystemProduct[] = [");
  if (start < 0) throw new Error(`productRecords not found in ${CATALOG_SOURCE}`);
  const end = source.indexOf("\n];", start);
  const block = source.slice(start, end);

  return new Set([
    ...[...block.matchAll(/\n\s*slug:\s*"([a-z0-9-]+)"/g)].map((match) => match[1]),
    ...[...block.matchAll(/archivedProduct\("([a-z0-9-]+)"\)/g)].map((match) => match[1]),
  ]);
}

/**
 * Reads the baslac products straight out of the live product model rather than
 * a copy, so the report can never describe a catalogue that no longer exists.
 */
function readLocalProducts() {
  const source = readFileSync(CATALOG_SOURCE, "utf8");
  const liveSlugs = readLiveSlugs(source);
  const starts = [...source.matchAll(/\n\s*slug:\s*"([a-z0-9-]+)"/g)];
  const products = [];

  starts.forEach((start, index) => {
    const body = source.slice(start.index, starts[index + 1]?.index ?? source.length);
    if (!/brandSlug:\s*"baslac"/.test(body)) return;
    if (!liveSlugs.has(start[1])) return;
    products.push({
      slug: start[1],
      name: /name:\s*"([^"]+)"/.exec(body)?.[1] ?? null,
      sku: /sku:\s*"([^"]+)"/.exec(body)?.[1] ?? null,
      programSlug: /programSlug:\s*"([a-z-]+)"/.exec(body)?.[1] ?? null,
      phaseSlug: /phaseSlug:\s*"([a-z-]+)"/.exec(body)?.[1] ?? null,
      shortDescription: /shortDescription:\s*"([^"]+)"/.exec(body)?.[1] ?? null,
      packages: [...body.matchAll(/label:\s*"([^"]+)"/g)].map((entry) => entry[1]),
    });
  });

  if (!products.length) throw new Error(`No baslac products found in ${CATALOG_SOURCE}`);
  return products;
}

/* -------------------------------------------------------------------------- */
/* 2. Documents                                                               */
/* -------------------------------------------------------------------------- */

/** Files already published as brand-library cards must not be re-used as PDP sheets. */
function readPublishedGuideFiles() {
  const source = readFileSync(LIBRARY_SOURCE, "utf8");
  return new Set(
    [...source.matchAll(/file:\s*"(\/documents\/baslac\/guides\/[^"]+)"/g)].map((m) => m[1]),
  );
}

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const publishedGuideFiles = readPublishedGuideFiles();

/**
 * The 15 brand/system guides are recognisable in the per-SKU folder by their
 * non-numeric product code — the manufacturer names them by subject
 * (`Spray_guns.pdf`, `TempChart_VOC.pdf`), not by article number.
 */
const ARTICLE_CODE_RE = /^\d{2}(?:-[A-Z0-9]{2,4})?$/;

const documents = manifest.documents.map((document) => ({
  sourceUrl: document.sourceUrl,
  title: document.title,
  fileName: document.fileName,
  href: document.localPath,
  productCode: document.productCode ?? null,
  kind: document.kind,
  sha256: document.sha256,
  acquisitionMethod: document.acquisitionMethod,
  isArticleSheet: ARTICLE_CODE_RE.test(document.productCode ?? ""),
  isVariantSheet: /_variant_|-variant-/i.test(document.fileName),
}));

const perSkuDocuments = documents.filter((document) => document.isArticleSheet);
const systemDocuments = documents.filter((document) => !document.isArticleSheet);

/* -------------------------------------------------------------------------- */
/* 3. Identity of our own SKUs                                                */
/* -------------------------------------------------------------------------- */

/** `BASLAC-60-20-5L` → `60-20`; `BASLAC-35-M214` → `35-M214`. */
function articleCode(product) {
  const fromSku = /^BASLAC-(\d{2}-[A-Z0-9]{2,4})/i.exec(product.sku ?? "")?.[1];
  const fromName = /\b(\d{2}-[A-Z0-9]{2,4})\b/.exec(product.name ?? "")?.[1];
  return (fromSku ?? fromName ?? null)?.toUpperCase() ?? null;
}

/** The `35` in `35-M214` — the system line, never the article itself. */
function lineCode(code) {
  return code ? code.split("-")[0] : null;
}

/**
 * What our own catalogue claims the product is. Used only to detect
 * contradiction; it never upgrades a match.
 */
function declaredType(product) {
  const haystack = [product.name, product.shortDescription, product.programSlug, product.phaseSlug]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/razre[dđ]iva[cč]|reducer|thinner/.test(haystack)) return "reducer";
  if (/pasta|polir/.test(haystack)) return "polishing";
  if (/u[cč]vr[sš][cć]iva[cč]|hardener|aktivator/.test(haystack)) return "hardener";
  if (/bezbojni|clear/.test(haystack)) return "clearcoat";
  if (/bazn|basecoat/.test(haystack)) return "basecoat";
  return null;
}

/** What the manufacturer's own document title says the document is about. */
function documentType(document) {
  const title = document.title.toLowerCase();
  if (/reducer|dilutant|thinner/.test(title)) return "reducer";
  if (/hardener|activator/.test(title)) return "hardener";
  if (/clear/.test(title)) return "clearcoat";
  if (/basecoat/.test(title)) return "basecoat";
  if (/topcoat/.test(title)) return "topcoat";
  if (/primerfiller|washprimer|plastic primer/.test(title)) return "primer";
  if (/bodyfiller/.test(title)) return "bodyfiller";
  if (/cleaner/.test(title)) return "cleaner";
  if (/additive/.test(title)) return "additive";
  return null;
}

/* -------------------------------------------------------------------------- */
/* 4. Classification                                                          */
/* -------------------------------------------------------------------------- */

const CLASSES = [
  "EXACT",
  "HIGH_CONFIDENCE",
  "REVIEW",
  "AMBIGUOUS",
  "UNMATCHED",
  "CONFLICT",
];

const localProducts = readLocalProducts();
const results = [];

for (const product of localProducts) {
  const code = articleCode(product);
  const line = lineCode(code);
  const ourType = declaredType(product);

  // Rule 1 — exact manufacturer article code.
  const exact = perSkuDocuments.filter((document) => document.productCode === code);
  // Rule 3 — line-level sheets (`35_Line.pdf`, `30_Line_CV.pdf`, …) cover the
  // system a component code belongs to, but never the component itself.
  const lineLevel =
    line && line !== code
      ? perSkuDocuments.filter((document) => document.productCode === line)
      : [];

  if (exact.length) {
    const base = exact.filter((document) => !document.isVariantSheet);
    const candidates = base.length ? base : exact;

    for (const document of exact) {
      const theirType = documentType(document);
      const contradicts = ourType && theirType && ourType !== theirType;
      const isChosen = candidates.length === 1 && candidates[0] === document;

      results.push({
        productSlug: product.slug,
        productName: product.name,
        productSku: product.sku,
        articleCode: code,
        documentFile: document.fileName,
        documentTitle: document.title,
        documentHref: document.href,
        documentSha256: document.sha256,
        sourceUrl: document.sourceUrl,
        acquisitionMethod: document.acquisitionMethod,
        evidence: "exact-article-code",
        classification: contradicts ? "CONFLICT" : isChosen ? "EXACT" : "REVIEW",
        reason: contradicts
          ? `Kod se poklapa (${code}), ali naš zapis opisuje "${ourType}", a dokument "${theirType}".`
          : isChosen
            ? `Zvanična oznaka artikla ${code} identična je oznaci dokumenta; tip proizvoda se ne protivreči.`
            : `Više dokumenata nosi kod ${code} (osnovni + varijante) — izbor varijante traži ljudsku potvrdu.`,
        linkable: !contradicts && isChosen,
      });
    }
    continue;
  }

  if (lineLevel.length) {
    // A line sheet is evidence about the family, not about this article.
    const theirTypes = new Set(lineLevel.map((document) => documentType(document)));
    const contradicts =
      ourType && theirTypes.size && ![...theirTypes].includes(ourType);
    const classification = contradicts
      ? "CONFLICT"
      : lineLevel.length > 1
        ? "AMBIGUOUS"
        : "REVIEW";

    for (const document of lineLevel) {
      results.push({
        productSlug: product.slug,
        productName: product.name,
        productSku: product.sku,
        articleCode: code,
        documentFile: document.fileName,
        documentTitle: document.title,
        documentHref: document.href,
        documentSha256: document.sha256,
        sourceUrl: document.sourceUrl,
        acquisitionMethod: document.acquisitionMethod,
        evidence: "line-prefix-only",
        classification,
        reason: contradicts
          ? `Linija ${line} pokriva "${[...theirTypes].filter(Boolean).join(", ")}", a naš zapis opisuje "${ourType}" — jedan od dva podatka je pogrešan.`
          : classification === "AMBIGUOUS"
            ? `Linija ${line} ima više paralelnih tehničkih listova (${lineLevel.length}); ne može se utvrditi koji važi za ${code}.`
            : `Dokument opisuje liniju ${line}, ne artikal ${code} — nedovoljno za javni per-SKU link.`,
        linkable: false,
      });
    }
    continue;
  }

  results.push({
    productSlug: product.slug,
    productName: product.name,
    productSku: product.sku,
    articleCode: code,
    documentFile: null,
    documentTitle: null,
    documentHref: null,
    documentSha256: null,
    sourceUrl: null,
    acquisitionMethod: null,
    evidence: "none",
    classification: "UNMATCHED",
    reason: `Nijedan od ${perSkuDocuments.length} per-SKU dokumenata ne nosi oznaku ${code ?? "(nepoznat kod)"}.`,
    linkable: false,
  });
}

/* -------------------------------------------------------------------------- */
/* 5. Output                                                                  */
/* -------------------------------------------------------------------------- */

const byClassification = Object.fromEntries(
  CLASSES.map((name) => [
    name,
    results.filter((result) => result.classification === name).length,
  ]),
);

const linkable = results.filter((result) => result.linkable);
const linkedFiles = new Set(linkable.map((result) => result.documentHref));

if (linkedFiles.size !== linkable.length) {
  throw new Error("Isti fajl je predložen za više proizvoda — matching nije jednoznačan.");
}

const payload = {
  summary: {
    generatedAt,
    brand: "baslac",
    documentsTotal: documents.length,
    perSkuDocuments: perSkuDocuments.length,
    systemDocuments: systemDocuments.length,
    publishedAsBrandLibrary: publishedGuideFiles.size,
    localProducts: localProducts.length,
    candidates: results.length,
    byClassification,
    autoLinked: linkable.length,
  },
  results,
};

mkdirSync("data/knowledge", { recursive: true });
writeFileSync(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`);

console.log(JSON.stringify(payload.summary, null, 2));
for (const result of results) {
  console.log(
    `${result.classification.padEnd(16)} ${result.productSlug} ← ${result.documentFile ?? "—"}`,
  );
}
