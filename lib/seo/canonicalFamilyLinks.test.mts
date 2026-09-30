/*
 * Interni linkovi na proizvod vode na kanonsko odredište, ne na adresu koja preusmerava.
 *
 *   npm run test:seo-canonical
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { productVariantKey, toProductVariantView } from "@/components/product/productVariantView";
import { findVariantByKey } from "@/components/product/productVariantState.mjs";
import * as sitemapModule from "@/app/sitemap";
import { getAllCarsystemProducts, getCarsystemProductBySlug } from "@/lib/carsystem-data";
import { canonicalVariantKey } from "@/lib/catalog/variant-key";
import {
  familyPath,
  getAllProductFamilies,
  getFamilyForProduct,
  productCanonicalHref,
  variantRedirectTarget,
} from "@/lib/product-families";
import { buildProductFamilyMetadata } from "@/lib/seo/metadata-builders";

const product = (slug: string) => {
  const found = getCarsystemProductBySlug(slug);
  assert.ok(found, `${slug} postoji`);
  return found;
};

function expectFamilyLink(slug: string, familySlug: string) {
  const item = product(slug);
  const family = getFamilyForProduct(item);
  assert.equal(family?.slug, familySlug, `${slug}: porodica`);
  assert.equal(family?.presentation, "variant-pdp", `${slug}: varijantni PDP`);
  const href = productCanonicalHref(item);
  assert.equal(href, `/proizvodi/grupa/${familySlug}?varijanta=${encodeURIComponent(canonicalVariantKey(item))}`);
  // Isto odredište kao preusmerenje: link ne dodaje skok, a kupac dolazi na izabranu varijantu.
  assert.equal(href, variantRedirectTarget(item));
  return { item, family: family!, href };
}

test("Norbin N15-020: oba pakovanja vode na porodični PDP sa izabranom varijantom", () => {
  expectFamilyLink("norbin-n15-020-1l", "norbin-n15-020");
  expectFamilyLink("norbin-n15-020-5l", "norbin-n15-020");
});

test("Baslac 1 L (20-24 i 27-10): vode na porodični PDP, ne na slug koji preusmerava", () => {
  expectFamilyLink("baslac-20-24-2k-primerfiller-grey-1l", "20-24-2k-primerfiller-grey");
  expectFamilyLink("baslac-27-10-2k-washprimer-1l", "27-10-2k-washprimer");
});

test("canonical porodice nema query, a ?varijanta= bira baš tu varijantu", () => {
  const { item, family, href } = expectFamilyLink("baslac-20-24-2k-primerfiller-grey-1l", "20-24-2k-primerfiller-grey");
  const canonical = String(buildProductFamilyMetadata(family).alternates?.canonical ?? "");
  assert.ok(canonical.endsWith(familyPath(family)), canonical);
  assert.ok(!canonical.includes("?"), `canonical bez query-ja: ${canonical}`);

  const key = new URL(href, "https://carsystemirm.com").searchParams.get("varijanta");
  const views = family.variants.map((variant) => toProductVariantView(variant, family.slug));
  assert.equal(findVariantByKey(views, key)?.slug, item.slug);
  assert.equal(productVariantKey(item), key);
});

test("svaka varijanta svake variant-pdp porodice (i buduće) linkuje kanonsko odredište", () => {
  let checked = 0;
  const familySlugs = new Set(getAllProductFamilies().map((family) => family.slug));
  for (const item of getAllCarsystemProducts()) {
    const family = getFamilyForProduct(item);
    const target = variantRedirectTarget(item);
    if (!family || family.presentation !== "variant-pdp") {
      assert.equal(target, null, item.slug);
      assert.equal(productCanonicalHref(item), `/proizvodi/${item.slug}`);
      continue;
    }
    assert.ok(target?.startsWith(`${familyPath(family)}?varijanta=`), item.slug);
    assert.equal(productCanonicalHref(item), target);
    // Odredište je porodica koja postoji (200), pa nema lanca preusmerenja.
    assert.ok(familySlugs.has(family.slug));
    checked += 1;
  }
  assert.ok(checked > 700, `proveravano ${checked}`);
});

test("sitemap sadrži samo kanonske entitete", () => {
  const mod = sitemapModule as unknown as { default: (() => { url: string }[]) | { default: () => { url: string }[] } };
  const sitemap = typeof mod.default === "function" ? mod.default : mod.default.default;
  const urls = sitemap().map((entry) => new URL(entry.url).pathname);
  const redirecting = new Set(
    getAllCarsystemProducts().filter((item) => variantRedirectTarget(item)).map((item) => `/proizvodi/${item.slug}`),
  );
  assert.deepEqual(urls.filter((url) => redirecting.has(url)), []);
  for (const family of getAllProductFamilies()) assert.ok(urls.includes(familyPath(family)), family.slug);
});

test("liste proizvoda ne grade adresu ručno iz sluga", () => {
  const files = [
    "components/product/ProductDetailPage.tsx",
    "components/product/RelatedProducts.tsx",
    "components/norbin-brand/NorbinBrandPage.tsx",
    "components/brand-program/EntityProductCard.tsx",
    "components/brand/cosmos/CosmosBrandPage.tsx",
    "components/baslac-brand/BaslacBrandPage.tsx",
  ];
  for (const file of files) {
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /[`"']\/proizvodi\/\$\{product\.slug\}/, file);
    assert.match(source, /productCanonicalHref\(/, file);
  }
});
