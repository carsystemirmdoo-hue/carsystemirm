#!/usr/bin/env node
/**
 * Taxonomy validator + tabela dokaza za 12 platformskih kategorija.
 *
 * Pokreće ISTI klasifikator koji pokreće katalog (`lib/productTaxonomy.mjs`),
 * ali sada nad STVARNIM runtime katalogom umesto nad rekonstrukcijom.
 *
 * Ranija verzija je populaciju sklapala regexom nad `lib/carsystem-data.ts` plus
 * dva generisana JSON-a, i poredila je sa `EXPECTED_TOTAL = 832`. Ta
 * rekonstrukcija nije mogla da vidi Baslac proizvode, jer njih ne piše nijedan
 * literal u izvoru nego ih generiše `lib/baslac-catalog-products.ts` iz
 * `lib/baslac-systems.ts`. Posledica: validator je godinama klasifikovao 832
 * zapisa i prijavljivao „0 neklasifikovanih", dok je stvarni katalog imao 991
 * zapisa i 34 neklasifikovana.
 *
 * Zato nema više ni rekonstrukcije ni očekivanog ukupnog broja. Ukupno je
 * IZMERENO, a proverava se ono što mora važiti za bilo koji katalog.
 *
 * Režimi (isti obrazac kao `scripts/validate-product-identity.mjs`):
 *
 *   audit (podrazumevano)  izlaz 0; zatečeni taksonomski nalazi se PRIJAVLJUJU
 *   --strict               izlaz 1 i na te nalaze
 *
 * Razlog za audit režim: prelazak na stvarni katalog je odmah otkrio postojeće
 * nalaze u Baslac skupu. Njihovo rešavanje je izmena klasifikacije, dakle
 * izmena onoga što katalog prikazuje — to ne pripada ovom koraku. Do tada
 * moraju biti vidljivi, a build upotrebljiv. Nema allowliste slugova.
 *
 * Strukturne greške (nepoznata kategorija iz klasifikatora, navigacioni link
 * bez kategorije) obaraju build u OBA režima — one nisu zatečeno stanje nego
 * kvar.
 */

import { readFileSync } from "node:fs";
import {
  getProductCategorySlug,
  productCategories,
} from "../lib/productTaxonomy.mjs";
import { loadCatalogRuntime, summarizeCatalogRuntime } from "./lib/catalog-runtime.mjs";

const strict = process.argv.slice(2).includes("--strict");

/** Kvarovi — obaraju build uvek. */
const failures = [];
/** Zatečeni taksonomski nalazi — obaraju build samo u `--strict`. */
const findings = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

const { products } = loadCatalogRuntime();
const summary = summarizeCatalogRuntime();

/* -------------------------------------------------------------------------- */
/* Dokaz o tome KOJA grana klasifikatora je odlučila                          */
/* -------------------------------------------------------------------------- */

/**
 * Ogledalo grananja u `getProductCategorySlug`. Ne ponavlja mapiranja — samo
 * imenuje granu, da bi tabela dokaza pokazala na osnovu čega je odluka pala.
 */
function evidenceFor(product, resolved) {
  if (product.rmMetadata?.category) {
    return `rmMetadata.category=${product.rmMetadata.category}`;
  }
  const technicalCategory = product.catalogMetadata?.technicalCategory;
  if (technicalCategory) {
    // Nema mapiranja → klasifikator pada na aerosol pravilo pisano za Cosmos.
    return resolved === "sprejevi" || resolved === undefined
      ? `technicalCategory=${technicalCategory} (fallback po phaseSlug)`
      : `technicalCategory=${technicalCategory}`;
  }
  /*
   * Poslednje dve grane su badge vokabular pa `programSlug`. Razlikovanje bi
   * tražilo kopiju `BADGE_MAP`-a iz klasifikatora — druga implementacija istog
   * mapiranja, tačno ono što ovaj validator postoji da spreči. Zato zajednička
   * oznaka, kao i u ranijoj verziji tabele.
   */
  if (resolved && (product.badges ?? []).length > 0) return "badge/programSlug";
  return `programSlug=${product.programSlug ?? "?"}`;
}

/* -------------------------------------------------------------------------- */
/* Klasifikacija                                                              */
/* -------------------------------------------------------------------------- */

