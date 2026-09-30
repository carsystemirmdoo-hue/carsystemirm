import type { MetadataRoute } from "next";
import {
  getAllCarsystemBrands,
  getAllCarsystemProducts,
  getAllPublicProgramGroups,
} from "@/lib/carsystem-data";
import {
  getAllProductFamilies,
  getConsolidatedVariantSlugs,
} from "@/lib/product-families";
import { absoluteUrl } from "@/lib/seo";
import { seoCategoryLandings } from "@/lib/seo/category-landings";
import { publishedGuides } from "@/lib/knowledge/guides";
import { guides } from "@/data/knowledge/guides";
import { CATALOG_BATCH_SIZE } from "@/components/catalog/catalogInfiniteScroll.mjs";
import { getCatalogListingData } from "@/lib/catalog-listing";

const staticRoutes = [
  "/",
  "/katalog",
  "/katalozi",
  "/brendovi",
  "/program",
  "/prodavnice",
  "/kontakt",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const brandRoutes = getAllCarsystemBrands().map((brand) => `/brendovi/${brand.slug}`);
  const programRoutes = getAllPublicProgramGroups().map((program) => `/program/${program.slug}`);
  const products = getAllCarsystemProducts();

  // Variants consolidated onto a family page canonicalise elsewhere, so they
  // must not appear here — a sitemap entry whose canonical points at a
  // different URL is a contradictory signal.
  const consolidated = getConsolidatedVariantSlugs();
  const productRoutes = products
    .filter((product) => !consolidated.has(product.slug))
    .map((product) => `/proizvodi/${product.slug}`);
  const familyRoutes = getAllProductFamilies().map(
    (family) => `/proizvodi/grupa/${family.slug}`,
  );

  const categoryRoutes = seoCategoryLandings.map(
    (category) => `/kategorije/${category.slug}`,
  );

  // Guides enter the sitemap only once they pass the publication gate. A draft
  // or unverified guide produces no route, so it must produce no entry.
  const guideRoutes = publishedGuides(guides).map((guide) => `/vodici/${guide.slug}`);

  /*
   * Paginacija hoda kanonskim entitetima, isto kao ruta koja je renderuje —
   * porodice i samostalni proizvodi. Brojanje po sirovoj listi proizvoda davalo
   * bi više strana nego što ih ruta generiše, pa bi sitemap nudio adrese koje
   * vraćaju 404.
   *
   * Konsolidovane varijante ostaju dostupne: `collection` porodice ih linkuju sa
   * svoje stranice, a `variant-pdp` varijante i inače preusmeravaju na porodicu.
   */
  const totalCatalogPages = Math.ceil(
    getCatalogListingData().canonical.length / CATALOG_BATCH_SIZE,
  );
  const paginationRoutes = Array.from(
    { length: Math.max(0, totalCatalogPages - 1) },
    (_, index) => `/katalog/strana/${index + 2}`,
  );

  return [
    ...staticRoutes,
    ...categoryRoutes,
    ...brandRoutes,
    ...programRoutes,
    ...guideRoutes,
    ...paginationRoutes,
    ...familyRoutes,
    ...productRoutes,
  ].map((route) => ({
    url: absoluteUrl(route),
  }));
}
