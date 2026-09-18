/**
 * Platform product taxonomy — the single source of truth for the 12 categories.
 *
 * Before this module the 12 `?kategorija=` links in `PRODUCT_CATEGORIES` had no
 * mapping behind them at all: the catalog URL parser never read the parameter,
 * so every one of them opened an unfiltered catalog. The category list existed
 * as navigation copy and icons only.
 *
 * Plain JS (not TS) on purpose: the same rules are consumed by the typed
 * catalog code (`lib/product-taxonomy.ts`), by `node --test`, and by the data
 * validator, so there is exactly one implementation to keep honest — the same
 * pattern `components/catalog/catalogInfiniteScroll.mjs` already uses.
 *
 * Classification is derived from confirmed product fields, in a fixed order of
 * evidence. Nothing is matched on product-name similarity — a wrong category is
 * a false claim about what a product is, and the catalogue carries 832 records
 * where names alone would misfile many of them.
 *
 * Evidence ladder (first rule that applies wins):
 *
 *   0. `taxonomyCategory`               — manufacturer taxonomy already mapped at
 *                                       import (Carsystem sync; the mapping is
 *                                       data/carsystem-sync/taxonomy-map.json)
 *   1. `rmMetadata.category`            — R-M's own manufacturer category (64)
 *   2. `catalogMetadata.technicalCategory` + phase
 *                                       — Cosmos Lac catalogue extraction (742)
 *   3. badge vocabulary / `programSlug` — the 26 remaining hand-written records
 *
 * Aerosols: the platform list carries both "Boje" and "Sprejevi", so format is
 * meaningful — but only where format *is* the product identity. A can of spray
 * paint belongs in Sprejevi; an aerosol cleaner is still a cleaning product and
 * belongs in Čišćenje. The rule is therefore function-first, with Sprejevi
 * claiming aerosols whose function is colour (`phaseSlug === "boja"`).
 * See docs/CATALOG_TAXONOMY.md for the per-category evidence table.
 */

/** @typedef {"boje"|"abrazivi"|"kitovi"|"maskiranje"|"sprejevi"|"oprema"|"pribor"|"lepkovi"|"ciscenje"|"zastita"|"poliranje"|"radionica"} ProductCategorySlug */

export const productCategorySlugs = [
  "boje",
  "abrazivi",
  "kitovi",
  "maskiranje",
  "sprejevi",
  "oprema",
  "pribor",
  "lepkovi",
  "ciscenje",
  "zastita",
  "poliranje",
  "radionica",
];

export const productCategories = [
  { slug: "boje", label: "Boje", description: "Bazni slojevi, lakovi, podloge i sistemske komponente." },
  { slug: "abrazivi", label: "Abrazivi", description: "Brusni diskovi, trake i materijal za brušenje." },
  { slug: "kitovi", label: "Kitovi", description: "Gitovi i punila za ravnanje površine." },
  { slug: "maskiranje", label: "Maskiranje", description: "Folije, trake i materijal za zaštitu tokom lakiranja." },
  { slug: "sprejevi", label: "Sprejevi", description: "Aerosolni program boja u spreju." },
  { slug: "oprema", label: "Oprema", description: "Pištolji i oprema za nanošenje materijala." },
  { slug: "pribor", label: "Pribor", description: "Prateći pribor i potrošni delovi opreme." },
  { slug: "lepkovi", label: "Lepkovi", description: "Lepkovi i zaptivne mase." },
  { slug: "ciscenje", label: "Čišćenje", description: "Sredstva za čišćenje i pripremu površine." },
  { slug: "zastita", label: "Zaštita", description: "Zaštita površine, podvozja i zaštitna oprema." },
  { slug: "poliranje", label: "Poliranje", description: "Paste, sunđeri i materijal za završnu obradu." },
  { slug: "radionica", label: "Radionica", description: "Radionička hemija i materijal za održavanje." },
];

const categoryBySlug = new Map(productCategories.map((category) => [category.slug, category]));

export function getProductCategory(slug) {
  return categoryBySlug.get(slug);
}

export function isProductCategorySlug(value) {
  return categoryBySlug.has(value);
}

