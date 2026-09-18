#!/usr/bin/env node
/**
 * Carsystem sync · korak 6 — validacija REZULTATA u stvarnom runtime katalogu.
 *
 * Ne proverava generisani JSON izolovano, nego ono što sajt zaista renderuje
 * (`scripts/lib/catalog-runtime.mjs`), jer duplikat može nastati tek u spoju
 * uvezenih i ručnih zapisa.
 *
 * Greška (exit 1) je sve što bi kupac video kao kvar ili lažan podatak.
 * Upozorenje je ono što traži ljudsku odluku, ali ne kvari katalog.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { PATHS, PUBLIC_IMAGE_URL_PREFIX, REPO_ROOT } from "./lib/config.mjs";
import { readJson } from "./lib/http.mjs";
import { loadCatalogRuntime } from "../lib/catalog-runtime.mjs";

const errors = [];
const warnings = [];
const expect = (condition, message) => condition || errors.push(message);

const dataset = readJson(PATHS.siteDataset);
const registry = readJson(PATHS.identityRegistry);
const source = readJson(PATHS.source);
if (!dataset || !registry || !source) throw new Error("Nedostaje dataset/registar/source — pokrenuti sync.");

const runtime = loadCatalogRuntime();
const taxonomy = runtime.requireModule("lib/product-taxonomy.ts");
const motion = runtime.requireModule("components/product/productMotion.ts");
const data = runtime.requireModule("lib/carsystem-data.ts");

const carsystem = runtime.products.filter((product) => product.brandSlug === "carsystem");
const imported = carsystem.filter((product) => registry.products[product.slug]);
const officialArticles = new Set(source.products.flatMap((product) => product.articles.map((article) => article.articleNumber)));

/* -- duplikati -------------------------------------------------------------- */

const count = (values) => values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map());
for (const [slug, total] of count(runtime.products.map((product) => product.slug))) {
  expect(total === 1, `Dupli slug u katalogu: ${slug} (${total}×)`);
}
for (const [name, total] of count(carsystem.map((product) => product.name))) {
  expect(total === 1, `Dupli naziv Carsystem proizvoda: ${name} (${total}×)`);
}

const articleOwners = new Map();
for (const product of carsystem) {
  const rows = product.detail?.variants?.content.rows ?? [];
  const ids = rows.length ? rows.map((row) => row.id) : product.manufacturerCode ? [product.manufacturerCode] : [];
  for (const [id, total] of count(ids)) expect(total === 1, `Dupla varijanta ${id} u ${product.slug}`);
  for (const id of ids) {
    if (!/^\d{3}\.\d{3}$/.test(id)) continue;
    articleOwners.set(id, [...(articleOwners.get(id) ?? []), product.slug]);
  }
}
for (const [article, owners] of articleOwners) {
  expect(owners.length === 1, `Šifra proizvođača ${article} pripada više proizvoda: ${owners.join(", ")}`);
}

// Istorijska šifra (artikal prenumerisan kod proizvođača) ne sme da bude i aktivna
// šifra bilo kog proizvoda — inače bi pretraga po njoj vodila na dva mesta.
for (const product of carsystem) {
  for (const legacy of product.legacyManufacturerCodes ?? []) {
    expect(!articleOwners.has(legacy), `${product.slug}: istorijska šifra ${legacy} je ujedno aktivna šifra proizvoda ${articleOwners.get(legacy)?.join(", ")}`);
  }
}

/* -- uvezeni proizvodi ------------------------------------------------------ */

expect(imported.length === dataset.products.length, `Runtime ima ${imported.length} uvezenih, dataset ${dataset.products.length}.`);

