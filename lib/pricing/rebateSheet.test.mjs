import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePricing } from "./precedence.mjs";
import {
  evaluateEdit,
  noticeRecipients,
  parseAmountCents,
  parsePercent,
  planReplacement,
  priceFromRabat,
  rabatFromPrice,
  validatePeriod,
  withNewArticleDefault,
} from "./rebateSheet.mjs";

test("unos: iznos i procenat u srpskom zapisu", () => {
  assert.equal(parseAmountCents("1.793,60"), 179360);
  assert.equal(parseAmountCents("1793,6"), 179360);
  assert.equal(parseAmountCents("1793.60"), 179360);
  assert.equal(parseAmountCents(""), null);
  assert.ok(Number.isNaN(parseAmountCents("12a")));
  assert.equal(parsePercent("22,5"), 22.5);
  assert.equal(parsePercent("19,872 %"), 19.872);
  assert.ok(Number.isNaN(parsePercent("19,8718")), "najviše 3 decimale, kao rabat u BizniSoftu");
  assert.equal(parsePercent(" "), null);
});

test("rabat → cena: VP × (1 − rabat), zaokruženo kao BizniSoft", () => {
  assert.equal(priceFromRabat(236000, 24), 179360);
  assert.equal(priceFromRabat(3800, 28), 2736);
  assert.equal(priceFromRabat(null, 20), null);
  assert.equal(priceFromRabat(0, 20), null);
});

test("cena → rabat: najmanje decimala koje daju tačnu cenu, i nazad ista cena", () => {
  assert.deepEqual(rabatFromPrice(236000, 179360), { ok: true, percent: 24, exact: true, priceCents: 179360 });
  // 3.120,00 → 2.500,00 traži rabat 19,8718 %; sa 3 decimale (kao u BizniSoftu) tačna cena ne postoji.
  const r = rabatFromPrice(312000, 250000);
  assert.ok(r.ok && !r.exact, "uneta cena se ne može tačno dobiti — prikazuje se najbliža");
  assert.equal(r.percent, 19.872);
  assert.equal(r.priceCents, 249999);
  assert.deepEqual(rabatFromPrice(312000, 249999), { ok: true, percent: 19.872, exact: true, priceCents: 249999 });
  let exact = 0;
  let inexact = 0;
  for (let i = 0; i < 20000; i++) {
    const base = 100 + Math.floor(Math.random() * 5_000_000);
    const typed = Math.floor(Math.random() * base);
    const x = rabatFromPrice(base, typed);
    assert.ok(x.ok);
    assert.equal(priceFromRabat(base, x.percent), x.priceCents, "prikazana cena je uvek ona koja sledi iz sačuvanog rabata");
    if (x.exact) {
      assert.equal(x.priceCents, typed);
      exact++;
    } else inexact++;
  }
  assert.ok(exact > 0 && exact + inexact === 20000);
});

test("cena bez VP, VP 0 i cena iznad VP se odbijaju", () => {
  assert.deepEqual(rabatFromPrice(null, 100), { ok: false, reason: "nema_vp" });
  assert.deepEqual(rabatFromPrice(0, 100), { ok: false, reason: "nema_vp" });
  assert.deepEqual(rabatFromPrice(1000, 1200), { ok: false, reason: "iznad_vp" });
  assert.equal(evaluateEdit({ field: "c", value: "10,00" }, null).ok, false);
});

test("prazan unos posebnog dogovora traži izričit rabat", () => {
  const e = evaluateEdit({ field: "r", value: "" }, 100000, { replacesArticleAgreement: true });
  assert.equal(e.ok, false);
  assert.match(e.error, /ne vraća sam/);
  assert.equal(evaluateEdit({ field: "r", value: "120" }, 100000).ok, false);
  assert.equal(evaluateEdit({ field: "r", value: "0" }, 100000).ok, true);
  assert.equal(evaluateEdit({ field: "r", value: "100" }, 100000).ok, true);
});

test("period: od sada, od datuma, akcija sa krajem", () => {
  const today = "2026-10-16";
  assert.deepEqual(validatePeriod({ kind: "sada" }, today), { ok: true, kind: "redovni", from: today, to: null });
  assert.equal(validatePeriod({ kind: "datum", from: "2026-10-01" }, today).ok, false);
  assert.equal(validatePeriod({ kind: "akcija", from: "2026-11-01" }, today).ok, false);
  assert.equal(validatePeriod({ kind: "akcija", from: "2026-11-01", to: "2026-10-31" }, today).ok, false);
  assert.deepEqual(validatePeriod({ kind: "akcija", from: "2026-11-01", to: "2026-12-31" }, today), { ok: true, kind: "akcija", from: "2026-11-01", to: "2026-12-31" });
});

