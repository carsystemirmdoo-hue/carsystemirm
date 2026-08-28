/**
 * Product family (ProductGroup) layer.
 *
 * The audit found 742 Cosmos LAC colour variants each holding its own indexable
 * URL, with sibling pages up to 0.90 similar and only 29 distinct `useCase`
 * strings across all of them. Those pages are not 742 products; they are 41
 * products offered in many colours, plus 27 genuinely standalone items.
 *
 * This module derives the missing middle entity — the family — from data that
 * already exists (`catalogMetadata.baseProductSlug`). Nothing is invented and no
 * product record is edited.
 *
 * Indexation strategy (see docs/seo/SEO_PRODUCT_GROUP_STRATEGY.md):
 *
 *   family (>= 2 variants)  -> indexable, self-canonical, in sitemap, ProductGroup
 *   variant of such family  -> canonical to the family, NOT in sitemap,
 *                              meta robots left as index,follow
 *   single-variant product  -> unchanged; it is already its own best entity
 *
 * Variants keep `index, follow` deliberately. Combining `noindex` with a
 * cross-URL canonical sends Google two contradictory instructions and risks the
 * noindex being applied to the canonical target. Canonical consolidation alone
 * is the documented pattern for near-duplicate variants, and it keeps the pages
 * fully usable and link-equity-passing.
 */

import { canonicalVariantKey } from "@/lib/catalog/variant-key";
import {
  getAllCarsystemProducts,
  getCarsystemBrandBySlug,
  type CarsystemProduct,
} from "@/lib/carsystem-data";
import { cosmosColorCategories } from "@/lib/cosmos-lac-data";

export type ProductFamily = {
  /** URL slug, unique across all families. */
  slug: string;
  /** Source grouping key from `catalogMetadata.baseProductSlug`. */
  baseProductSlug: string;
  /** Display name, derived from the variants' shared official-name prefix. */
  name: string;
  brandSlug: string;
  brandName: string;
  line?: string;
  programSlug: string;
  phaseSlug: string;
  /** Variants, in catalogue order. */
  variants: CarsystemProduct[];
  /** The variant used for imagery and as the representative product. */
  representative: CarsystemProduct;
  /** What distinguishes the variants, for `ProductGroup.variesBy`. */
  variesBy: ("color" | "size" | "volume" | "finish")[];
  /**
   * How the family route presents itself.
   *
   * `variant-pdp` — the variants are one product in many colours or pack
   *   sizes, so the family URL *is* the product page. It renders the real
   *   product-detail experience with a variant selector; the generic group
   *   hero and card grid are never mounted.
   * `collection` — the members are genuinely different products, so the group
   *   listing is the right presentation.
   */
  presentation: "variant-pdp" | "collection";
};

/**
 * A family is a variant PDP when its members differ only by colour, pack size
 * or finish. That is the definition of a variant, so this is derived rather
 * than listed per slug — no family gets a special case.
 */
function resolvePresentation(
  variesBy: ProductFamily["variesBy"],
): ProductFamily["presentation"] {
  const variantAxes = new Set(["color", "size", "volume", "finish"]);
  const differsOnlyByVariantAxis =
    variesBy.length > 0 && variesBy.every((axis) => variantAxes.has(axis));
  return differsOnlyByVariantAxis ? "variant-pdp" : "collection";
}

const FAMILY_MIN_VARIANTS = 2;

/**
 * Tokens that make a poor trailing word in a derived family name.
 *
 * Deliberately punctuation and conjunctions only. Product-line words such as
 * "RAL" must be kept: "Cosmos Lac RAL" is a real line name, and stripping it
 * collapsed that family to the bare brand name.
 */
const TRAILING_NOISE = new Set(["-", "—", "&", "i", "u", "za"]);

/** A derived name must carry more than just the brand words to be usable. */
const MIN_NAME_TOKENS = 3;

function tokenise(value: string) {
  return value.split(/\s+/).filter(Boolean);
}

/**
 * Longest shared leading token run across the variants' official names.
 *
 * "Cosmos Lac Automotive Antichip 250 White" + "... 251 Black"
 *   -> "Cosmos Lac Automotive Antichip"
 */
function commonNamePrefix(names: string[]) {
  if (!names.length) return "";
  const tokenLists = names.map(tokenise);
  const [first, ...rest] = tokenLists;
  const prefix: string[] = [];

  for (let index = 0; index < first.length; index += 1) {
    const token = first[index];
    if (!rest.every((tokens) => tokens[index] === token)) break;
    prefix.push(token);
  }

  // Drop trailing artefacts of the source product code that leaked into the
  // shared prefix: a bare "CL" line marker, or a bare item number such as the
  // "01" in "Master Mechanic Primer 01". A token like "700°C" is not bare and
  // survives, because there it is part of the line name.
  const isCodeFragment = (token: string) =>
    /^\d+$/.test(token) || token.toLocaleLowerCase("sr-Latn") === "cl";

  while (
    prefix.length > MIN_NAME_TOKENS &&
    (TRAILING_NOISE.has(prefix[prefix.length - 1].toLocaleLowerCase("sr-Latn")) ||
      isCodeFragment(prefix[prefix.length - 1]))
  ) {
    prefix.pop();
  }

  // A prefix that never diverged (or collapsed to the brand words alone) is not
  // a usable family name; let the caller fall back to the product line.
  return prefix.length >= MIN_NAME_TOKENS ? prefix.join(" ") : "";
}

type VariationAxis = "color" | "size" | "volume" | "finish";

