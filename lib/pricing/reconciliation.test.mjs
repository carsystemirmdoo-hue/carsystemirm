import assert from "node:assert/strict";
import test from "node:test";
import {
  isDirectlyProvable,
  isWithinValidity,
  lineMatchesRule,
  netUnitPrice,
  reconcileRule,
} from "./reconciliation.mjs";

const line = (over = {}) => ({
  invoiceId: "inv-1",
  invoiceLineId: "line-1",
  issuedOn: "2026-03-10",
  unitPrice: 100,
  discountPercent: 10,
  ...over,
});

const rule = (over = {}) => ({
  customerScope: "customer",
  productScope: "article",
  valueKind: "discount_percent",
  discountPercent: 10,
  netPrice: null,
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  ...over,
});

test("samo par (jedan kupac, jedan artikal) je dokaziv jednom stavkom", () => {
  assert.equal(isDirectlyProvable(rule()), true);
  for (const scope of [
    { customerScope: "group" },
    { customerScope: "all" },
    { productScope: "product_group" },
    { productScope: "brand" },
    { productScope: "all" },
  ]) {
    assert.equal(
      isDirectlyProvable(rule(scope)),
      false,
      `opseg ${JSON.stringify(scope)} je proglasen dokazivim`,
    );
  }
});

test("siri opseg ne moze zavrsiti u confirmed, nego na rucnom pregledu", () => {
  const out = reconcileRule({ rule: rule({ customerScope: "group" }), lines: [line()] });
  assert.equal(out.outcome, "not_applicable");
  assert.equal(out.evidence, null);
});

test("popust se poredi sa tolerancijom zaokruzivanja, ne na dlaku", () => {
  assert.equal(lineMatchesRule(rule(), line({ discountPercent: 10.0005 })), true);
  assert.equal(lineMatchesRule(rule(), line({ discountPercent: 10.5 })), false);
});

test("neto cena se izvodi iz cene i popusta sa stavke", () => {
  assert.equal(netUnitPrice({ unitPrice: 100, discountPercent: 10 }), 90);
  assert.equal(netUnitPrice({ unitPrice: 123.45, discountPercent: 7.5 }), 114.1913);
});

test("pravilo na neto cenu poredi izvedenu cenu, ne bruto", () => {
  const r = rule({ valueKind: "net_price", discountPercent: null, netPrice: 90 });
  assert.equal(lineMatchesRule(r, line()), true);
  assert.equal(lineMatchesRule(r, line({ unitPrice: 100, discountPercent: 0 })), false);
});

test("pravilo bez vrednosti se ne potvrdjuje ni za jednu stavku", () => {
  assert.equal(lineMatchesRule(rule({ discountPercent: null }), line()), false);
  assert.equal(
    lineMatchesRule(rule({ valueKind: "net_price", netPrice: null }), line()),
    false,
  );
});

test("nepoznata vrsta vrednosti nije potvrda", () => {
  assert.equal(lineMatchesRule(rule({ valueKind: "bonus_kartica" }), line()), false);
});

test("granice vazenja su ukljucene na oba kraja", () => {
  const r = rule({ effectiveFrom: "2026-03-01", effectiveTo: "2026-03-31" });
  assert.equal(isWithinValidity(r, "2026-03-01"), true);
  assert.equal(isWithinValidity(r, "2026-03-31"), true);
  assert.equal(isWithinValidity(r, "2026-02-28"), false);
  assert.equal(isWithinValidity(r, "2026-04-01"), false);
});

test("stavka van perioda vazenja ne potvrdjuje pravilo", () => {
  const out = reconcileRule({
    rule: rule({ effectiveFrom: "2026-06-01" }),
    lines: [line({ issuedOn: "2026-03-10" })],
  });
  assert.equal(out.outcome, "no_evidence_yet");
});

test("bez ijedne stavke ishod je 'jos nema dokaza', ne neuspeh", () => {
  const out = reconcileRule({ rule: rule(), lines: [] });
  assert.equal(out.outcome, "no_evidence_yet");
});

test("stavke postoje ali nijedna ne nosi uslov — neuspelo usaglasavanje", () => {
  const out = reconcileRule({
    rule: rule(),
    lines: [line({ discountPercent: 0 }), line({ discountPercent: 5 })],
  });
  assert.equal(out.outcome, "failed");
  assert.equal(out.evidence, null);
});

test("poruka o neuspehu ne sadrzi nijedan iznos", () => {
  const out = reconcileRule({
    rule: rule({ valueKind: "net_price", discountPercent: null, netPrice: 90 }),
    lines: [line({ unitPrice: 777.77, discountPercent: 0 })],
  });
  assert.equal(out.outcome, "failed");
  assert.ok(!out.detail.includes("777"), "iznos je iscureo u poruku");
  assert.ok(!out.detail.includes("90"), "iznos je iscureo u poruku");
});

test("dokaz je NAJSTARIJA stavka koja se poklapa", () => {
  const out = reconcileRule({
    rule: rule(),
    lines: [
      line({ invoiceLineId: "novija", issuedOn: "2026-05-01" }),
      line({ invoiceLineId: "starija", issuedOn: "2026-02-01" }),
    ],
  });
  assert.equal(out.outcome, "confirmed");
  assert.equal(out.evidence.invoiceLineId, "starija");
});

test("potvrda uvek nosi konkretnu stavku kao dokaz", () => {
  const out = reconcileRule({ rule: rule(), lines: [line()] });
  assert.equal(out.outcome, "confirmed");
  assert.ok(out.evidence.invoiceId, "potvrda bez fakture");
  assert.ok(out.evidence.invoiceLineId, "potvrda bez stavke");
});