test("zamena redovnog rabata: prethodni se zatvara dan ranije, budući se opoziva, akcija ostaje", () => {
  const existing = [
    { id: "r1", ruleKind: "redovni", effectiveFrom: "2026-01-01", effectiveTo: null },
    { id: "r2", ruleKind: "redovni", effectiveFrom: "2026-11-01", effectiveTo: null },
    { id: "a1", ruleKind: "akcija", effectiveFrom: "2026-10-01", effectiveTo: "2026-12-31" },
    { id: "r0", ruleKind: "redovni", effectiveFrom: "2025-01-01", effectiveTo: "2025-12-31" },
  ];
  const p = planReplacement(existing, "redovni", "2026-10-16", null, false);
  assert.deepEqual(p, { ok: true, changes: [{ id: "r1", action: "close", effectiveTo: "2026-10-15" }, { id: "r2", action: "revoke" }] });
});

test("zamena akcije: bez potvrde nema čuvanja; uz potvrdu stara se skraćuje do dana pre nove", () => {
  const existing = [
    { id: "r1", ruleKind: "redovni", effectiveFrom: "2026-01-01", effectiveTo: null },
    { id: "a1", ruleKind: "akcija", effectiveFrom: "2026-10-01", effectiveTo: "2026-12-31" },
    { id: "a2", ruleKind: "akcija", effectiveFrom: "2026-11-10", effectiveTo: "2026-11-20" },
  ];
  const blocked = planReplacement(existing, "akcija", "2026-11-01", "2026-11-30", false);
  assert.equal(blocked.ok, false);
  assert.deepEqual(blocked.conflicts.map((c) => c.id), ["a1", "a2"]);
  const ok = planReplacement(existing, "akcija", "2026-11-01", "2026-11-30", true);
  assert.deepEqual(ok, { ok: true, changes: [{ id: "a1", action: "close", effectiveTo: "2026-10-31" }, { id: "a2", action: "revoke" }] });
});

const rule = (o) => ({ customerScope: "customer", customerId: "k1", productScope: "article", articleId: "a1", valueKind: "discount_percent", effectiveFrom: "2026-01-01", effectiveTo: null, paymentCondition: "odlozeno_30", ruleKind: "redovni", ...o });
const ctx = (onDate) => ({ customerId: "k1", articleId: "a1", onDate, paymentCondition: "odlozeno_30" });

test("akcija pobeđuje redovni istog opsega dok važi; posle isteka sam se vraća redovni", () => {
  const rules = [rule({ id: "r", discountPercent: "24" }), rule({ id: "a", discountPercent: "29", ruleKind: "akcija", effectiveFrom: "2026-10-01", effectiveTo: "2026-12-31" })];
  const during = evaluatePricing(rules, ctx("2026-11-15"));
  assert.equal(during.winner.id, "a");
  assert.deepEqual(during.pausedRegular.map((r) => r.id), ["r"]);
  assert.equal(evaluatePricing(rules, ctx("2027-01-01")).winner.id, "r");
  assert.equal(evaluatePricing(rules, ctx("2026-09-30")).winner.id, "r");
});

test("dve akcije istog dana su konflikt; bez akcije dva redovna takođe", () => {
  const two = [rule({ id: "a", discountPercent: "29", ruleKind: "akcija", effectiveTo: "2026-12-31" }), rule({ id: "b", discountPercent: "30", ruleKind: "akcija", effectiveTo: "2026-12-31" })];
  assert.equal(evaluatePricing(two, ctx("2026-11-01")).conflict.length, 2);
  const regs = [rule({ id: "r1", discountPercent: "20" }), rule({ id: "r2", discountPercent: "21" })];
  assert.equal(evaluatePricing(regs, ctx("2026-11-01")).conflict.length, 2);
});

test("nov artikal: 30 % kada nema pravila za artikal; izričit dogovor za artikal se ne prepisuje", () => {
  const base = rule({ id: "osn", productScope: "all", articleId: undefined, discountPercent: "18", paymentCondition: null });
  const d = withNewArticleDefault(evaluatePricing([base], ctx("2026-11-01")), 30);
  assert.equal(d.newArticleDefault, true);
  assert.equal(d.winner.discountPercent, "30");
  const explicit = rule({ id: "art", discountPercent: "27", paymentCondition: "avans" });
  const avans = { ...ctx("2026-11-01"), paymentCondition: "avans" };
  const kept = withNewArticleDefault(evaluatePricing([base, explicit], avans), 30);
  assert.equal(kept.winner.id, "art");
  assert.equal(withNewArticleDefault(evaluatePricing([], ctx("2026-11-01")), 30).winner.discountPercent, "30");
  assert.equal(withNewArticleDefault(evaluatePricing([], ctx("2026-11-01")), null).winner, null);
});

test("obaveštenja: komercijalista → gazde; gazda → dodeljeni komercijalisti; bez dodele → niko", () => {
  const owners = [{ id: "g1" }, { id: "g2" }];
  assert.deepEqual(noticeRecipients({ id: "m", role: "komercijalista" }, owners, [{ id: "m" }]), ["g1", "g2"]);
  assert.deepEqual(noticeRecipients({ id: "g1", role: "gazda" }, owners, [{ id: "m" }, { id: "j" }]), ["m", "j"]);
  assert.deepEqual(noticeRecipients({ id: "g1", role: "gazda" }, owners, []), []);
  assert.deepEqual(noticeRecipients({ id: "t", role: "kancelarija" }, owners, [{ id: "m" }]), []);
});
