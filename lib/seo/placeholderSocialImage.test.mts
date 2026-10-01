/*
 * `placeholder-product.svg` je sistemski „vizuel u pripremi", ne slika
 * proizvoda. Ne sme da izađe kao og:image / twitter:image niti kao slika
 * varijante u ProductGroup JSON-LD-u (321 PDP i 10 porodica su ga nosile).
 *
 *   npm run test:seo-canonical
 */
import assert from "node:assert/strict";
import test from "node:test";

import { getAllCarsystemProducts, getCarsystemBrandBySlug } from "@/lib/carsystem-data";
import { getAllProductFamilies } from "@/lib/product-families";
import { productGroupJsonLd } from "@/lib/seo";
import {
  buildPageMetadata,
  buildProductFamilyMetadata,
  buildProductMetadata,
} from "@/lib/seo/metadata-builders";
import { seoSiteConfig } from "@/lib/seo/site-config";

const PLACEHOLDER = "placeholder-product";

function socialImages(metadata: ReturnType<typeof buildPageMetadata>) {
  const og = metadata.openGraph?.images;
  const ogList = (Array.isArray(og) ? og : og ? [og] : []).map((image) =>
    typeof image === "object" && image !== null && "url" in image ? String(image.url) : String(image),
  );
  const tw = metadata.twitter?.images;
  const twList = (Array.isArray(tw) ? tw : tw ? [tw] : []).map((image) => String(image));
  return [...ogList, ...twList];
}

test("placeholder slika se zamenjuje podrazumevanom slikom sajta", () => {
  const metadata = buildPageMetadata({
    title: "Proba",
    description: "Opis",
    path: "/proizvodi/proba",
    image: "/images/products/placeholder-product.svg",
    imageAlt: "Proba, ilustrativni prikaz proizvoda",
  });
  const images = socialImages(metadata);
  assert.ok(images.length > 0);
  for (const url of images) {
    assert.ok(!url.includes(PLACEHOLDER), url);
    assert.ok(url.endsWith(seoSiteConfig.defaultOgImage), url);
  }
});

test("nijedan PDP ne deli placeholder kao og:image ili twitter:image", () => {
  const offenders: string[] = [];
  for (const product of getAllCarsystemProducts()) {
    const brand = getCarsystemBrandBySlug(product.brandSlug);
    if (!brand) continue;
    const images = socialImages(buildProductMetadata({ brand, product }));
    if (images.some((url) => url.includes(PLACEHOLDER))) offenders.push(product.slug);
  }
  assert.deepEqual(offenders, []);
});

test("porodice: ni metadata ni hasVariant ne nose placeholder", () => {
  const offenders: string[] = [];
  for (const family of getAllProductFamilies()) {
    const images = socialImages(buildProductFamilyMetadata(family));
    const variantImages = productGroupJsonLd(family).hasVariant.map((variant) => variant.image ?? "");
    if ([...images, ...variantImages].some((url) => url.includes(PLACEHOLDER))) offenders.push(family.slug);
  }
  assert.deepEqual(offenders, []);
});
