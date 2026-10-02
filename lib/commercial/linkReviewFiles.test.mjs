import assert from "node:assert/strict";
import test from "node:test";
import { readReview, registerFromRows, REVIEW_COLUMNS } from "./linkReviewFiles.mjs";

const row = (o) => REVIEW_COLUMNS.map((c) => o[c] ?? "").join(";");
const KEY_A = "0123456789abcdef";
const KEY_B = "fedcba9876543210";
const csv = (...rows) => "﻿" + [REVIEW_COLUMNS.join(";"), ...rows].join("\n") + "\n";

test("šifarnik iz sirovog izvoza: izvorne šifre i blokada", () => {
  const reg = registerFromRows([
    ["Šifra", "Naziv partnera", "PIB / JMBG", "Mesto", "Blokiran"],
    ["28", "QA PRIMER", "100000002", "QA", "False"],
    ["0012", "QA DRUGI", "100000003", null, "True"],
  ]);
  assert.deepEqual(reg.map((r) => [r.code, r.blocked]), [["28", false], ["0012", true]]);
});

test("šifarnik bez potrebne kolone se odbija", () => {
  assert.throws(() => registerFromRows([["Šifra", "Naziv partnera"]]), (e) => e.code === "register_column_missing");
});

test("pregled: odluke i partneri talasa; prazna odluka ostaje prazna", () => {
  const out = readReview(csv(
    row({ kljuc: KEY_A, sifra_na_fakturi: "00028", pib: "100000002", dokumenata: "3", odluka: "potvrdi", potvrdio: "QA Kancelarija" }),
    row({ kljuc: KEY_B, sifra_na_fakturi: "00394", pib: "100000003", dokumenata: "1" }),
  ));
  assert.deepEqual(out.decisions, [
    { key: KEY_A, decision: "potvrdi", confirmedBy: "QA Kancelarija" },
    { key: KEY_B, decision: "", confirmedBy: "" },
  ]);
  assert.deepEqual(out.invoicePartners[0], { code: "00028", pib: "100000002", documents: 3 });
});

test("pregled: izmenjene kolone, nepoznata odluka, potvrda bez imena i ponovljen ključ se odbijaju", () => {
  assert.throws(() => readReview("kljuc;odluka\n"), (e) => e.code === "review_columns");
  assert.throws(() => readReview(csv(row({ kljuc: KEY_A, odluka: "da" }))), (e) => e.code === "review_decision");
  assert.throws(() => readReview(csv(row({ kljuc: KEY_A, odluka: "potvrdi" }))), (e) => e.code === "review_confirmed_by");
  assert.throws(() => readReview(csv(row({ kljuc: KEY_A }), row({ kljuc: KEY_A }))), (e) => e.code === "review_duplicate");
  assert.throws(() => readReview(csv(row({ kljuc: "x" }))), (e) => e.code === "review_key");
});

test("polje sa tačkom-zarezom i navodnicima se čita tačno", () => {
  const out = readReview(csv(row({ kljuc: KEY_A, sifra_na_fakturi: "00028", napomena: '"a; ""b"""' })));
  assert.equal(out.decisions.length, 1);
});
