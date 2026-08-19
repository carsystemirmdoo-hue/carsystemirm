#!/usr/bin/env node
/**
 * Taxonomy validator + evidence table for the 12 platform categories.
 *
 * Runs the SAME classifier the catalog runs (`lib/productTaxonomy.mjs`) over the
 * reconstructed 832-record population, so a rule change can never pass here and
 * behave differently in the browser.
 *
 * Fails when:
 *   - the reconstruction does not total the live model's 832 records;
 *   - a product falls into no category and is not on the documented
 *     unclassified list;
 *   - a category slug used by `PRODUCT_CATEGORIES` has no counterpart in the
 *     taxonomy (a navigation link that could never filter anything).
 *
 * An empty category is reported, not failed: "Pribor" is legitimately empty
 * today, and the catalog says so explicitly instead of pretending otherwise.
 */

import { readFileSync } from "node:fs";
import {
  getProductCategorySlug,
  productCategories,
} from "../lib/productTaxonomy.mjs";

const EXPECTED_TOTAL = 832;
const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

/* -------------------------------------------------------------------------- */
/* Reconstruct the catalogue population from the three runtime sources        */
/* -------------------------------------------------------------------------- */

const source = readFileSync("lib/carsystem-data.ts", "utf8");
const recordsStart = source.indexOf("const productRecords: CarsystemProduct[] = [");
const recordsBlock = source.slice(recordsStart, source.indexOf("\n];", recordsStart));

const liveSlugs = new Set([
  ...[...recordsBlock.matchAll(/\n\s*slug:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]),
  ...[...recordsBlock.matchAll(/archivedProduct\("([a-z0-9-]+)"\)/g)].map((m) => m[1]),
]);

const starts = [...source.matchAll(/\n\s*slug:\s*"([a-z0-9-]+)"/g)];
const handWritten = [];
starts.forEach((start, index) => {
  const slug = start[1];
  if (!liveSlugs.has(slug)) return;
  const body = source.slice(start.index, starts[index + 1]?.index ?? source.length);
  const rmCategory = /category:\s*"([a-z-]+)"/.exec(body)?.[1];
  handWritten.push({
    slug,
    name: /name:\s*"([^"]+)"/.exec(body)?.[1] ?? "",
    brandSlug: /brandSlug:\s*"([a-z0-9-]+)"/.exec(body)?.[1] ?? "",
    programSlug: /programSlug:\s*"([a-z0-9-]+)"/.exec(body)?.[1] ?? "",
    phaseSlug: /phaseSlug:\s*"([a-z0-9-]+)"/.exec(body)?.[1] ?? "",
    badges: [...(/badges:\s*\[([^\]]*)\]/.exec(body)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map(
      (m) => m[1],
    ),
    rmMetadata: rmCategory ? { category: rmCategory } : null,
    evidence: rmCategory ? `rmMetadata.category=${rmCategory}` : "badge/programSlug",
  });
});

const padColours = [
  ...source.matchAll(/\n\s{4}slug:\s*"(narandzasti|crni|plavi|beli|zuti)"/g),
].map((m) => m[1]);
const befarPads = padColours.flatMap((colour) =>
  ["25x150", "50x150"].map((size) => ({
    slug: `befar-sundjer-${colour}-${size}`,
    name: `Befar sunđer ${colour} ${size}`,
    brandSlug: "befar",
    programSlug: "poliranje",
    phaseSlug: "poliranje",
    badges: ["Sunđer", "Poliranje"],
    rmMetadata: null,
    evidence: "programSlug=poliranje",
  })),
);

const rm = JSON.parse(
  readFileSync("data/rm-imported-products.generated.json", "utf8"),
).products.map((product) => ({
  slug: product.slug,
  name: product.canonicalName,
  brandSlug: "rm",
  programSlug: product.taxonomy.programSlug,
  phaseSlug: product.taxonomy.phaseSlug,
  badges: [],
  rmMetadata: { category: product.taxonomy.category },
  evidence: `rmMetadata.category=${product.taxonomy.category}`,
}));

const cosmosRaw = JSON.parse(readFileSync("data/cosmos-lac-products.generated.json", "utf8"));
const cosmos = (Array.isArray(cosmosRaw) ? cosmosRaw : cosmosRaw.products).map((record) => ({
  slug: record.slug,
  name: record.displayNameSr,
  brandSlug: "cosmos-lac",
  programSlug: record.programSlug,
  phaseSlug: record.primaryCategory,
  badges: [],
  rmMetadata: null,
  catalogMetadata: { technicalCategory: record.technicalCategory },
  evidence: `technicalCategory=${record.technicalCategory}`,
}));

const products = [...rm, ...handWritten, ...befarPads, ...cosmos];

expect(
  products.length === EXPECTED_TOTAL,
  `Rekonstrukcija (${products.length}) se ne poklapa sa live modelom (${EXPECTED_TOTAL}).`,
);

/* -------------------------------------------------------------------------- */
/* Classify                                                                   */
/* -------------------------------------------------------------------------- */

const buckets = new Map(productCategories.map((category) => [category.slug, []]));
const unclassified = [];

for (const product of products) {
  const slug = getProductCategorySlug(product);
  if (!slug) {
    unclassified.push(product);
    continue;
  }
  const bucket = buckets.get(slug);
  expect(Boolean(bucket), `Klasifikator je vratio nepoznatu kategoriju: ${slug}`);
  bucket?.push(product);
}

expect(
  unclassified.length === 0,
  `Neklasifikovani proizvodi (${unclassified.length}): ${unclassified
    .slice(0, 10)
    .map((p) => p.slug)
    .join(", ")}`,
);

/* -------------------------------------------------------------------------- */
/* Every navigation category link must exist in the taxonomy                  */
/* -------------------------------------------------------------------------- */

const navigation = readFileSync("components/layout/navigation-data.ts", "utf8");
const navigationSlugs = [
  ...navigation.matchAll(/href:\s*"\/katalog\?kategorija=([a-z-]+)"/g),
].map((m) => m[1]);

expect(
  navigationSlugs.length === 12,
  `Očekivano 12 kategorijskih linkova u navigaciji, pronađeno ${navigationSlugs.length}.`,
);
for (const slug of navigationSlugs) {
  expect(buckets.has(slug), `Navigacioni link \`?kategorija=${slug}\` nema kategoriju u taksonomiji.`);
}
for (const category of productCategories) {
  expect(
    navigationSlugs.includes(category.slug),
    `Kategorija \`${category.slug}\` nije dostupna ni sa jednog navigacionog linka.`,
  );
}

/* -------------------------------------------------------------------------- */

if (failures.length) {
  console.error(`Taxonomy validacija nije prošla (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const table = productCategories.map((category) => {
  const items = buckets.get(category.slug) ?? [];
  const evidence = {};
  for (const item of items) evidence[item.evidence] = (evidence[item.evidence] ?? 0) + 1;
  return {
    slug: category.slug,
    label: category.label,
    count: items.length,
    representative: items.slice(0, 3).map((item) => item.slug),
    evidence: Object.fromEntries(
      Object.entries(evidence).sort((a, b) => b[1] - a[1]).slice(0, 6),
    ),
  };
});

console.log(
  JSON.stringify(
    {
      total: products.length,
      classified: products.length - unclassified.length,
      unclassified: unclassified.length,
      emptyCategories: table.filter((row) => row.count === 0).map((row) => row.slug),
      categories: table,
    },
    null,
    2,
  ),
);
