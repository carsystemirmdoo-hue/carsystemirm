#!/usr/bin/env node
/**
 * BEFAR sync — validacija uvezenog dataseta i runtime kataloga.
 * Greška (izlaz ≠ 0) = nešto što ne sme na sajt; upozorenje = činjenica za vlasnika.
 */

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { isProductCategorySlug } from "../../lib/productTaxonomy.mjs";
import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { loadCatalogRuntime } from "../lib/catalog-runtime.mjs";
import { checkLocalization } from "./check-localization.mjs";
import { BRAND, PATHS, PUBLIC_IMAGE_URL_PREFIX, REPO_ROOT } from "./lib/config.mjs";

const dataset = readJson(PATHS.siteDataset);
const plan = readJson(PATHS.plan);
const source = readJson(PATHS.source);
const registry = readJson(PATHS.identityRegistry, { products: {} });
if (!dataset || !plan || !source) throw new Error("Nedostaje dataset/plan/source — pokrenuti `npm run befar:sync:apply`.");

const errors = [];
const warnings = [];
const error = (slug, message) => errors.push(`${slug}: ${message}`);
const warn = (slug, message) => warnings.push(`${slug}: ${message}`);

const OFFICIAL = /^\d{5,6}[A-Z]{0,4}$/;
const RISKY = [/zvani[čc]n\w* distributer/i, /ovla[šs][ćc]en\w* zastupnik/i, /ekskluzivn\w* partner/i];
const PRICE = /\b(\d+[.,]?\d*\s?(rsd|eur|€|din\.?))\b/i;
const LINES = new Set(["Befar", "Befar Plus", "Leo", "Turkuaz", "Opencell"]);

const input = {};
if (existsSync(PATHS.localizationInputDir)) for (const file of readdirSync(PATHS.localizationInputDir)) Object.assign(input, readJson(path.join(PATHS.localizationInputDir, file), {}));
const localization = {};
for (const file of readdirSync(PATHS.localizationDir).filter((name) => name.endsWith(".json")).sort()) Object.assign(localization, readJson(path.join(PATHS.localizationDir, file), {}));
for (const message of checkLocalization(localization, input)) errors.push(`lokalizacija · ${message}`);

const websiteCodes = new Set(source.products.flatMap((product) => product.variants.map((variant) => variant.code)));
const seenCodes = new Map();
const seenSlugs = new Set();
for (const product of dataset.products) {
  const { slug } = product;
  if (seenSlugs.has(slug)) error(slug, "dupli slug u datasetu");
  seenSlugs.add(slug);
  if (!registry.products[slug]) error(slug, "slug nije u identity registru");
  if (!slug.startsWith(`${BRAND.slug}-`)) error(slug, "slug ne počinje prefiksom brenda");
  if (!LINES.has(product.line)) error(slug, `nepoznata linija „${product.line}” (Leo/Plus/Turkuaz su linije brenda Befar)`);
  if (!isProductCategorySlug(product.taxonomy.category)) error(slug, `nepoznata kategorija ${product.taxonomy.category}`);
  if (!OFFICIAL.test(product.leadCode ?? "")) error(slug, `vodeća šifra nije u zvaničnom formatu: ${product.leadCode}`);
  if (!product.variants.length) error(slug, "proizvod bez ijedne šifre");

  const labels = new Set();
  for (const variant of product.variants) {
    if (!OFFICIAL.test(variant.code)) error(slug, `šifra nije u zvaničnom formatu: ${variant.code}`);
    if (!websiteCodes.has(variant.code)) error(slug, `šifra ${variant.code} nije na aktuelnom sajtu proizvođača`);
    if (seenCodes.has(variant.code)) error(slug, `šifra ${variant.code} je već na proizvodu ${seenCodes.get(variant.code)}`);
    seenCodes.set(variant.code, slug);
    if (!variant.label?.trim()) error(slug, `varijanta ${variant.code} bez oznake`);
    if (labels.has(variant.label)) error(slug, `oznaka varijante nije jedinstvena: „${variant.label}”`);
    labels.add(variant.label);
    if (variant.colour && !variant.colourSr) error(slug, `boja varijante ${variant.code} nije sačuvana kao činjenica`);
    if (variant.image && !existsSync(path.join(REPO_ROOT, "public", variant.image))) error(slug, `slika varijante ne postoji: ${variant.image}`);
  }

  if (product.image) {
    if (!product.image.src.startsWith(`${PUBLIC_IMAGE_URL_PREFIX}/`)) error(slug, `slika nije lokalno hostovana: ${product.image.src}`);
    else if (!existsSync(path.join(REPO_ROOT, "public", product.image.src))) error(slug, `slika ne postoji: ${product.image.src}`);
    if (product.sharedGroupImages) warn(slug, "proizvođač nema zasebnu fotografiju ovog proizvoda — prikazana je zvanična grupna fotografija bloka");
  } else if (!product.missingOfficialAsset) error(slug, "nema sliku, a nije označen MISSING_OFFICIAL_ASSET");
  else warn(slug, "MISSING_OFFICIAL_ASSET — koristi se placeholder sajta");

  const text = JSON.stringify([product.name, product.content]);
  for (const pattern of RISKY) if (pattern.test(text)) error(slug, `rizična pravna formulacija ${pattern}`);
  if (PRICE.test(text)) error(slug, "tekst sadrži cenu");
  if (product.shade && !product.shade.source) error(slug, "boja kartice bez navedenog izvora");
  if (product.classification === "WEBSITE_ONLY") warn(slug, "samo na aktuelnom sajtu (nema ga u digitalnom katalogu)");
}

