import { test } from "node:test";
import assert from "node:assert/strict";
import { brandOf, orderFileName, parseOrderQuantity, suggestQuantity, trendOf } from "./suggest.mjs";

test("brend iz naziva", () => {
  assert.equal(brandOf("CS TECLINE SUNĐER"), "Carsystem");
  assert.equal(brandOf("COS.SPREJ FLAME"), "Cosmos Lac");
  assert.equal(brandOf("RM CHRONOTOP KLAR LAK 1L"), "R-M");
  assert.equal(brandOf("BASLACUNIVERZALHS"), "Baslac");
  assert.equal(brandOf("LEO BRUSNI"), "Befar");
  assert.equal(brandOf("SATAjet 5000"), "SATA");
  assert.equal(brandOf("POSUDA 1L"), "Ostalo");
  assert.equal(brandOf("RM X", "Upisan"), "Upisan");
  assert.equal(brandOf("CSX nešto"), "Ostalo"); // cela reč, ne početak
});

test("predlog: potreba minus lager, naviše na pakovanje", () => {
  // 180 kom za 180 dana = 1/dan; 60 dana pokrivanja = 60; lager 15 → 45; pakovanje 10 → 50
  const r = suggestQuantity({ sold: 180, windowDays: 180, coverDays: 60, stock: 15, unit: "KOM", pack: { quantity: 10, unit: "KOM" } });
  assert.equal(r.suggested, 50);
  assert.equal(r.packs, 5);
});

test("predlog: bez pakovanja ceo broj; LIT sa pakovanjem 4 L", () => {
  assert.equal(suggestQuantity({ sold: 10, windowDays: 180, coverDays: 60, stock: 0, unit: "KOM", pack: null }).suggested, 4);
  const l = suggestQuantity({ sold: 90, windowDays: 180, coverDays: 30, stock: 1, unit: "LIT", pack: { quantity: 4, unit: "LIT" } });
  assert.equal(l.suggested, 16); // 15 − 1 = 14 → 4 kante
  assert.equal(l.packs, 4);
});

test("predlog: dovoljno lagera → 0; negativan lager se računa kao 0; nepoznat lager", () => {
  assert.equal(suggestQuantity({ sold: 30, windowDays: 180, coverDays: 60, stock: 100, unit: "KOM", pack: null }).suggested, 0);
  assert.equal(suggestQuantity({ sold: 180, windowDays: 180, coverDays: 30, stock: -5, unit: "KOM", pack: null }).suggested, 30);
  const u = suggestQuantity({ sold: 180, windowDays: 180, coverDays: 30, stock: null, unit: "KOM", pack: null });
  assert.equal(u.stockKnown, false);
  assert.equal(u.suggested, 30);
});

test("pakovanje u drugoj JM se ne koristi", () => {
  const r = suggestQuantity({ sold: 18, windowDays: 180, coverDays: 60, stock: 0, unit: "LIT", pack: { quantity: 4, unit: "KOM" } });
  assert.equal(r.packs, null);
  assert.equal(r.suggested, 6);
});

test("kretanje prodaje", () => {
  assert.equal(trendOf(13, 10), "raste");
  assert.equal(trendOf(7, 10), "pada");
  assert.equal(trendOf(10, 10), null);
  assert.equal(trendOf(5, 0), "novo");
  assert.equal(trendOf(0, 0), null);
});

test("upisana količina", () => {
  assert.equal(parseOrderQuantity(""), null);
  assert.equal(parseOrderQuantity("12"), 12);
  assert.equal(parseOrderQuantity("2,5"), 2.5);
  assert.ok(Number.isNaN(parseOrderQuantity("-3")));
  assert.ok(Number.isNaN(parseOrderQuantity("abc")));
});

test("naziv fajla", () => {
  assert.equal(orderFileName("R-M", "2026-11-10"), "Porudzbina-R-M-2026-11-10");
  assert.equal(orderFileName("C.A.R.FIT", "2026-11-10"), "Porudzbina-C.A.R.FIT-2026-11-10");
  assert.equal(orderFileName("Šmirgle đ", "2026-11-10"), "Porudzbina-Smirgle-dj-2026-11-10");
});