function slugify(value: string) {
  return value
    .toLocaleLowerCase("sr-Latn")
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * What actually distinguishes the variants.
 *
 * Returns an empty list when no axis can be defended. `variesBy` is then
 * omitted from the ProductGroup rather than guessed — a wrong axis is a false
 * machine-readable claim about the product, and "colour" was previously being
 * inferred for lubricants and cleaners purely from a SKU code.
 */
function detectVariesBy(variants: CarsystemProduct[]): VariationAxis[] {
  const axes = new Set<VariationAxis>();
  const distinct = (pick: (product: CarsystemProduct) => string | null | undefined) =>
    new Set(variants.map(pick).filter(Boolean)).size > 1;

  const isColourFamily = variants.some((product) =>
    cosmosColorCategories.has(product.catalogMetadata?.technicalCategory ?? ""),
  );

  if (
    isColourFamily &&
    (distinct((product) => product.catalogMetadata?.colorName) ||
      distinct((product) => product.catalogMetadata?.ralCode))
  ) {
    axes.add("color");
  }
  if (distinct((product) => product.catalogMetadata?.finish)) axes.add("finish");
  if (distinct((product) => product.catalogMetadata?.volume)) axes.add("volume");
  if (distinct((product) => product.variantOptions?.size)) axes.add("size");

  return [...axes];
}

function buildFamilies(): ProductFamily[] {
  const groups = new Map<string, CarsystemProduct[]>();

  for (const product of getAllCarsystemProducts()) {
    const baseSlug = product.catalogMetadata?.baseProductSlug;
    if (!baseSlug) continue;
    const bucket = groups.get(baseSlug);
    if (bucket) bucket.push(product);
    else groups.set(baseSlug, [product]);
  }

  const usedSlugs = new Set<string>();
  const families: ProductFamily[] = [];

  for (const [baseProductSlug, variants] of groups) {
    if (variants.length < FAMILY_MIN_VARIANTS) continue;

    const representative = variants[0];
    const brandName =
      getCarsystemBrandBySlug(representative.brandSlug)?.name ??
      representative.brandSlug;
    const line = representative.catalogMetadata?.line;

    // Prefer the variants' shared official-name prefix; fall back to
    // "<brand> <line>" so a family is never named by the brand alone.
    const name =
      commonNamePrefix(
        variants.map(
          (product) => product.catalogMetadata?.officialName ?? product.name,
        ),
      ) ||
      (line ? `${brandName} ${line}` : representative.name);

    // Prefer a slug derived from the readable name; fall back to the stable
    // source key if that would collide or degenerate.
    const preferred = slugify(name);
    const slug =
      preferred && !usedSlugs.has(preferred) ? preferred : baseProductSlug;
    usedSlugs.add(slug);

    const variesBy = detectVariesBy(variants);
    families.push({
      slug,
      baseProductSlug,
      name,
      brandSlug: representative.brandSlug,
      brandName,
      line,
      programSlug: representative.programSlug,
      phaseSlug: representative.phaseSlug,
      variants,
      representative,
      variesBy,
      presentation: resolvePresentation(variesBy),
    });
  }

  return families.sort((a, b) => a.slug.localeCompare(b.slug, "sr-Latn"));
}

let cachedFamilies: ProductFamily[] | undefined;

export function getAllProductFamilies() {
  cachedFamilies ??= buildFamilies();
  return cachedFamilies;
}

export function getProductFamilyBySlug(slug: string) {
  return getAllProductFamilies().find((family) => family.slug === slug);
}

const familyByVariantSlug = new Map<string, ProductFamily>();

function variantIndex() {
  if (familyByVariantSlug.size) return familyByVariantSlug;
  for (const family of getAllProductFamilies()) {
    for (const variant of family.variants) {
      familyByVariantSlug.set(variant.slug, family);
    }
  }
  return familyByVariantSlug;
}

/**
 * The family a product belongs to, or `undefined` for standalone products.
 *
 * This is the single predicate that decides a product page's canonical target
 * and its sitemap eligibility, so both stay consistent by construction.
 */
export function getFamilyForProduct(product: CarsystemProduct) {
  return variantIndex().get(product.slug);
}

export function isFamilyVariant(product: CarsystemProduct) {
  return variantIndex().has(product.slug);
}

export function familyPath(family: ProductFamily) {
  return `/proizvodi/grupa/${family.slug}`;
}

/** Product slugs consolidated into a family, hence excluded from the sitemap. */
export function getConsolidatedVariantSlugs() {
  return new Set(variantIndex().keys());
}


/**
 * Stari variant URL vodi na canonical family rutu sa preselektovanom
 * varijantom — za svaku `variant-pdp` porodicu, ne samo za jedan brend.
 */
export function variantRedirectTarget(product: CarsystemProduct): string | null {
  const family = getFamilyForProduct(product);
  if (!family || family.presentation !== "variant-pdp") return null;

  /*
   * Ista formula koju PDP upisuje pri izboru na strani.
   *
   * Ranije je ovde stajala prepisana, sa `variantId` pre `sku` — pa je 56
   * varijanti bez `cosmosCode` imalo jednu adresu iz preusmerenja i drugu iz
   * izbora. `canonicalVariantKey` uvek vraća vrednost (slug je poslednja
   * odbrana), pa provere na `null` više nema: varijanta `variant-pdp`
   * porodice uvek ima adresu.
   */
  const code = canonicalVariantKey(product);

  return `${familyPath(family)}?varijanta=${encodeURIComponent(code)}`;
}
