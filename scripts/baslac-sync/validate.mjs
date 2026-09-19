#!/usr/bin/env node
/**
 * baslac sync — provera sadržaja, slika i runtime zapisa (posle apply).
 *
 * Greška ruši korak; upozorenje je stanje koje se svesno prihvata (npr. zapis bez
 * zvanične fotografije: 32 aktuelna proizvoda baslac javno ne objavljuje sa slikom).
 */

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { loadCatalogRuntime } from "../lib/catalog-runtime.mjs";
import { PATHS, REPO_ROOT, SOURCES } from "./lib/config.mjs";
import { checkLocalization } from "./check-localization.mjs";

const dataset = readJson(PATHS.siteDataset, { products: [], enrichments: {} });
const source = readJson(PATHS.source);
const officialCodes = new Set((source?.products ?? []).map((product) => product.code));
const errors = [];
const warnings = [];

const runtimeData = loadCatalogRuntime();
const runtime = new Map(runtimeData.products.filter((product) => product.brandSlug === "baslac").map((product) => [product.slug, product]));
const families = new Map(runtimeData.families.map((family) => [family.slug, family]));

/** Dokument sme da bude zvanični URL ili LOKALNA kopija zvaničnog lista. */
const officialDocument = (href) => href.startsWith(`${SOURCES.techinfo.origin}/`) || href.startsWith("/documents/products/baslac/");

for (const product of dataset.products) {
  const fail = (message) => errors.push(`${product.slug}: ${message}`);
  if (!runtime.has(product.slug)) fail("nije vidljiv u runtime katalogu");
  for (const field of ["name", "officialName", "content", "taxonomy"]) if (!product[field]) fail(`nedostaje ${field}`);
  if (product.code && !officialCodes.has(product.code)) fail(`oznaka „${product.code}” ne postoji na zvaničnim izvorima`);
  if (product.image && !existsSync(path.join(REPO_ROOT, "public", product.image.src))) fail(`slika ne postoji: ${product.image.src}`);
  if (!product.image && product.kind !== "system") warnings.push(`${product.slug}: nema zvaničnu fotografiju (MISSING_OFFICIAL_ASSET)`);
  for (const relation of [...product.relations, ...product.usedBy]) if (relation.slug && !runtime.has(relation.slug) && !dataset.enrichments[relation.slug]) fail(`odnos pokazuje na nepostojeći zapis ${relation.slug}`);
  for (const document of product.documents) if (!officialDocument(document.href)) fail(`dokument nije sa zvaničnog izvora: ${document.href}`);
  if (product.documents.some((document) => document.href.startsWith("/")) && !existsSync(path.join(REPO_ROOT, "public", product.documents[0].href))) fail(`lokalna kopija lista ne postoji: ${product.documents[0].href}`);

  // Sadržaj iznad zvanične granice je znak da su dva bezbednosna bloka lista pomešana.
  const voc = product.technical?.voc;
  if (voc?.limit && voc.content > voc.limit) fail(`VOC ${voc.content} g/l je iznad granice ${voc.limit} g/l`);

  const text = JSON.stringify(product.content);
  if (/[Ѐ-ӿ]/.test(text)) fail("ćirilica u sadržaju");
  if (/\b(RSD|EUR|cena)\b/i.test(text)) fail("cena u sadržaju");
  // Broj artikla postoji samo u imenu zvanične slike i ne sme da izađe u javni sadržaj.
  if (/\b\d{8}\b/.test(JSON.stringify({ ...product, image: null }))) fail("broj artikla u javnom zapisu");

  /* Sistem mora da zaključa svoju porodicu, a mixing komponenta ne sme da bude kartica. */
  if (product.kind === "system") {
    const family = families.get(product.family?.identity?.slug);
    if (!family) fail(`porodica ${product.family?.identity?.slug} ne postoji u runtime modelu`);
    else {
      if (family.name !== product.officialName) fail(`porodica se zove „${family.name}”, a zvanični naziv je „${product.officialName}”`);
      if (!runtimeData.variantSlugs.has(product.slug)) fail("zapis sistema nije konsolidovan u svoju porodicu (bio bi druga kartica)");
    }
    for (const component of product.systemComponents) {
      const slug = [...runtime.values()].find((entry) => entry.sku === component.code)?.slug;
      if (slug && !runtimeData.variantSlugs.has(slug)) fail(`mixing komponenta ${component.code} je samostalna kartica`);
    }
  }
}

for (const [slug, enrichment] of Object.entries(dataset.enrichments)) {
  const product = runtime.get(slug);
  if (!product) errors.push(`${slug}: dopunjeni zapis ne postoji u runtime katalogu`);
  else if (product.manufacturerCode !== enrichment.code) errors.push(`${slug}: runtime oznaka ${product.manufacturerCode} ≠ ${enrichment.code}`);
  else if (!product.taxonomyCategory) errors.push(`${slug}: dopuna nije postavila kategoriju`);
  // Promovisan zapis mora da bude SAMOSTALNA kartica, a adresa mora da ostane ista.
  if (product && enrichment.detachFromFamily && runtimeData.variantSlugs.has(slug)) errors.push(`${slug}: i dalje je varijanta porodice, a trebalo je da postane samostalna kartica`);
}

/* -- Lokalizacija ------------------------------------------------------------------------- */

const input = {};
if (existsSync(PATHS.localizationInputDir)) for (const file of readdirSync(PATHS.localizationInputDir)) Object.assign(input, readJson(path.join(PATHS.localizationInputDir, file), {}));
const localization = {};
if (existsSync(PATHS.localizationDir)) for (const file of readdirSync(PATHS.localizationDir).filter((name) => name.endsWith(".json"))) Object.assign(localization, readJson(path.join(PATHS.localizationDir, file), {}));
errors.push(...checkLocalization(localization, input));

const summary = {
  products: dataset.products.filter((product) => product.kind === "product").length,
  systems: dataset.products.filter((product) => product.kind === "system").length,
  enrichedExisting: Object.keys(dataset.enrichments).length,
  runtimeBaslacRecords: runtime.size,
  withImage: dataset.products.filter((product) => product.image).length,
  withRelations: dataset.products.filter((product) => product.relations.length).length,
  withUsedBy: dataset.products.filter((product) => product.usedBy.length).length,
  withTds: dataset.products.filter((product) => product.documents.length).length,
  localizedEntries: Object.keys(localization).length,
  errors: errors.length,
  warnings: warnings.length,
};

writeJson(PATHS.validation, { summary, errors, warnings });
console.log(JSON.stringify(summary, null, 1));
for (const error of errors.slice(0, 25)) console.log(`✖ ${error}`);
if (errors.length) process.exitCode = 1;
