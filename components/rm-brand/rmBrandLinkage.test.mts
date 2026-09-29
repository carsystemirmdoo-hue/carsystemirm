/*
 * Veza R-M brend stranice sa katalogom: grupe se čitaju iz `rmMetadata`, a slika svakog
 * prikazanog proizvoda je ista ona koju koriste katalog, pretraga i detaljna stranica.
 *
 *   npm run test:rm-brand
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  rmColorSystems,
  rmGallerySystems,
  rmProductFamilies,
} from "@/components/rm-brand/rmBrandData";
import { hasCatalogImage, selectRmGroupProducts } from "@/components/rm-brand/rmBrandSelection";
import { toProductVariantView } from "@/components/product/productVariantView";
import { getCarsystemProductBySlug, getCarsystemProductsByBrandSlug } from "@/lib/carsystem-data";
import { getRmBrandClassifications } from "@/lib/rm-brand-classification";
import { toCatalogListingEntity } from "@/lib/catalog-listing";
import { getProductSearchIndex } from "@/lib/search/buildSearchIndex";
import catalogData from "@/data/rm-catalog-products.generated.json";
import supplied from "@/data/catalog/image-supply/supplied-images.json";

const products = getCarsystemProductsByBrandSlug("rm");
const syncedSlugs = new Set((catalogData.products as { slug: string }[]).map((product) => product.slug));
const classifications = getRmBrandClassifications(products);
const cls = (slug: string) => classifications[slug];

/** Isti izbor koji rade `RmColorSystems`, `RmProductSystemGallery` i `RmProductFamilies`. */
function colorSystemProducts(system: string) {
  const index = rmColorSystems.findIndex((item) => item.system === system);
  const config = rmColorSystems[index];
  return selectRmGroupProducts({
    limit: index === 0 ? 4 : 3,
    members: products.filter((product) => cls(product.slug)?.system === config.system),
    pinnedSlugs: config.productSlugs,
    pool: products,
  });
}
function galleryProducts(id: string) {
  const config = rmGallerySystems.find((item) => item.id === id)!;
  return selectRmGroupProducts({
    limit: 5,
    members: products.filter((product) =>
      config.kind === "system" ? cls(product.slug)?.system === id : cls(product.slug)?.series === id,
    ),
    pinnedSlugs: config.productSlugs,
  });
}
function familyProducts(id: string) {
  const family = rmProductFamilies.find((item) => item.id === id)!;
  return selectRmGroupProducts({
    limit: family.visualCount,
    members: family.category ? products.filter((product) => cls(product.slug)?.category === family.category) : [],
    pinnedSlugs: family.productSlugs,
    pool: products,
  }).slice(0, family.visualCount);
}

test("1. sinhronizovani R-M zapisi su razvrstani na brend stranici", () => {
  const unclassified = products.filter((product) => !cls(product.slug)).map((product) => product.slug);
  assert.deepEqual(unclassified, []);

  // Klasifikacija živi samo na brend stranici: sync zapisi u katalogu i dalje nemaju rmMetadata,
  // a zapisi iz arhive zadržavaju svoj potvrđeni rmMetadata.
  const synced = products.filter((product) => syncedSlugs.has(product.slug));
  assert.equal(synced.length, 159);
  assert.deepEqual(synced.filter((product) => product.rmMetadata).map((product) => product.slug), []);
  for (const product of products.filter((item) => item.rmMetadata)) {
    assert.equal(cls(product.slug).source, "catalog");
    assert.equal(cls(product.slug).category, product.rmMetadata!.category);
  }

  const cleaners = familyProducts("cleaners");
  assert.equal(cleaners.length, 2);
  for (const product of cleaners) {
    assert.ok(syncedSlugs.has(product.slug), product.slug);
    assert.equal(cls(product.slug)?.category, "cleaner");
  }

  const uno = products.filter((product) => cls(product.slug)?.system === "uno-hd");
  assert.equal(uno.length, 7);
  assert.ok(uno.every((product) => syncedSlugs.has(product.slug)));

  // Blenderi sa „A” oznakom su aditivi (kao potvrđeni zapisi iz arhive), ne bazne boje.
  assert.equal(cls("rm-a-2530x-agilis-blender")?.category, "additive");
  assert.equal(cls("rm-a-2530x-agilis-blender")?.system, "agilis");
  // Basecoat/Topcoat nije „Bazna boja”.
  assert.equal(cls("rm-sc-t2a203-pure-black")?.categoryLabel, "Bazna ili završna boja");
});

test("2. UNO HD koristi kanonsku sliku iz kataloga", () => {
  const record = (supplied.images as { slug: string; path: string }[]).find((image) => image.slug === "rm-uno-hd");
  assert.ok(record, "rm-uno-hd mora biti u supplied-images.json");

  const [first] = colorSystemProducts("uno-hd");
  assert.equal(first.slug, "rm-uno-hd");
  assert.equal(first.productImage?.src, record.path);

  const [central] = galleryProducts("uno-hd");
  assert.equal(central.slug, "rm-uno-hd");
  assert.equal(central.productImage?.src, record.path);
});

