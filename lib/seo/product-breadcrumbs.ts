import {
  publicProgramGroups,
  type CarsystemBrand,
  type CarsystemProduct,
  type ProgramGroup,
} from "@/lib/carsystem-data";
import { familyPath, getFamilyForProduct } from "@/lib/product-families";
import { getSeoCategoryForProduct } from "@/lib/seo/category-landings";

export function getProductBreadcrumbItems({
  brand,
  product,
  program,
}: {
  brand: CarsystemBrand;
  product: CarsystemProduct;
  program: ProgramGroup;
}) {
  const category = getSeoCategoryForProduct(product);
  const publicProgram = publicProgramGroups.find((item) =>
    item.internalProgramSlugs.includes(program.slug),
  );

  // A consolidated variant sits under its family. Including the family here is
  // what makes the family page reachable by a crawler: it is the canonical
  // entity, so it must not depend on the sitemap alone for discovery.
  const family = getFamilyForProduct(product);

  return [
    { name: "Početna", path: "/" },
    { name: "Katalog", path: "/katalog" },
    { name: brand.name, path: brand.routes.landing },
    category
      ? { name: category.name, path: `/kategorije/${category.slug}` }
      : {
          name: publicProgram?.name ?? program.name,
          path: `/program/${publicProgram?.slug ?? program.slug}`,
        },
    ...(family ? [{ name: family.name, path: familyPath(family) }] : []),
    { name: product.name, path: `/proizvodi/${product.slug}` },
  ];
}
