#!/usr/bin/env node
/**
 * Phase 5, step 1 — exact local inventory of every brand in the Carsystem
 * catalogue.
 *
 * Establishes the baseline the acquisition work is measured against: for each
 * brand, what products, images and documents do we already hold locally.
 *
 * Read from the *built* output rather than the TypeScript source, because the
 * built pages are the only place the brand→product mapping is fully resolved
 * (products come from three separate data sources and are merged at runtime).
 *
 * Output: docs/seo/BRAND_INVENTORY.json + .md
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from "node:fs";
import path from "node:path";

const APP_DIR = ".next/server/app";

if (!existsSync(APP_DIR)) {
  console.error("Nema build izlaza. Pokrenite `npm run build` prvo.");
  process.exit(1);
}

/* -- Brand definitions from source ------------------------------------------ */

const dataSource = readFileSync("lib/carsystem-data.ts", "utf8");

function extractBrandBlock(marker, endMarker) {
  const start = dataSource.indexOf(marker);
  const end = dataSource.indexOf(endMarker, start);
  return dataSource.slice(start, end === -1 ? start + 30000 : end);
}

const activeBlock = extractBrandBlock(
  "export const brands: CarsystemBrand[]",
  "export const futureBrands",
);
const futureBlock = extractBrandBlock(
  "export const futureBrands: FutureBrand[]",
  "export const programGroups",
);

function parseBrands(block, status) {
  const brands = [];
  const re = /slug:\s*"([a-z0-9-]+)",\s*\n\s*name:\s*"([^"]+)"/g;
  let match;
  while ((match = re.exec(block)) !== null) {
    brands.push({ slug: match[1], name: match[2], status });
  }
  return brands;
}

const brands = [
  ...parseBrands(activeBlock, "active"),
  ...parseBrands(futureBlock, "placeholder"),
];

/* -- Products per brand from built pages ------------------------------------ */

const productDir = path.join(APP_DIR, "proizvodi");
const productFiles = readdirSync(productDir).filter((file) => file.endsWith(".html"));

const nameToSlug = new Map(brands.map((brand) => [brand.name, brand.slug]));
const productsByBrand = new Map(brands.map((brand) => [brand.slug, []]));
const unmatchedBrandNames = new Set();

for (const file of productFiles) {
  const html = readFileSync(path.join(productDir, file), "utf8");
  const brandName = html.match(
    /"brand":\{"@type":"Brand","name":"([^"]+)"/,
  )?.[1];
  if (!brandName) continue;
  const slug = nameToSlug.get(brandName);
  if (!slug) {
    unmatchedBrandNames.add(brandName);
    continue;
  }
  productsByBrand.get(slug).push(file.replace(/\.html$/, ""));
}

/* -- Local assets ------------------------------------------------------------ */

function countFiles(dir, filter = () => true) {
  if (!existsSync(dir)) return { count: 0, bytes: 0 };
  let count = 0;
  let bytes = 0;
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (filter(entry.name)) {
        count += 1;
        bytes += statSync(full).size;
      }
    }
  };
  walk(dir);
  return { count, bytes };
}

const IMAGE_RE = /\.(webp|png|jpe?g|avif|svg)$/i;
const PDF_RE = /\.pdf$/i;

/** Candidate on-disk locations for a brand's assets. */
function assetDirs(slug) {
  return {
    images: [
      `public/products/${slug}`,
      `public/images/brands/${slug}`,
      // Cosmos Lac ships under two historical directory names.
      slug === "cosmos-lac" ? "public/products/cosmos-spray" : null,
    ].filter(Boolean),
    documents: [`public/documents/products/${slug}`],
  };
}

const inventory = brands.map((brand) => {
  const dirs = assetDirs(brand.slug);
  const images = dirs.images.reduce(
    (acc, dir) => {
      const result = countFiles(dir, (name) => IMAGE_RE.test(name));
      return { count: acc.count + result.count, bytes: acc.bytes + result.bytes };
    },
    { count: 0, bytes: 0 },
  );
  const documents = dirs.documents.reduce(
    (acc, dir) => {
      const result = countFiles(dir, (name) => PDF_RE.test(name));
      return { count: acc.count + result.count, bytes: acc.bytes + result.bytes };
    },
    { count: 0, bytes: 0 },
  );

  const products = productsByBrand.get(brand.slug) ?? [];

  return {
    brandSlug: brand.slug,
    brandName: brand.name,
    status: brand.status,
    productCount: products.length,
    productSlugs: products,
    localImages: images.count,
    localImageBytes: images.bytes,
    localDocuments: documents.count,
    localDocumentBytes: documents.bytes,
    imageDirs: dirs.images.filter((dir) => existsSync(dir)),
    documentDirs: dirs.documents.filter((dir) => existsSync(dir)),
  };
});