test("3. ručna i kataloška slika se ne dupliraju", () => {
  const source = readdirSync(new URL(".", import.meta.url))
    .filter((file) => /\.(ts|tsx)$/.test(file) && !file.includes(".test."))
    .map((file) => readFileSync(new URL(file, import.meta.url), "utf8"))
    .join("\n");

  // Brend stranica ne drži svoju kopiju packshota UNO HD, niti putanje kataloških slika.
  assert.doesNotMatch(source, /uno-hd\/[^"']*\.webp/);
  assert.doesNotMatch(source, /\/products\/rm\//);
  assert.doesNotMatch(source, /stageAssets|RmSlotIllustration/);

  for (const system of rmColorSystems) {
    const selected = colorSystemProducts(system.system);
    const srcs = selected.filter(hasCatalogImage).map((product) => product.productImage?.src);
    assert.equal(new Set(selected.map((product) => product.slug)).size, selected.length, system.system);
    assert.equal(new Set(srcs).size, srcs.length, `${system.system}: ista slika dvaput`);
  }
});

test("3b. isti naziv se ne ponavlja dok postoji drugi član grupe", () => {
  const names = galleryProducts("uno-hd").map((product) => product.name);
  assert.equal(new Set(names).size, names.length, names.join(" / "));
});

test("4. zapis bez kategorije ne ulazi ni u jednu grupu", () => {
  // Zapis koji nije ni u arhivi ni u sync-u nema klasifikaciju → ni u jednoj grupi.
  const orphan = { ...products[0], slug: "rm-test-bez-kategorije", rmMetadata: undefined };
  const pool = [...products, orphan];
  const poolClassifications = getRmBrandClassifications(pool);
  assert.equal(poolClassifications[orphan.slug], undefined);
  for (const family of rmProductFamilies) {
    const members = family.category ? pool.filter((product) => poolClassifications[product.slug]?.category === family.category) : [];
    assert.ok(!members.includes(orphan), family.id);
  }
  // Nepostojeći izabrani slug se preskače, ne pravi prazan proizvod.
  assert.deepEqual(selectRmGroupProducts({ limit: 3, members: [], pinnedSlugs: ["ne-postoji"] }), []);
});

test("5. CRYSTAL BASE bez aktivnog zapisa ne postaje proizvod za kupovinu", () => {
  const crystal = products.filter(
    (product) => cls(product.slug)?.system === "crystal-base" || /crystal/i.test(product.slug),
  );
  assert.deepEqual(crystal.map((product) => product.slug), []);
  assert.deepEqual(colorSystemProducts("crystal-base"), []);
  assert.deepEqual(galleryProducts("crystal-base"), []);
  // Sistem ostaje prikazan kao sistem (upit), bez kataloške kartice.
  assert.ok(rmColorSystems.some((system) => system.system === "crystal-base" && !system.productSlugs));
});

test("6. katalog, pretraga, PDP i brend stranica dele identitet i sliku", () => {
  const search = new Map(
    (getProductSearchIndex().records as { id: string; imageSrc?: string | null; productCode?: string }[]).map(
      (record) => [record.id, record],
    ),
  );

  const shown = [
    ...rmColorSystems.flatMap((system) => colorSystemProducts(system.system)),
    ...rmGallerySystems.flatMap((system) => galleryProducts(system.id)),
    ...rmProductFamilies.flatMap((family) => familyProducts(family.id)),
  ];
  assert.ok(shown.length > 40);

  for (const product of new Map(shown.map((item) => [item.slug, item])).values()) {
    const pdp = getCarsystemProductBySlug(product.slug);
    assert.ok(pdp, `${product.slug}: nema PDP`);
    assert.equal(pdp.productImage?.src, product.productImage?.src, product.slug);
    assert.equal(pdp.sku, product.sku, product.slug);

    const listing = toCatalogListingEntity(product);
    assert.equal(listing.href, `/proizvodi/${product.slug}`);
    assert.equal(listing.presentation.image?.src, product.productImage?.src, product.slug);

    // Pretraga ne nosi placeholder; prava slika je ista putanja.
    const record = search.get(product.slug);
    if (record && hasCatalogImage(product)) assert.equal(record.imageSrc, product.productImage?.src, product.slug);
    if (record && !hasCatalogImage(product)) assert.ok(!record.imageSrc || record.imageSrc === product.productImage?.src, product.slug);
  }

  const uno = getCarsystemProductBySlug("rm-uno-hd")!;
  assert.equal(search.get("rm-uno-hd")?.imageSrc, uno.productImage?.src);
});

test("7. UNO HD: bez lažne šifre, alt iz registra slike", () => {
  const uno = getCarsystemProductBySlug("rm-uno-hd")!;
  assert.equal(uno.sku, "rm-uno-hd"); // identitet ostaje
  assert.equal(uno.skuIsInternalOnly, true);
  assert.equal(toProductVariantView(uno).sku, null);
  assert.equal(uno.productImage?.alt, "R-M UNO HD sistem boja – zvanična ambalaža");

  // Zapisi sa zvaničnom oznakom i dalje prikazuju šifru.
  assert.equal(toProductVariantView(getCarsystemProductBySlug("rm-sc-t2a203-pure-black")!).sku, "SC T2A203");
  // Kartica, pretraga, JSON-LD i Baslac sistemi: `lib/catalog/public-code.test.mts`.
});
