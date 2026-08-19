#!/usr/bin/env node
/**
 * Carsystem Phase 2 — website ↔ TDS cross-check.
 *
 * We now hold two independent evidence sets for the same products: 1,909 claims
 * read off the manufacturer's product pages and 1,790 read out of its technical
 * data sheets. Where they disagree, neither is silently discarded.
 *
 * A TDS normally carries more evidentiary weight than a web page — it is
 * versioned, dated and written for professionals. But "higher weight" is not
 * "authority to overwrite", so a disagreement is classified and both values are
 * kept for the expert.
 *
 * Classifications:
 *   CONSISTENT              both state the same thing
 *   TDS_MORE_SPECIFIC       TDS adds a value/unit/condition the website lacks
 *   WEBSITE_MORE_SPECIFIC   the page is more precise than the sheet
 *   CONDITIONAL_DIFFERENCE  same measure, different stated condition
 *   VALUE_CONFLICT          same field, incompatible values
 *   REVISION_DIFFERENCE     documents carry different revisions
 *   NOT_COMPARABLE          no shared field to compare
 *
 * Output: data/knowledge/carsystem-source-crosscheck.generated.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const websiteClaims = JSON.parse(
  readFileSync("data/knowledge/carsystem-website-claims.generated.json", "utf8"),
);
const tdsClaims = JSON.parse(
  readFileSync("data/knowledge/carsystem-tds-claims.generated.json", "utf8"),
);

const generatedAt = new Date().toISOString();

const websiteBySlug = new Map(websiteClaims.records.map((record) => [record.slug, record]));

/** Website field ↔ TDS field, only where the two genuinely measure the same thing. */
const COMPARABLE = [
  { website: "temperatureResistance", tds: "temperatureResistance" },
  { website: "colour", tds: "colour" },
  { website: "abrasiveGrain", tds: "abrasiveGrainType" },
  { website: "substrates", tds: "substrate" },
];

/** Numbers present in a value, for compatibility comparison. */
function numbersIn(text) {
  return [...String(text).matchAll(/-?\d+(?:[.,]\d+)?/g)].map((match) =>
    Number(match[0].replace(",", ".")),
  );
}

const normalise = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const comparisons = [];

for (const record of tdsClaims.records) {
  for (const productSlug of record.appliesToProducts) {
    const website = websiteBySlug.get(productSlug);
    if (!website) continue;

    for (const pair of COMPARABLE) {
      const websiteSide = website.claims.filter((claim) => claim.field === pair.website);
      const tdsSide = record.claims.filter((claim) => claim.field === pair.tds);
      if (!websiteSide.length && !tdsSide.length) continue;

      if (!websiteSide.length || !tdsSide.length) {
        comparisons.push({
          productSlug,
          field: pair.tds,
          classification: tdsSide.length ? "TDS_MORE_SPECIFIC" : "WEBSITE_MORE_SPECIFIC",
          websiteValue: websiteSide[0]?.value,
          tdsValue: tdsSide[0]?.value,
          tdsDocument: record.documentFileName,
          tdsPage: tdsSide[0]?.page,
          note: tdsSide.length
            ? "Podatak postoji samo u tehničkom listu."
            : "Podatak postoji samo na sajtu proizvođača.",
        });
        continue;
      }

      // Substrates compare by slug + polarity, everything else by value text.
      if (pair.tds === "substrate") {
        for (const tdsClaim of tdsSide) {
          const websiteMatch = websiteSide.find(
            (claim) => claim.value?.substrate === tdsClaim.value.substrate,
          );
          if (!websiteMatch) {
            comparisons.push({
              productSlug,
              field: "substrate",
              classification: "TDS_MORE_SPECIFIC",
              tdsValue: tdsClaim.value,
              tdsDocument: record.documentFileName,
              tdsPage: tdsClaim.page,
              note: "Podloga navedena samo u tehničkom listu.",
            });
            continue;
          }
          const samePolarity =
            websiteMatch.value.suitability === tdsClaim.value.suitability;
          comparisons.push({
            productSlug,
            field: "substrate",
            // A polarity disagreement is the most serious conflict class here:
            // one source permits a substrate the other forbids.
            classification: samePolarity ? "CONSISTENT" : "VALUE_CONFLICT",
            websiteValue: websiteMatch.value,
            tdsValue: tdsClaim.value,
            websiteExcerpt: websiteMatch.rawText?.slice(0, 140),
            tdsExcerpt: tdsClaim.excerpt?.slice(0, 140),
            tdsDocument: record.documentFileName,
            tdsPage: tdsClaim.page,
            note: samePolarity
              ? undefined
              : "Izvori se ne slažu oko toga da li je podloga dozvoljena.",
          });
        }
        continue;
      }

      const websiteValue = websiteSide[0].value;
      const tdsClaim = tdsSide[0];
      const websiteNumbers = numbersIn(websiteValue);
      const tdsNumbers = numbersIn(tdsClaim.value);

      let classification;
      if (normalise(websiteValue) === normalise(tdsClaim.value)) {
        classification = "CONSISTENT";
      } else if (tdsClaim.condition) {
        // The sheet states a condition the page omits — not a conflict, a
        // qualification the page dropped.
        classification = "CONDITIONAL_DIFFERENCE";
      } else if (
        websiteNumbers.length &&
        tdsNumbers.length &&
        websiteNumbers.some((number) => tdsNumbers.includes(number))
      ) {
        classification = "CONSISTENT";
      } else if (websiteNumbers.length && tdsNumbers.length) {
        classification = "VALUE_CONFLICT";
      } else if (tdsClaim.unit && !websiteNumbers.length) {
        classification = "TDS_MORE_SPECIFIC";
      } else {
        classification = "NOT_COMPARABLE";
      }

      comparisons.push({
        productSlug,
        field: pair.tds,
        classification,
        websiteValue,
        tdsValue: tdsClaim.value,
        tdsUnit: tdsClaim.unit,
        tdsCondition: tdsClaim.condition,
        websiteExcerpt: websiteSide[0].rawText?.slice(0, 140),
        tdsExcerpt: tdsClaim.excerpt?.slice(0, 140),
        tdsDocument: record.documentFileName,
        tdsRevision: record.documentRevision,
        tdsPage: tdsClaim.page,
      });
    }
  }
}

const byClassification = {};
for (const comparison of comparisons) {
  byClassification[comparison.classification] =
    (byClassification[comparison.classification] ?? 0) + 1;
}

const summary = {
  generatedAt,
  brand: "Carsystem",
  websiteClaims: websiteClaims.summary.totalClaims,
  tdsClaims: tdsClaims.summary.totalClaims,
  comparisons: comparisons.length,
  byClassification,
  conflicts: comparisons.filter((entry) => entry.classification === "VALUE_CONFLICT").length,
  // Nothing here is auto-resolved; every disagreement goes to the expert.
  autoResolved: 0,
};

mkdirSync("data/knowledge", { recursive: true });
writeFileSync(
  "data/knowledge/carsystem-source-crosscheck.generated.json",
  `${JSON.stringify({ summary, comparisons }, null, 2)}\n`,
);

console.log(JSON.stringify(summary, null, 2));
