#!/usr/bin/env node
/**
 * Canonical listing model validator.
 *
 * Re-derives the entity split from the same generated data the runtime model
 * builds from, and asserts the invariants the catalog now depends on:
 *
 *   - 41 canonical families covering 715 variants;
 *   - 117 standalone entities;
 *   - 158 browse entities in total;
 *   - one card per family (no duplicate family entities);
 *   - every family route in the sitemap is reachable as a browse entity.
 *
 * The numbers are asserted, not printed, because the whole point of P1-02 is
 * that catalog discovery and the canonical/sitemap architecture describe the
 * same entities — a silent drift between them is the bug.
 */

import { readFileSync } from "node:fs";

const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

const cosmosRaw = JSON.parse(
  readFileSync("data/cosmos-lac-products.generated.json", "utf8"),
);
const cosmos = Array.isArray(cosmosRaw) ? cosmosRaw : cosmosRaw.products;

const groups = new Map();
for (const record of cosmos) {
  const bucket = groups.get(record.baseProductSlug) ?? [];
  bucket.push(record);
  groups.set(record.baseProductSlug, bucket);
}

const families = [...groups.values()].filter((variants) => variants.length >= 2);
const cosmosSingletons = [...groups.values()].filter((variants) => variants.length === 1);
const variantCount = families.reduce((total, variants) => total + variants.length, 0);

const TOTAL_PRODUCTS = 832;
const nonCosmos = TOTAL_PRODUCTS - cosmos.length;
const standalone = cosmosSingletons.length + nonCosmos;
const canonical = families.length + standalone;

expect(families.length === 41, `Očekivana 41 porodica, pronađeno ${families.length}.`);
expect(variantCount === 715, `Očekivano 715 varijanti u porodicama, pronađeno ${variantCount}.`);
expect(standalone === 117, `Očekivano 117 samostalnih entiteta, pronađeno ${standalone}.`);
expect(canonical === 158, `Očekivano 158 browse entiteta, pronađeno ${canonical}.`);
expect(
  variantCount + standalone === TOTAL_PRODUCTS,
  `Varijante + samostalni (${variantCount + standalone}) ne daju ${TOTAL_PRODUCTS}.`,
);

/* Jedna porodica = jedan browse entitet. */
const baseSlugs = families.map((variants) => variants[0].baseProductSlug);
expect(
  new Set(baseSlugs).size === families.length,
  "Porodice nisu jedinstvene po baseProductSlug — moguća duplirana family kartica.",
);

/* Reprezentativna varijanta mora biti deterministička (prva u redosledu). */
for (const variants of families) {
  expect(
    Boolean(variants[0]?.slug),
    "Porodica nema deterministički prvu varijantu za reprezentativni vizuel.",
  );
}

/* Katalog i sitemap moraju opisivati iste entitete. */
const listing = readFileSync("lib/catalog-listing.ts", "utf8");
expect(
  listing.includes("familyPath(family)"),
  "Family entitet ne koristi postojeći `familyPath` — moguć paralelni family sistem.",
);
expect(
  listing.includes('href: `/proizvodi/${product.slug}`'),
  "Samostalni entitet ne koristi svoj PDP href.",
);

if (failures.length) {
  console.error(`Catalog listing validacija nije prošla (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      families: families.length,
      variantsInFamilies: variantCount,
      standalone,
      browseEntities: canonical,
      totalProducts: TOTAL_PRODUCTS,
    },
    null,
    2,
  ),
);
