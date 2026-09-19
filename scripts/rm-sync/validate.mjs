#!/usr/bin/env node
/**
 * R-M sync — provera sadržaja, slika i runtime zapisa (posle apply).
 *
 * Greška ruši korak; upozorenje je stanje koje se svesno prihvata (npr. zapis bez zvanične
 * fotografije ili proizvod čiji TDS proizvođač nije objavio).
 */

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { loadCatalogRuntime } from "../lib/catalog-runtime.mjs";
import { PATHS, REPO_ROOT } from "./lib/config.mjs";
import { checkLocalization } from "./check-localization.mjs";

const dataset = readJson(PATHS.siteDataset, { products: [], enrichments: {} });
const source = readJson(PATHS.source);
const officialCodes = new Set((source?.products ?? []).map((product) => product.code));
const errors = [];
const warnings = [];

const { products: runtimeProducts } = loadCatalogRuntime();
const runtime = new Map(runtimeProducts.filter((product) => product.brandSlug === "rm").map((product) => [product.slug, product]));

for (const product of dataset.products) {
  const fail = (message) => errors.push(`${product.slug}: ${message}`);
  if (!runtime.has(product.slug)) fail("nije vidljiv u runtime katalogu");
  for (const field of ["name", "officialName", "content", "taxonomy"]) if (!product[field]) fail(`nedostaje ${field}`);
  // Zvanični identifikator portala ume da bude i imenski („ONYX HD”, „SC T2A203”) — poredi se sa izvorom, ne sa oblikom.
  if (product.code && !officialCodes.has(product.code)) fail(`oznaka „${product.code}” ne postoji na info portalu`);
  if (product.image && !existsSync(path.join(REPO_ROOT, "public", product.image.src))) fail(`slika ne postoji: ${product.image.src}`);
  if (!product.image) warnings.push(`${product.slug}: nema zvaničnu fotografiju (MISSING_OFFICIAL_ASSET)`);
  if (product.documentationGap) warnings.push(`${product.slug}: ${product.documentationGap}`);
  for (const relation of [...product.relations, ...product.usedBy]) if (relation.slug && !runtime.has(relation.slug) && !dataset.enrichments[relation.slug]) fail(`odnos pokazuje na nepostojeći zapis ${relation.slug}`);
  for (const document of product.documents) if (!/^https:\/\/techinfo\.rmpaint\.com\//.test(document.href)) fail(`dokument nije sa zvaničnog izvora: ${document.href}`);
  const text = JSON.stringify(product.content);
  if (/[Ѐ-ӿ]/.test(text)) fail("ćirilica u sadržaju");
  if (/\b(RSD|EUR|cena)\b/i.test(text)) fail("cena u sadržaju");
}

for (const [slug, enrichment] of Object.entries(dataset.enrichments)) {
  const product = runtime.get(slug);
  if (!product) errors.push(`${slug}: dopunjeni zapis ne postoji u runtime katalogu`);
  else if (product.manufacturerCode !== enrichment.code) errors.push(`${slug}: runtime oznaka ${product.manufacturerCode} ≠ ${enrichment.code}`);
  else if (!product.taxonomyCategory) errors.push(`${slug}: dopuna nije postavila kategoriju`);
}

/* -- Lokalizacija ------------------------------------------------------------------------- */

const input = {};
if (existsSync(PATHS.localizationInputDir)) for (const file of readdirSync(PATHS.localizationInputDir)) Object.assign(input, readJson(path.join(PATHS.localizationInputDir, file), {}));
const localization = {};
if (existsSync(PATHS.localizationDir)) for (const file of readdirSync(PATHS.localizationDir).filter((name) => name.endsWith(".json"))) Object.assign(localization, readJson(path.join(PATHS.localizationDir, file), {}));
errors.push(...checkLocalization(localization, input));

const summary = {
  products: dataset.products.length,
  enrichedExisting: Object.keys(dataset.enrichments).length,
  runtimeRmProducts: runtime.size,
  systems: dataset.products.filter((product) => product.kind === "system").length,
  components: dataset.products.filter((product) => product.kind === "component").length,
  withImage: dataset.products.filter((product) => product.image).length,
  withRelations: dataset.products.filter((product) => product.relations.length).length,
  withTds: dataset.products.filter((product) => product.documents.length).length,
  withShade: dataset.products.filter((product) => product.shade).length,
  localizedEntries: Object.keys(localization).length,
  errors: errors.length,
  warnings: warnings.length,
};

writeJson(PATHS.validation, { summary, errors, warnings });
console.log(JSON.stringify(summary, null, 1));
for (const error of errors.slice(0, 25)) console.log(`✖ ${error}`);
if (errors.length) process.exitCode = 1;
