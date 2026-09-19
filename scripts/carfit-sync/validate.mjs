#!/usr/bin/env node
/**
 * C.A.R.FIT sync — validacija uvezenog dataseta i runtime kataloga.
 *
 * Greška (izlaz ≠ 0) = nešto što ne sme na sajt. Upozorenje = činjenica koju
 * vlasnik treba da zna (proizvod bez TDS-a, boja brenda umesto boje materijala…).
 */

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { isProductCategorySlug } from "../../lib/productTaxonomy.mjs";
import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { loadCatalogRuntime } from "../lib/catalog-runtime.mjs";
import { checkLocalization } from "./check-localization.mjs";
import { BRAND, ORIGIN, PATHS, PUBLIC_IMAGE_URL_PREFIX, REPO_ROOT } from "./lib/config.mjs";

const dataset = readJson(PATHS.siteDataset);
const plan = readJson(PATHS.plan);
const registry = readJson(PATHS.identityRegistry, { products: {} });
if (!dataset || !plan) throw new Error("Nedostaje dataset/plan — pokrenuti `npm run carfit:sync:apply`.");

const errors = [];
const warnings = [];
const error = (slug, message) => errors.push(`${slug}: ${message}`);
const warn = (slug, message) => warnings.push(`${slug}: ${message}`);

const OFFICIAL = /^\d-\d{3}-\d{3,5}[A-Za-z]?$/;
const RISKY = [/zvani[čc]n\w* distributer/i, /ovla[šs][ćc]en\w* zastupnik/i, /ekskluzivn\w* partner/i];
const PRICE = /\b(\d+[.,]?\d*\s?(rsd|eur|€|din\.?))\b/i;

/* -- Lokalizacija ---------------------------------------------------------------------- */

const input = {};
if (existsSync(PATHS.localizationInputDir)) for (const file of readdirSync(PATHS.localizationInputDir)) Object.assign(input, readJson(path.join(PATHS.localizationInputDir, file), {}));
const localization = {};
for (const file of readdirSync(PATHS.localizationDir).filter((name) => name.endsWith(".json")).sort()) Object.assign(localization, readJson(path.join(PATHS.localizationDir, file), {}));
for (const message of checkLocalization(localization, input)) errors.push(`lokalizacija · ${message}`);

/* -- Dataset ------------------------------------------------------------------------------ */

