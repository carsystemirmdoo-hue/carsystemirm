import assert from "node:assert/strict";
import test from "node:test";
import { applicationReason, evaluateArticle } from "./rebateApplication.mjs";

const AS_OF = "2026-10-07";
const inv = (i, percent, date) => ({ invoiceId: `f${i}`, documentLabel: `${i}/2026`, issuedOn: date, discountPercent: percent, lineNumber: 1 });

test("dosledan rabat na poslednje 3 fakture u različitim danima i rasponu ≥ 30 dana → pravilo", () => {
  const r = evaluateArticle([inv(1, 40, "2026-03-01"), inv(2, 40, "2026-05-01"), inv(3, 40, "2026-08-01")], { asOf: AS_OF });
  assert.equal(r.outcome, "primeni");
  assert.equal(r.percent, 40);
  assert.equal(r.changedFrom, null);
});

test("poslednja pojedinačna kupovina nije dokaz", () => {
  assert.equal(evaluateArticle([inv(1, 40, "2026-08-01")], { asOf: AS_OF }).outcome, "jednokratno");
  const r = evaluateArticle([inv(1, 38, "2026-01-01"), inv(2, 38, "2026-03-01"), inv(3, 38, "2026-05-01"), inv(4, 40, "2026-08-01")], { asOf: AS_OF });
  assert.equal(r.outcome, "nejasno");
});

test("jasna ponovljena promena: noviji dosledan rabat, sa prethodnom vrednošću", () => {
  const r = evaluateArticle(
    [inv(1, 35, "2025-01-01"), inv(2, 35, "2025-03-01"), inv(3, 35, "2025-05-01"), inv(4, 40, "2026-02-01"), inv(5, 40, "2026-04-01"), inv(6, 40, "2026-07-01")],
    { asOf: AS_OF },
  );
  assert.equal(r.outcome, "primeni");
  assert.equal(r.percent, 40);
  assert.equal(r.changedFrom, 35);
  assert.match(r.reason, /35 % → 40 %/);
});

test("protivrečne vrednosti na istoj fakturi se ne primenjuju", () => {
  const lines = [inv(1, 40, "2026-03-01"), inv(2, 40, "2026-05-01"), inv(3, 40, "2026-08-01"), { ...inv(3, 30, "2026-08-01"), lineNumber: 2 }];
  assert.equal(evaluateArticle(lines, { asOf: AS_OF }).outcome, "nejasno");
});

test("visok rabat, kratak period, zastarelo i bez rabata nisu pravila", () => {
  assert.equal(evaluateArticle([inv(1, 55, "2026-03-01"), inv(2, 55, "2026-05-01"), inv(3, 55, "2026-08-01")], { asOf: AS_OF }).outcome, "visok_rabat");
  assert.equal(evaluateArticle([inv(1, 40, "2026-08-01"), inv(2, 40, "2026-08-05"), inv(3, 40, "2026-08-09")], { asOf: AS_OF }).outcome, "kratko");
  assert.equal(evaluateArticle([inv(1, 40, "2023-01-01"), inv(2, 40, "2023-03-01"), inv(3, 40, "2023-05-01")], { asOf: AS_OF }).outcome, "zastarelo");
  assert.equal(evaluateArticle([inv(1, 0, "2026-03-01"), inv(2, 0, "2026-05-01"), inv(3, 0, "2026-08-01")], { asOf: AS_OF }).outcome, "bez_rabata");
});

test("odobreno pravilo sa drugom vrednošću se ne prepisuje — sukob", () => {
  const lines = [inv(1, 40, "2026-03-01"), inv(2, 40, "2026-05-01"), inv(3, 40, "2026-08-01")];
  assert.equal(evaluateArticle(lines, { asOf: AS_OF, existing: [{ status: "confirmed", discountPercent: 35, approved: true }] }).outcome, "sukob");
  assert.equal(evaluateArticle(lines, { asOf: AS_OF, existing: [{ status: "approved_pending_biznisoft", discountPercent: 40, approved: true }] }).outcome, "vec_vazi");
  assert.equal(evaluateArticle(lines, { asOf: AS_OF, existing: [{ status: "pending_approval", discountPercent: 40, approved: false }] }).outcome, "vec_predlozeno");
});

test("obrazloženje nosi kriterijum, fakture, prethodnu i novu vrednost i autorizaciju", () => {
  const r = evaluateArticle([inv(1, 40, "2026-03-01"), inv(2, 40, "2026-05-01"), inv(3, 40, "2026-08-01")], { asOf: AS_OF });
  const t = applicationReason(r, { previousRule: null, authorization: "vlasnik naloga, chat 2026-10-07" });
  assert.match(t, /rabati-v1-2026-10-07/);
  assert.match(t, /1\/2026 \(2026-03-01\)/);
  assert.match(t, /Prethodno pravilo: nije postojalo/);
  assert.match(t, /Nova vrednost: 40 %/);
  assert.match(t, /nije upisano u BizniSoft/);
  assert.match(t, /vlasnik naloga, chat 2026-10-07/);
});
