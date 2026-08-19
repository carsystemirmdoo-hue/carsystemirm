#!/usr/bin/env node
/**
 * Phase 5 — Carsystem MATCH stage.
 *
 * Maps our 9 local Carsystem records onto the 462 official manufacturer
 * products, applying the corrected Cosmos rules.
 *
 * The shape of the problem is the inverse of Cosmos. There we had 742 local
 * shades against 679 official ones, roughly 1:1. Here our records are *generic*
 * — "Carsystem F19 brusni diskovi" corresponds to five distinct official
 * products (Finish 152 mm, Finish 77 mm, plain 150 mm, plain 77 mm, Soft), and
 * "Git Multi Green" to seven. Collapsing those to one arbitrary winner would
 * attach one variant's article numbers and documents to a record that means
 * something broader.
 *
 * So `ambiguous` is a first-class outcome here, not a failure: it records every
 * defensible candidate and asks a human which our record actually denotes.
 *
 * Confidence, never collapsed:
 *   exact-code          our article number appears in the official article list
 *   exact-name          normalised names identical
 *   normalized-code     code agrees after removing separators (F23 vs F.23)
 *   cross-family-exact  code agrees but the category differs
 *   ambiguous           several official products match equally well
 *   probable            strong name evidence, single candidate
 *   unmatched           no defensible correspondence
 *   source-conflict     evidence points two ways
 *
 * Output: data/knowledge/carsystem-match.generated.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const official = JSON.parse(
  readFileSync("data/knowledge/carsystem-catalog.generated.json", "utf8"),
);
const inventory = JSON.parse(readFileSync("docs/seo/BRAND_INVENTORY.json", "utf8"));

/**
 * Our local Carsystem records.
 *
 * Names and article numbers are read from the built product pages, which is
 * where the three separate local data sources are finally merged.
 */
const localSlugs =
  inventory.brands.find((brand) => brand.brandSlug === "carsystem")?.productSlugs ?? [];

const localProducts = [];
for (const slug of localSlugs) {
  const file = `.next/server/app/proizvodi/${slug}.html`;
  let html = "";
  try {
    html = readFileSync(file, "utf8");
  } catch {
    localProducts.push({ slug, name: slug, articleNumbers: [] });
    continue;
  }
  const name =
    /"@type":"Product"[\s\S]{0,200}?"name":"([^"]+)"/.exec(html)?.[1] ?? slug;
  const skuRaw = /\\"sku\\":\\"([^\\]+)\\"/.exec(html)?.[1] ?? "";
  // Some local SKUs are real article-number ranges ("159.218–159.226"),
  // others are internal placeholders ("CS-F19-DISC").
  const articleNumbers = [...skuRaw.matchAll(/\d{3}\.\d{3}/g)].map((m) => m[0]);
  localProducts.push({ slug, name, sku: skuRaw, articleNumbers });
}

/* -------------------------------------------------------------------------- */

const norm = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Comparison key that ignores separators, so "F23" equals "F.23". */
const squash = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const STOP = new Set([
  "carsystem", "cs", "serija", "series", "git", "brusni", "diskovi", "disc",
  "sanding", "der", "die", "das", "und", "mm", "set", "kit",
]);

const contentTokens = (value) =>
  new Set(norm(value).split(" ").filter((token) => token && !STOP.has(token)));