/* -------------------------------------------------------------------------- */
/* Rule 1 — R-M manufacturer category                                         */
/* -------------------------------------------------------------------------- */

/**
 * Hardeners, thinners and additives are system components of the paint build,
 * not a category of their own — the platform list has no "Aditivi". They sit in
 * Boje, matching how `lib/seo/category-landings.ts` already presents
 * "Učvršćivači i razređivači" as part of the paint system. Flagged for a human
 * decision in docs/CATALOG_TAXONOMY.md.
 */
export const RM_CATEGORY_MAP = {
  basecoat: "boje",
  clearcoat: "boje",
  "primer-filler": "boje",
  hardener: "boje",
  thinner: "boje",
  additive: "boje",
  bodyfiller: "kitovi",
  cleaner: "ciscenje",
  "polishing-compound": "poliranje",
};

/* -------------------------------------------------------------------------- */
/* Rule 2 — Cosmos Lac technical category                                     */
/* -------------------------------------------------------------------------- */

/**
 * Non-colour technical categories keep their functional home even in aerosol
 * form. A Cosmos record not listed here and sold as colour falls through to
 * Sprejevi.
 */
export const COSMOS_TECHNICAL_CATEGORY_MAP = {
  // undercoats and top coats — a coating, regardless of the can it ships in
  primer: "boje",
  "plastic-primer": "boje",
  "filler-primer": "boje",
  sealer: "boje",
  zinc: "boje",
  clearcoat: "boje",
  varnish: "boje",
  // protection
  antichip: "zastita",
  "wood-care": "zastita",
  // workshop chemistry
  lubricant: "radionica",
  "automotive-maintenance": "radionica",
  // discrete functions
  cleaner: "ciscenje",
  adhesive: "lepkovi",
  putty: "kitovi",
};

/* -------------------------------------------------------------------------- */
/* Rule 3 — remaining hand-written records                                    */
/* -------------------------------------------------------------------------- */

/** Badge vocabulary is a small, curated, closed set in the hand-written records. */
export const BADGE_MAP = {
  Git: "kitovi",
  "Body filler": "kitovi",
  Maskiranje: "maskiranje",
  "Zaštita": "zastita",
};

export const PROGRAM_MAP = {
  abrazivi: "abrazivi",
  poliranje: "poliranje",
  oprema: "oprema",
  "boje-i-lakovi": "boje",
};

/* -------------------------------------------------------------------------- */

/*
 * TODO(CATALOG-TAXONOMY): Kada bude završen unos kompletnog asortimana, razvrstati sve proizvode kroz categorySlugs[] i uraditi završni QA filtera.
 */

/**
 * The category a product belongs to, or `undefined` when no rule applies.
 *
 * `undefined` is a real answer — it keeps an unclassifiable product out of every
 * category rather than parking it in a default bucket that would then lie about
 * what the category contains.
 *
 * @param {{taxonomyCategory?: string, badges?: string[], catalogMetadata?: {technicalCategory?: string}|null, phaseSlug?: string, programSlug?: string, rmMetadata?: {category?: string}|null}} product
 * @returns {ProductCategorySlug|undefined}
 */
export function getProductCategorySlug(product) {
  // An unknown value is ignored rather than trusted: the import must not be able
  // to invent a 13th category by writing a new string into its dataset.
  if (product.taxonomyCategory && categoryBySlug.has(product.taxonomyCategory)) {
    return product.taxonomyCategory;
  }

  const rmCategory = product.rmMetadata?.category;
  if (rmCategory) return RM_CATEGORY_MAP[rmCategory];

  const technicalCategory = product.catalogMetadata?.technicalCategory;
  if (technicalCategory) {
    const mapped = COSMOS_TECHNICAL_CATEGORY_MAP[technicalCategory];
    if (mapped) return mapped;
    // Everything left in the Cosmos set is a colour product; the aerosol can is
    // the product identity, so it belongs to the Sprejevi programme.
    return product.phaseSlug === "boja" ? "sprejevi" : undefined;
  }

  for (const badge of product.badges ?? []) {
    const mapped = BADGE_MAP[badge];
    if (mapped) return mapped;
  }

  return PROGRAM_MAP[product.programSlug ?? ""];
}
