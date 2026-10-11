/*
 * <title> proizvoda: jedinstven, bez brenda ponovljenog tri puta, uz očuvan naziv i šifru.
 *
 *   npm run test:seo-canonical
 */
import assert from "node:assert/strict";
import test from "node:test";

import { getAllCarsystemProducts, getCarsystemBrandBySlug } from "@/lib/carsystem-data";
import { buildProductMetadata } from "@/lib/seo/metadata-builders";

const entries = getAllCarsystemProducts().flatMap((product) => {
  const brand = getCarsystemBrandBySlug(product.brandSlug);
  if (!brand) return [];
  const { title } = buildProductMetadata({ brand, product });
  return [{ product, brand, title: (title as { absolute: string }).absolute }];
});

test("svaki proizvod ima jedinstven <title>", () => {
  const seen = new Map<string, string>();
  for (const { product, title } of entries) {
    assert.ok(!seen.has(title), `isti naslov: ${product.slug} i ${seen.get(title)} → ${title}`);
    seen.set(title, product.slug);
  }
});

test("naslov počinje vidljivim nazivom proizvoda i ne ponavlja generički „<brend> proizvod”", () => {
  for (const { product, brand, title } of entries) {
    assert.ok(title.startsWith(product.name), `${product.slug}: ${title}`);
    assert.ok(!title.includes(`– ${brand.name} proizvod`), `${product.slug}: ${title}`);
  }
});

test("brend ostaje u naslovu i kada ga naziv nema (SATA nazivi na srpskom)", () => {
  const compact = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const { product, brand, title } of entries) {
    assert.ok(compact(title).includes(compact(brand.name)), `${product.slug}: ${title}`);
  }
});
