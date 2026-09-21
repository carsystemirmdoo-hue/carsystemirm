#!/usr/bin/env node
/**
 * Cosmos Lac sync — RECONCILE: zvanični opseg ↔ STVARNI runtime kataloga.
 *
 *   A = odobreni aktuelni zvanični proizvodi        B = oni zastupljeni u runtime-u (bar jedan zapis na kartici)
 *   C = odobreni identiteti nijansi/varijanti       D = ti identiteti zastupljeni u runtime-u
 *
 * A i C se računaju iz izvornog modela (plan), B i D se MERE u runtime-u. Aktuelno van opsega, legacy i
 * zapisi objavljeni samo na drugim jezicima prijavljuju se zasebno. Meri se i očuvanje adresa.
 */

import { readFileSync } from "node:fs";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { loadCatalogRuntime } from "../lib/catalog-runtime.mjs";
import { PATHS, PLACEHOLDER_IMAGE } from "./lib/config.mjs";

const plan = readJson(PATHS.plan);
const dataset = readJson(PATHS.siteDataset);
const source = readJson(PATHS.source);
const scope = JSON.parse(readFileSync(PATHS.scope, "utf8"));
const baseline = JSON.parse(readFileSync(PATHS.baselineUrls, "utf8"));

const runtime = loadCatalogRuntime();
const records = runtime.products.filter((product) => product.brandSlug === "cosmos-lac");
const bySlug = new Map(records.map((product) => [product.slug, product]));
const cards = runtime.listing.canonical.filter((card) => card.brandSlug === "cosmos-lac");
const families = runtime.families.filter((family) => family.brandSlug === "cosmos-lac");

/* Svaki runtime zapis → njegov zvanični identitet (iz dataseta) i kartica na kojoj je vidljiv. */
const syncOf = (slug) => dataset.enrichments[slug] ?? dataset.products.find((product) => product.slug === slug)?.sync ?? null;
const cardOf = (product) => { const family = runtime.getFamilyForProduct(product); return family ? `family:${family.slug}` : product.slug; };
const cardIds = new Set(cards.map((card) => card.id));

const outOfScope = new Set(Object.keys(scope.outOfScopeProducts));
const officialProducts = [...new Set(source.products.map((product) => product.productKey))].filter((key) => !outOfScope.has(key));
const officialPages = source.products.filter((product) => !outOfScope.has(product.productKey));

const representedProducts = new Set();
const representedPages = new Set();
const regionIdentities = new Set();
const orphanRecords = [];
for (const product of records) {
  const sync = syncOf(product.slug);
  if (!sync) { orphanRecords.push(product.slug); continue; }
  if (!cardIds.has(cardOf(product))) { orphanRecords.push(`${product.slug} (kartica ${cardOf(product)} nije u listingu)`); continue; }
  if (sync.officialUrl) { representedPages.add(sync.officialUrl); if (sync.officialProduct) representedProducts.add(sync.officialProduct); }
  if (sync.status === "CURRENT_REGION_SPECIFIC") regionIdentities.add(product.slug);
}
const missingProducts = officialProducts.filter((key) => !representedProducts.has(key));
const missingPages = officialPages.filter((page) => !representedPages.has(page.url)).map((page) => page.url);
const leakedOutOfScope = [...representedProducts].filter((key) => outOfScope.has(key));
const regionExpected = Object.entries(plan.enrichments).filter(([, entry]) => entry.status === "CURRENT_REGION_SPECIFIC").map(([slug]) => slug);
const regionMissing = regionExpected.filter((slug) => !regionIdentities.has(slug));
const regionWithoutProvenance = regionExpected.filter((slug) => !(dataset.enrichments[slug].sourceLocales ?? []).length);

/* Kartice: aktuelne vs legacy (Molotow). */
const legacyCards = cards.filter((card) => {
  const members = card.id.startsWith("family:") ? families.find((family) => `family:${family.slug}` === card.id).variants : [bySlug.get(card.id)];
  return members.every((member) => syncOf(member.slug)?.status === "LEGACY_LOCAL_ONLY");
});
// Kartica ne sme da meša različite zvanične proizvode, osim linija boja (tamo je linija = kartica).
const COLOUR_LINES = new Set(["chalk-effect", "easy-max", "fast-acrylic", "flame", "flame-blue", "flame-orange", "ral", "spray-bike"]);
const pageByUrl = new Map(source.products.map((page) => [page.url, page]));
const mixedCards = families.filter((family) => {
  const pages = family.variants.map((variant) => pageByUrl.get(syncOf(variant.slug)?.officialUrl)).filter(Boolean);
  return new Set(pages.map((page) => page.productKey)).size > 1 && !pages.some((page) => COLOUR_LINES.has(page.family));
}).map((family) => family.slug);

