import { test } from "node:test";
import assert from "node:assert/strict";
import { getCatalogListingData } from "@/lib/catalog-listing";
import { productCategorySlugs } from "@/lib/product-taxonomy";

/*
 * Pokrivenost kategorijama se proverava po jedinstvenim proizvodima, ne zbirom rezultata
 * filtera: proizvod u dve kategorije bi zbir povećao, a proizvod bez kategorije ga ne bi
 * smanjio vidljivo (2026-10-15: 1.177 jedinstvenih + 3 bez kategorije, zbir filtera 1.179).
 */
test("svaki proizvod kataloga je u bar jednoj od 12 kategorija", () => {
  const known = new Set<string>(productCategorySlugs);
  const canonical = getCatalogListingData().canonical;
  const none = canonical.filter((entity) => entity.categorySlugs.length === 0).map((entity) => entity.id);
  const unknown = canonical.filter((entity) => entity.categorySlugs.some((slug) => !known.has(slug))).map((entity) => entity.id);
  assert.deepEqual(none, [], `bez kategorije: ${none.join(", ")}`);
  assert.deepEqual(unknown, [], `nepoznata kategorija: ${unknown.join(", ")}`);
});
