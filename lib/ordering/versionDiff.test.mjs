import { test } from "node:test";
import assert from "node:assert/strict";
import { versionDiff } from "./versionDiff.mjs";

const line = (articleId, quantity, netPrice = 100, priceStatus = "cena") => ({ articleId, articleCode: articleId, articleName: articleId, unit: "KOM", quantity, netPrice, priceStatus });

test("dodato, uklonjeno, količina i cena", () => {
  const d = versionDiff([line("a", 3), line("b", 3), line("c", 1, 50)], [line("a", 2), line("c", 1, 40), line("d", 5)]);
  assert.deepEqual(d.changed.a, { quantityFrom: 3 });
  assert.deepEqual(d.changed.c, { priceFrom: 50 });
  assert.deepEqual(d.changed.d, { added: true });
  assert.deepEqual(d.removed.map((l) => l.articleId), ["b"]);
  assert.equal(d.count, 4);
});

test("prelaz na upit → sa cenom se prikazuje kao promena statusa, ne cene", () => {
  const d = versionDiff([line("a", 1, null, "na_upit")], [line("a", 1, 120, "cena")]);
  assert.deepEqual(d.changed.a, { statusFrom: "na_upit" });
});

test("iste verzije nemaju razlike", () => {
  const d = versionDiff([line("a", 1)], [line("a", 1)]);
  assert.equal(d.count, 0);
});
