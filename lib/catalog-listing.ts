/**
 * Catalog listing model — what the browser actually needs to browse the catalog.
 *
 * Two problems this solves, both measured on `/katalog`:
 *
 * P1-02 — the catalog listed 832 variant records and every card linked to a
 * variant PDP, so the 41 canonical family routes that the sitemap and the
 * canonical tags already treat as the real entities were unreachable from the
 * main discovery flow. Catalog UI and SEO were describing different entities.
 *
 * P1-03 — the full `CarsystemProduct` was serialised 832 times into the
 * explorer's props and again for each of the first 48 cards, carrying PDP-only
 * prose, documents, specifications and Cosmos acquisition metadata the catalog
 * never reads.
 *
 * The model here is deliberately three-kinded, matching the existing
 * `catalogStrategy` contract rather than inventing a parallel family system:
 *
 *   "family"  — a canonical `ProductFamily` (>= 2 variants), href = familyPath
 *   "product" — a standalone product, href = its own PDP
 *   "variant" — one variant of a family, surfaced only by a text search that
 *               asks for it; href = the variant's own PDP, which stays valid
 *               and canonicalises to the family
 *
 * Browse (no `q`) shows family + product entities. A text query additionally
 * searches variants, so a specific SKU, colour or pack size is still findable
 * and lands on the page that actually shows it.
 */

import {
  getAllCarsystemProducts,
  type CarsystemProduct,
  type ProductPublicStatus,
  type ProductStockStatus,
  type RefinishPhaseSlug,
  type RmProductMetadata,
} from "@/lib/carsystem-data";
import {
  familyPath,
  getFamilyForProduct,
  type ProductFamily,
} from "@/lib/product-families";
import { getProductCategorySlug } from "@/lib/product-taxonomy";
import {
  toProductVisualPresentation,
  type ProductVisualPresentation,
} from "@/components/product/productVisualPresentation";

export type CatalogListingKind = "family" | "product" | "variant";

/**
 * A variant carries only what differs from its family.
 *
 * Brand, programme, phase, categories, line and badges are properties of the
 * group, not of one colour or pack size, and shipping 715 copies of them was
 * most of what the catalog payload actually weighed. `expandVariant()` merges a
 * variant onto its family entity on the client, which is cheap and keeps the
 * rendered card identical.
 */
export type CatalogVariantEntity = {
  id: string;
  name: string;
  familySlug: string;
  productCode: string;
  technicalLine: string;
  finish?: string;
  search: string;
  /** Visual bits that genuinely differ per variant. */
  accent: string;
  imageSrc: string | null;
  imageAlt: string;
  sizeClass: ProductVisualPresentation["sizeClass"];
  quantityLabel: string | null;
  volumeStatus: ProductVisualPresentation["volumeStatus"];
};

/**
 * `categorySlugs` is an array even though the current classifier assigns
 * exactly one category per product. The business mapping is provisional (see
 * docs/CATALOG_TAXONOMY.md) and "Boje"/"Sprejevi"/"Zaštita" are probably not
 * mutually exclusive axes; an array absorbs that decision later without another
 * architectural change.
 */
export type CatalogListingEntity = {
  kind: CatalogListingKind;
  /** Stable React key and dedup identity. */
  id: string;
  href: string;
  name: string;
  brandSlug: string;
  programSlug: string;
  phaseSlug: RefinishPhaseSlug;
  categorySlugs: string[];
  /** Everything the shared visual surface renders, pre-resolved. */
  presentation: ProductVisualPresentation;
  /** Code shown as the card's first line in the catalog's B-system layout. */
  productCode: string;
  /**
   * Same code, but omitted when it is a long internal SKU. The non-catalog card
   * layouts (PDP related row, Cosmos brand page) fold it into the technical
   * line instead of showing it on its own, and dropping the length guard would
   * change those locked surfaces.
   */
  shortCode?: string;
  /** Secondary technical line (pack size / finish), already composed. */
  technicalLine: string;
  badges: string[];
  publicStatus?: ProductPublicStatus;
  stockStatus?: ProductStockStatus;
  /** 1 for standalone products and variants; >= 2 for families. */
  variantCount: number;
  /** Set on families and on variants, so a variant can be traced to its group. */
  familySlug?: string;
  /** Filter facets the catalog sidebar offers. */
  line?: string;
  technicalCategory?: string;
  finish?: string;
  rmMetadata?: RmProductMetadata;
  /** Pre-normalised haystack; replaces shipping five prose fields per record. */
  search: string;
};

