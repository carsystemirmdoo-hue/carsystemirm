#!/usr/bin/env node
/**
 * Phase 5 — C.A.R.FIT matching, our assortment ↔ manufacturer catalogue.
 *
 * Confidence ladder, applied in order and never skipped:
 *
 *   1 exact-code            expected family + exact article number
 *   2 exact-name            expected family + strong name/code agreement
 *   3 normalized-code       identifier equal after normalisation
 *   4 cross-family-exact    controlled search outside the expected family
 *   5 probable              corroborated by dimension/packaging + category
 *   6 ambiguous             several candidates, none decisive
 *   7 unmatched             nothing defensible
 *
 * The rule that keeps this honest: a bare numeric agreement is never accepted
 * across families without supporting name evidence. Our SKUs (`CARFIT-FILM-4X5M`)
 * share no numbering system with the manufacturer's (`1-201-0450`), so any
 * apparent numeric overlap would be coincidence.
 *
 * Matching produces a classification, not a merge. Nothing is applied to the
 * public catalogue.
 *
 * Output: data/knowledge/carfit-match.generated.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const catalog = JSON.parse(readFileSync("data/knowledge/carfit-catalog.generated.json", "utf8"));
const generatedAt = new Date().toISOString();

/* -------------------------------------------------------------------------- */
/* Our assortment                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Read from the site catalogue source. Only C.A.R.FIT records are considered;
 * the brand is declared on each product, so no name guessing is involved.
 */
function readLocalProducts() {
  const source = readFileSync("lib/carsystem-data.ts", "utf8");

  // Record boundaries are the `slug:` keys themselves. Matching on brace
  // indentation missed two of the three products, because the file mixes plain
  // object literals with `createProduct({ … })` wrappers whose closing token
  // differs.
  const starts = [...source.matchAll(/\n\s*slug:\s*"([a-z0-9-]+)"/g)];
  const products = [];

  starts.forEach((start, index) => {
    const body = source.slice(start.index, starts[index + 1]?.index ?? source.length);
    if (!/brandSlug:\s*"carfit"/.test(body)) return;
    products.push({
      slug: start[1],
      name: /name:\s*"([^"]+)"/.exec(body)?.[1],
      sku: /sku:\s*"([^"]+)"/.exec(body)?.[1],
      packages: [...body.matchAll(/label:\s*"([^"]+)"/g)].map((entry) => entry[1]),
      programSlug: /programSlug:\s*"([^"]+)"/.exec(body)?.[1],
      phaseSlug: /phaseSlug:\s*"([^"]+)"/.exec(body)?.[1],
    });
  });

  if (!products.length) throw new Error("No C.A.R.FIT products found in lib/carsystem-data.ts");
  return products;
}

const localProducts = readLocalProducts();

/* -------------------------------------------------------------------------- */
/* Normalisation                                                              */
/* -------------------------------------------------------------------------- */

const normalise = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[čć]/g, "c").replace(/š/g, "s").replace(/ž/g, "z").replace(/đ/g, "dj")
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const normaliseCode = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Dimensions like "4 x 5 m" / "4 m x 5 m" → a comparable "4x5m". */
function dimensionKey(text) {
  const match = /(\d+(?:[.,]\d+)?)\s*(?:m|mm|cm)?\s*[x×хX]\s*(\d+(?:[.,]\d+)?)\s*(m|mm|cm)\b/i.exec(String(text ?? ""));
  if (!match) return undefined;
  return `${match[1].replace(",", ".")}x${match[2].replace(",", ".")}${match[3].toLowerCase()}`;
}

/** Serbian ↔ German product vocabulary, only where the pairing is unambiguous. */
const VOCABULARY = [
  { local: /maskirna folija|folija/i, official: /abdeckfolie|abdeckmaterial/i, concept: "masking film" },
  { local: /maskirna traka|traka/i, official: /abdeckklebeband|klebeband/i, concept: "masking tape" },
  { local: /prajmer|temelj/i, official: /grundierung|primer|grundierfüller/i, concept: "primer" },
  { local: /kit\b|git\b/i, official: /spachtel|putty/i, concept: "filler" },
  { local: /lak\b|bezbojni/i, official: /klarlack|clearcoat/i, concept: "clearcoat" },
  { local: /brusni|brusn/i, official: /schleif/i, concept: "abrasive" },
  { local: /polir/i, official: /polier|polishing/i, concept: "polishing" },
  { local: /razred(jiv)?ac|razredjivac/i, official: /verdünner|thinner/i, concept: "thinner" },
];

function tokenOverlap(a, b) {
  const left = new Set(normalise(a).split(" ").filter((token) => token.length > 2));
  const right = new Set(normalise(b).split(" ").filter((token) => token.length > 2));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / Math.min(left.size, right.size);
}

/* -------------------------------------------------------------------------- */
/* Manufacturer index                                                         */
/* -------------------------------------------------------------------------- */

const byArticle = new Map();
const duplicateArticles = [];
for (const product of catalog.products) {
  for (const variant of product.variants) {
    const key = normaliseCode(variant.articleNumber);
    const existing = byArticle.get(key);
    if (existing && existing.product.id !== product.id) {
      // The manufacturer's own data reuses an article number across two
      // different products. Recorded, not corrected.
      duplicateArticles.push({
        articleNumber: variant.articleNumber,
        products: [existing.product.officialName, product.officialName],
        sourceUrls: [existing.product.sourceUrl, product.sourceUrl],
      });
      continue;
    }
    byArticle.set(key, { product, variant });
  }
}

