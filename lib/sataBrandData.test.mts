/**
 * SATA — izvrsni testovi.
 *
 * Pokrecu se kroz `tsx --test`, pa uvoze STVARNE TypeScript izvoze i pozivaju
 * ih. Nijedna tvrdnja o SEO ponasanju ne cita izvorni tekst: `productJsonLd`
 * se stvarno izvrsava nad stvarnim kataloskim zapisima.
 *
 * Jedina tvrdnja koja cita izvor je oznacena kao SOURCE-CONTRACT i objasnjeno
 * je zasto se ne moze izvrsiti.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getCarsystemBrandBySlug,
  getCarsystemProductBySlug,
  getAllCarsystemProducts,
  getCarsystemProductsByBrandSlug,
} from "@/lib/carsystem-data";
import { absoluteUrl, productJsonLd } from "@/lib/seo";
import {
  SATA_BRAND_SLUG,
  SATA_OFFICIAL,
  sataSections,
  sataSeo,
  sataServices,
} from "@/lib/sata-brand-data";

const SATAJET = "satajet-x-5500";

/* ==========================================================================
 * 1. JSON-LD: placeholder se ne objavljuje kao Product.image
 * ========================================================================== */

test("SATA proizvod sa placeholder vizuelom nema Product.image", () => {
  const product = getCarsystemProductBySlug(SATAJET);
  assert.ok(product, `${SATAJET} ne postoji u katalogu`);

  /*
   * Predus1ov: zapis STVARNO nosi sistemski placeholder. Bez ovoga bi test
   * mogao da prodje samo zato sto proizvod nema sliku iz nekog drugog razloga.
   */
  assert.match(
    product.productImage?.src ?? "",
    /placeholder-product/,
    "preduslov: satajet vise ne koristi sistemski placeholder",
  );

  const ld = productJsonLd(product, "SATA", "Oprema");

  assert.equal(ld.image, undefined, "placeholder je zavrsio u Product.image");
  assert.ok(!("image" in ld) || ld.image === undefined);

  // Ni u jednom uglu serijalizovanog rezultata.
  const serialized = JSON.stringify(ld);
  assert.ok(
    !serialized.includes("placeholder-product"),
    "placeholder-product se pojavljuje u serijalizovanom JSON-LD-u",
  );

  // Ostalo mora ostati — filter ne sme da oduzme nista drugo.
  assert.equal(ld["@type"], "Product");
  assert.equal(ld.name, product.name);
  assert.equal(ld.url, absoluteUrl(`/proizvodi/${SATAJET}`));
  assert.equal(ld.brand?.name, "SATA");
});

