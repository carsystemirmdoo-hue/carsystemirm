import assert from "node:assert/strict";
import test from "node:test";
import { unitNetCents } from "./money.mjs";
import { groupKeysFor, netCentsFor, parseAmount, parsePercent, planChanges, rebateForNet } from "./rebateTable.mjs";

test("brend i grupa iz naziva; potvrđen brend ima prednost", () => {
  assert.deepEqual(groupKeysFor({ name: "CS P19 KRUŽNA ŠMIRGLA 150MM P400" }), { brand: "CS", group: "CS P19" });
  assert.deepEqual(groupKeysFor({ name: "BASLAC 35-M218 1L BASECOAT" }), { brand: "BASLAC", group: "BASLAC 35-M" });
  assert.deepEqual(groupKeysFor({ name: "R-M ONYX HD HB110" }), { brand: "R-M", group: "R-M ONYX" });
  assert.deepEqual(groupKeysFor({ name: "X" }), { brand: "OSTALO", group: "OSTALO" });
  assert.deepEqual(groupKeysFor({ name: "COS.SPREJ VINIL CRNA SATEN N510", brand: "COSMOS" }), { brand: "COSMOS", group: "COSMOS VINIL" });
});

test("neto cena → rabat koji na fakturi daje TAČNO tu cenu", () => {
  const r = rebateForNet(315000, 180000);
  assert.equal(r.ok, true);
  assert.equal(r.percent, 42.857);
  assert.equal(r.netCents, 180000);
  assert.equal(r.exact, true);
  assert.equal(unitNetCents("3150.00", "42.857"), 180000, "isti broj daje i obračun fakture");
});

test("cena koju 3 decimale ne pogađaju: najbliža, i to se kaže", () => {
  const r = rebateForNet(1180000, 700001);
  assert.equal(r.ok, true);
  assert.equal(r.exact, false);
  assert.ok(Math.abs(r.netCents - 700001) <= 12, "najviše VP/100.000 po komadu");
  assert.equal(netCentsFor(1180000, r.percent), r.netCents);
});

test("obrnuti račun je zatvoren: rabat iz neto cene uvek vraća istu neto cenu", () => {
  for (const base of [72000, 69000, 148000, 315000, 489000, 1180000, 640037]) {
    for (let want = 100; want <= base; want += 977) {
      const r = rebateForNet(base, want);
      assert.equal(r.ok, true);
      assert.equal(netCentsFor(base, r.percent), r.netCents, `${base} ${want}`);
      assert.ok(Math.abs(r.netCents - want) <= Math.ceil(base / 100000), `${base} ${want} → ${r.netCents}`);
      assert.match(String(r.percent), /^\d+(\.\d{1,3})?$/, "najviše 3 decimale");
    }
  }
});

test("neto cena: odbija nulu, veću od VP i artikal bez VP cene", () => {
  assert.equal(rebateForNet(315000, 0).ok, false);
  assert.match(rebateForNet(315000, 315001).error, /veća od VP/);
  assert.match(rebateForNet(null, 1000).error, /VP cenu/);
  assert.deepEqual(rebateForNet(315000, 315000), { ok: true, percent: 0, netCents: 315000, exact: true });
});

test("unos brojeva u srpskom zapisu", () => {
  assert.equal(parseAmount("1.800,50"), 1800.5);
  assert.equal(parseAmount("1800,5"), 1800.5);
  assert.equal(parseAmount("1800.5"), 1800.5);
  assert.equal(parseAmount("1.800"), 1800);
  assert.equal(parseAmount("abc"), null);
  assert.equal(parsePercent("42,8575"), 42.858);
  assert.equal(parsePercent("100"), null);
  assert.equal(parsePercent("-1"), null);
});

const row = (id, over = {}) => ({
  articleId: id,
  brand: "CS",
  group: "CS P19",
  baseCents: 315000,
  currentPercent: 40,
  source: "artikal",
  ownRuleId: `rule-${id}`,
  blocked: null,
  ...over,
});