const usedImages = new Set();
for (const product of imported) {
  const at = product.slug;
  expect(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(at) && at.length <= 80, `Neispravan slug: ${at}`);
  for (const field of ["name", "shortDescription", "longDescription", "purpose", "sku"]) {
    expect(typeof product[field] === "string" && product[field].trim(), `${at}: prazno polje ${field}`);
  }
  expect(product.publicStatus === "Na upit" && product.stockStatus === "unknown", `${at}: uvoz ne sme da tvrdi dostupnost`);
  expect(!/\b(RSD|EUR|din\.?|€)\b/i.test(`${product.shortDescription} ${product.longDescription}`), `${at}: tekst pominje cenu`);
  expect(!/zvani[čc]ni distributer|ovla[šs][ćc]eni|ekskluzivn/i.test(`${product.shortDescription} ${product.longDescription}`), `${at}: rizična pravna formulacija`);

  const category = taxonomy.getProductCategorySlug(product);
  expect(Boolean(category), `${at}: bez kategorije`);
  expect(category === product.taxonomyCategory, `${at}: kategorija ${category} ≠ mapirana ${product.taxonomyCategory}`);
  expect(data.programGroups.some((group) => group.slug === product.programSlug), `${at}: nepoznat programSlug ${product.programSlug}`);

  const images = [product.productImage, ...product.galleryImages].filter(Boolean);
  const datasetEntry = dataset.products.find((candidate) => candidate.slug === at);
  if (datasetEntry?.missingOfficialAsset) warnings.push(`${at}: MISSING_OFFICIAL_ASSET — aktivan proizvod bez zvanične slike, prikazuje se placeholder`);
  else expect(product.productImage?.src?.startsWith(PUBLIC_IMAGE_URL_PREFIX), `${at}: nema zvaničnu sliku`);
  for (const image of images) {
    if (!image.src.startsWith(PUBLIC_IMAGE_URL_PREFIX)) continue;
    usedImages.add(image.src);
    const file = path.join(REPO_ROOT, "public", image.src);
    expect(existsSync(file) && statSync(file).size > 1500, `${at}: slika ne postoji ili je prazna — ${image.src}`);
  }

  const entry = dataset.products.find((candidate) => candidate.slug === at);
  expect(entry.variants.length > 0, `${at}: nema nijednu šifru artikla`);
  for (const variant of entry.variants) {
    expect(officialArticles.has(variant.articleNumber), `${at}: šifra ${variant.articleNumber} nije u zvaničnom izvoru`);
    expect(variant.label?.trim(), `${at}: varijanta ${variant.articleNumber} bez oznake`);
  }
  if (entry.variants.length > 1) {
    const selector = data.getProductVariantSelector(product);
    expect(selector?.variants.length === entry.variants.length, `${at}: selektor varijanti ima ${selector?.variants.length ?? 0} od ${entry.variants.length}`);
    const labels = count(entry.variants.map((variant) => variant.label));
    for (const [label, total] of labels) if (total > 1) warnings.push(`${at}: ${total} varijante imaju istu oznaku „${label}”`);
  }
  for (const slug of product.relatedProductSlugs) {
    expect(runtime.products.some((candidate) => candidate.slug === slug), `${at}: preporuka pokazuje na nepostojeći proizvod ${slug}`);
  }
  expect(registry.products[at].articleNumbers.every((article) => /^\d{3}\.\d{3}$/.test(article)), `${at}: registar nosi neispravnu šifru`);
}

/* -- boja kartice ----------------------------------------------------------- */

const plan = readJson(PATHS.plan);
const shadeExpected = new Set(plan.items.filter((item) => item.action === "IMPORT" && item.taxonomy.packshotShade).map((item) => item.slug));
const withoutShade = imported.filter((product) => shadeExpected.has(product.slug) && !motion.getProductShadeSource(product));
for (const product of withoutShade) {
  warnings.push(`${product.slug}: proizvod sa sopstvenom bojom materijala nema potvrđenu boju serije → boja brenda`);
}
for (const product of imported) {
  const shade = motion.getProductShadeSource(product);
  if (shade) expect(/^#[0-9A-F]{6}$/i.test(shade.color) && shade.source, `${product.slug}: boja bez izvora ili u pogrešnom formatu`);
}

/* -- siročad ---------------------------------------------------------------- */

for (const enrichment of Object.values(dataset.enrichments)) if (enrichment.image) usedImages.add(enrichment.image.src);

const orphans = existsSync(PATHS.publicImages)
  ? readdirSync(PATHS.publicImages).filter((file) => !usedImages.has(`${PUBLIC_IMAGE_URL_PREFIX}/${file}`))
  : [];
for (const file of orphans) warnings.push(`slika bez proizvoda: ${PUBLIC_IMAGE_URL_PREFIX}/${file}`);

/* -- ručni zapisi ostaju netaknuti ------------------------------------------ */

for (const slug of Object.keys(dataset.enrichments)) {
  const product = carsystem.find((candidate) => candidate.slug === slug);
  expect(Boolean(product), `Dopuna za nepostojeći ručni zapis: ${slug}`);
  if (!product) continue;
  const officialImage = dataset.enrichments[slug].image;
  if (officialImage) {
    expect(product.productImage?.src === officialImage.src, `${slug}: zamena slike nije primenjena (${product.productImage?.src})`);
    expect(existsSync(path.join(REPO_ROOT, "public", officialImage.src)), `${slug}: zamenska slika ne postoji — ${officialImage.src}`);
    const sharedWith = imported.filter((candidate) => candidate.productImage?.src === officialImage.src).map((candidate) => candidate.slug);
    expect(sharedWith.length === 0, `${slug}: deli packshot sa ${sharedWith.join(", ")}`);
  }
  const rows = product.detail?.variants?.content.rows ?? [];
  expect(rows.length >= dataset.enrichments[slug].variants.length, `${slug}: dopuna varijanti nije primenjena`);
  expect((product.detail?.technicalFacts?.content.length ?? 0) > 0, `${slug}: dopuna je sakrila tehničke podatke`);
}

const result = {
  carsystemProducts: carsystem.length,
  imported: imported.length,
  handWritten: carsystem.length - imported.length,
  manufacturerArticleNumbers: articleOwners.size,
  importedWithShade: imported.filter((product) => motion.getProductShadeSource(product)).length,
  materialProductsOnBrandColour: withoutShade.length,
  orphanedImages: orphans.length,
  errors: errors.length,
  warnings: warnings.length,
};
console.log(JSON.stringify(result, null, 2));
if (warnings.length) console.log(`\nUpozorenja (${warnings.length}):\n${warnings.slice(0, 60).map((line) => `  - ${line}`).join("\n")}${warnings.length > 60 ? `\n  … +${warnings.length - 60}` : ""}`);
if (errors.length) {
  console.error(`\nGreške (${errors.length}):\n${errors.slice(0, 80).map((line) => `  ✗ ${line}`).join("\n")}`);
  process.exitCode = 1;
}
