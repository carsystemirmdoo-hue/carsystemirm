import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  formatOrderNumber,
  formatRequestNumber,
  lineAmounts,
  netUnitPrice,
  orderabilityProblem,
  orderTotals,
  quantityProblem,
  quoteKey,
  transitionProblem,
} from "./orderRules.mjs";

test("iznos: rabat, PDV na stavku, ukupno kao zbir zaokruženih stavki", () => {
  assert.equal(netUnitPrice(3480, 10), 3132);
  assert.equal(netUnitPrice(99.99, 12.5), 87.49);
  assert.deepEqual(lineAmounts({ quantity: 3, netPrice: 3132, vatPercent: 20 }), { net: 9396, vat: 1879.2, gross: 11275.2 });
  const t = orderTotals([
    { quantity: 3, netPrice: 3132, vatPercent: 20 },
    { quantity: 0.5, netPrice: 1.01, vatPercent: 10 },
  ]);
  assert.deepEqual(t, { net: 9396.51, vat: 1879.25, gross: 11275.76 });
});

test("količina: pozitivna, u koraku i ne manja od najmanje", () => {
  assert.equal(quantityProblem("3"), null);
  assert.equal(quantityProblem("2,5", { quantityStep: 0.5 }), null);
  assert.match(quantityProblem("0"), /pozitivan/);
  assert.match(quantityProblem("-2"), /pozitivan/);
  assert.match(quantityProblem("abc"), /pozitivan/);
  assert.match(quantityProblem("1.5"), /koracima od 1/);
  assert.match(quantityProblem("2", { minQuantity: 5 }), /Najmanja/);
  assert.match(quantityProblem("100000"), /Najveća/);
  assert.equal(quantityProblem(0.3, { minQuantity: 0.1, quantityStep: 0.1 }), null, "0,1 + 0,2 ne sme pasti na koraku");
});

test("poručivost: samo potvrđena veza, tačna varijanta i stavka cenovnika", () => {
  const ok = { mapping: { status: "mapped", catalogProductSlug: "x", catalogVariantId: null }, productExists: true, rowVariantKeys: [], priceItem: {} };
  assert.equal(orderabilityProblem(ok), null);
  assert.equal(orderabilityProblem({ ...ok, mapping: { ...ok.mapping, status: "suggested" } }).code, "not_mapped");
  assert.equal(orderabilityProblem({ ...ok, mapping: null }).code, "not_mapped");
  assert.equal(orderabilityProblem({ ...ok, productExists: false }).code, "product_missing");
  assert.equal(orderabilityProblem({ ...ok, rowVariantKeys: ["156.058", "156.059"] }).code, "variant_required");
  assert.equal(
    orderabilityProblem({ ...ok, mapping: { ...ok.mapping, catalogVariantId: "P600" }, rowVariantKeys: ["156.058", "156.059"] }).code,
    "invalid_variant",
    "oznaka varijante se ne pogađa po nazivu",
  );
  assert.equal(orderabilityProblem({ ...ok, mapping: { ...ok.mapping, catalogVariantId: "156.059" }, rowVariantKeys: ["156.058", "156.059"] }), null);
  assert.equal(orderabilityProblem({ ...ok, priceItem: null }).code, "no_price");
  assert.equal(orderabilityProblem({ ...ok, pricingConflict: true }).code, "price_conflict");
});

test("otisak ponude: nezavisan od redosleda, osetljiv na cenu i količinu", () => {
  const a = { articleId: "a", quantity: 2, netPrice: 10, vatPercent: 20 };
  const b = { articleId: "b", quantity: 1, netPrice: 5, vatPercent: 20 };
  assert.equal(quoteKey([a, b]), quoteKey([b, a]));
  assert.notEqual(quoteKey([a, b]), quoteKey([{ ...a, netPrice: 11 }, b]));
  assert.notEqual(quoteKey([a, b]), quoteKey([{ ...a, quantity: 3 }, b]));
});

test("prelazi: ko sme šta, razlog obavezan za izmenu i odbijanje", () => {
  assert.equal(transitionProblem({ from: "submitted", to: "under_review", actor: "office" }), null);
  assert.match(transitionProblem({ from: "submitted", to: "under_review", actor: "customer" }), /ulozi/);
  assert.match(transitionProblem({ from: "submitted", to: "confirmed", actor: "office" }), /nije dozvoljen/, "potvrda tek posle pregleda");
  assert.match(transitionProblem({ from: "under_review", to: "rejected", actor: "office", reason: "" }), /Razlog/);
  assert.equal(transitionProblem({ from: "under_review", to: "rejected", actor: "office", reason: "Artikal ukinut" }), null);
  assert.match(transitionProblem({ from: "under_review", to: "cancelled", actor: "customer" }), /nije dozvoljen/, "kupac ne otkazuje zahtev u obradi");
  assert.match(transitionProblem({ from: "confirmed", to: "cancelled", actor: "customer" }), /nije dozvoljen/);
});

test("brojevi: zahtev i porudžbina imaju različite, prepoznatljive oznake", () => {
  assert.equal(formatRequestNumber(2026, 7), "Z-2026-00007");
  assert.equal(formatOrderNumber(2026, 7), "P-2026-00007");
});

test("cena nikad iz fakture: modul ne čita istorijske cene", async () => {
  for (const f of ["./orderRules.mjs", "./ordering-service.ts"]) {
    const source = await readFile(new URL(f, import.meta.url), "utf8");
    assert.doesNotMatch(source, /invoice_lines|invoiceLines|unit_price|unitPrice/, `${f} ne sme čitati fakturisane cene`);
  }
});

test("izmena: kupac vraća zahtev na ispravku; kancelarija to ne može umesto njega", () => {
  assert.equal(transitionProblem({ from: "changes_requested", to: "superseded", actor: "customer" }), null);
  assert.match(transitionProblem({ from: "changes_requested", to: "superseded", actor: "office" }), /ulozi/);
  assert.match(transitionProblem({ from: "submitted", to: "superseded", actor: "customer" }), /nije dozvoljen/, "samo kada kancelarija traži izmenu");
  assert.match(transitionProblem({ from: "superseded", to: "submitted", actor: "customer" }), /nije dozvoljen/, "stari zahtev se ne oživljava");
});
