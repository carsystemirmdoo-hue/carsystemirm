#!/usr/bin/env node
/**
 * Cosmos Lac sync — validacija generisanog dataseta (bez runtime-a).
 *
 * Čuva ono što se ne sme desiti tiho: prepisan Brand Kit zapis, spoljna slika, izmišljen dokument,
 * prikazan polomljen PDF, obrisan lokalni podatak o pakovanju, dirnut legacy/Molotow zapis, cena.
 */

import { readFileSync } from "node:fs";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS, PLACEHOLDER_IMAGE } from "./lib/config.mjs";

const dataset = readJson(PATHS.siteDataset);
const local = readJson(PATHS.localDataset);
const documents = readJson(PATHS.rawDocuments);
const lock = readJson(PATHS.scopeLock);
const scope = JSON.parse(readFileSync(PATHS.scope, "utf8"));
const okDocuments = new Set(documents.documents.filter((document) => document.status === 200).map((document) => document.url));
const errors = [];
const fail = (code, detail = {}) => errors.push({ code, ...detail });

const localBySlug = new Map(local.map((record) => [record.slug, record]));
if (Object.keys(dataset.enrichments).length !== local.length) fail("ENRICHMENT_COUNT", { expected: local.length, found: Object.keys(dataset.enrichments).length });
for (const slug of Object.keys(dataset.enrichments)) if (!localBySlug.has(slug)) fail("ENRICHMENT_FOR_UNKNOWN_RECORD", { slug });
if (JSON.stringify(dataset.meta.measured) !== JSON.stringify(lock.measured)) fail("MEASURED_DIFFERS_FROM_LOCK");

const officialUrls = new Map();
for (const [slug, entry] of Object.entries(dataset.enrichments)) {
  const record = localBySlug.get(slug);
  if (entry.officialUrl) officialUrls.set(entry.officialUrl, [...(officialUrls.get(entry.officialUrl) ?? []), slug]);
  if (["LEGACY_LOCAL_ONLY", "REMOVED_FROM_CUSTOMER_CATALOG"].includes(entry.status) && (entry.officialUrl || entry.baseProductSlug || entry.document || entry.familyIdentity)) fail("LEGACY_RECORD_TOUCHED", { slug });
  if (entry.status === "CURRENT_REGION_SPECIFIC" && !(entry.sourceLocales ?? []).length) fail("REGION_SPECIFIC_WITHOUT_PROVENANCE", { slug });
  if (entry.status === "CURRENT" && !entry.officialUrl) fail("CURRENT_WITHOUT_OFFICIAL_PAGE", { slug });
  // Lokalni podatak o pakovanju se nikad ne briše.
  if ((entry.packaging.local ?? null) !== (record.volume ?? null)) fail("LOCAL_PACKAGING_CHANGED", { slug, local: record.volume, found: entry.packaging.local });
  if (!["OFFICIAL_CURRENT", "LOCAL_EXISTING", "SOURCE_UNSPECIFIED"].includes(entry.packaging.status)) fail("PACKAGING_STATUS", { slug });
  // Status određuje šta kupac vidi: zvanično kada ga izvor navodi, postojeće kada ga ne navodi, ništa kada ga nema.
  if (entry.packaging.status === "OFFICIAL_CURRENT" && (!entry.packaging.official || !entry.packaging.customerFacing)) fail("OFFICIAL_PACKAGING_WITHOUT_VALUE", { slug });
  if (entry.packaging.status === "LOCAL_EXISTING" && (entry.packaging.official || entry.packaging.customerFacing !== record.volume)) fail("LOCAL_PACKAGING_NOT_SHOWN_AS_IS", { slug });
  if (entry.packaging.status === "SOURCE_UNSPECIFIED" && (entry.packaging.customerFacing || record.volume)) fail("INVENTED_PACKAGING", { slug });
  if (entry.document && !okDocuments.has(entry.document.href)) fail("DOCUMENT_NOT_LIVE_ON_OFFICIAL_SITE", { slug, href: entry.document.href });
  if (entry.document && !entry.document.href.startsWith("https://cosmoslac.com/pdfs/")) fail("DOCUMENT_NOT_OFFICIAL_HOST", { slug });
  if (entry.document && /sds|msds|safety/i.test(entry.document.title)) fail("INVENTED_SDS", { slug });
  if (entry.previousBaseProductSlug && !scope.splitCards[entry.previousBaseProductSlug]) fail("REGROUPED_OUTSIDE_APPROVED_SPLIT", { slug });
}
for (const [url, slugs] of officialUrls) {
  if (slugs.length < 2) continue;
  if (new Set(slugs.map((slug) => localBySlug.get(slug).volume)).size !== slugs.length) fail("DUPLICATE_OFFICIAL_IDENTITY", { url, slugs });
}
// Uklonjeno iz kataloga za kupce (Molotow): zapis ostaje netaknut kao istorijski podatak, nije `discontinued`,
// izvorna klasifikacija se ne menja, a stare adrese pokriva preusmerenje.
const removal = scope.removedFromCustomerCatalog;
const removedRecords = local.filter((record) => removal.lines.includes(record.line));
for (const record of removedRecords) {
  const entry = dataset.enrichments[record.slug];
  if (entry.status !== removal.status) fail("REMOVED_LINE_STILL_IN_CATALOG", { slug: record.slug, status: entry.status });
  if (entry.classification !== "LEGACY_LOCAL_ONLY") fail("REMOVED_RECORD_SOURCE_CLASSIFICATION_CHANGED", { slug: record.slug });
}
for (const [slug, entry] of Object.entries(dataset.enrichments)) if (entry.status === removal.status && !removal.lines.includes(localBySlug.get(slug).line)) fail("REMOVED_OUTSIDE_APPROVED_LINES", { slug });
if (/discontinued/i.test(JSON.stringify(removedRecords.map((record) => dataset.enrichments[record.slug])))) fail("REMOVED_MARKED_DISCONTINUED_WITHOUT_EVIDENCE");
if (dataset.meta.removedFromCustomerCatalog.records !== removedRecords.length) fail("REMOVED_COUNT_MISMATCH");
const removalRules = dataset.redirects.filter((entry) => entry.destination === removal.redirectDestination);
if (removedRecords.length && removalRules.length !== 2) fail("REMOVED_URLS_WITHOUT_REDIRECT", { rules: removalRules.length });

