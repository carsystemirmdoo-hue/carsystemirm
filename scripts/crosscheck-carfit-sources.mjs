#!/usr/bin/env node
/**
 * Phase 5 — C.A.R.FIT website ↔ TDS cross-check (VERIFY).
 *
 * Two independent evidence sets now cover the same products: 1,096 claims read
 * off the manufacturer's product pages and 567 read out of its data sheets.
 * A data sheet normally carries more evidentiary weight than a web page, but
 * "more weight" is not "authority to overwrite" — every disagreement is
 * classified and both values are kept.
 *
 * Classifications:
 *   CONSISTENT              both state the same thing
 *   TDS_MORE_SPECIFIC       the sheet adds a value/unit/condition the page lacks
 *   WEBSITE_MORE_SPECIFIC   the page is more precise than the sheet
 *   CONDITIONAL_DIFFERENCE  same measure, different stated condition
 *   VALUE_CONFLICT          same field, incompatible values
 *   NOT_COMPARABLE          no shared field to compare
 *
 * Output: data/knowledge/carfit-source-crosscheck.generated.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const website = JSON.parse(readFileSync("data/knowledge/carfit-website-claims.generated.json", "utf8"));
const tds = JSON.parse(readFileSync("data/knowledge/carfit-tds-claims.generated.json", "utf8"));

const generatedAt = new Date().toISOString();
const websiteBySlug = new Map(website.records.map((record) => [record.slug, record]));

/** Only fields where the two sources genuinely measure the same quantity. */
const COMPARABLE = [
  "colour", "density", "voc", "vocRegulation", "flashPoint",
  "composition", "potLife", "coverage", "shelfLife", "viscosity", "gloss",
];

const normalise = (value) =>
  String(value ?? "").toLowerCase().replace(/\s+/g, " ").replace(/,/g, ".").trim();

const numbersIn = (text) =>
  [...String(text).matchAll(/-?\d+(?:[.,]\d+)?/g)].map((match) => Number(match[0].replace(",", ".")));

const comparisons = [];

for (const record of tds.records) {
  for (const productSlug of record.appliesToProducts) {
    const site = websiteBySlug.get(productSlug);
    if (!site) continue;

    for (const field of COMPARABLE) {
      const siteSide = site.claims.filter((claim) => claim.field === field);
      const tdsSide = record.claims.filter((claim) => claim.field === field);
      if (!siteSide.length && !tdsSide.length) continue;

      if (!siteSide.length || !tdsSide.length) {
        comparisons.push({
          productSlug,
          field,
          classification: tdsSide.length ? "TDS_MORE_SPECIFIC" : "WEBSITE_MORE_SPECIFIC",
          websiteValue: siteSide[0]?.value,
          tdsValue: tdsSide[0]?.value,
          tdsDocument: record.documentFileName,
          tdsPage: tdsSide[0]?.page,
          note: tdsSide.length
            ? "Podatak postoji samo u tehničkom listu."
            : "Podatak postoji samo na sajtu proizvođača.",
        });
        continue;
      }

      const websiteValue = siteSide[0].value;
      const tdsClaim = tdsSide[0];
      const websiteNumbers = numbersIn(websiteValue);
      const tdsNumbers = numbersIn(tdsClaim.value);

      let classification;
      if (normalise(websiteValue) === normalise(tdsClaim.value)) {
        classification = "CONSISTENT";
      } else if (tdsClaim.condition && !siteSide[0].condition) {
        // The sheet states a condition the page omits. That is a qualification
        // the page dropped, not a contradiction.
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
        field,
        classification,
        websiteValue,
        websiteScope: siteSide[0].scope,
        tdsValue: tdsClaim.value,
        tdsUnit: tdsClaim.unit,
        tdsCondition: tdsClaim.condition,
        websiteExcerpt: siteSide[0].rawText?.slice(0, 140),
        tdsExcerpt: tdsClaim.excerpt?.slice(0, 140),
        tdsDocument: record.documentFileName,
        tdsPage: tdsClaim.page,
        // A family-scoped page value compared against a single sheet is not a
        // like-for-like comparison; flagged so the expert can see why.
        scopeCaveat: String(siteSide[0].scope).startsWith("family")
          ? "Vrednost sa sajta važi za porodicu, tehnički list može opisivati jednu varijantu."
          : undefined,
      });
    }
  }
}

const byClassification = {};
for (const comparison of comparisons) {
  byClassification[comparison.classification] = (byClassification[comparison.classification] ?? 0) + 1;
}

const summary = {
  generatedAt,
  brand: "C.A.R.FIT",
  websiteClaims: website.summary.totalClaims,
  tdsClaims: tds.summary.totalClaims,
  comparisons: comparisons.length,
  byClassification,
  conflicts: comparisons.filter((entry) => entry.classification === "VALUE_CONFLICT").length,
  withScopeCaveat: comparisons.filter((entry) => entry.scopeCaveat).length,
  // Nothing is auto-resolved; every disagreement goes to the expert.
  autoResolved: 0,
};

mkdirSync("data/knowledge", { recursive: true });
writeFileSync(
  "data/knowledge/carfit-source-crosscheck.generated.json",
  `${JSON.stringify({ summary, comparisons }, null, 2)}\n`,
);

console.log(JSON.stringify(summary, null, 2));
