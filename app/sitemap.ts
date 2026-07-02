import type { MetadataRoute } from "next";
import {
  getAllCarsystemBrands,
  getAllCarsystemProducts,
  getAllPublicProgramGroups,
} from "@/lib/carsystem-data";
import { absoluteUrl } from "@/lib/seo";

const staticRoutes = [
  "/",
  "/katalog",
  "/brendovi",
  "/program",
  "/prodavnice",
  "/kontakt",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const brandRoutes = getAllCarsystemBrands().map((brand) => `/brendovi/${brand.slug}`);
  const programRoutes = getAllPublicProgramGroups().map((program) => `/program/${program.slug}`);
  const productRoutes = getAllCarsystemProducts().map((product) => `/proizvodi/${product.slug}`);

  return [...staticRoutes, ...brandRoutes, ...programRoutes, ...productRoutes].map((route) => ({
    url: absoluteUrl(route),
    lastModified: now,
  }));
}
