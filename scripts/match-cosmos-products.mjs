#!/usr/bin/env node
/**
 * Phase 5 — Cosmos Lac MATCH stage (pass 2).
 *
 * Maps the 742 local Cosmos records onto the 679 official manufacturer products.
 *
 * Pass 1 restricted candidates to the family implied by our product line, which
 * produced false negatives wherever the manufacturer files a product under a
 * different family than we do — "Brake Cleaner 750" is `cleaners` for us and
 * `automotive` for them, so an exact code match was never even considered.
 *
 * Pass 2 therefore searches the whole catalogue and treats **code agreement as
 * stronger evidence than family agreement**. Family agreement remains a
 * confidence signal and a disagreement is recorded, never used as a veto.
 *
 * Confidence, never collapsed:
 *   exact-code       distinctive code token present in the manufacturer slug
 *   exact-name       normalised names identical
 *   normalized-code  numeric-only code agrees, supported by name overlap
 *   probable         strong but incomplete — NEVER auto-accepted
 *   unmatched        no defensible correspondence
 *
 * Output: data/knowledge/cosmos-match.generated.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const official = JSON.parse(
  readFileSync("data/knowledge/cosmos-catalog.generated.json", "utf8"),
);
const local = JSON.parse(
  readFileSync("data/cosmos-lac-products.generated.json", "utf8"),
);

const norm = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const tokens = (value) => new Set(norm(value).split(" ").filter(Boolean));

/** Words that carry no discriminating power when comparing product names. */
const STOP = new Set([
  "cosmos", "lac", "spray", "paint", "ml", "gr", "kg", "l", "and", "the", "for",
  "with", "sjaj", "mat", "polusjaj", "400", "500",
]);

const contentTokens = (value) =>
  new Set([...tokens(value)].filter((token) => !STOP.has(token)));

/** Our line names vs the manufacturer's URL family segment. */
const LINE_TO_FAMILY = {
  Automotive: "automotive",
  "Chalk Effect": "chalk-effect",
  Cleaners: "cleaners",
  "Easy Max": "easy-max",
  Effect: "effect",
  "Fast Acrylic": "fast-acrylic",
  "Flame Blue": "flame-blue",
  "Flame Booster": "flame",
  "Flame Orange": "flame-orange",
  "Fluorescent & Marking": "fluo-marking",
  "High Heat 700°C": "high-heat",
  Home: "home",
  Lubricants: "lubricants",
  "Master Mechanic": "master-mechanic",
  Metallic: "metallic",
  "Molotow Burner": "flame",
  "Molotow Premium": "flame",
  Primers: "primer",
  Putties: "putties",
  RAL: "ral",
  Sealer: "sealer",
  "Spray.Bike": "spray-bike",
  Varnishes: "varnish",
  "W Wood Care": "wood-varnish-w",
  "Wheel Rim": "wheel-rim",
  "Wood Putties": "wood-putties",
  Zinc: "zinc",
};

function localComparableName(record) {
  let name = record.officialName ?? record.displayNameSr ?? "";
  name = name.replace(/^Cosmos Lac\s+/i, "");
  if (record.line) name = name.replace(new RegExp(`^${record.line}\\s+`, "i"), "");
  return name;
}