/* -------------------------------------------------------------------------- */
/* Search text                                                                */
/* -------------------------------------------------------------------------- */

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function searchTokens(parts: (string | null | undefined)[]) {
  const seen = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const token of normalize(part).split(/\s+/)) {
      if (token) seen.add(token);
    }
  }
  return [...seen].join(" ");
}

/* -------------------------------------------------------------------------- */
/* Card copy — kept identical to what CatalogProductCard used to compute       */
/* -------------------------------------------------------------------------- */

function productCodeOf(product: CarsystemProduct) {
  const metadata = product.catalogMetadata;
  return (
    metadata?.cosmosCode ??
    (metadata?.ralCode ? `RAL ${metadata.ralCode}` : null) ??
    product.sku
  );
}

function shortCodeOf(product: CarsystemProduct) {
  const metadata = product.catalogMetadata;
  return (
    metadata?.cosmosCode ??
    (metadata?.ralCode ? `RAL ${metadata.ralCode}` : null) ??
    (product.sku.length <= 24 ? product.sku : null) ??
    undefined
  );
}

function technicalLineOf(product: CarsystemProduct) {
  const metadata = product.catalogMetadata;
  const packageSummary =
    metadata?.volume ??
    product.packages
      .map((item) => item.label)
      .filter((label) => !label.toLocaleLowerCase("sr-Latn").includes("upit"))
      .slice(0, 2)
      .join(" / ");

  return [packageSummary, metadata?.finish]
    .filter((value): value is string => Boolean(value))
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 3)
    .join(" · ");
}

/* -------------------------------------------------------------------------- */
/* Entity builders                                                            */
/* -------------------------------------------------------------------------- */

function productEntity(
  product: CarsystemProduct,
  kind: "product" | "variant",
  family?: ProductFamily,
): CatalogListingEntity {
  const category = getProductCategorySlug(product);
  const metadata = product.catalogMetadata;

  return {
    kind,
    id: product.slug,
    href: `/proizvodi/${product.slug}`,
    name: product.name,
    brandSlug: product.brandSlug,
    programSlug: product.programSlug,
    phaseSlug: product.phaseSlug,
    categorySlugs: category ? [category] : [],
    presentation: toProductVisualPresentation(product),
    productCode: productCodeOf(product),
    shortCode: shortCodeOf(product),
    technicalLine: technicalLineOf(product),
    badges: product.badges,
    publicStatus: product.publicStatus,
    stockStatus: product.stockStatus,
    variantCount: 1,
    familySlug: family?.slug,
    line: metadata?.line,
    technicalCategory: metadata?.technicalCategory,
    finish: metadata?.finish ?? undefined,
    rmMetadata: product.rmMetadata,
    search: searchTokens([
      product.name,
      product.shortDescription,
      product.sku,
      product.badges.join(" "),
      metadata?.officialName,
      metadata?.displayNameSr,
      metadata?.cosmosCode,
      metadata?.ralCode,
      metadata?.colorName,
      metadata?.line,
      metadata?.technicalCategory,
      metadata?.finish,
      metadata?.volume,
    ]),
  };
}

/**
 * The representative variant, chosen deterministically.
 *
 * `family.representative` is the first record in catalogue order, which is the
 * order the generated dataset is written in — stable across builds. Picking by
 * anything mutable (e.g. "first with an image") would make the card's visual
 * flip between builds.
 */
function variantEntity(
  product: CarsystemProduct,
  family: ProductFamily,
): CatalogVariantEntity {
  const full = productEntity(product, "variant", family);
  const style = full.presentation.style as Record<string, string>;

  return {
    id: full.id,
    name: full.name,
    familySlug: family.slug,
    productCode: full.productCode,
    technicalLine: full.technicalLine,
    finish: full.finish,
    search: full.search,
    accent: style["--product-visual-background-color"] ?? style["--product-visual-accent"] ?? "",
    imageSrc: full.presentation.image?.src ?? null,
    imageAlt: full.presentation.image?.alt ?? full.name,
    sizeClass: full.presentation.sizeClass,
    quantityLabel: full.presentation.quantityLabel,
    volumeStatus: full.presentation.volumeStatus,
  };
}

