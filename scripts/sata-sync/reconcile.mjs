#!/usr/bin/env node
/**
 * SATA sync — RECONCILE: zvanični opseg ↔ STVARNI runtime kataloga.
 *
 *   A = zvanične porodice u opsegu            B = te porodice kao VIDLJIVE kartice u runtime-u
 *   C = zvanični brojevi artikala u opsegu    D = ti brojevi kao redovi konfiguracija u runtime-u
 *
 * Opseg je „SATA EMEA REFINISH FAMILY SCOPE”. Aktuelni artikli van opsega (faza 2, rezervni delovi,
 * industrijski program, reklamni artikli, drugi regioni) se prijavljuju ZASEBNO i nikad kao „nedostaje”.
 * Meri se runtime (`getCatalogListingData().canonical`), ne dataset.
 */

import { readFileSync } from "node:fs";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { loadCatalogRuntime } from "../lib/catalog-runtime.mjs";
import { PATHS, SCOPE_NAME } from "./lib/config.mjs";
import { europeVariants, partitionStandalone, splitFamilies } from "./lib/scope.mjs";

const source = readJson(PATHS.source);
const dataset = readJson(PATHS.siteDataset);
const taxonomy = JSON.parse(readFileSync(PATHS.taxonomy, "utf8"));
const { current, inScope, outOfScope } = splitFamilies(source, taxonomy);
const standalone = partitionStandalone(source, inScope);

const runtime = loadCatalogRuntime();
const records = runtime.products.filter((product) => product.brandSlug === "sata");
const cards = runtime.listing.canonical.filter((product) => product.brandSlug === "sata");
const slugByFamily = new Map([...dataset.products, ...Object.values(dataset.enrichments)].map((entry) => [entry.familyId, entry.slug]));

/* A / B */
// Kartica listinga nosi slug zapisa u `id`.
const cardSlugs = new Set(cards.map((card) => card.id));
const missingFamilies = inScope.filter((family) => !cardSlugs.has(slugByFamily.get(family.id))).map((family) => ({ id: family.id, officialName: family.officialName }));
const expectedSlugs = new Set(inScope.map((family) => slugByFamily.get(family.id)));
const unexpectedCards = cards.filter((card) => !expectedSlugs.has(card.id)).map((card) => card.id);
const duplicateCards = cards.map((card) => card.id).filter((slug, index, all) => all.indexOf(slug) !== index);

/* C / D */
const officialNumbers = inScope.flatMap((family) => europeVariants(family).map((variant) => ({ family: family.id, articleNumber: variant.articleNumber })));
const runtimeRows = [];
for (const record of records) {
  const rows = record.detail?.variants?.content.rows ?? [];
  if (rows.length) for (const row of rows) runtimeRows.push({ slug: record.slug, articleNumber: row.values.article ?? row.id });
  else if (record.manufacturerCode) runtimeRows.push({ slug: record.slug, articleNumber: record.manufacturerCode });
}
const runtimeNumbers = new Map();
for (const row of runtimeRows) runtimeNumbers.set(row.articleNumber, [...(runtimeNumbers.get(row.articleNumber) ?? []), row.slug]);
const officialSet = new Set(officialNumbers.map((entry) => entry.articleNumber));
const missingNumbers = officialNumbers.filter((entry) => runtimeNumbers.get(entry.articleNumber)?.[0] !== slugByFamily.get(entry.family));
const duplicateNumbers = [...runtimeNumbers].filter(([, owners]) => owners.length > 1).map(([articleNumber, owners]) => ({ articleNumber, owners }));
const leakedNumbers = [...runtimeNumbers.keys()].filter((number) => !officialSet.has(number));

/* Slike: nijedna kartica ne sme imati SATA sliku dok pravo nije potvrđeno. */
const nonPlaceholder = records.filter((record) => !/placeholder-product/.test(record.productImage?.src ?? "")).map((record) => record.slug);

const report = {
  scope: SCOPE_NAME,
  coverage: { A: inScope.length, B: inScope.length - missingFamilies.length, C: officialNumbers.length, D: officialNumbers.length - missingNumbers.length },
  runtime: {
    underlyingRecords: records.length,
    visibleCards: cards.length,
    redirectOnlyRecords: records.filter((record) => runtime.variantSlugs.has(record.slug)).length,
    imported: dataset.products.length,
    enrichedExisting: Object.keys(dataset.enrichments).length,
    configurationRows: runtimeRows.length,
  },
  problems: { missingFamilies, unexpectedCards, duplicateCards, missingNumbers, duplicateNumbers, leakedOutOfScopeNumbers: leakedNumbers, cardsWithNonPlaceholderImage: nonPlaceholder },
  images: { ...dataset.meta.images, PLACEHOLDER_RUNTIME_CARDS: cards.length - nonPlaceholder.length },
  notCountedAsMissing: {
    CURRENT_OUT_OF_SCOPE_FAMILIES: outOfScope.length,
    CURRENT_OUT_OF_SCOPE_FAMILY_ARTICLE_NUMBERS: outOfScope.reduce((sum, family) => sum + family.variantCountEurope, 0),
    CURRENT_FAMILIES_TOTAL: current.length,
    UNLISTED_SPARE_PART_FAMILY_ARTICLE_NUMBERS: source.unlistedFamilies.reduce((sum, family) => sum + family.variantCount, 0),
    REGION_ONLY_MEMBERS_OF_IN_SCOPE_FAMILIES: inScope.reduce((sum, family) => sum + family.variants.filter((variant) => variant.region !== "CURRENT").length, 0),
    STANDALONE_PARTITION: standalone.partition,
    CURRENT_OUT_OF_SCOPE_PHASE_2: standalone.partition.STANDALONE_CUSTOMER_FACING_PHASE_2 + standalone.partition.ACCESSORY_TIED_TO_APPROVED_FAMILY,
  },
};
const problemCount = Object.values(report.problems).reduce((sum, list) => sum + list.length, 0);
writeJson(PATHS.reconciliation, report);
console.log(JSON.stringify({ ...report, problems: Object.fromEntries(Object.entries(report.problems).map(([key, list]) => [key, list.length])) }, null, 1));
if (problemCount || report.coverage.A !== report.coverage.B || report.coverage.C !== report.coverage.D) process.exitCode = 1;