for (const item of plan.items.filter((entry) => entry.action.startsWith("HELD"))) error(item.sourceKey, `zadržan proizvod: ${item.action} — ${item.reason}`);
for (const [name, list] of Object.entries(plan.summary.planErrors)) if (list.length) error("plan", `${name}: ${JSON.stringify(list)}`);

const { products } = loadCatalogRuntime();
const runtime = products.filter((product) => product.brandSlug === BRAND.slug);
const runtimeSlugs = new Set(runtime.map((product) => product.slug));
for (const product of dataset.products) if (!runtimeSlugs.has(product.slug)) error(product.slug, "u datasetu je, ali ga runtime katalog ne prikazuje");
for (const product of runtime) {
  if (seenSlugs.has(product.slug) && product.publicStatus !== "Na upit") error(product.slug, `uvezen proizvod mora biti „Na upit”, a jeste „${product.publicStatus}”`);
  if (seenSlugs.has(product.slug) && (product.price !== undefined || product.priceRsd !== undefined)) error(product.slug, "uvezen proizvod nosi cenu");
}
if (products.some((product) => ["leo", "turkuaz", "befar-plus"].includes(product.brandSlug))) error("brand", "Leo/Turkuaz/Plus ne smeju biti zaseban brend — to su linije brenda Befar");

const summary = {
  products: dataset.products.length,
  variants: dataset.products.reduce((sum, product) => sum + product.variants.length, 0),
  byLine: dataset.meta.byLine,
  sets: dataset.products.filter((product) => product.isSet).length,
  runtimeBefarProducts: runtime.length,
  withImage: dataset.products.filter((product) => product.image).length,
  variantsWithOwnImage: dataset.products.reduce((sum, product) => sum + product.variants.filter((variant) => variant.image).length, 0),
  variantsWithColourFact: dataset.products.reduce((sum, product) => sum + product.variants.filter((variant) => variant.colourSr).length, 0),
  variantsWithHardness: dataset.products.reduce((sum, product) => sum + product.variants.filter((variant) => variant.hardnessStars).length, 0),
  withShade: dataset.products.filter((product) => product.shade).length,
  localizedEntries: Object.keys(localization).length,
  errors: errors.length,
  warnings: warnings.length,
};
writeJson(PATHS.validation, { summary, errors, warnings });
console.log(JSON.stringify(summary, null, 2));
for (const message of errors.slice(0, 40)) console.log(`✖ ${message}`);
if (errors.length) process.exitCode = 1;