function familyEntity(family: ProductFamily): CatalogListingEntity {
  const representative = family.representative;
  const categories = new Set<string>();
  const finishes = new Set<string>();

  for (const variant of family.variants) {
    const category = getProductCategorySlug(variant);
    if (category) categories.add(category);
    if (variant.catalogMetadata?.finish) finishes.add(variant.catalogMetadata.finish);
  }

  return {
    kind: "family",
    id: `family:${family.slug}`,
    href: familyPath(family),
    name: family.name,
    brandSlug: family.brandSlug,
    programSlug: family.programSlug,
    phaseSlug: family.phaseSlug as RefinishPhaseSlug,
    categorySlugs: [...categories],
    presentation: toProductVisualPresentation(representative),
    productCode: family.line ?? representative.catalogMetadata?.line ?? family.brandName,
    technicalLine: `${family.variants.length} varijanti`,
    badges: representative.badges,
    publicStatus: representative.publicStatus,
    stockStatus: representative.stockStatus,
    variantCount: family.variants.length,
    familySlug: family.slug,
    line: family.line,
    technicalCategory: representative.catalogMetadata?.technicalCategory,
    finish: finishes.size === 1 ? [...finishes][0] : undefined,
    rmMetadata: representative.rmMetadata,
    // A family is findable by its own name and by its line; variant-level terms
    // are matched against the variant entities instead, so that a query for one
    // colour surfaces that colour rather than the whole group.
    search: searchTokens([
      family.name,
      family.line,
      family.brandName,
      representative.badges.join(" "),
    ]),
  };
}

/* -------------------------------------------------------------------------- */
/* Public builders                                                            */
/* -------------------------------------------------------------------------- */

export type CatalogListingData = {
  /** Family + standalone entities: what browse shows. */
  canonical: CatalogListingEntity[];
  /** Variants of multi-variant families: only ever shown for a text query. */
  variants: CatalogVariantEntity[];
};

/** Rebuilds a full listing entity from a variant plus its family. */
export function expandVariant(
  variant: CatalogVariantEntity,
  family: CatalogListingEntity,
): CatalogListingEntity {
  return {
    ...family,
    kind: "variant",
    id: variant.id,
    // Varijanta vodi na canonical family PDP sa preselektovanom varijantom, a
    // ne na zasebnu variant stranicu — korisnik nikada ne dolazi na generički
    // group listing. `family.href` je već `familyPath`.
    href: variant.productCode
      ? `${family.href}?varijanta=${encodeURIComponent(variant.productCode)}`
      : `/proizvodi/${variant.id}`,
    name: variant.name,
    productCode: variant.productCode,
    shortCode: variant.productCode,
    technicalLine: variant.technicalLine,
    finish: variant.finish,
    variantCount: 1,
    search: variant.search,
    presentation: {
      ...family.presentation,
      slug: variant.id,
      name: variant.name,
      sizeClass: variant.sizeClass,
      quantityLabel: variant.quantityLabel,
      volumeStatus: variant.volumeStatus,
      style: {
        "--product-visual-accent": variant.accent,
        "--product-visual-complement": variant.accent,
        "--product-visual-background-color": variant.accent,
        "--product-active-color": variant.accent,
      } as CatalogListingEntity["presentation"]["style"],
      image: variant.imageSrc
        ? { src: variant.imageSrc, alt: variant.imageAlt }
        : null,
    },
  };
}

let cached: CatalogListingData | undefined;

export function getCatalogListingData(): CatalogListingData {
  if (cached) return cached;

  const canonical: CatalogListingEntity[] = [];
  const variants: CatalogVariantEntity[] = [];
  const seenFamilies = new Set<string>();

  /*
   * One pass in catalogue order. A family takes the slot of its FIRST variant,
   * so the curated ("Preporučeno") sequence stays recognisable instead of all
   * 41 groups being pushed to the end — and a family can be emitted only once,
   * which is what keeps duplicate family cards structurally impossible.
   */
  for (const product of getAllCarsystemProducts()) {
    const family = getFamilyForProduct(product);

    if (!family) {
      canonical.push(productEntity(product, "product"));
      continue;
    }

    variants.push(variantEntity(product, family));
    if (seenFamilies.has(family.slug)) continue;
    seenFamilies.add(family.slug);
    canonical.push(familyEntity(family));
  }

  cached = { canonical, variants };
  return cached;
}

/**
 * Adapter for routes that legitimately list products rather than canonical
 * entities — a family page shows its variants, a brand page shows products.
 */
export function toCatalogListingEntity(product: CarsystemProduct): CatalogListingEntity {
  return productEntity(product, "product");
}