const buckets = new Map(productCategories.map((category) => [category.slug, []]));
const unclassified = [];
/** Zapisi koje je u kategoriju uvela Cosmos aerosol grana, a nisu Cosmos. */
const aerosolFallbackOutsideCosmos = [];

for (const product of products) {
  const slug = getProductCategorySlug(product);
  const evidence = evidenceFor(product, slug);

  if (!slug) {
    unclassified.push({ slug: product.slug, brandSlug: product.brandSlug, evidence });
    continue;
  }

  expect(buckets.has(slug), `Klasifikator je vratio nepoznatu kategoriju: ${slug}`);
  buckets.get(slug)?.push({ slug: product.slug, brandSlug: product.brandSlug, evidence });

  if (
    slug === "sprejevi" &&
    product.brandSlug !== "cosmos-lac" &&
    evidence.includes("fallback")
  ) {
    aerosolFallbackOutsideCosmos.push({
      slug: product.slug,
      brandSlug: product.brandSlug,
      technicalCategory: product.catalogMetadata?.technicalCategory,
    });
  }
}

/* -- Invarijanta zbira ----------------------------------------------------- */

const classified = products.length - unclassified.length;
const bucketTotal = [...buckets.values()].reduce((sum, items) => sum + items.length, 0);
expect(
  bucketTotal === classified,
  `Zbir kategorija (${bucketTotal}) se ne poklapa sa brojem klasifikovanih (${classified}).`,
);
expect(
  classified + unclassified.length === products.length,
  `Klasifikovani + neklasifikovani (${classified + unclassified.length}) ne daju ukupno (${products.length}).`,
);

/* -- Zatečeni nalazi ------------------------------------------------------- */

if (unclassified.length > 0) {
  const byBrand = {};
  for (const item of unclassified) byBrand[item.brandSlug] = (byBrand[item.brandSlug] ?? 0) + 1;
  findings.push(
    `Neklasifikovanih proizvoda: ${unclassified.length} (${JSON.stringify(byBrand)}). ` +
      `Primeri: ${unclassified.slice(0, 5).map((item) => item.slug).join(", ")}.`,
  );
}

if (aerosolFallbackOutsideCosmos.length > 0) {
  const byBrand = {};
  for (const item of aerosolFallbackOutsideCosmos) {
    byBrand[item.brandSlug] = (byBrand[item.brandSlug] ?? 0) + 1;
  }
  findings.push(
    `U „Sprejevi" je kroz Cosmos aerosol granu ušlo ${aerosolFallbackOutsideCosmos.length} zapisa van Cosmos Lac-a ` +
      `(${JSON.stringify(byBrand)}). Grana je pisana za aerosol, pa je za limenke verovatno netačna.`,
  );
}

/* -------------------------------------------------------------------------- */
/* Svaki navigacioni link mora imati kategoriju i obrnuto                     */
/* -------------------------------------------------------------------------- */

const navigation = readFileSync("components/layout/navigation-data.ts", "utf8");
const navigationSlugs = [
  ...navigation.matchAll(/href:\s*"\/katalog\?kategorija=([a-z-]+)"/g),
].map((m) => m[1]);

expect(
  navigationSlugs.length === productCategories.length,
  `Navigacionih kategorijskih linkova ${navigationSlugs.length}, a kategorija ${productCategories.length}.`,
);
for (const slug of navigationSlugs) {
  expect(
    buckets.has(slug),
    `Navigacioni link \`?kategorija=${slug}\` nema kategoriju u taksonomiji.`,
  );
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
      Object.entries(evidence)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6),
    ),
  };
});

console.log(
  JSON.stringify(
    {
      mode: strict ? "strict" : "audit",
      source: "runtime (lib/carsystem-data.ts → getAllCarsystemProducts)",
      measured: {
        total: products.length,
        classified,
        unclassified: unclassified.length,
        byBrand: summary.byBrand,
      },
      emptyCategories: table.filter((row) => row.count === 0).map((row) => row.slug),
      categories: table,
    },
    null,
    2,
  ),
);

if (findings.length) {
  console.log(`\nZatečeni taksonomski nalazi (${findings.length}):`);
  for (const finding of findings) console.log(`  - ${finding}`);

  if (strict) {
    console.error("\nStrict režim: zatečeni nalazi obaraju build.");
    process.exit(1);
  }
  console.log(
    "\nAudit režim: nalazi su prijavljeni, izlaz je 0. Klasifikacija se menja tek uz odobrenu izmenu kataloga.",
  );
}
