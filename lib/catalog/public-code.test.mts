/*
 * Interni `sku` (slug) se nigde ne prikazuje kupcu kao šifra; identitet, rute i prave šifre ostaju.
 *
 *   npm run test:public-code
 */
import assert from "node:assert/strict";
import test from "node:test";

import { toProductVariantView } from "@/components/product/productVariantView";
import { findVariantByKey, toCartPayload } from "@/components/product/productVariantState.mjs";
import { publicSkuOf } from "@/lib/catalog/public-code";
import { canonicalVariantKey } from "@/lib/catalog/variant-key";
import {
  getAllCarsystemProducts,
  getCarsystemBrandBySlug,
  getCarsystemProductBySlug,
  getProductVariantSelector,
} from "@/lib/carsystem-data";
import { expandVariant, getCatalogListingData, toCatalogListingEntity } from "@/lib/catalog-listing";
import { getFamilyForProduct, variantRedirectTarget } from "@/lib/product-families";
import { getProductSearchIndex } from "@/lib/search/buildSearchIndex";
import { productGroupJsonLd, productJsonLd } from "@/lib/seo";
import { buildProductMetadata } from "@/lib/seo/metadata-builders";

const INTERNAL = ["rm-uno-hd", "baslac-basecoat-35", "baslac-basecoat-45", "baslac-topcoat-30", "baslac-topcoat-30-cv"];
const BASLAC_SYSTEMS = INTERNAL.filter((slug) => slug.startsWith("baslac-"));

const all = getAllCarsystemProducts();
const bySlug = (slug: string) => getCarsystemProductBySlug(slug)!;
const listing = getCatalogListingData();
const search = new Map(
  (getProductSearchIndex().records as { id: string; kind: string; href: string; productCode?: string }[]).map((record) => [record.id, record]),
);
function listingEntityOf(slug: string) {
  const canonical = listing.canonical.find((entity) => entity.id === slug);
  if (canonical) return canonical;
  const variant = listing.variants.find((entity) => entity.id === slug)!;
  return expandVariant(variant, listing.canonical.find((entity) => entity.id === `family:${variant.familySlug}`)!);
}
const metaDescription = (slug: string) => {
  const product = bySlug(slug);
  return String(buildProductMetadata({ brand: getCarsystemBrandBySlug(product.brandSlug)!, product }).description);
};

test("samo pet sistemskih zapisa bez zvanične šifre nosi oznaku, i to iz adaptera", () => {
  assert.deepEqual(all.filter((product) => product.skuIsInternalOnly).map((product) => product.slug).sort(), [...INTERNAL].sort());
  for (const slug of INTERNAL) {
    const product = bySlug(slug);
    assert.equal(product.sku, slug, "sku ostaje interni ključ");
    assert.ok(!product.manufacturerCode, `${slug} nema zvaničnu šifru`);
  }
});

test("1–2. rm-uno-hd i četiri Baslac sistema se nigde ne prikazuju kao šifra", () => {
  for (const slug of INTERNAL) {
    const product = bySlug(slug);
    assert.equal(publicSkuOf(product), null);
    assert.equal(toProductVariantView(product).sku, null, `${slug}: PDP`);
    const entity = listingEntityOf(slug);
    assert.equal(entity.productCode, "", `${slug}: kartica`);
    assert.ok(!entity.shortCode, `${slug}: kratka šifra`);
    assert.equal(search.get(slug)?.productCode, undefined, `${slug}: pretraga`);
    assert.doesNotMatch(metaDescription(slug), new RegExp(`Šifra proizvoda ${slug}`), `${slug}: SEO opis`);
  }
  for (const slug of BASLAC_SYSTEMS) {
    const selector = getProductVariantSelector(bySlug(slug));
    const option = selector?.variants.find((variant) => variant.slug === slug);
    assert.ok(option, `${slug}: varijanta porodice`);
    assert.equal(option!.sku, undefined, `${slug}: izbor varijante na PDP-u porodice`);
  }
});