test("grupna izmena ne dira poseban dogovor; artikal i neto imaju prednost", () => {
  const rows = [row("a"), row("b"), row("c", { currentPercent: 45 }), row("d", { currentPercent: null, source: null, ownRuleId: null }), row("e", { group: "CS SPREJ" })];
  const p = planChanges(rows, { groups: { "CS P19": 42 }, articles: { b: 43 }, nets: { a: 180000 } });
  const by = Object.fromEntries(p.items.map((i) => [i.articleId, i]));
  assert.equal(by.a.percent, 42.857);
  assert.equal(by.a.netCents, 180000);
  assert.equal(by.b.percent, 43);
  assert.equal(by.d.percent, 42, "artikal bez rabata (na upit) dobija rabat grupe");
  assert.equal(by.d.replacesRuleId, null);
  assert.equal(by.c, undefined, "45 % je poseban dogovor (osnov grupe je 40 %)");
  assert.deepEqual(p.kept.map((k) => k.articleId), ["c"]);
  assert.equal(by.e, undefined, "druga grupa se ne menja");
  const all = planChanges(rows, { groups: { "CS P19": 42 }, includeOwn: true });
  assert.ok(all.items.some((i) => i.articleId === "c"), "uključen izričito");
});

test("brend: važi za sve grupe brenda; blokirani artikli se preskaču sa razlogom", () => {
  const rows = [row("a"), row("b", { group: "CS SPREJ", blocked: "već čeka predlog 41 %" }), row("x", { brand: "BEFAR", group: "BEFAR SUNDJER" })];
  const p = planChanges(rows, { brands: { CS: 41 } });
  assert.deepEqual(p.items.map((i) => i.articleId), ["a"]);
  assert.deepEqual(p.skipped, [{ articleId: "b", reason: "već čeka predlog 41 %", origin: "brend CS" }]);
});

test("isti rabat već važi kao pravilo artikla → nema promene; nasleđen rabat se upisuje", () => {
  const rows = [row("a", { currentPercent: 42 }), row("b", { currentPercent: 42, source: "brend", ownRuleId: null })];
  const p = planChanges(rows, { articles: { a: 42, b: 42 } });
  assert.deepEqual(p.items.map((i) => i.articleId), ["b"]);
});

test("obavezan par (0056): poklopac dobija rabat svoje posude, nikad poseban", () => {
  const rows = [
    row("kanta", { brand: "BLANKO", group: "BLANKO KANTA", currentPercent: 35, source: "artikal", ownRuleId: "rk" }),
    row("kanta-nova", { brand: "BLANKO", group: "BLANKO KANTA", currentPercent: 35, source: "artikal", ownRuleId: "rn" }),
    row("poklopac", { brand: "BLANKO", group: "BLANKO KANTA", currentPercent: 35, source: "artikal", ownRuleId: "rp", pairOf: ["kanta", "kanta-nova"] }),
  ];
  // Grupa: poklopac ide sa posudama.
  const g = planChanges(rows, { groups: { "BLANKO KANTA": 40 } });
  assert.deepEqual(g.items.map((i) => [i.articleId, i.percent]).sort(), [["kanta", 40], ["kanta-nova", 40], ["poklopac", 40]]);
  // Neto cena posude: poklopac dobija isti izračunat rabat.
  const n = planChanges(rows, { nets: { kanta: 50000 }, articles: { "kanta-nova": 0 } });
  assert.ok(n.skipped.some((s) => s.articleId === "poklopac"), "različit rabat posuda → poklopac se ne menja, uz razlog");
  const n2 = planChanges(rows.slice(0, 1).concat({ ...rows[2], pairOf: ["kanta"] }), { nets: { kanta: 50000 } });
  const kanta = n2.items.find((i) => i.articleId === "kanta");
  assert.equal(n2.items.find((i) => i.articleId === "poklopac")?.percent, kanta.percent);
  // Poklopac sam: izmena se ne prihvata.
  assert.equal(planChanges(rows, { articles: { poklopac: 10 }, nets: { poklopac: 100 } }).items.length, 0);
});
