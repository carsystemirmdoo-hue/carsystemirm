/**
 * Poklapanje postojećih Norbin zapisa sa zvaničnim modelom.
 *
 * Norbin je prvi brend čiji naši zapisi nose ŠIFRU PROIZVOĐAČA u internoj oznaci
 * (`NORBIN-N15-020-1L`). Poklapa se samo po toj šifri; golo numeričko poklapanje se ne
 * prihvata, jer bi spojilo nepovezane artikle.
 */

import { loadCatalogRuntime } from "../../lib/catalog-runtime.mjs";

export const codeOfSku = (sku) => /(?<![A-Z0-9])N\d{2}-[A-Z]?\d{2,3}(?![A-Z0-9])/.exec(String(sku ?? "").toUpperCase())?.[0] ?? null;

export function loadLocalNorbin() {
  const runtime = loadCatalogRuntime();
  const products = runtime.products.filter((product) => product.brandSlug === "norbin");
  return {
    runtime,
    records: products.map((product) => ({
      slug: product.slug,
      sku: product.sku ?? null,
      code: product.manufacturerCode ?? codeOfSku(product.sku),
      name: product.name,
      packages: (product.packages ?? []).map((entry) => entry.label),
      familySlug: runtime.getFamilyForProduct(product)?.slug ?? null,
      consolidated: runtime.variantSlugs.has(product.slug),
      hasImage: Boolean(product.productImage?.src && !product.productImage.src.includes("placeholder")),
    })),
  };
}
