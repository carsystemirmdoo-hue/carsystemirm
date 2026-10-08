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
import { getPublicSaveti, MIN_CLANAKA_ZA_INDEKS_KATEGORIJE } from "@/lib/saveti";
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

/*
 * Sitemap se obnavlja najkasnije na sat vremena, kao i strane rubrike
 * „Saveti i vodiči“: članak ulazi u sitemap tek kada ga kapija objave smatra
 * javnim, a zakazani posao (`/api/saveti/objava`) ga osvežava u terminu.
 */
export const revalidate = 3600;

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

  // Saveti i vodiči: samo javni članci (kapija objave u ovom trenutku), sa
  // stvarnim datumom poslednje izmene. Indeks rubrike, novosti i kategorije
  // ulaze tek kada imaju sadržaj — prazan spisak nije strana za indeks.
  const saveti = getPublicSaveti();
  const savetiEntries: MetadataRoute.Sitemap = saveti.map((clanak) => ({
    url: absoluteUrl(`/vodici/${clanak.slug}`),
    lastModified: clanak.datumIzmene,
  }));
  const savetiGuides = saveti.filter((clanak) => clanak.tip !== "novost");
  const savetiCategoryCounts = new Map<string, number>();
  for (const clanak of savetiGuides) {
    savetiCategoryCounts.set(clanak.kategorija, (savetiCategoryCounts.get(clanak.kategorija) ?? 0) + 1);
  }
  const savetiListRoutes = [
    ...(saveti.length ? ["/vodici"] : []),
    ...(saveti.some((clanak) => clanak.tip === "novost") ? ["/vodici/novosti"] : []),
    ...[...savetiCategoryCounts]
      .filter(([, count]) => count >= MIN_CLANAKA_ZA_INDEKS_KATEGORIJE)
      .map(([slug]) => `/vodici/kategorije/${slug}`),
  ];

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
    ...[
      ...staticRoutes,
      ...categoryRoutes,
      ...brandRoutes,
      ...programRoutes,
      ...savetiListRoutes,
      ...paginationRoutes,
      ...familyRoutes,
      ...productRoutes,
    ].map((route) => ({
      url: absoluteUrl(route),
    })),
    ...savetiEntries,
  ];
}
