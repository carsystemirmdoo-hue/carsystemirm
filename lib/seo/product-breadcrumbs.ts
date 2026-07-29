import {
  publicProgramGroups,
  type CarsystemBrand,
  type CarsystemProduct,
  type ProgramGroup,
} from "@/lib/carsystem-data";
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
    { name: product.name, path: `/proizvodi/${product.slug}` },
  ];
}