test("3. interni identiteti, rute i veze ostaju funkcionalni", () => {
  for (const slug of INTERNAL) {
    const product = bySlug(slug);
    assert.equal(canonicalVariantKey(product), slug);
    const view = toProductVariantView(product);
    assert.equal(findVariantByKey([view], slug), view, `${slug}: ključ varijante`);
    assert.equal(toCartPayload(view)!.sku, slug, `${slug}: korpa nosi interni ključ`);
    assert.equal(listingEntityOf(slug).id, slug);
  }
  assert.equal(search.get("rm-uno-hd")?.href, "/proizvodi/rm-uno-hd");
  for (const slug of BASLAC_SYSTEMS) {
    const product = bySlug(slug);
    const target = variantRedirectTarget(product);
    assert.equal(target, `/proizvodi/grupa/${getFamilyForProduct(product)!.slug}?varijanta=${slug}`);
    // Pretraga i kartica vode na istu adresu kao preusmerenje — kao pre izmene.
    assert.equal(search.get(slug)?.href, target);
    assert.equal(listingEntityOf(slug).href, target);
  }
});

test("4. stvarne proizvođačke šifre ostalih proizvoda ostaju vidljive", () => {
  const rm = bySlug("rm-sc-t2a203-pure-black");
  assert.equal(toProductVariantView(rm).sku, "SC T2A203");
  assert.equal(listingEntityOf(rm.slug).productCode, "SC T2A203");
  assert.equal(search.get(rm.slug)?.productCode, "SC T2A203");
  assert.match(metaDescription(rm.slug), /Šifra proizvoda SC T2A203/);

  const baslac = bySlug("baslac-12-20-bodyfiller-universal");
  assert.equal(toProductVariantView(baslac).sku, "12-20");
  assert.equal(listingEntityOf(baslac.slug).productCode, "12-20");
  assert.equal(search.get(baslac.slug)?.productCode, "12-20");

  // Nijedan drugi zapis ne gubi šifru ni na kartici ni u pretrazi.
  for (const product of all) {
    if (product.skuIsInternalOnly) continue;
    assert.ok(toCatalogListingEntity(product).productCode, product.slug);
  }
});

test("5. katalog, pretraga i PDP se ponašaju isto", () => {
  for (const product of all) {
    const view = toProductVariantView(product).sku;
    const record = search.get(product.slug);
    if (product.skuIsInternalOnly) {
      assert.equal(view, null);
      assert.equal(record?.productCode, undefined);
    } else if (!product.catalogMetadata?.cosmosCode && !product.catalogMetadata?.ralCode && !product.publicCode) {
      // Isti izvor šifre na PDP-u i na kartici/u pretrazi.
      assert.equal(view, product.sku, product.slug);
      if (record) assert.equal(record.productCode, product.sku, product.slug);
    }
  }
});

test("6. JSON-LD ne predstavlja interni slug kao SKU", () => {
  for (const slug of BASLAC_SYSTEMS) {
    const family = getFamilyForProduct(bySlug(slug))!;
    const variant = (productGroupJsonLd(family).hasVariant as { url: string; sku?: string }[]).find((item) => item.url.endsWith(`/proizvodi/${slug}`));
    assert.ok(variant, slug);
    assert.equal(variant!.sku, undefined, `${slug}: hasVariant.sku`);
    // Ostale varijante iste porodice zadržavaju svoju šifru.
    assert.ok((productGroupJsonLd(family).hasVariant as { sku?: string }[]).some((item) => item.sku));
  }
  const uno = productJsonLd(bySlug("rm-uno-hd"), "R-M") as Record<string, unknown>;
  assert.equal("sku" in uno && uno.sku !== undefined, false);
  assert.doesNotMatch(JSON.stringify(uno), /"rm-uno-hd"/);
});

test("3b. katalog klijent iz zapisa pretrage vraća istu adresu varijante", async () => {
  const source = (await import("node:fs")).readFileSync(new URL("../../components/catalog/CatalogExplorer.tsx", import.meta.url), "utf8");
  // Katalog sa upitom gradi varijantu iz zapisa pretrage; bez šifre ključ se čita iz `href`.
  assert.match(source, /variantKey: variantKeyFromHref\(record\.href\)/);
  for (const slug of BASLAC_SYSTEMS) {
    const record = search.get(slug)!;
    const family = listing.canonical.find((entity) => entity.id === `family:${getFamilyForProduct(bySlug(slug))!.slug}`)!;
    const key = new URL(record.href, "https://katalog.local").searchParams.get("varijanta")!;
    const rebuilt = expandVariant({ ...listing.variants.find((variant) => variant.id === slug)!, productCode: "", variantKey: key }, family);
    assert.equal(rebuilt.href, record.href);
  }
});
