import assert from "node:assert/strict";
import test from "node:test";

import { brandAliasSearch } from "./legacy-query-aliases.mjs";

const run = (pathname, query) => brandAliasSearch(pathname, new URLSearchParams(query));

test("?brand= na katalogu vodi na isti URL sa ?brend=", () => {
  assert.equal(run("/katalog", "brand=carfit"), "brend=carfit");
  assert.equal(run("/katalog/strana/3", "brand=sata&q=crevo"), "q=crevo&brend=sata");
  assert.equal(run("/katalozi", "brand=baslac"), "brend=baslac");
});

test("kanonski ?brend= ima prednost i brand se uklanja", () => {
  assert.equal(run("/katalog", "brend=rm&brand=sata"), "brend=rm");
});

test("bez aliasa ili van filtera kataloga nema preusmerenja (nema petlje)", () => {
  assert.equal(run("/katalog", "brend=carfit"), null);
  assert.equal(run("/katalog", ""), null);
  assert.equal(run("/proizvodi/carfit-clearcoat-matt", "brand=carfit"), null);
  // Rezultat preusmerenja više nema `brand`, pa drugi zahtev ne preusmerava ponovo.
  assert.equal(run("/katalog", run("/katalog", "brand=carfit")), null);
});
