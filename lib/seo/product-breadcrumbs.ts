import {
  getCarsystemBrandBySlug,
  publicProgramGroups,
  type CarsystemBrand,
  type CarsystemProduct,
  type ProgramGroup,
} from "@/lib/carsystem-data";
import { familyPath, getFamilyForProduct } from "@/lib/product-families";
import { getSeoCategoryForProduct } from "@/lib/seo/category-landings";
import { getProductCategorySlug, productCategories } from "@/lib/product-taxonomy";

/**
 * Jedan izvor za „gde proizvod pripada”: treći nivo putanje. Isti naziv nose i nadnaslov i
 * oznaka na stranici proizvoda, da putanja, nadnaslov i oznaka ne bi navodili tri različite
 * grupe (npr. „Potrošni materijal”, „Boje i lakovi” i „Aerosol program” za isti sprej).
 */
export function getProductPlacement({
  brand,
  product,
  program,
}: {
  brand: CarsystemBrand;
  product: CarsystemProduct;
  program: ProgramGroup;
}): { name: string; path: string } {
  if (brand.offeredWithin) {
    const categorySlug = getProductCategorySlug(product);
    const productCategory = productCategories.find((item) => item.slug === categorySlug);
    if (productCategory) {
      return {
        name: productCategory.label,
        path: `/katalog?brend=${brand.slug}&kategorija=${productCategory.slug}`,
      };
    }
  }
  const category = getSeoCategoryForProduct(product);
  if (category) return { name: category.name, path: `/kategorije/${category.slug}` };
  const publicProgram = publicProgramGroups.find((item) =>
    item.internalProgramSlugs.includes(program.slug),
  );
  return {
    name: publicProgram?.name ?? program.name,
    path: `/program/${publicProgram?.slug ?? program.slug}`,
  };
}

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

  /*
   * Brend ponuđen u okviru drugog (RUPES u Carsystem programu): putanja ide kroz matični
   * brend i sekciju proizvođača, a treći nivo je STVARNA kategorija artikla (oprema, pribor,
   * poliranje, radionica) — ne programska grupa, koja bi svim mašinama dala isto ime.
   */
  const parentBrand = brand.offeredWithin ? getCarsystemBrandBySlug(brand.offeredWithin) : undefined;
  if (parentBrand) {
    const categorySlug = getProductCategorySlug(product);
    const productCategory = productCategories.find((item) => item.slug === categorySlug);
    return [
      { name: "Početna", path: "/" },
      { name: "Katalog", path: "/katalog" },
      { name: parentBrand.name, path: parentBrand.routes.landing },
      { name: brand.name, path: `${parentBrand.routes.landing}#${brand.slug}` },
      ...(productCategory
        ? [{ name: productCategory.label, path: `/katalog?brend=${brand.slug}&kategorija=${productCategory.slug}` }]
        : []),
      ...(family ? [{ name: family.name, path: familyPath(family) }] : []),
      { name: product.name, path: `/proizvodi/${product.slug}` },
    ];
  }

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
