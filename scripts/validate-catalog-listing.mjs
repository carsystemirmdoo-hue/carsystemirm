#!/usr/bin/env node
/**
 * Validator canonical listing modela.
 *
 * Ranija verzija je populaciju rekonstruisala iz `data/cosmos-lac-products.generated.json`
 * i poredila je sa hardkodiranim `TOTAL_PRODUCTS = 832`. Ta rekonstrukcija nije
 * videla 163 Baslac zapisa koje generiše `lib/baslac-catalog-products.ts`, pa je
 * validator prolazio tvrdeći 832 proizvoda i 41 porodicu dok ih je runtime imao
 * 991 i 48. Svaki snapshot broj zastari čim se uveze nova roba.
 *
 * Zato ovde više nema očekivanog ukupnog broja. Model se učitava iz istog
 * runtime izvora koji renderuje javni sajt (`scripts/lib/catalog-runtime.mjs` →
 * `getCatalogListingData()`, `getAllProductFamilies()`), zbirne vrednosti se
 * MERE i ispisuju, a proveravaju se INVARIJANTE — tvrdnje koje moraju važiti za
 * bilo koji katalog, i danas i posle uvoza:
 *
 *   - varijante + samostalni === ukupno proizvoda;
 *   - browse (canonical) === porodice + samostalni;
 *   - jedna porodica daje tačno jedan browse entitet;
 *   - browse nikada ne prikazuje varijantu;
 *   - svaka porodica ima najmanje `FAMILY_MIN_VARIANTS` varijanti;
 *   - svaka porodica je dostupna sa svoje canonical rute;
 *   - svaka varijanta pripada porodici koja postoji u browse skupu.
 *
 * Jedini zaključani poslovni ugovori su izdvojeni u `BUSINESS_CONTRACT` — to su
 * namerne odluke, ne izmereni brojevi.
 */

import {
  loadCatalogRuntime,
  summarizeCatalogRuntime,
} from "./lib/catalog-runtime.mjs";

/**
 * Namerno zaključane poslovne odluke. NE zbir trenutnog kataloga.
 *
 * `familyMinVariants` prati `FAMILY_MIN_VARIANTS` u `lib/product-families.ts`:
 * grupa od jednog člana nije porodica nego proizvod, i to se ne menja rastom
 * asortimana.
 */
const BUSINESS_CONTRACT = {
  familyMinVariants: 2,
};

const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

const { families, listing, variantSlugs, familyPath } = loadCatalogRuntime();
const summary = summarizeCatalogRuntime();
const { canonical, variants } = listing;

/* -- Invarijante zbira ----------------------------------------------------- */

expect(
  summary.variants + summary.standalone === summary.total,
  `Varijante (${summary.variants}) + samostalni (${summary.standalone}) ne daju ukupno (${summary.total}).`,
);

expect(
  canonical.length === summary.families + summary.standalone,
  `Browse entiteta ${canonical.length}, a porodica + samostalnih ${summary.families + summary.standalone}.`,
);

expect(
  variants.length === summary.variants,
  `Listing nosi ${variants.length} varijanti, a katalog ih ima ${summary.variants}.`,
);

/* -- Jedna porodica = jedan browse entitet --------------------------------- */

const familyEntities = canonical.filter((entity) => entity.kind === "family");
expect(
  familyEntities.length === families.length,
  `Family entiteta ${familyEntities.length}, a porodica ${families.length} — moguća duplirana ili izgubljena kartica.`,
);
expect(
  new Set(familyEntities.map((entity) => entity.id)).size === familyEntities.length,
  "Dva family entiteta dele isti id — duplirana family kartica u katalogu.",
);
expect(
  new Set(canonical.map((entity) => entity.id)).size === canonical.length,
  "Browse skup sadrži dva entiteta sa istim id-om.",
);

/* Browse je skup canonical entiteta; varijanta se prikazuje samo na upit. */
expect(
  canonical.every((entity) => entity.kind !== "variant"),
  "Browse skup sadrži varijantu — katalog i canonical/sitemap bi opisivali različite entitete.",
);

/* -- Porodice -------------------------------------------------------------- */

for (const family of families) {
  expect(
    family.variants.length >= BUSINESS_CONTRACT.familyMinVariants,
    `Porodica "${family.slug}" ima ${family.variants.length} varijanti, a ugovor traži najmanje ${BUSINESS_CONTRACT.familyMinVariants}.`,
  );
  expect(
    Boolean(family.representative?.slug),
    `Porodica "${family.slug}" nema determinističku reprezentativnu varijantu.`,
  );
}

/* Svaka canonical family ruta mora biti dostižna kao browse entitet. */
const canonicalHrefs = new Set(canonical.map((entity) => entity.href));
for (const family of families) {
  expect(
    canonicalHrefs.has(familyPath(family)),
    `Canonical ruta ${familyPath(family)} nije dostižna iz browse skupa.`,
  );
}

/* -- Varijante ------------------------------------------------------------- */

const familySlugs = new Set(families.map((family) => family.slug));
for (const variant of variants) {
  expect(
    familySlugs.has(variant.familySlug),
    `Varijanta "${variant.id}" pokazuje na nepostojeću porodicu "${variant.familySlug}".`,
  );
}

expect(
  variants.every((variant) => variantSlugs.has(variant.id)),
  "Listing nosi varijantu koju family sloj ne prepoznaje kao konsolidovanu.",
);

/* -- Izlaz ----------------------------------------------------------------- */

if (failures.length) {
  console.error(`Catalog listing validacija nije prošla (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      source: "runtime (lib/catalog-listing.ts + lib/product-families.ts)",
      measured: {
        totalProducts: summary.total,
        families: summary.families,
        variants: summary.variants,
        standalone: summary.standalone,
        browseEntities: canonical.length,
        byBrand: summary.byBrand,
        familiesByBrand: summary.familiesByBrand,
        familiesByPresentation: summary.familiesByPresentation,
      },
      businessContract: BUSINESS_CONTRACT,
    },
    null,
    2,
  ),
);
