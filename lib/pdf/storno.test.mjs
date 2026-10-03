import assert from "node:assert/strict";
import test from "node:test";
import { compareStornoToOriginal } from "./storno.mjs";
import { checkLineArithmetic, parseHeader } from "./biznisoftLayout.mjs";

// Sintetičke stavke.
const ORIGINAL = {
  partnerCode: "00042", total: 360,
  lines: [
    { articleCode: "900001", quantity: 2, unitPrice: 100, discountPercent: 0 },
    { articleCode: "900002", quantity: 1, unitPrice: 100, discountPercent: 0 },
  ],
};
const neg = (o) => ({ ...o, total: -o.total, lines: o.lines.map((l) => ({ ...l, quantity: -l.quantity })) });

test("potpun storno: iste stavke, suprotne količine, zbir 0", () => {
  assert.deepEqual(compareStornoToOriginal(neg(ORIGINAL), ORIGINAL), { kind: "full", reasons: [] });
});

test("delimičan storno se NE tretira kao potpun", () => {
  const s = { partnerCode: "00042", total: -120, lines: [{ articleCode: "900002", quantity: -1, unitPrice: 100, discountPercent: 0 }] };
  assert.equal(compareStornoToOriginal(s, ORIGINAL).kind, "partial");
});

test("drugi partner, druga cena, stavka van originala ili veći storno — neslaganje", () => {
  assert.equal(compareStornoToOriginal({ ...neg(ORIGINAL), partnerCode: "00043" }, ORIGINAL).kind, "mismatch");
  const cena = neg(ORIGINAL); cena.lines[0] = { ...cena.lines[0], unitPrice: 90 };
  assert.equal(compareStornoToOriginal(cena, ORIGINAL).kind, "mismatch");
  const vise = neg(ORIGINAL); vise.lines[0] = { ...vise.lines[0], quantity: -3 };
  assert.deepEqual(compareStornoToOriginal(vise, ORIGINAL).reasons, ["reverses_more_than_original"]);
});

test("veza na original se čita samo iz izričite napomene", () => {
  const h = parseHeader("NAPOMENA: Ovim dokumentom se stornira dokument broj 99-RN900000001 od 05.01.2026 godine.");
  assert.equal(h.reversesDocumentNumber.value, "99-RN900000001");
  assert.equal(h.reversesDocumentDate.value, "2026-01-05");
  assert.equal(parseHeader("Račun-otpremnica br. 99-RN900000001").reversesDocumentNumber.status, "missing");
});

test("negativni iznosi se zaokružuju simetrično originalu", () => {
  // Original: 1,5 × 10,00, rabat 12,5 % → neto 13,12, PDV 2,62, bruto 15,74.
  const storno = checkLineArithmetic({ quantity: -1.5, unitPrice: 10, discountPercent: 12.5,
    taxPercent: 20, taxAmount: -2.62, grossAmount: -15.74 });
  assert.deepEqual(storno, { netAmount: -13.12, off: [] });
});