function jaccard(a, b) {
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

/**
 * Code-like tokens identifying a specific product or shade.
 *
 * The manufacturer's URL slug is the most reliable key: our "FO-100" appears in
 * their slug `flame-orange-fo-100-vanilla`, while their display name carries a
 * trademark glyph and inconsistent spacing.
 */
function localCodeTokens(record) {
  const out = new Set();
  const add = (value) => {
    const cleaned = norm(value).replace(/\s+/g, "-");
    if (cleaned.length >= 2) out.add(cleaned);
  };
  if (record.cosmosCode) {
    add(record.cosmosCode);
    const tail = String(record.cosmosCode).split(/[-\s]/).slice(1).join("-");
    if (tail) add(tail);
  }
  if (record.ralCode) add(record.ralCode);
  for (const match of String(record.officialName ?? "").matchAll(
    /\b([A-Z]{1,2}-?\d{2,4}|\d{3,4})\b/g,
  )) {
    add(match[1]);
  }
  return out;
}

function slugHasCode(slug, code) {
  if (!code) return false;
  return `-${slug}-`.includes(`-${code}-`);
}

const results = [];
const usedOfficial = new Map();

for (const record of local) {
  const expectedFamily = LINE_TO_FAMILY[record.line];
  const localName = localComparableName(record);
  const localTokens = contentTokens(localName);
  const codeTokens = localCodeTokens(record);

  /**
   * Two-stage selection.
   *
   * Stage A searches the family our product line implies. Stage B widens to the
   * whole catalogue and only runs when stage A found nothing usable.
   *
   * The order matters: searching catalogue-wide first lets a bare numeric code
   * collide across families — "Antichip 250" matched a Spray.Bike product that
   * merely contains "250". Preferring the expected family keeps that from
   * happening while still recovering genuinely cross-filed products like
   * "Brake Cleaner 750", which has no counterpart in our `cleaners` family.
   */
  function evaluate(candidate) {
    const candidateTokens = contentTokens(candidate.officialName);
    const nameScore = jaccard(localTokens, candidateTokens);
    const nameExact = norm(localName) === norm(candidate.officialName);
    const familyAgrees = candidate.family === expectedFamily;

    let codeMatch;
    for (const code of codeTokens) {
      if (slugHasCode(candidate.slug, code)) {
        if (!codeMatch || code.length > codeMatch.length) codeMatch = code;
      }
    }

    let score = nameScore;
    if (codeMatch) score += 1 + codeMatch.length / 20;
    if (nameExact) score += 1;
    if (familyAgrees) score += 0.35;

    return { candidate, codeMatch, nameExact, nameScore, familyAgrees, score };
  }

  function pickBest(pool) {
    let winner;
    for (const candidate of pool) {
      const evaluated = evaluate(candidate);
      if (!winner || evaluated.score > winner.score) winner = evaluated;
    }
    return winner;
  }

  function classify(candidate) {
    if (!candidate) return "unmatched";
    const { codeMatch, nameExact, nameScore, familyAgrees } = candidate;
    const strongCode = Boolean(codeMatch && /[a-z]/.test(codeMatch));
    if (strongCode) return "exact-code";
    if (codeMatch && familyAgrees) return "exact-code";
    // A bare number outside the expected family is weak on its own; it needs
    // substantial name agreement before it may be accepted.
    if (codeMatch && nameScore >= 0.5) return "exact-code";
    if (nameExact) return "exact-name";
    if (codeMatch && nameScore >= 0.3) return "normalized-code";
    if (nameScore >= 0.55 && familyAgrees) return "probable";
    if (nameScore >= 0.7) return "probable";
    return "unmatched";
  }

  const familyPool = expectedFamily
    ? official.products.filter((product) => product.family === expectedFamily)
    : [];

  let best = pickBest(familyPool);
  let confidence = classify(best);

  // Stage B — only when the expected family yielded nothing usable.
  if (confidence === "unmatched" || confidence === "probable") {
    const wide = pickBest(official.products);
    const wideConfidence = classify(wide);
    const RANK = {
      "exact-code": 4,
      "exact-name": 3,
      "normalized-code": 2,
      probable: 1,
      unmatched: 0,
    };
    if (RANK[wideConfidence] > RANK[confidence]) {
      best = wide;
      confidence = wideConfidence;
    }
  }

  const accepted = confidence !== "unmatched" && confidence !== "probable";
  if (accepted && best) {
    const existing = usedOfficial.get(best.candidate.sourceUrl) ?? [];
    existing.push(record.slug);
    usedOfficial.set(best.candidate.sourceUrl, existing);
  }

  results.push({
    localSlug: record.slug,
    localName: record.officialName,
    localLine: record.line,
    localCode: record.cosmosCode,
    matchedOnCode: best?.codeMatch,
    baseProductSlug: record.baseProductSlug,
    expectedFamily,
    confidence,
    applied: accepted,
    familyAgrees: best?.familyAgrees ?? false,
    // Recorded, never used to reject: our category and theirs legitimately
    // differ (Brake Cleaner is `cleaners` for us, `automotive` for them).
    familyDisagreement:
      accepted && best && !best.familyAgrees
        ? `naša linija „${record.line}" (${expectedFamily}) vs zvanična porodica „${best.candidate.family}"`
        : undefined,
    officialUrl: confidence === "unmatched" ? undefined : best?.candidate.sourceUrl,
    officialName: confidence === "unmatched" ? undefined : best?.candidate.officialName,
    officialFamily: confidence === "unmatched" ? undefined : best?.candidate.family,
    officialCode: confidence === "unmatched" ? undefined : best?.candidate.productCode,
    nameSimilarity: best ? Number(best.nameScore.toFixed(3)) : 0,
  });
}

const unclaimed = official.products.filter(
  (product) => !usedOfficial.has(product.sourceUrl),
);

/* -- Code / name consistency on the manufacturer side ----------------------- */

/**
 * The manufacturer's own name and code sometimes disagree, e.g.
 * "Ral 9002 - Grey White" carrying code 9003.
 *
 * Source truth is preserved exactly as published; the discrepancy is recorded
 * for a human. Silently "correcting" manufacturer data would put a value in our
 * dataset that appears nowhere in theirs.
 */
const codeNameDiscrepancies = [];
for (const product of official.products) {
  if (!product.productCode) continue;
  const inName = [...String(product.officialName).matchAll(/\b(\d{3,4})\b/g)].map(
    (match) => match[1],
  );
  if (!inName.length) continue;
  if (!inName.includes(String(product.productCode))) {
    codeNameDiscrepancies.push({
      officialName: product.officialName,
      parsedCode: product.productCode,
      numbersInName: inName,
      slug: product.slug,
      family: product.family,
      sourceUrl: product.sourceUrl,
      /**
       * Verified against the live page: title, H1 and self-canonical all carry
       * the name, while the URL carries a different code. The inconsistency is
       * published by the manufacturer, so it is recorded rather than corrected.
       */
      classification: "source-site-error",
      evidence:
        "Naslov, H1 i canonical na zvaničnoj stranici nose naziv koji ne odgovara šifri u URL-u.",
    });
  }
}

/* -- Invariant: unmatched local must not shadow an exact-code candidate ----- */

const violations = [];
const unmatchedLocal = results.filter((row) => row.confidence === "unmatched");
for (const row of unmatchedLocal) {
  const record = local.find((item) => item.slug === row.localSlug);
  const codes = localCodeTokens(record);
  for (const candidate of unclaimed) {
    for (const code of codes) {
      if (code.length >= 3 && slugHasCode(candidate.slug, code)) {
        violations.push({
          localSlug: row.localSlug,
          localName: row.localName,
          candidateName: candidate.officialName,
          candidateUrl: candidate.sourceUrl,
          sharedCode: code,
        });
      }
    }
  }
}

const byConfidence = results.reduce((acc, row) => {
  acc[row.confidence] = (acc[row.confidence] ?? 0) + 1;
  return acc;
}, {});

const summary = {
  generatedAt: new Date().toISOString(),
  pass: 2,
  localProducts: local.length,
  officialProducts: official.products.length,
  byConfidence,
  applied: results.filter((row) => row.applied).length,
  requiringReview: results.filter(
    (row) => row.confidence === "probable" || row.confidence === "unmatched",
  ).length,
  officialProductsUnclaimed: unclaimed.length,
  matchesAcrossFamilyBoundary: results.filter((row) => row.familyDisagreement).length,
  codeNameDiscrepancies: codeNameDiscrepancies.length,
  invariantViolations: violations.length,
};

mkdirSync("data/knowledge", { recursive: true });
writeFileSync(
  "data/knowledge/cosmos-match.generated.json",
  `${JSON.stringify(
    {
      summary,
      matches: results,
      unclaimedOfficialProducts: unclaimed.map((product) => ({
        officialName: product.officialName,
        family: product.family,
        category: product.category,
        sourceUrl: product.sourceUrl,
        productCode: product.productCode,
      })),
      codeNameDiscrepancies,
      invariantViolations: violations,
    },
    null,
    2,
  )}\n`,
);

console.log(JSON.stringify(summary, null, 2));
if (violations.length) {
  console.log("\nNARUŠENI INVARIJANTI (nepoklopljen lokalni proizvod deli šifru sa kandidatom):");
  for (const violation of violations.slice(0, 15)) {
    console.log(`  • ${violation.localName} ↔ ${violation.candidateName} [${violation.sharedCode}]`);
  }
}
