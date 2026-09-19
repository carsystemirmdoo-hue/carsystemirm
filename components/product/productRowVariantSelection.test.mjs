/**
 * Izbor varijante kada su varijante REDOVI jednog proizvoda.
 *
 * Kvar koji ovo zaključava: proizvodi sa tabelom šifara (Carsystem, C.A.R.FIT,
 * Befar — granulacije, pakovanja, boje) imali su u provideru jedan jedini pogled,
 * pa je klik na svaki red osim prvog tiho propadao: šifra, izvedba, slika i
 * `aria-pressed` ostajali su na prvoj varijanti, a direktan link
 * `?varijanta=<šifra>` padao na nju.
 *
 * Test nije vezan za brend: prvi deo radi nad izmišljenim redovima, drugi nad
 * SVAKIM proizvodom stvarnog kataloga koji ima redove varijanti.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { loadCatalogRuntime } from "../../scripts/lib/catalog-runtime.mjs";
import {
  expandRowVariants,
  findVariantByKey,
  resolveActiveVariant,
  variantQueryValue,
} from "./productVariantState.mjs";

const read = (relative) => readFile(new URL(relative, import.meta.url), "utf8");

const stage = (src) => ({ src, alt: "", contrastMode: "neutral" });
const BASE = {
  key: "100.001",
  id: "sanding-disc",
  slug: "sanding-disc",
  name: "Sanding Disc",
  sku: "100.001",
  shadeLabel: null,
  status: "Na upit",
  images: [stage("/products/disc.webp"), stage("/products/disc-2.webp")],
};
const ROWS = [
  { id: "100.001", label: "Bela", sku: "100.001", status: "Na upit" },
  { id: "100.002", label: "Narandžasta", sku: "100.002", status: "Na upit", image: "/products/disc-orange.webp" },
  { id: "100.003", label: "Bordo", sku: "100.003", status: "Po porudžbini", image: "/products/disc-claret.webp" },
];
const resolveImage = (src, row) => ({ ...stage(src), alt: `Sanding Disc · ${row.label}` });

/** Isti redosled kojim `ProductVariantOptions.chooseVariant` traži pogled. */
const viewFor = (views, candidate) =>
  findVariantByKey(views, candidate.id) ?? findVariantByKey(views, candidate.sku) ?? findVariantByKey(views, candidate.slug);

test("svaki red dobija svoj pogled sa SVOJOM šifrom, izvedbom i statusom", () => {
  const views = expandRowVariants(BASE, ROWS, resolveImage);
  assert.equal(views.length, 3);
  assert.deepEqual(views.map((view) => view.sku), ["100.001", "100.002", "100.003"]);
  assert.deepEqual(views.map((view) => view.key), ["100.001", "100.002", "100.003"]);
  assert.deepEqual(views.map((view) => view.shadeLabel), ["Bela", "Narandžasta", "Bordo"]);
  assert.equal(views[2].status, "Po porudžbini");
  // Porodica se ne dira: naziv i slug ostaju od proizvoda.
  assert.ok(views.every((view) => view.name === "Sanding Disc" && view.slug === "sanding-disc"));
});

test("varijanta sa svojom slikom je prikazuje prvu; bez nje ostaju slike proizvoda", () => {
  const views = expandRowVariants(BASE, ROWS, resolveImage);
  assert.deepEqual(views[0].images, BASE.images, "red bez slike: stabilan pad na slike proizvoda");
  assert.equal(views[1].images[0].src, "/products/disc-orange.webp");
  assert.equal(views[1].images[0].alt, "Sanding Disc · Narandžasta");
  assert.deepEqual(views[1].images.slice(1), BASE.images, "slike proizvoda ostaju u galeriji");
  // Slika reda koja je već u galeriji proizvoda se ne duplira.
  const dup = expandRowVariants(BASE, [ROWS[0], { ...ROWS[1], image: "/products/disc-2.webp" }], resolveImage);
  assert.deepEqual(dup[1].images.map((image) => image.src), ["/products/disc-2.webp", "/products/disc.webp"]);
});

test("izbor prve → druge → treće → prve varijante uvek daje tačno tu varijantu", () => {
  const views = expandRowVariants(BASE, ROWS, resolveImage);
  let activeKey = resolveActiveVariant(views, null, BASE.key).key;
  const seen = [];
  for (const row of [ROWS[0], ROWS[1], ROWS[2], ROWS[0]]) {
    const view = viewFor(views, row);
    assert.ok(view, `red ${row.id} nema pogled — klik bi tiho propao`);
    activeKey = view.key;
    const active = resolveActiveVariant(views, activeKey, BASE.key);
    // Selektor svoj označeni red nalazi istim ključem (`aria-pressed`).
    assert.equal(findVariantByKey(ROWS, activeKey)?.id, row.id);
    seen.push([active.sku, active.shadeLabel, active.images[0].src]);
  }
  assert.deepEqual(seen, [
    ["100.001", "Bela", "/products/disc.webp"],
    ["100.002", "Narandžasta", "/products/disc-orange.webp"],
    ["100.003", "Bordo", "/products/disc-claret.webp"],
    ["100.001", "Bela", "/products/disc.webp"],
  ]);
});

