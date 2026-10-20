import { test } from "node:test";
import assert from "node:assert/strict";
import overrides from "../../data/catalog/category-overrides.json" with { type: "json" };
import { getCarsystemProductBySlug } from "../carsystem-data";
import { getCatalogListingData } from "../catalog-listing";
import { isProductCategorySlug } from "../productTaxonomy.mjs";

test("svaka ispravka kategorije ima postojeći artikal, važeću kategoriju, razlog i izvor", () => {
  for (const record of overrides.records) {
    assert.ok(getCarsystemProductBySlug(record.slug), `${record.slug} ne postoji`);
    assert.ok(isProductCategorySlug(record.category), `${record.slug}: ${record.category}`);
    assert.ok(record.reason && record.source, `${record.slug} nema razlog ili izvor`);
  }
});

test("katalog prikazuje ispravljenu kategoriju", () => {
  const { canonical } = getCatalogListingData();
  const bySlug = new Map(canonical.map((entity) => [entity.id.replace(/^family:/, ""), entity]));
  for (const record of overrides.records) {
    const entity = bySlug.get(record.slug);
    if (!entity) continue; // član porodice — porodica nosi kategoriju predstavnika
    assert.ok(entity.categorySlugs.includes(record.category), `${record.slug}: ${entity.categorySlugs}`);
  }
});

test("ručni brusni blokovi i podloške za brušenje su u abrazivima, podloške polirke u poliranju", () => {
  const { canonical } = getCatalogListingData();
  for (const entity of canonical) {
    const name = entity.name.toLowerCase();
    if (/sanding block|brusni blok/.test(name)) assert.ok(entity.categorySlugs.includes("abrazivi"), entity.name);
    if (/velcro backing pad|polishing back pad|finish back pad/.test(name)) {
      assert.ok(entity.categorySlugs.includes("poliranje"), entity.name);
    }
  }
});
