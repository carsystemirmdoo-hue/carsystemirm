/**
 * Poklapanje postojećih baslac zapisa sa zvaničnim modelom.
 *
 * baslac katalog je GENERISAN iz `lib/baslac-systems.ts` (toner baze) i `lib/baslac-catalog-
 * products.ts` (pripremni proizvodi), pa se dokaz čita iz `sku` zapisa, a ne iz runtime naziva.
 * Šifra pakovanja (`20-24-1L`) se svodi na identitet proizvoda (`20-24`).
 */

import { loadCatalogRuntime } from "../../lib/catalog-runtime.mjs";

export const codeOfSku = (sku) =>
  String(sku ?? "")
    .replace(/^BASLAC-/i, "")
    .replace(/-(\d+(?:[.,]\d+)?)(L|ML|KG)$/i, "")
    .toUpperCase();

export function loadLocalBaslac() {
  const runtime = loadCatalogRuntime();
  const products = runtime.products.filter((product) => product.brandSlug === "baslac");
  return {
    runtime,
    records: products.map((product) => ({
      slug: product.slug,
      sku: product.sku ?? null,
      code: codeOfSku(product.sku),
      name: product.name,
      familySlug: runtime.getFamilyForProduct(product)?.slug ?? null,
      consolidated: runtime.variantSlugs.has(product.slug),
      hasImage: Boolean(product.productImage?.src && !product.productImage.src.includes("placeholder")),
      documents: (product.documents ?? []).filter((document) => document.status === "available").length,
    })),
    allSlugs: new Set(runtime.products.map((product) => product.slug)),
  };
}