test("`?varijanta=<šifra>` vodi na taj red; nepoznata vrednost pada na reprezentativnu", () => {
  const views = expandRowVariants(BASE, ROWS, resolveImage);
  assert.equal(variantQueryValue(views[2]), "100.003");
  assert.equal(resolveActiveVariant(views, "100.003", BASE.key).shadeLabel, "Bordo");
  assert.equal(resolveActiveVariant(views, "ne-postoji", BASE.key).sku, "100.001");
});

test("porodice sa zasebnim proizvodima i proizvodi bez redova ostaju kakvi su bili", () => {
  assert.deepEqual(expandRowVariants(BASE, [], resolveImage), [BASE]);
  assert.deepEqual(expandRowVariants(BASE, [ROWS[0]], resolveImage), [BASE], "jedan red nije izbor");
  const withSlugs = ROWS.map((row) => ({ ...row, slug: `product-${row.id}` }));
  assert.deepEqual(expandRowVariants(BASE, withSlugs, resolveImage), [BASE], "red sa slug-om je zaseban proizvod");
});

test("dva reda sa istom šifrom ostaju oba dostižna", () => {
  const views = expandRowVariants(BASE, [ROWS[0], { id: "row-b", label: "Drugo pakovanje", sku: "100.001" }], resolveImage);
  assert.deepEqual(views.map((view) => view.key), ["100.001", "row-b"]);
  assert.equal(viewFor(views, { id: "row-b", sku: "100.001" }).shadeLabel, "Drugo pakovanje");
});

test("PDP i selektor su vezani za redove: pogled po redu, id pre slug-a, izbor i tastaturom", async () => {
  const page = await read("./ProductDetailPage.tsx");
  assert.match(page, /selectorProducts\.length > 0 \? \[\] : \(variantSelector\?\.variants \?\? \[\]\)/);
  assert.match(page, /toProductVariantViews\(\s*variantProducts,\s*family\?\.slug \?\? null,\s*rowVariants,\s*\)/);

  const options = await read("./ProductVariantOptions.tsx");
  assert.match(options, /findVariant\(candidate\.id\) \?\?\s*findVariant\(candidate\.sku\) \?\?\s*findVariant\(candidate\.slug\)/);
  // Izbor je pravo dugme sa stanjem — radi na Enter/Space, ne samo na klik mišem.
  assert.match(options, /<button[\s\S]{0,200}?type="button"\s+aria-pressed=\{isSelected\}\s+onClick=\{\(\) => chooseVariant\(candidate\)\}/);
});

test("stvarni katalog: svaki red svake tabele šifara ima svoj pogled i svoju šifru", () => {
  const runtime = loadCatalogRuntime();
  const { getProductVariantSelector } = runtime.requireModule("lib/carsystem-data.ts");
  const { toProductVariantViews } = runtime.requireModule("components/product/productVariantView.ts");

  const byBrand = {};
  let withOwnImage = 0;
  for (const product of runtime.products) {
    const selector = getProductVariantSelector(product);
    const rows = (selector?.variants ?? []).filter((variant) => !variant.slug);
    if (!selector || rows.length < 2 || rows.length !== selector.variants.length) continue;

    const views = toProductVariantViews([product], null, selector.variants);
    assert.equal(views.length, rows.length, `${product.slug}: broj pogleda ≠ broj redova`);
    assert.equal(new Set(views.map((view) => view.key.toLowerCase())).size, views.length, `${product.slug}: ključevi nisu jedinstveni`);

    for (const row of rows) {
      const view = viewFor(views, row);
      assert.ok(view, `${product.slug}: red ${row.id} nema pogled`);
      assert.equal(view.id, row.id, `${product.slug}: red ${row.id} pogađa tuđi pogled`);
      assert.equal(view.sku, row.sku ?? view.sku, `${product.slug}: pogrešna šifra za red ${row.id}`);
      assert.equal(view.name, product.name);
      if (row.image) {
        assert.equal(view.images[0].src, row.image, `${product.slug}: slika varijante ${row.id} nije prva`);
        withOwnImage += 1;
      }
      // Oznaka reda nikada nije javni status („Na upit / Na upit”).
      assert.notEqual(view.shadeLabel, "Na upit", `${product.slug}: oznaka varijante je status`);
    }
    byBrand[product.brandSlug] = (byBrand[product.brandSlug] ?? 0) + 1;
  }

  // Tri sync brenda imaju tabele šifara; test pokriva i svaki budući brend sa istim modelom.
  for (const brand of ["carsystem", "carfit", "befar"]) assert.ok(byBrand[brand] > 0, `nijedan ${brand} proizvod sa redovima varijanti`);
  assert.ok(withOwnImage > 0, "nijedna varijanta sa sopstvenom slikom");
});