/* -- Documents that are placeholders ---------------------------------------- */

const placeholderDocs = ["public/documents/placeholder-tds.pdf", "public/documents/placeholder-msds.pdf"]
  .filter((file) => existsSync(file));

const summary = {
  generatedAt: new Date().toISOString(),
  brands: inventory.length,
  activeBrands: inventory.filter((brand) => brand.status === "active").length,
  placeholderBrands: inventory.filter((brand) => brand.status === "placeholder").length,
  totalProducts: inventory.reduce((sum, brand) => sum + brand.productCount, 0),
  totalLocalImages: inventory.reduce((sum, brand) => sum + brand.localImages, 0),
  totalLocalDocuments: inventory.reduce((sum, brand) => sum + brand.localDocuments, 0),
  brandsWithNoDocuments: inventory
    .filter((brand) => brand.status === "active" && brand.localDocuments === 0)
    .map((brand) => brand.brandSlug),
  brandsWithNoProducts: inventory
    .filter((brand) => brand.productCount === 0)
    .map((brand) => brand.brandSlug),
  unmatchedBrandNames: [...unmatchedBrandNames],
  placeholderDocuments: placeholderDocs,
};

mkdirSync("docs/seo", { recursive: true });
writeFileSync(
  "docs/seo/BRAND_INVENTORY.json",
  `${JSON.stringify({ summary, brands: inventory }, null, 2)}\n`,
);

/* -- Markdown --------------------------------------------------------------- */

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);
const lines = [];
lines.push("# Carsystem — inventar brendova (lokalno stanje)");
lines.push("");
lines.push(`Datum: ${summary.generatedAt.slice(0, 10)}`);
lines.push("");
lines.push(
  "Šta trenutno postoji u projektu, po brendu. Ovo je polazno stanje u odnosu na koje se meri prikupljanje podataka od proizvođača.",
);
lines.push("");
lines.push("| Brend | Status | Proizvoda | Slika | Dokumenata (PDF) |");
lines.push("| --- | --- | ---: | ---: | ---: |");
for (const brand of inventory.sort((a, b) => b.productCount - a.productCount)) {
  lines.push(
    `| **${brand.brandName}** | ${brand.status === "active" ? "u katalogu" : "u pripremi"} | ${brand.productCount} | ${brand.localImages} | ${brand.localDocuments} |`,
  );
}
lines.push(
  `| **UKUPNO** | | **${summary.totalProducts}** | **${summary.totalLocalImages}** | **${summary.totalLocalDocuments}** |`,
);
lines.push("");

lines.push("## Najveće rupe u lokalnim podacima");
lines.push("");
lines.push("| Brend | Proizvoda | Dokumenata | Problem |");
lines.push("| --- | ---: | ---: | --- |");
for (const brand of inventory.filter((item) => item.status === "active")) {
  const problems = [];
  if (brand.localDocuments === 0 && brand.productCount > 0) {
    problems.push("nema nijedan tehnički dokument");
  }
  if (brand.localImages < brand.productCount) {
    problems.push(`slika manje nego proizvoda (${brand.localImages}/${brand.productCount})`);
  }
  if (brand.productCount === 0) problems.push("nema proizvoda u katalogu");
  if (!problems.length) continue;
  lines.push(
    `| ${brand.brandName} | ${brand.productCount} | ${brand.localDocuments} | ${problems.join("; ")} |`,
  );
}
lines.push("");

if (summary.placeholderDocuments.length) {
  lines.push("## Placeholder dokumenti");
  lines.push("");
  lines.push(
    "Ovi fajlovi nisu stvarna dokumentacija i ne smeju se tretirati kao izvor:",
  );
  lines.push("");
  for (const file of summary.placeholderDocuments) lines.push(`- \`${file}\``);
  lines.push("");
}

lines.push("## Veličina lokalnih materijala");
lines.push("");
lines.push("| Brend | Slike | Dokumenti |");
lines.push("| --- | ---: | ---: |");
for (const brand of inventory.filter((item) => item.localImages || item.localDocuments)) {
  lines.push(
    `| ${brand.brandName} | ${mb(brand.localImageBytes)} MB | ${mb(brand.localDocumentBytes)} MB |`,
  );
}
lines.push("");

writeFileSync("docs/seo/BRAND_INVENTORY.md", `${lines.join("\n")}\n`);

console.log(JSON.stringify(summary, null, 2));