/* Adrese: svaka adresa iz stanja pre synca mora i dalje da postoji ili da ima preusmerenje. */
const familySlugs = new Set(families.map((family) => family.slug));
const redirected = new Set(dataset.redirects.filter((entry) => !entry.has).map((entry) => entry.source.replace("/proizvodi/grupa/", "")));
const brokenFamilyUrls = baseline.familySlugs.filter((slug) => !familySlugs.has(slug) && !redirected.has(slug));
const brokenProductUrls = baseline.productSlugs.filter((slug) => !bySlug.has(slug));
const redirectTargetsMissing = dataset.redirects.filter((entry) => entry.destination.startsWith("/proizvodi/") && !bySlug.has(entry.destination.replace("/proizvodi/", ""))).map((entry) => entry.destination);
const unexpectedlyRetired = baseline.familySlugs.filter((slug) => !familySlugs.has(slug)).filter((slug) => !Object.values(scope.splitCards).some((config) => config.retiredFamilySlug === slug && !config.keepBaseFor));

/* Slike: postojeće netaknute, novi zapisi na placeholderu, bez spoljnih adresa. */
const localImages = new Map(readJson(PATHS.localDataset).map((record) => [record.slug, record.image]));
const changedImages = records.filter((product) => localImages.has(product.slug) && product.productImage?.src !== localImages.get(product.slug)).map((product) => product.slug);
const newRecords = records.filter((product) => !localImages.has(product.slug));
const newNotPlaceholder = newRecords.filter((product) => product.productImage?.src !== PLACEHOLDER_IMAGE).map((product) => product.slug);
const externalImages = records.filter((product) => /^https?:/.test(product.productImage?.src ?? "")).map((product) => product.slug);

const report = {
  coverage: { A: officialProducts.length, B: officialProducts.length - missingProducts.length, C: officialPages.length + regionExpected.length, D: officialPages.length - missingPages.length + regionExpected.length - regionMissing.length },
  cards: { VISIBLE_CURRENT_COSMOS_CARDS: cards.length - legacyCards.length, VISIBLE_LEGACY_MOLOTOW_CARDS: legacyCards.length, TOTAL_VISIBLE_COSMOS_BRAND_CARDS: cards.length, baselineCards: baseline.cards, legacyCardIds: legacyCards.map((card) => card.id) },
  runtime: { underlyingRecords: records.length, families: families.length, redirectOnlyRecords: records.filter((product) => runtime.variantSlugs.has(product.slug)).length, newRecords: newRecords.length, enrichedExisting: Object.values(dataset.enrichments).filter((entry) => entry.officialUrl || entry.sourceLocales).length },
  status: dataset.meta.status,
  problems: { missingProducts, missingPages, leakedOutOfScope, regionMissing, regionWithoutProvenance, orphanRecords, mixedCards, brokenFamilyUrls, brokenProductUrls, redirectTargetsMissing, unexpectedlyRetired, changedImages, newNotPlaceholder, externalImages },
  urls: { baselineFamilyUrls: baseline.familySlugs.length, stillLive: baseline.familySlugs.filter((slug) => familySlugs.has(slug)).length, redirected: baseline.familySlugs.filter((slug) => !familySlugs.has(slug) && redirected.has(slug)).length, baselineProductUrls: baseline.productSlugs.length, productUrlsStillLive: baseline.productSlugs.length - brokenProductUrls.length, redirectRules: dataset.redirects.length },
  notCountedAsMissing: { CURRENT_OUT_OF_SCOPE: plan.currentOutOfScope, LEGACY_LOCAL_ONLY: dataset.meta.status.LEGACY_LOCAL_ONLY },
};
writeJson(PATHS.reconciliation, report);
const problemCount = Object.values(report.problems).reduce((sum, list) => sum + list.length, 0);
console.log(JSON.stringify({ ...report, problems: Object.fromEntries(Object.entries(report.problems).map(([key, list]) => [key, list.length])), notCountedAsMissing: undefined }, null, 1));
if (problemCount) console.log("PROBLEMI:", JSON.stringify(Object.fromEntries(Object.entries(report.problems).filter(([, list]) => list.length)), null, 1).slice(0, 1500));
if (problemCount || report.coverage.A !== report.coverage.B || report.coverage.C !== report.coverage.D) process.exitCode = 1;
