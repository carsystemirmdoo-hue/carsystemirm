/**
 * Slug je slug, ne labela.
 *
 * Izvrsni test: ucitava STVARNI katalog i poredi vrednosti, ne tekst izvora.
 *
 * Zasto postoji
 * -------------
 * Globalna zamena „baslac" → „Baslac" pogodila je i mesta na kojima ta rec NIJE
 * prikazni naziv nego identifikator: `publicProgramGroups[].brandSlugs` i
 * `brandSlugByKey` u social-export modulu. Poredjenja su stroga (`===`,
 * `Array.includes`), a slugovi u podacima su malim slovima — pa je eksplicitna
 * veza tiho prestala da vazi.
 *
 * Kvar se nije video jer `getPublicProgramGroupsForBrand` ima rezervni put
 * preko `internalProgramSlugs`, koji je vracao isti rezultat. Zato se ovde ne
 * proverava ISHOD funkcije — proveravaju se same vrednosti, gde rezervni put ne
 * moze nista da sakrije.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { loadCatalogRuntime } from "../../scripts/lib/catalog-runtime.mjs";

const { brands, requireModule } = loadCatalogRuntime();
const { publicProgramGroups, futureBrands } = requireModule("lib/carsystem-data.ts");

/** Slug je mala slova, cifre i crtice — nista drugo. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

test("svaki brandSlugs zapis je normalizovan lowercase slug", () => {
  const lose = [];
  for (const group of publicProgramGroups) {
    for (const slug of group.brandSlugs) {
      if (!SLUG.test(slug)) lose.push(`${group.slug} → "${slug}"`);
    }
  }
  assert.deepEqual(lose, [], `nenormalizovani slugovi: ${lose.join(", ")}`);
});

test("nijedan brandSlugs zapis ne koristi veliko slovo", () => {
  const velika = publicProgramGroups.flatMap((group) =>
    group.brandSlugs
      .filter((slug) => slug !== slug.toLowerCase())
      .map((slug) => `${group.slug} → "${slug}"`),
  );
  assert.deepEqual(velika, [], `slug sa velikim slovom: ${velika.join(", ")}`);
});

test("svaki brandSlugs zapis pokazuje na postojeci brend", () => {
  // Programska celina sme da najavi i brend koji jos nije u ponudi
  // (`futureBrands`) — ali ne i slug koji ne postoji nigde.
  const poznati = new Set([
    ...brands.map((brand) => brand.slug),
    ...futureBrands.map((brand) => brand.slug),
  ]);
  const visece = publicProgramGroups.flatMap((group) =>
    group.brandSlugs
      .filter((slug) => !poznati.has(slug))
      .map((slug) => `${group.slug} → "${slug}"`),
  );
  assert.deepEqual(visece, [], `nepostojeci brend: ${visece.join(", ")}`);
});

test("baslac postoji kao eksplicitna veza tamo gde je predvidjen", () => {
  // Dve programske celine su izricito vezane za Baslac; obe moraju nositi slug.
  for (const slug of ["boje-i-lakovi", "poliranje"]) {
    const group = publicProgramGroups.find((item) => item.slug === slug);
    assert.ok(group, `programska celina "${slug}" ne postoji`);
    assert.ok(
      group.brandSlugs.includes("baslac"),
      `"${slug}" vise nema eksplicitnu vezu ka baslac: ${JSON.stringify(group.brandSlugs)}`,
    );
  }
});

test("prikazni naziv brenda ostaje Baslac", () => {
  const brand = brands.find((item) => item.slug === "baslac");
  assert.ok(brand, "brend baslac ne postoji");
  assert.equal(brand.slug, "baslac", "slug mora ostati malim slovima");
  assert.equal(brand.name, "Baslac", "labela mora ostati velikim slovom");
});

test("[source-contract] social-export brandSlugByKey nosi slug, ne labelu", async () => {
  /*
   * Ovo je JEDINA tvrdnja u fajlu koja cita izvor.
   *
   * `refinishSystemsPrograms.ts` uvozi `BrandLogoPlate` i tipove iz
   * `BrandEcosystemCards`, pa ga loader kataloga ne moze izvrsiti — lanac vodi u
   * TSX i CSS modul. Vrednost je obican literal, pa se proverava u tekstu.
   *
   * Ista greska se ovde vec javila: `baslac: "Baslac"` je bio slug, ne labela.
   */
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL(
      "../../components/social-exports/refinish-systems/refinishSystemsPrograms.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const blok = source.slice(
    source.indexOf("export const brandSlugByKey"),
    source.indexOf("export function getDirectBrandCatalogPreview"),
  );
  assert.ok(blok.length > 0, "brandSlugByKey blok nije nadjen");

  for (const [, value] of blok.matchAll(/^\s*[a-zA-Z]+:\s*"([^"]+)",/gm)) {
    assert.match(value, SLUG, `brandSlugByKey nosi vrednost koja nije slug: "${value}"`);
  }
  assert.match(blok, /baslac:\s*"baslac"/, "brandSlugByKey.baslac vise nije slug");
});
