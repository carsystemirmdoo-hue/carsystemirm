/**
 * Typed access to the paint rule.
 *
 * The rule itself lives in `lib/productPaintRule.mjs` so the PDP, the catalog,
 * the tests and the validators execute the same implementation. This file only
 * adds the types; it must not add a second rule.
 */

import {
  getProductDataShade as getProductDataShadeImpl,
  isPaintProduct as isPaintProductImpl,
} from "@/lib/productPaintRule.mjs";
import type { CarsystemProduct } from "@/lib/carsystem-data";

/** Fields a record must expose to be classified as paint or not. */
export type PaintClassifiableProduct = Pick<
  CarsystemProduct,
  "slug" | "rmMetadata" | "visual" | "catalogMetadata"
>;

/** True when the product is a paint: a colour, a mixing tint or a colour aerosol. */
export function isPaintProduct(product: PaintClassifiableProduct): boolean {
  return isPaintProductImpl(product);
}

/** The product's own shade from reviewed data, or `null` when it has none. */
export function getProductDataShade(
  product: Pick<CarsystemProduct, "visual">,
): string | null {
  return getProductDataShadeImpl(product);
}