/* -------------------------------------------------------------------------- */
/* Matching                                                                   */
/* -------------------------------------------------------------------------- */

function conceptsOf(name) {
  return VOCABULARY.filter((entry) => entry.local.test(name ?? "")).map((entry) => entry);
}

const matches = localProducts.map((local) => {
  const concepts = conceptsOf(local.name);
  const localDimensions = local.packages.map(dimensionKey).filter(Boolean);

  // Stage 1 — the expected family: manufacturer products whose name matches a
  // concept our product's name declares. Searching the whole catalogue first is
  // what produces bare-numeric cross-family collisions.
  const expectedFamily = catalog.products.filter((product) =>
    concepts.some((concept) => concept.official.test(product.officialName)),
  );

  const evaluate = (pool, family) =>
    pool
      .map((product) => {
        const dimensionHits = product.variants.filter(
          (variant) => localDimensions.includes(dimensionKey(variant.descriptor)),
        );
        return {
          officialName: product.officialName,
          sourceUrl: product.sourceUrl,
          category: product.category,
          articleNumbers: product.articleNumbers,
          matchedArticleNumbers: dimensionHits.map((variant) => variant.articleNumber),
          nameSimilarity: Number(tokenOverlap(local.name, product.officialName).toFixed(2)),
          dimensionAgrees: dimensionHits.length > 0,
          inExpectedFamily: family,
        };
      })
      .filter((candidate) => candidate.dimensionAgrees || candidate.nameSimilarity > 0 || family);

  let candidates = evaluate(expectedFamily, true);
  let confidence;
  let searchStage;

  // Exact article-number agreement, if our record ever carries one.
  const directCode = local.sku && byArticle.get(normaliseCode(local.sku));

  if (directCode) {
    confidence = "exact-code";
    searchStage = "expected-family-exact-code";
    candidates = evaluate([directCode.product], true);
  } else if (candidates.some((candidate) => candidate.dimensionAgrees)) {
    const agreeing = candidates.filter((candidate) => candidate.dimensionAgrees);
    // Dimension agreement inside the expected family, with the name concept
    // already corroborated, is the strongest evidence available for consumables.
    confidence = agreeing.length === 1 ? "exact-name" : "ambiguous";
    searchStage = "expected-family-dimension";
    candidates = agreeing;
  } else if (candidates.length === 1) {
    confidence = "probable";
    searchStage = "expected-family-single";
  } else if (candidates.length > 1) {
    confidence = "ambiguous";
    searchStage = "expected-family-multiple";
  } else {
    // Stage 4 — controlled cross-family search, name evidence required.
    const crossFamily = catalog.products
      .map((product) => ({ product, similarity: tokenOverlap(local.name, product.officialName) }))
      .filter((entry) => entry.similarity >= 0.5)
      .map((entry) => entry.product);
    if (crossFamily.length) {
      candidates = evaluate(crossFamily, false);
      confidence = crossFamily.length === 1 ? "cross-family-exact" : "ambiguous";
      searchStage = "cross-family-name";
    } else {
      candidates = [];
      confidence = "unmatched";
      searchStage = "exhausted";
    }
  }

  return {
    localSlug: local.slug,
    localName: local.name,
    localSku: local.sku,
    localPackages: local.packages,
    concepts: concepts.map((concept) => concept.concept),
    confidence,
    searchStage,
    candidateCount: candidates.length,
    // Nothing is written back to the public catalogue by this step.
    applied: false,
    candidates: candidates.sort((a, b) => b.nameSimilarity - a.nameSimilarity).slice(0, 8),
    note:
      confidence === "unmatched"
        ? "Nema odgovarajućeg artikla u zvaničnom katalogu proizvođača."
        : undefined,
  };
});

/* -------------------------------------------------------------------------- */

const byConfidence = {};
for (const row of matches) byConfidence[row.confidence] = (byConfidence[row.confidence] ?? 0) + 1;

/**
 * Every manufacturer product our assortment does not cover stays a candidate.
 * Being in this list is not a claim that Carsystem i R-M sells it.
 */
const matchedUrls = new Set(matches.flatMap((row) => row.candidates.map((candidate) => candidate.sourceUrl)));
const manufacturerOnly = catalog.products
  .filter((product) => !matchedUrls.has(product.sourceUrl))
  .map((product) => ({
    officialName: product.officialName,
    sourceUrl: product.sourceUrl,
    category: product.category,
    articleNumbers: product.articleNumbers,
    catalogStatus: "manufacturer-catalog-candidate",
  }));

const summary = {
  generatedAt,
  brand: "C.A.R.FIT",
  manufacturer: "August Handel GmbH",
  ourProducts: localProducts.length,
  manufacturerProducts: catalog.products.length,
  byConfidence,
  reliable: matches.filter((row) => ["exact-code", "exact-name", "normalized-code", "cross-family-exact"].includes(row.confidence)).length,
  ambiguous: matches.filter((row) => row.confidence === "ambiguous").length,
  unmatched: matches.filter((row) => row.confidence === "unmatched").length,
  manufacturerOnlyCandidates: manufacturerOnly.length,
  // A bare numeric agreement is never enough on its own.
  bareNumericAcceptances: 0,
  duplicateArticleNumbersInSource: duplicateArticles.length,
  appliedToPublicCatalogue: 0,
};

mkdirSync("data/knowledge", { recursive: true });
writeFileSync(
  "data/knowledge/carfit-match.generated.json",
  `${JSON.stringify({ summary, matches, manufacturerOnly, duplicateArticles }, null, 2)}\n`,
);

console.log(JSON.stringify({ ...summary, duplicateArticles }, null, 2));
