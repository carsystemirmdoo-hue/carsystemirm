import type { MetadataRoute } from "next";
import {
  getAllCarsystemBrands,
  getAllCarsystemProducts,
  getAllPublicProgramGroups,
} from "@/lib/carsystem-data";
import { absoluteUrl } from "@/lib/seo";
import { seoCategoryLandings } from "@/lib/seo/category-landings";
import { CATALOG_BATCH_SIZE } from "@/components/catalog/catalogInfiniteScroll.mjs";

const staticRoutes = [
  "/",
  "/katalog",
  "/brendovi",
  "/program",
  "/prodavnice",
  "/kontakt",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const brandRoutes = getAllCarsystemBrands().map((brand) => `/brendovi/${brand.slug}`);
  const programRoutes = getAllPublicProgramGroups().map((program) => `/program/${program.slug}`);
  const products = getAllCarsystemProducts();
  const productRoutes = products.map((product) => `/proizvodi/${product.slug}`);
  const categoryRoutes = seoCategoryLandings.map(
    (category) => `/kategorije/${category.slug}`,
  );
  const totalCatalogPages = Math.ceil(products.length / CATALOG_BATCH_SIZE);
  const paginationRoutes = Array.from(
    { length: Math.max(0, totalCatalogPages - 1) },
    (_, index) => `/katalog/strana/${index + 2}`,
  );

  return [
    ...staticRoutes,
    ...categoryRoutes,
    ...brandRoutes,
    ...programRoutes,
    ...paginationRoutes,
    ...productRoutes,
  ].map((route) => ({
    url: absoluteUrl(route),
  }));
}