function jaccard(a, b) {
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

/** Our Serbian record names map onto the manufacturer's German category. */
const LOCAL_CATEGORY_HINT = {
  "carsystem-f19-brusni-diskovi": "schleifen",
  "carsystem-f23-brusni-diskovi": "schleifen",
  "carsystem-p19-brusni-diskovi": "schleifen",
  "carsystem-p23-brusni-diskovi": "schleifen",
  "carsystem-git-elastic-weiss": "spachteln",
  "carsystem-git-multi-green": "spachteln",
  "carsystem-soft-plus-git": "spachteln",
  "carsystem-zastitno-odelo": "arbeitsschutz",
  "carsystem-finish-serija": "finish",
};

/** Distinctive code tokens embedded in our record names, e.g. "F19". */
function localCodeTokens(record) {
  const out = new Set();
  for (const match of String(record.name).matchAll(/\b([A-Z]\.?\d{2})\b/gi)) {
    out.add(squash(match[1]));
  }
  for (const article of record.articleNumbers) out.add(squash(article));
  return out;
}

const results = [];
const claimedOfficial = new Set();

for (const record of localProducts) {
  const expectedCategory = LOCAL_CATEGORY_HINT[record.slug];
  const localTokens = contentTokens(record.name);
  const codes = localCodeTokens(record);

  const scored = [];
  for (const candidate of official.products) {
    const candidateSquashed = squash(
      `${candidate.officialName} ${candidate.subtitle ?? ""}`,
    );
    const candidateTokens = contentTokens(
      `${candidate.officialName} ${candidate.subtitle ?? ""}`,
    );
    const nameScore = jaccard(localTokens, candidateTokens);
    const nameExact = norm(record.name) === norm(candidate.officialName);

    // Article-number agreement is the strongest evidence available.
    const articleHit = record.articleNumbers.some((article) =>
      candidate.articleNumbers.includes(article),
    );
    // Code token agreement, separator-insensitive ("F23" ↔ "F.23").
    let codeHit;
    for (const code of codes) {
      if (code.length >= 3 && candidateSquashed.includes(code)) {
        if (!codeHit || code.length > codeHit.length) codeHit = code;
      }
    }

    const categoryAgrees = candidate.category === expectedCategory;
    if (!articleHit && !codeHit && nameScore < 0.25) continue;

    scored.push({
      candidate,
      nameScore,
      nameExact,
      articleHit,
      codeHit,
      categoryAgrees,
      score:
        nameScore +
        (articleHit ? 2 : 0) +
        (codeHit ? 1 + codeHit.length / 20 : 0) +
        (nameExact ? 1 : 0) +
        (categoryAgrees ? 0.35 : 0),
    });
  }

  scored.sort((a, b) => b.score - a.score);

  let confidence = "unmatched";
  let accepted = [];

  if (scored.length) {
    const best = scored[0];

    if (best.articleHit) {
      confidence = best.categoryAgrees ? "exact-code" : "cross-family-exact";
      accepted = [best];
    } else if (best.codeHit || best.nameExact || best.nameScore >= 0.5) {
      // Several candidates may match the same code equally well — our record is
      // then generic and cannot be resolved to one product by machine.
      const equallyGood = scored.filter(
        (entry) =>
          (entry.codeHit && entry.codeHit === best.codeHit) ||
          Math.abs(entry.score - best.score) < 0.15,
      );
      if (equallyGood.length > 1) {
        confidence = "ambiguous";
        accepted = equallyGood;
      } else if (best.nameExact) {
        confidence = "exact-name";
        accepted = [best];
      } else if (best.codeHit) {
        confidence = best.categoryAgrees ? "normalized-code" : "cross-family-exact";
        accepted = [best];
      } else {
        confidence = "probable";
        accepted = [best];
      }
    }
  }

  /**
   * Cross-language fallback.
   *
   * Our records are named in Serbian ("zaštitno odelo"), the manufacturer's in
   * German ("Schutzanzug"). Token comparison cannot bridge that, so a record
   * with no lexical match is not evidence that the product is absent — the
   * manufacturer lists seven protective suits. Classifying it `unmatched` would
   * assert absence we have not established.
   */
  if (confidence === "unmatched" && expectedCategory) {
    const inCategory = official.products.filter(
      (product) => product.category === expectedCategory,
    );
    if (inCategory.length) {
      confidence = "ambiguous";
      accepted = inCategory.slice(0, 8).map((candidate) => ({
        candidate,
        nameScore: 0,
        nameExact: false,
        articleHit: false,
        codeHit: undefined,
        categoryAgrees: true,
      }));
      results.crossLanguage = true;
    }
  }

  // Only a single, unambiguous, code-or-name backed match is applied.
  const applied =
    accepted.length === 1 &&
    ["exact-code", "exact-name", "normalized-code", "cross-family-exact"].includes(
      confidence,
    );

  if (applied) claimedOfficial.add(accepted[0].candidate.sourceUrl);

  results.push({
    localSlug: record.slug,
    localName: record.name,
    localSku: record.sku,
    localArticleNumbers: record.articleNumbers,
    expectedCategory,
    confidence,
    applied,
    candidateCount: accepted.length,
    // True when candidates come from the category fallback rather than from
    // lexical or code evidence — the expert must pick, the machine cannot.
    resolvedByCategoryFallback:
      confidence === "ambiguous" && accepted.every((entry) => !entry.codeHit && !entry.articleHit && entry.nameScore === 0),
    categoryProductCount: expectedCategory
      ? official.products.filter((p) => p.category === expectedCategory).length
      : 0,
    candidates: accepted.slice(0, 8).map((entry) => ({
      officialName: entry.candidate.officialName,
      subtitle: entry.candidate.subtitle,
      category: entry.candidate.category,
      sourceUrl: entry.candidate.sourceUrl,
      articleNumbers: entry.candidate.articleNumbers,
      nameSimilarity: Number(entry.nameScore.toFixed(3)),
      matchedOnArticle: entry.articleHit,
      matchedOnCode: entry.codeHit,
      categoryAgrees: entry.categoryAgrees,
    })),
  });
}

/* -- Manufacturer-only products -------------------------------------------- */

const candidates = official.products.filter(
  (product) => !claimedOfficial.has(product.sourceUrl),
);

/* -- Invariant: an unmatched local product must not shadow a candidate ------ */

const violations = [];
for (const row of results.filter((entry) => entry.confidence === "unmatched")) {
  const record = localProducts.find((item) => item.slug === row.localSlug);
  const codes = localCodeTokens(record);
  for (const candidate of candidates) {
    const squashed = squash(`${candidate.officialName} ${candidate.subtitle ?? ""}`);
    for (const code of codes) {
      if (code.length >= 3 && squashed.includes(code)) {
        violations.push({
          localSlug: row.localSlug,
          localName: row.localName,
          candidateName: candidate.officialName,
          candidateUrl: candidate.sourceUrl,
          sharedCode: code,
        });
      }
    }
    if (record.articleNumbers.some((a) => candidate.articleNumbers.includes(a))) {
      violations.push({
        localSlug: row.localSlug,
        localName: row.localName,
        candidateName: candidate.officialName,
        candidateUrl: candidate.sourceUrl,
        sharedArticle: true,
      });
    }
  }
}

const byConfidence = results.reduce((acc, row) => {
  acc[row.confidence] = (acc[row.confidence] ?? 0) + 1;
  return acc;
}, {});

const summary = {
  generatedAt: new Date().toISOString(),
  localProducts: localProducts.length,
  officialProducts: official.products.length,
  byConfidence,
  applied: results.filter((row) => row.applied).length,
  ambiguous: results.filter((row) => row.confidence === "ambiguous").length,
  requiringReview: results.filter((row) => !row.applied).length,
  manufacturerOnlyCandidates: candidates.length,
  invariantViolations: violations.length,
};

mkdirSync("data/knowledge", { recursive: true });
writeFileSync(
  "data/knowledge/carsystem-match.generated.json",
  `${JSON.stringify(
    {
      summary,
      matches: results,
      manufacturerOnlyCandidates: candidates.map((product) => ({
        officialName: product.officialName,
        subtitle: product.subtitle,
        category: product.category,
        sourceUrl: product.sourceUrl,
        articleNumbers: product.articleNumbers,
      })),
      invariantViolations: violations,
    },
    null,
    2,
  )}\n`,
);

console.log(JSON.stringify(summary, null, 2));
for (const row of results) {
  console.log(
    `  ${row.confidence.padEnd(18)} ${row.localName.slice(0, 34).padEnd(36)} → ${row.candidateCount} kandidat(a)`,
  );
}
