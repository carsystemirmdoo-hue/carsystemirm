import assert from "node:assert/strict";
import test from "node:test";
import { buildPartnerRegister, confirmInvoicePartner, numericPartnerKey } from "./partnerRegisterMatch.mjs";
import { isSamePartnerCode } from "./externalIdentity.mjs";

// Sintetički šifarnik: šifre bez vodećih nula, kao u izvozu BizniSoft-a.
const REGISTER = buildPartnerRegister([
  { code: "28", pib: "100000002" },
  { code: "394", pib: "100000003" },
  { code: "500", pib: "" },
]);

test("ključ: samo cifre, bez vodećih nula; nula ostaje nula", () => {
  assert.equal(numericPartnerKey("00028"), "28");
  assert.equal(numericPartnerKey("28"), "28");
  assert.equal(numericPartnerKey("00000"), "0");
  assert.equal(numericPartnerKey("A28"), null);
  assert.equal(numericPartnerKey(""), null);
});

test("šifra sa nulama sa fakture + isti PIB = potvrđeno; izvorne vrednosti se čuvaju", () => {
  const r = confirmInvoicePartner({ code: "00028", pib: "100000002" }, REGISTER);
  assert.equal(r.status, "confirmed");
  assert.equal(r.invoiceCode, "00028");
  assert.equal(r.registerCode, "28");
  assert.equal(r.matchedBy, "numeric_key");
});

test("ista šifra, drugi PIB — nije potvrđeno", () => {
  assert.equal(confirmInvoicePartner({ code: "00028", pib: "100000003" }, REGISTER).status, "pib_mismatch");
});

test("PIB nije ključ: poznat PIB pod nepoznatom šifrom se ne spaja", () => {
  assert.equal(confirmInvoicePartner({ code: "00999", pib: "100000002" }, REGISTER).status, "not_in_register");
});

test("bez PIB-a u šifarniku ili na fakturi — ručni pregled", () => {
  assert.equal(confirmInvoicePartner({ code: "00500", pib: "100000009" }, REGISTER).status, "register_pib_missing");
  assert.equal(confirmInvoicePartner({ code: "00394", pib: null }, REGISTER).status, "invoice_pib_missing");
});

test("kolizija posle uklanjanja nula se ne razrešava — ni tačnim poklapanjem", () => {
  const sudar = buildPartnerRegister([{ code: "028", pib: "100000002" }, { code: "28", pib: "100000002" }]);
  assert.equal(sudar.collisions, 1);
  assert.equal(confirmInvoicePartner({ code: "00028", pib: "100000002" }, sudar).status, "ambiguous_code");
  assert.equal(confirmInvoicePartner({ code: "028", pib: "100000002" }, sudar).status, "ambiguous_code");
});

test("šifra sa slovima se poredi samo tačno", () => {
  const reg = buildPartnerRegister([{ code: "K28", pib: "100000002" }]);
  assert.equal(confirmInvoicePartner({ code: "K28", pib: "100000002" }, reg).status, "confirmed");
  assert.equal(confirmInvoicePartner({ code: "k28", pib: "100000002" }, reg).status, "not_in_register");
});

test("opšte pravilo tačne šifre ostaje netaknuto", () => {
  assert.equal(isSamePartnerCode("0012", "12"), false);
});

test("oblik sa fakture: 5 cifara, samo kada je ključ jedinstven u šifarniku", async () => {
  const { invoiceFormPartnerCode } = await import("./partnerRegisterMatch.mjs");
  assert.equal(invoiceFormPartnerCode("28", REGISTER), "00028");
  assert.equal(invoiceFormPartnerCode("394", REGISTER), "00394");
  const sudar = buildPartnerRegister([{ code: "0012", pib: "1" }, { code: "12", pib: "2" }]);
  assert.equal(invoiceFormPartnerCode("12", sudar), null);
  assert.equal(invoiceFormPartnerCode("0012", sudar), null);
  assert.equal(invoiceFormPartnerCode("K28", REGISTER), null);
  assert.equal(invoiceFormPartnerCode("123456", buildPartnerRegister([{ code: "123456", pib: "1" }])), null);
  // Šifra sa fakture se onda potvrđuje istim pravilom kao u alatu za vezu.
  assert.equal(confirmInvoicePartner({ code: invoiceFormPartnerCode("28", REGISTER), pib: "100000002" }, REGISTER).status, "confirmed");
});
