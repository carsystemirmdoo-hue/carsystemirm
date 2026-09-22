/**
 * Revizija kataloga 2026-09-22 — uklanjanje iz programa, direct-to-PDP i deljene slike.
 *
 * Testira se STVARNI runtime, ne tekst izvora. Svaka tvrdnja iz odluke vlasnika ima ovde svoj
 * dokaz, pa nijedna ne može tiho da se izgubi u sledećoj izmeni:
 *
 *   1. 21 uklonjena kartica nije customer-facing i svaka ima odredište preusmerenja;
 *   2. ono što je izričito ZADRŽANO (procesni filteri, zaštitna odeća, masking program) je i dalje tu —
 *      „maska za disanje” i „maskirna folija” nisu ista kategorija;
 *   3. nijedna preporuka ne pokazuje na nepostojeći proizvod;
 *   4. porodice idu pravo na PDP, osim odloženih, a odlaganje mora i dalje da bude opravdano;
 *   5. migracija nije uvela nijednu novu `?varijanta=` koliziju.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { loadCatalogRuntime } from "../../scripts/lib/catalog-runtime.mjs";

const runtime = loadCatalogRuntime();
const { requireModule, families, listing, products, productVariantKey } = runtime;
const data = requireModule("lib/carsystem-data.ts");
const registry = requireModule("data/catalog/removed-from-customer-catalog.json");
const { DEFERRED_VARIANT_PDP_FAMILIES } = requireModule("lib/product-families.ts");

const slugs = new Set(products.map((product) => product.slug));
const cardIds = new Set(listing.canonical.map((card) => card.id));

test("uklonjeni zapisi nisu customer-facing", () => {
  assert.equal(registry.records.length, 21);
  for (const record of registry.records) {
    assert.equal(slugs.has(record.slug), false, `${record.slug} je i dalje u katalogu`);
    assert.equal(cardIds.has(record.slug), false, `${record.slug} je i dalje kartica`);
  }
});

test("svaki uklonjeni zapis ima odredište preusmerenja koje postoji", () => {
  const config = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");
  assert.match(config, /removedFromCustomerCatalog\.records\.map/, "redirecti se grade iz registra");
  const brandRoutes = new Set(data.brands.map((brand) => brand.routes.landing));
  for (const record of registry.records) {
    assert.ok(record.redirect, `${record.slug} nema odredište`);
    const target = record.redirect.startsWith("/proizvodi/")
      ? slugs.has(record.redirect.replace("/proizvodi/", ""))
      : brandRoutes.has(record.redirect);
    assert.ok(target, `odredište ${record.redirect} ne postoji`);
    assert.ok(record.status && record.reason && record.evidence, `${record.slug} nema obrazloženje`);
    // Bez izmišljenog „ukinuto kod proizvođača”: dozvoljena su samo dva dokazana statusa.
    assert.ok(["BUSINESS_OUT_OF_PROGRAMME", "INVALID_MANUAL_RECORD"].includes(record.status));
  }
});

test("zadržano ostaje zadržano: procesni filteri, zaštitna odeća, masking program", () => {
  for (const [group, kept] of Object.entries(registry.keptExplicitly)) {
    if (group === "_comment") continue;
    for (const slug of kept) assert.ok(slugs.has(slug), `${slug} (${group}) je nestao iz kataloga`);
  }
});

test("respiratorni pribor odlazi sa roditeljem, a roditelji su stvarno respiratorni", () => {
  const sata = requireModule("data/sata-catalog-products.generated.json");
  const phase1 = new Map((sata.products ?? []).map((entry) => [entry.slug, entry]));
  const phase2 = new Map((sata.phase2?.products ?? []).map((entry) => [entry.slug, entry]));
  const removed = new Set(registry.records.map((record) => record.slug));

  for (const record of registry.records.filter((entry) => entry.source === "SATA_SYNC_PHASE_1" && entry.reason.includes("respiratorne"))) {
    assert.match(phase1.get(record.slug).sataCategory, /^respiratory-protection\//);
  }
  for (const record of registry.records.filter((entry) => entry.source === "SATA_SYNC_PHASE_2")) {
    assert.equal(phase2.get(record.slug).functionalClass, "RESPIRATOR_AIR_SUPPLY");
  }
  // Nijedan respiratorni dodatak ne sme da ostane kao samostalan proizvod.
  for (const [slug, entry] of phase2) {
    if (entry.functionalClass === "RESPIRATOR_AIR_SUPPLY") assert.ok(removed.has(slug), `${slug} je respiratorni pribor a ostao je u katalogu`);
  }
  // Zaštitna odeća NIJE respiratorna oprema i ostaje.
  for (const [slug, entry] of phase2) {
    if (entry.functionalClass === "PROTECTIVE_CLOTHING") assert.equal(removed.has(slug), false, `${slug} je odeća, ne respirator`);
  }
});

test("nijedna preporuka ne pokazuje na nepostojeći proizvod", () => {
  const dangling = [];
  for (const product of products) {
    for (const slug of product.relatedProductSlugs ?? []) if (!slugs.has(slug)) dangling.push([product.slug, slug]);
    for (const match of JSON.stringify(product.detail ?? {}).matchAll(/"productSlug":"([^"]+)"/g)) {
      if (!slugs.has(match[1])) dangling.push([product.slug, match[1]]);
    }
  }
  assert.deepEqual(dangling, []);
});

test("porodica vodi pravo na PDP; odlaganje mora da ostane opravdano", () => {
  const collections = families.filter((family) => family.presentation === "collection");
  assert.deepEqual(
    collections.map((family) => family.slug).sort(),
    Object.keys(DEFERRED_VARIANT_PDP_FAMILIES).sort(),
    "jedine `collection` porodice su one na spisku odloženih",
  );
  for (const family of collections) {
    const keys = family.variants.map(productVariantKey);
    // Kad ključevi postanu jedinstveni, razlog za odlaganje više ne postoji i unos se briše.
    assert.ok(new Set(keys).size < keys.length, `${family.slug} više nema koliziju ključa — ukloniti ga iz DEFERRED_VARIANT_PDP_FAMILIES`);
    assert.equal(DEFERRED_VARIANT_PDP_FAMILIES[family.slug], "COSMOS_VARIANT_KEY_COLLISION_FOLLOWUP");
  }
});

test("migracija nije uvela nijednu novu koliziju ključa varijante", () => {
  // Zatečeno stanje na `main` 621cbad: 15 sudarajućih parova (kartica, ključ) u celom katalogu.
  const collisions = families.flatMap((family) => {
    const keys = family.variants.map(productVariantKey);
    return keys.length - new Set(keys).size;
  }).reduce((sum, count) => sum + count, 0);
  assert.equal(collisions, 15);
});

test("svaka kartica porodice vodi na family rutu, nijedna na člana", () => {
  for (const card of listing.canonical.filter((entry) => entry.id.startsWith("family:"))) {
    assert.equal(card.href, `/proizvodi/grupa/${card.id.slice("family:".length)}`);
  }
});
