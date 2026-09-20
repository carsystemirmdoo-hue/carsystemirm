#!/usr/bin/env node
/**
 * Norbin sync — provera sadržaja, dokumenata i runtime zapisa (posle apply).
 *
 * Greška ruši korak; upozorenje je stanje koje se svesno prihvata (proizvod bez tehničkog
 * lista ili bez ijedne fotografije — oboje je stvarno stanje izvora, ne praznina uvoza).
 */

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { loadCatalogRuntime } from "../lib/catalog-runtime.mjs";
import { PATHS, SOURCES } from "./lib/config.mjs";
import { checkLocalization } from "./check-localization.mjs";

const dataset = readJson(PATHS.siteDataset, { products: [], enrichments: {} });
const source = readJson(PATHS.source);
const plan = readJson(PATHS.plan);
const officialCodes = new Set((source?.products ?? []).filter((product) => product.status === "CURRENT_EMEA").map((product) => product.code));
const errors = [];
const warnings = [];

const runtimeData = loadCatalogRuntime();
const runtime = new Map(runtimeData.products.filter((product) => product.brandSlug === "norbin").map((product) => [product.slug, product]));
const families = new Map(runtimeData.families.map((family) => [family.slug, family]));

/** Dokument sme da bude SAMO zvanična referenca; ništa se ne hostuje lokalno u ovom ciklusu. */
const officialDocument = (href) => href.startsWith(`${SOURCES.website.origin}/`);

const all = [...dataset.products, ...Object.entries(dataset.enrichments).map(([slug, entry]) => ({ ...entry, slug }))];
for (const product of all) {
  const fail = (message) => errors.push(`${product.slug}: ${message}`);
  if (!runtime.has(product.slug)) fail("nije vidljiv u runtime katalogu");
  for (const field of ["officialName", "taxonomy", "availability"]) if (!product[field]) fail(`nedostaje ${field}`);
  if (!officialCodes.has(product.code)) fail(`oznaka „${product.code}” nije aktuelna EMEA šifra`);
  if (product.image) fail("zvanična slika ne postoji ni za jedan Norbin proizvod");
  if (product.availability.publicStatus !== "Na upit") fail(`javni status je „${product.availability.publicStatus}”, a mora biti „Na upit”`);
  if (!product.documents.length) fail("nema nijedan zvanični dokument");
  for (const document of product.documents) {
    if (!officialDocument(document.href)) fail(`dokument nije sa zvaničnog izvora: ${document.href}`);
    // Token u URL-u je deo stvarnog zvaničnog linka i mora ostati doslovno.
    if (document.tokenizedUrl && !document.href.includes("?")) fail("izgubljen upitni token iz zvaničnog linka");
  }
  if (!product.documents.some((document) => document.kind === "tds")) warnings.push(`${product.slug}: proizvođač ne objavljuje tehnički list`);
  warnings.push(`${product.slug}: nema zvaničnu fotografiju (MISSING_OFFICIAL_ASSET)`);

  for (const relation of [...product.relations, ...product.usedBy]) {
    if (relation.slug && !runtime.has(relation.slug) && !dataset.enrichments[relation.slug] && !families.has(relation.slug)) fail(`odnos pokazuje na nepostojeći zapis ${relation.slug}`);
    // Nerazrešena zvanična referenca (N85-025) sme da postoji, ali NIKADA sa slugom.
    if (!relation.officialIdentity && relation.slug) fail(`komponenta bez zvaničnog identiteta ${relation.code} je dobila zapis`);
  }

  const runtimeProduct = runtime.get(product.slug);
  if (runtimeProduct) {
    const text = JSON.stringify({ name: runtimeProduct.name, search: runtimeProduct.searchTerms, specs: runtimeProduct.specifications });
    // Naš interni broj artikla je poslovni podatak i ne sme da izađe u javni zapis.
    if (/\b\d{6}\b/.test(text)) fail("interni broj artikla u javnom zapisu");
  }

  if (product.content) {
    const text = JSON.stringify(product.content);
    if (/[Ѐ-ӿ]/.test(text)) fail("ćirilica u sadržaju");
    if (/\b(RSD|EUR|cena|na stanju|na lageru)\b/i.test(text)) fail("cena ili tvrdnja o stanju u sadržaju");
  }
}

/* Porodica pakovanja: oba stara sluga moraju ostati varijante, a porodica mora postojati. */
for (const [slug, entry] of Object.entries(dataset.enrichments)) {
  if (!entry.family) continue;
  const family = families.get(entry.family.baseProductSlug);
  if (!family) errors.push(`${slug}: porodica ${entry.family.baseProductSlug} ne postoji u runtime modelu`);
  else {
    if (family.presentation !== "variant-pdp") errors.push(`${slug}: porodica nije variant-pdp, pa stari URL ne bi preusmeravao`);
    if (!runtimeData.variantSlugs.has(slug)) errors.push(`${slug}: nije konsolidovan u porodicu (bio bi druga kartica)`);
  }
}

/* Komponenta koju izvor ne objavljuje ne sme da postoji kao zapis ni kao pojam pretrage. */
for (const entry of plan?.referencedOnly ?? []) {
  if ([...runtime.values()].some((product) => product.manufacturerCode === entry.code)) errors.push(`${entry.code}: dobio je karticu, a nema zvanični identitet`);
  for (const product of runtime.values()) if ((product.searchTerms ?? []).some((term) => String(term).includes(entry.code))) errors.push(`${entry.code}: ušao je u pojmove pretrage zapisa ${product.slug}`);
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
  runtimeNorbinRecords: runtime.size,
  officialProductImages: 0,
  withTds: all.filter((entry) => entry.documents.some((document) => document.kind === "tds")).length,
  withSds: all.filter((entry) => entry.documents.some((document) => document.kind === "sds")).length,
  withRelations: all.filter((entry) => entry.relations.length).length,
  withUsedBy: all.filter((entry) => entry.usedBy.length).length,
  localizedEntries: Object.keys(localization).length,
  errors: errors.length,
  warnings: warnings.length,
};

writeJson(PATHS.validation, { summary, errors, warnings });
console.log(JSON.stringify(summary, null, 1));
for (const error of errors.slice(0, 25)) console.log(`✖ ${error}`);
if (errors.length) process.exitCode = 1;