test("proizvod sa pravom slikom zadrzava Product.image", () => {
  const product = getAllCarsystemProducts().find(
    (item) =>
      item.productImage &&
      !item.productImage.src.includes("placeholder-product") &&
      item.galleryImages.length === 0,
  );
  assert.ok(product, "nijedan proizvod sa pravom slikom nije pronadjen");

  const ld = productJsonLd(product, "Test brend", "Test kategorija");

  assert.ok(Array.isArray(ld.image), "Product.image nedostaje");
  assert.deepEqual(ld.image, [absoluteUrl(product.productImage!.src)]);
  // Javna adresa, ne lokalna putanja.
  assert.match(ld.image[0], /^https?:\/\//);
  assert.ok(ld.image[0].endsWith(product.productImage!.src));

  // Osnovni Product podaci nisu uklonjeni filterom.
  assert.equal(ld["@type"], "Product");
  assert.equal(ld.name, product.name);
  assert.equal(ld.url, absoluteUrl(`/proizvodi/${product.slug}`));
  assert.equal(ld.brand?.name, "Test brend");
  assert.equal(ld.category, "Test kategorija");
  assert.ok(ld.description && ld.description.length > 0);
});

test("filter je selektivan: prava slika ostaje, placeholder iz iste galerije ne", () => {
  /*
   * U katalogu danas ne postoji zapis koji MESA pravu sliku i placeholder
   * (provereno: 7 proizvoda sa galerijom, nijedan mesovit). Da bi se dokazalo
   * da filter uklanja bas placeholder a ne celu galeriju, ulaz se sastavlja —
   * ali se poziva STVARNI `productJsonLd`, ne njegova kopija.
   */
  const osnova = getAllCarsystemProducts().find(
    (item) => item.productImage && !item.productImage.src.includes("placeholder-product"),
  );
  assert.ok(osnova, "nijedan proizvod sa pravom slikom");

  const mesovit = {
    ...osnova,
    galleryImages: [
      { src: "/images/products/placeholder-product.svg", alt: "vizuel u pripremi" },
      ...osnova.galleryImages,
    ],
  };

  const ld = productJsonLd(mesovit, "Test brend");
  assert.ok(Array.isArray(ld.image));
  assert.ok(
    ld.image.every((url: string) => !url.includes("placeholder-product")),
    "placeholder je prosao filter",
  );
  assert.equal(ld.image[0], absoluteUrl(osnova.productImage!.src));
  assert.equal(
    ld.image.length,
    1 + osnova.galleryImages.length,
    "filter je uklonio i prave slike",
  );
});

test("proizvod ciji su SVI vizueli placeholder nema Product.image", () => {
  // Stvaran slucaj u katalogu, ne izmisljen.
  const product = getAllCarsystemProducts().find((item) => {
    const images = [item.productImage, ...item.galleryImages].filter(Boolean);
    return images.length > 0 && images.every((i) => i!.src.includes("placeholder-product"));
  });
  assert.ok(product, "nijedan proizvod nema iskljucivo placeholder vizuele");

  const ld = productJsonLd(product, "Test brend");
  assert.equal(ld.image, undefined, `${product.slug}: placeholder je objavljen`);
  assert.ok(!JSON.stringify(ld).includes("placeholder-product"));
});

/* ==========================================================================
 * 2. SATA podaci i njihove reference u stvarnom katalogu
 * ========================================================================== */

test("identifikatori sekcija su neprazni i jedinstveni", () => {
  const ids = sataSections.map((section) => section.id);
  assert.ok(ids.length >= 5, `ocekivano bar 5 sekcija, ima ${ids.length}`);
  for (const id of ids) {
    assert.match(id, /^[a-z][a-z0-9-]*$/, `neispravan id: "${id}"`);
  }
  assert.equal(new Set(ids).size, ids.length, `duplirani section id: ${ids.join(", ")}`);

  // Labele takodje moraju postojati; prazna labela daje prazno dugme u navigaciji.
  for (const section of sataSections) {
    assert.ok(section.label.trim().length > 0, `prazna labela za "${section.id}"`);
  }
});

test("SATA brend i njegov proizvod postoje u stvarnim podacima", () => {
  const brand = getCarsystemBrandBySlug(SATA_BRAND_SLUG);
  assert.ok(brand, `brend "${SATA_BRAND_SLUG}" ne postoji`);
  assert.equal(brand.slug, SATA_BRAND_SLUG);
  assert.equal(sataSeo.path, `/brendovi/${SATA_BRAND_SLUG}`);

  const products = getCarsystemProductsByBrandSlug(SATA_BRAND_SLUG);
  assert.ok(products.length > 0, "SATA brend nema nijedan proizvod");

  // Bez dupliranih slugova — dva zapisa na istoj adresi znace da jedan nikad
  // nije dostupan.
  const slugs = products.map((product) => product.slug);
  assert.equal(new Set(slugs).size, slugs.length, `duplirani slug: ${slugs.join(", ")}`);
});

test("satajet-x-5500 se razresava tacno jednom", () => {
  const hits = getAllCarsystemProducts().filter((item) => item.slug === SATAJET);
  assert.equal(hits.length, 1, `ocekivan tacno jedan zapis, pronadjeno ${hits.length}`);
  assert.equal(hits[0].brandSlug, SATA_BRAND_SLUG);
  assert.equal(getCarsystemProductBySlug(SATAJET)?.slug, SATAJET);
});

test("SATA reference ne pokazuju na nepostojece proizvode", () => {
  const svi = new Set(getAllCarsystemProducts().map((item) => item.slug));
  for (const product of getCarsystemProductsByBrandSlug(SATA_BRAND_SLUG)) {
    for (const related of product.relatedProductSlugs ?? []) {
      assert.ok(svi.has(related), `${product.slug} → nepostojeci "${related}"`);
    }
  }
});

test("spoljne SATA adrese su apsolutne i vode na zvanicni domen", () => {
  // Servisni linkovi vode van sajta; relativna adresa bi tiho pala na nas domen.
  for (const service of sataServices) {
    if (!service.href) continue;
    assert.match(service.href, /^https:\/\//, `${service.title}: nije apsolutna`);
  }
  assert.match(SATA_OFFICIAL.site, /^https:\/\/(www\.)?sata\.com/);
});

/* ==========================================================================
 * 3. SOURCE-CONTRACT — jedina tvrdnja koja cita izvor
 *
 * `SataBrandPage.tsx` uvozi `./SataBrandPage.module.css`, sto `tsx --test` ne
 * moze da ucita, pa se komponenta ne moze renderovati u ovom okruzenju. Zato
 * se ovde cita njen izvor. Ovo NIJE izvrsni dokaz i nije browser provera.
 * ========================================================================== */

test("[source-contract] strana izvodi navigaciju iz kanonskih sataSections", async () => {
  const source = await readFile(
    new URL("../components/brand/sata/SataBrandPage.tsx", import.meta.url),
    "utf8",
  );

  // Navigacija se MAPIRA iz kanonskog izvora, ne prepisuje rucno.
  assert.match(source, /sataSections\.map\(/);
  assert.match(source, /from "@\/lib\/sata-brand-data"/);

  // Svaka kanonska sekcija ima svoje sidro na strani; inace navigacija vodi u prazno.
  for (const section of sataSections) {
    assert.ok(
      source.includes(`id="${section.id}"`),
      `nema sidra id="${section.id}" na strani`,
    );
  }
});