const seenArticles = new Map();
const seenSlugs = new Set();
for (const product of dataset.products) {
  const { slug } = product;
  if (seenSlugs.has(slug)) error(slug, "dupli slug u datasetu");
  seenSlugs.add(slug);
  if (!registry.products[slug]) error(slug, "slug nije u identity registru");
  if (!slug.startsWith(`${BRAND.slug}-`)) error(slug, "slug ne počinje prefiksom brenda");
  if (!product.sourceUrl?.startsWith(`${ORIGIN}/en/`)) error(slug, `sourceUrl nije zvanična EN stranica: ${product.sourceUrl}`);
  if (!isProductCategorySlug(product.taxonomy.category)) error(slug, `nepoznata kategorija ${product.taxonomy.category}`);
  if (!OFFICIAL.test(product.leadArticleNumber ?? "")) error(slug, `vodeća šifra nije u zvaničnom formatu: ${product.leadArticleNumber}`);
  if (!product.variants.length) error(slug, "proizvod bez ijedne šifre");

  const labels = new Set();
  for (const variant of product.variants) {
    if (!OFFICIAL.test(variant.articleNumber)) error(slug, `šifra nije u zvaničnom formatu: ${variant.articleNumber}`);
    if (seenArticles.has(variant.articleNumber)) error(slug, `šifra ${variant.articleNumber} je već na proizvodu ${seenArticles.get(variant.articleNumber)}`);
    seenArticles.set(variant.articleNumber, slug);
    if (!variant.label?.trim()) error(slug, `varijanta ${variant.articleNumber} bez oznake`);
    if (labels.has(variant.label)) error(slug, `oznaka varijante nije jedinstvena: „${variant.label}”`);
    labels.add(variant.label);
    if (!variant.onWebsite && !variant.inCatalogue) error(slug, `šifra ${variant.articleNumber} nema nijedan zvanični izvor`);
  }

  if (product.image) {
    if (!product.image.src.startsWith(`${PUBLIC_IMAGE_URL_PREFIX}/`)) error(slug, `slika nije lokalno hostovana: ${product.image.src}`);
    else if (!existsSync(path.join(REPO_ROOT, "public", product.image.src))) error(slug, `slika ne postoji: ${product.image.src}`);
    if (!product.image.hasAlpha) warn(slug, "slika je zadržala pozadinu (fotografija, nije packshot na beloj podlozi)");
  } else if (!product.missingOfficialAsset) error(slug, "nema sliku, a nije označen MISSING_OFFICIAL_ASSET");
  else warn(slug, "MISSING_OFFICIAL_ASSET — koristi se placeholder sajta");

  for (const document of product.documents) if (!document.href.startsWith(`${ORIGIN}/`)) error(slug, `dokument nije na zvaničnom hostu: ${document.href}`);
  if (!product.documents.some((document) => document.kind === "tds")) warn(slug, "proizvođač ne objavljuje TDS na stranici proizvoda");

  const text = JSON.stringify([product.name, product.content]);
  for (const pattern of RISKY) if (pattern.test(text)) error(slug, `rizična pravna formulacija ${pattern}`);
  if (PRICE.test(text)) error(slug, "tekst sadrži cenu");
  if (product.shade && !product.shade.source) error(slug, "boja bez navedenog izvora");
  if (product.shade && !/^#[0-9A-F]{6}$/i.test(product.shade.color)) error(slug, `boja nije hex: ${product.shade.color}`);
}

// Alternativni zapis šifre (slovna razlika sajt ↔ PDF) ne sme istovremeno biti i varijanta.
for (const product of dataset.products) {
  for (const variant of product.variants) {
    for (const alternate of variant.alternateArticleNumbers ?? []) {
      if (!OFFICIAL.test(alternate.articleNumber)) error(product.slug, `alternativna šifra nije u zvaničnom formatu: ${alternate.articleNumber}`);
      if (seenArticles.has(alternate.articleNumber)) error(product.slug, `alternativna šifra ${alternate.articleNumber} je ujedno i varijanta proizvoda ${seenArticles.get(alternate.articleNumber)}`);
      if (!alternate.source) error(product.slug, `alternativna šifra ${alternate.articleNumber} bez navedenog izvora`);
    }
  }
}
for (const [slug, enrichment] of Object.entries(dataset.enrichments)) {
  if (enrichment.presentation && /\b\d+\s?[x×]\s?\d+\s?m\b/i.test(enrichment.presentation.name)) error(slug, `naziv porodice i dalje sugeriše jednu dimenziju: ${enrichment.presentation.name}`);
}

/* -- Plan i runtime -------------------------------------------------------------------------- */

for (const item of plan.items.filter((entry) => entry.action.startsWith("HELD"))) error(item.sourceKey, `zadržan proizvod: ${item.action} — ${item.reason}`);
for (const [name, list] of Object.entries(plan.summary.planErrors)) if (list.length) error("plan", `${name}: ${JSON.stringify(list)}`);

const { products } = loadCatalogRuntime();
const runtime = products.filter((product) => product.brandSlug === BRAND.slug);
const runtimeSlugs = new Set(runtime.map((product) => product.slug));
for (const product of dataset.products) if (!runtimeSlugs.has(product.slug)) error(product.slug, "u datasetu je, ali ga runtime katalog ne prikazuje");
for (const slug of Object.keys(dataset.enrichments)) {
  const record = runtime.find((product) => product.slug === slug);
  if (!record) error(slug, "dopuna za zapis koji ne postoji u runtime katalogu");
  else if (!(record.detail?.variants?.content?.rows ?? []).length) error(slug, "dopuna nije dodala tabelu šifara");
}
for (const product of runtime) {
  if (product.publicStatus !== "Na upit" && seenSlugs.has(product.slug)) error(product.slug, `uvezen proizvod mora biti „Na upit”, a jeste „${product.publicStatus}”`);
  if (seenSlugs.has(product.slug) && (product.price !== undefined || product.priceRsd !== undefined)) error(product.slug, "uvezen proizvod nosi cenu");
}

const summary = {
  products: dataset.products.length,
  variants: dataset.products.reduce((sum, product) => sum + product.variants.length, 0),
  enrichedExisting: Object.keys(dataset.enrichments).length,
  runtimeCarfitProducts: runtime.length,
  withImage: dataset.products.filter((product) => product.image).length,
  withCutOutImage: dataset.products.filter((product) => product.image?.hasAlpha).length,
  withTds: dataset.products.filter((product) => product.documents.some((document) => document.kind === "tds")).length,
  withSds: dataset.products.filter((product) => product.documents.some((document) => document.kind === "sds")).length,
  withShade: dataset.products.filter((product) => product.shade).length,
  localizedEntries: Object.keys(localization).length,
  errors: errors.length,
  warnings: warnings.length,
};
writeJson(PATHS.validation, { summary, errors, warnings });
console.log(JSON.stringify(summary, null, 2));
for (const message of errors.slice(0, 40)) console.log(`✖ ${message}`);
if (errors.length) process.exitCode = 1;
