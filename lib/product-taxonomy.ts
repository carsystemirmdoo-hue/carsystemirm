/**
 * Typed access to the platform taxonomy.
 *
 * The rules themselves live in `lib/productTaxonomy.mjs` so the catalog, the
 * tests and the data validator all execute the same implementation. This file
 * only adds the types; it must not add a second mapping table.
 */

import {
  getProductCategory as getProductCategoryImpl,
  getProductCategorySlug as getProductCategorySlugImpl,
  isProductCategorySlug as isProductCategorySlugImpl,
  productCategories as productCategoriesImpl,
  productCategorySlugs as productCategorySlugsImpl,
} from "@/lib/productTaxonomy.mjs";
import type { CarsystemProduct } from "@/lib/carsystem-data";

export type ProductCategorySlug =
  | "boje"
  | "abrazivi"
  | "kitovi"
  | "maskiranje"
  | "sprejevi"
  | "oprema"
  | "pribor"
  | "lepkovi"
  | "ciscenje"
  | "zastita"
  | "poliranje"
  | "radionica";

export type ProductCategory = {
  slug: ProductCategorySlug;
  label: string;
  description: string;
};

/** Fields a record must expose to be classifiable. */
export type ClassifiableProduct = Pick<
  CarsystemProduct,
  "badges" | "catalogMetadata" | "phaseSlug" | "programSlug" | "rmMetadata" | "taxonomyCategory"
>;

export const productCategorySlugs = productCategorySlugsImpl as readonly ProductCategorySlug[];
export const productCategories = productCategoriesImpl as ProductCategory[];

export function getProductCategory(slug: string): ProductCategory | undefined {
  return getProductCategoryImpl(slug) as ProductCategory | undefined;
}

export function isProductCategorySlug(value: string): value is ProductCategorySlug {
  return isProductCategorySlugImpl(value);
}

export function getProductCategorySlug(
  product: ClassifiableProduct,
): ProductCategorySlug | undefined {
  return getProductCategorySlugImpl(product) as ProductCategorySlug | undefined;
}
