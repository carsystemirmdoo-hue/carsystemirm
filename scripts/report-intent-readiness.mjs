#!/usr/bin/env node
/**
 * Phase 3, step 9 — re-evaluate the 20 answer intents against extracted
 * evidence, and report BEFORE vs AFTER.
 *
 * BEFORE is recomputed with evidence forced off rather than read from a stored
 * snapshot, so the comparison always reflects the current intent records and
 * cannot go stale.
 *
 * Mirrors `resolveAnswerIntentReadiness()` in the TypeScript layer. The
 * duplication is deliberate: this script has to run without a TS build step,
 * and `scripts/validate-knowledge.mjs` cross-checks the two agree.
 *
 * Output: docs/seo/RM_INTENT_READINESS.json + console table
 */

import { readFileSync, writeFileSync } from "node:fs";

const extraction = JSON.parse(
  readFileSync("data/knowledge/rm-technical-extraction.generated.json", "utf8"),
);

/* -- Parse intent records --------------------------------------------------- */

const source = readFileSync("data/knowledge/answer-intents.ts", "utf8");
const intents = [];
for (const block of source.split(/\n  \{\n/).slice(1)) {
  const pick = (key) => block.match(new RegExp(`${key}: "([^"]*)"`))?.[1];
  const list = (key) => {
    const raw = block.match(new RegExp(`${key}: \\[([\\s\\S]*?)\\]`))?.[1];
    return raw ? [...raw.matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
  };
  const slug = pick("slug");
  if (!slug) continue;
  intents.push({
    slug,
    question: pick("question"),
    priority: pick("priority"),
    primaryBlocker: pick("primaryBlocker"),
    substrateSlugs: list("substrateSlugs"),
    processStepSlugs: list("processStepSlugs"),
    defectSlugs: list("defectSlugs"),
    requiredTechnicalFields: list("requiredTechnicalFields"),
    hasAnswerValue: !/answer: unknownClaim/.test(block),
  });
}

/* -- Evidence from the extraction ------------------------------------------ */

const substrateEvidence = new Map();
const fieldProductCounts = new Map();

for (const record of extraction.records) {
  for (const claim of record.claims) {
    if (claim.value !== undefined && !claim.ambiguous) {
      fieldProductCounts.set(
        claim.field,
        (fieldProductCounts.get(claim.field) ?? 0) + 1,
      );
    }
    if (claim.field !== "substrates" || !claim.value) continue;
    for (const entry of claim.value) {
      if (entry.unmapped) continue;
      for (const slug of entry.slugs) {
        const bucket = substrateEvidence.get(slug) ?? [];
        bucket.push({
          productSlug: record.productSlug,
          suitability: entry.suitability,
          category: record.category,
        });
        substrateEvidence.set(slug, bucket);
      }
    }
  }
}

function evidenceFor(intent) {
  const details = [];
  const supporting = new Set();
  for (const slug of intent.substrateSlugs) {
    const matches = substrateEvidence.get(slug) ?? [];
    if (!matches.length) continue;
    const direct = matches.filter((m) => m.suitability === "suitable").length;
    const primed = matches.filter((m) => m.suitability === "requires-primer").length;
    // Category breakdown matters: substrate evidence drawn from primers does
    // not, on its own, answer a question about body fillers. Showing the split
    // stops the count from implying more than it does.
    const byCategory = {};
    for (const match of matches) {
      byCategory[match.category] = (byCategory[match.category] ?? 0) + 1;
    }
    const categoryText = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => `${category} ${count}`)
      .join(", ");
    details.push(
      `podloga "${slug}": ${matches.length} proizvoda (${direct} direktno, ${primed} uz temeljenje) — po kategoriji: ${categoryText}`,
    );
    for (const match of matches) supporting.add(match.productSlug);
  }
  for (const field of intent.requiredTechnicalFields) {
    const count = fieldProductCounts.get(field) ?? 0;
    if (count > 0) details.push(`polje "${field}": ${count} proizvoda`);
  }
  return { hasEvidence: details.length > 0, details, supporting: [...supporting] };
}

/* -- Readiness (mirrors lib/knowledge/answer-intents.ts) -------------------- */

function resolveReadiness(intent, hasEvidence) {
  if (intent.hasAnswerValue) return "blocked-by-expert-validation";
  if (intent.primaryBlocker === "expert-validation") {
    return "blocked-by-expert-validation";
  }
  if (intent.primaryBlocker === "technical-data") {
    if (hasEvidence) return "blocked-by-expert-validation";
    const hasLinks =
      intent.substrateSlugs.length ||
      intent.processStepSlugs.length ||
      intent.defectSlugs.length;
    return hasLinks ? "partially-answerable" : "blocked-by-technical-data";
  }
  return "blocked-by-technical-data";
}

const rows = intents.map((intent) => {
  const evidence = evidenceFor(intent);
  return {
    slug: intent.slug,
    question: intent.question,
    priority: intent.priority,
    before: resolveReadiness(intent, false),
    after: resolveReadiness(intent, evidence.hasEvidence),
    hasEvidence: evidence.hasEvidence,
    evidenceDetails: evidence.details,
    supportingProductCount: evidence.supporting.length,
  };
});

function tally(key) {
  const counts = {
    "answerable-now": 0,
    "partially-answerable": 0,
    "blocked-by-technical-data": 0,
    "blocked-by-expert-validation": 0,
  };
  for (const row of rows) counts[row[key]] += 1;
  return counts;
}

const result = {
  generatedAt: new Date().toISOString(),
  before: tally("before"),
  after: tally("after"),
  changed: rows.filter((row) => row.before !== row.after).length,
  withEvidence: rows.filter((row) => row.hasEvidence).length,
  rows,
};

writeFileSync(
  "docs/seo/RM_INTENT_READINESS.json",
  `${JSON.stringify(result, null, 2)}\n`,
);

const LABEL = {
  "answerable-now": "ODGOVORIVO SADA",
  "partially-answerable": "DELIMIČNO",
  "blocked-by-technical-data": "BLOK: TEH. PODACI",
  "blocked-by-expert-validation": "BLOK: STRUČNA VALIDACIJA",
};

console.log("\nANSWER INTENT READINESS — BEFORE vs AFTER PHASE 3\n");
console.log(`${"".padEnd(28)}${"BEFORE".padStart(7)}${"AFTER".padStart(8)}`);
for (const key of Object.keys(result.before)) {
  console.log(
    LABEL[key].padEnd(28) +
      String(result.before[key]).padStart(7) +
      String(result.after[key]).padStart(8),
  );
}
console.log(`\nPromenjeno: ${result.changed} / ${rows.length}`);
console.log(`Sa dokazima iz dokumentacije: ${result.withEvidence}\n`);
console.log("Promene:");
for (const row of rows.filter((item) => item.before !== item.after)) {
  console.log(`  • ${row.question}`);
  console.log(`      ${LABEL[row.before]} -> ${LABEL[row.after]}`);
  for (const detail of row.evidenceDetails) console.log(`      dokaz: ${detail}`);
}
console.log("");
