import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyDocument,
  invoiceIdentity,
  isValidPib,
  parseDate,
  parseNumber,
  validateInvoiceRow,
} from "./invoiceRow.mjs";

const ISPRAVAN = {
  pib: "108234560",
  kupac: "Primer Boje Šabac",
  broj_dokumenta: "2026-1841",
  datum: "31.07.2026",
  vrsta_dokumenta: "Faktura",
  sifra_artikla: "40-204",
  naziv_artikla: "RM Onyx HS bezbojni lak 5L",
  komercijalista: "Petar Primerović",
  kolicina: "4",
  cena: "9800",
  iznos_stavke: "39200",
};

test("ispravan red prolazi bez primedbi", () => {
  const result = validateInvoiceRow(ISPRAVAN, 1);
  assert.equal(result.status, "ispravan");
  assert.equal(result.problems.length, 0);
  assert.equal(result.value.quantity, 4);
  assert.equal(result.value.lineAmount, 39200);
  assert.equal(result.value.year, 2026);
  assert.equal(result.value.issuedOn, "2026-07-31");
});

test("nepostojeći datum se odbija umesto da se ispravi", () => {
  assert.equal(parseDate("31.02.2026"), null);
  assert.equal(parseDate("32.01.2026"), null);
  assert.equal(parseDate("01.13.2026"), null);
  const result = validateInvoiceRow({ ...ISPRAVAN, datum: "31.02.2026" }, 204);
  assert.equal(result.status, "neispravan");
  assert.equal(result.value, null);
  assert.ok(result.problems.some((p) => p.field === "datum"));
});

test("neispravan PIB obara red", () => {
  assert.ok(isValidPib("108234560"));
  assert.ok(!isValidPib("9041"));
  assert.ok(!isValidPib(""));
  const result = validateInvoiceRow({ ...ISPRAVAN, pib: "90412" }, 118);
  assert.equal(result.status, "neispravan");
  assert.ok(result.problems.some((p) => p.field === "pib"));
});

test("srpski i engleski zapis broja se čitaju isto", () => {
  assert.equal(parseNumber("1.234,56"), 1234.56);
  assert.equal(parseNumber("1234.56"), 1234.56);
  assert.equal(parseNumber("-39.200,00"), -39200);
  assert.equal(parseNumber("(1.200)"), -1200);
  assert.equal(parseNumber(""), null);
  assert.equal(parseNumber("nije broj"), null);
});

test("negativna stavka se čuva, ne pretvara u pozitivnu", () => {
  const result = validateInvoiceRow(
    { ...ISPRAVAN, vrsta_dokumenta: "Povrat robe", kolicina: "-4", iznos_stavke: "-39200" },
    1,
  );
  assert.equal(result.status, "ispravan");
  assert.equal(result.value.quantity, -4);
  assert.equal(result.value.lineAmount, -39200);
  assert.equal(result.value.documentKind, "povrat_robe");
});

test("neslaganje znaka količine i iznosa je greška", () => {
  const result = validateInvoiceRow(
    { ...ISPRAVAN, kolicina: "-4", iznos_stavke: "39200" },
    1,
  );
  assert.equal(result.status, "neispravan");
  assert.ok(result.problems.some((p) => p.field === "iznos_stavke"));
});

test("vrsta dokumenta se prepoznaje iz izvora", () => {
  assert.equal(classifyDocument("Faktura").kind, "faktura");
  assert.equal(classifyDocument("Povrat robe").kind, "povrat_robe");
  assert.equal(classifyDocument("Storno").kind, "storno");
  assert.equal(classifyDocument("Knjižno odobrenje").kind, "knjizno_odobrenje");
  assert.equal(classifyDocument("korekcija_cene").kind, "korekcija_cene");
});

test("nepoznata vrsta se ne pogađa", () => {
  const doc = classifyDocument("XYZ-17");
  assert.equal(doc.kind, "nepoznato");
  assert.equal(doc.known, false);
  // Izvorna oznaka se čuva da bi knjigovodstvo moglo da je razreši.
  assert.equal(doc.source, "XYZ-17");
});

test("negativan dokument bez vrste prolazi uz upozorenje, ne kao povrat", () => {
  const result = validateInvoiceRow(
    { ...ISPRAVAN, vrsta_dokumenta: "", kolicina: "-2", iznos_stavke: "-7600" },
    114,
  );
  assert.equal(result.status, "upozorenje");
  assert.equal(result.value.documentKind, "nepoznato");
  assert.equal(result.value.documentKindKnown, false);
  assert.ok(result.problems.some((p) => p.field === "vrsta_dokumenta"));
});

test("identitet fakture ne zavisi od pozicije u fajlu", () => {
  const a = invoiceIdentity({
    companyId: "carsystem",
    documentKind: "faktura",
    number: "2026-1841",
    year: 2026,
  });
  const b = invoiceIdentity({
    companyId: "CARSYSTEM",
    documentKind: "faktura",
    number: "2026-1841",
    year: 2026,
  });
  assert.equal(a, b);

  // Različita godina ili vrsta = drugi dokument.
  assert.notEqual(
    a,
    invoiceIdentity({
      companyId: "carsystem",
      documentKind: "faktura",
      number: "2026-1841",
      year: 2025,
    }),
  );
  assert.notEqual(
    a,
    invoiceIdentity({
      companyId: "carsystem",
      documentKind: "storno",
      number: "2026-1841",
      year: 2026,
    }),
  );
});

test("iznos koji ne odgovara količini i ceni daje upozorenje, ne odbacivanje", () => {
  const result = validateInvoiceRow({ ...ISPRAVAN, iznos_stavke: "40400" }, 318);
  assert.equal(result.status, "upozorenje");
  assert.ok(result.value !== null);
});

test("rabat se uračunava u očekivani iznos", () => {
  const result = validateInvoiceRow(
    { ...ISPRAVAN, rabat: "10", iznos_stavke: "35280" },
    1,
  );
  assert.equal(result.status, "ispravan");
  assert.equal(result.value.discountPercent, 10);
});

test("nedostatak komercijaliste je upozorenje, ne greška", () => {
  const result = validateInvoiceRow({ ...ISPRAVAN, komercijalista: "" }, 1);
  assert.equal(result.status, "upozorenje");
  assert.ok(result.value !== null);
});