const newSlugs = new Set();
for (const product of dataset.products) {
  if (localBySlug.has(product.slug) || newSlugs.has(product.slug)) fail("NEW_SLUG_COLLISION", { slug: product.slug });
  newSlugs.add(product.slug);
  if (product.image !== PLACEHOLDER_IMAGE) fail("NEW_RECORD_IMAGE_NOT_PLACEHOLDER", { slug: product.slug, image: product.image });
  if (officialUrls.has(product.sync.officialUrl)) fail("NEW_RECORD_DUPLICATES_EXISTING_IDENTITY", { slug: product.slug });
  if (product.sync.document && !okDocuments.has(product.sync.document.href)) fail("DOCUMENT_NOT_LIVE_ON_OFFICIAL_SITE", { slug: product.slug });
  if (Object.keys(scope.outOfScopeProducts).includes(product.sync.officialProduct)) fail("OUT_OF_SCOPE_IMPORTED", { slug: product.slug });
}

const serialized = JSON.stringify(dataset);
// Jedina slika u datasetu je placeholder sajta; nijedna adresa slike sa cosmoslac.com ili trećih strana.
// Naziv Brand Kit fajla naveden kao DOKAZ („`ral-9003-signal-white-v2.png`”) nije adresa slike; proverava se samo ono što je putanja ili URL.
const imageRefs = (serialized.match(/[^"\s]+\.(?:webp|png|jpe?g|svg)/gi) ?? []).filter((ref) => /^(?:https?:|\/)/.test(ref));
if (imageRefs.some((ref) => ref !== PLACEHOLDER_IMAGE)) fail("FOREIGN_IMAGE_IN_DATASET", { refs: [...new Set(imageRefs.filter((ref) => ref !== PLACEHOLDER_IMAGE))].slice(0, 5) });
if (/"(?:[a-z_]*price[a-z_]*|currency|vat|taxRate)"\s*:/i.test(serialized)) fail("PRICE_IN_DATASET");

const seenRules = new Set();
for (const rule of dataset.redirects) {
  const key = `${rule.source}?${rule.has?.[0]?.value ?? ""}`;
  if (seenRules.has(key)) fail("DUPLICATE_REDIRECT_RULE", { key });
  seenRules.add(key);
  const target = rule.destination.startsWith("/proizvodi/") ? rule.destination.replace("/proizvodi/", "") : null;
  if (target && !localBySlug.has(target)) fail("REDIRECT_TARGET_UNKNOWN", { rule: rule.destination });
}

const report = { measured: dataset.meta.measured, existingRecords: Object.keys(dataset.enrichments).length, newRecords: dataset.products.length, status: dataset.meta.status, packaging: dataset.meta.packaging, documents: dataset.meta.documents, images: dataset.meta.images, redirects: dataset.redirects.length, errors };
writeJson(PATHS.validation, report);
console.log(JSON.stringify({ ...report, errors: errors.slice(0, 15), errorCount: errors.length }, null, 1));
if (errors.length) process.exitCode = 1;
