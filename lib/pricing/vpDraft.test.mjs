import { test } from "node:test";
import assert from "node:assert/strict";
import { changePercent, newCentsFor, parseChangePercent, parseDraftSheet, parseNumber, parsePriceCents, planDraft, sanitizeEdits } from "./vpDraft.mjs";

test("brojevi iz polja i Excela", () => {
  assert.equal(parseNumber("1.250,50"), 1250.5);
  assert.equal(parseNumber("1250.50"), 1250.5);
  assert.equal(parseNumber("+4"), 4);
  assert.equal(parseNumber("-2,5"), -2.5);
  assert.equal(parseNumber("4 %"), 4);
  assert.equal(parseNumber(1250.5), 1250.5);
  assert.equal(parseNumber("abc"), null);
  assert.equal(parseChangePercent("400"), null);
  assert.equal(parseChangePercent("-95"), null);
  assert.equal(parseChangePercent("4,555"), 4.56);
  assert.equal(parsePriceCents("0"), null);
  assert.equal(parsePriceCents("1.234,56"), 123456);
});

test("nova cena: procenat i zaokruživanje", () => {
  assert.equal(newCentsFor(100000, 4), 104000);
  assert.equal(newCentsFor(12345, 4), 12839); // 128,388 → 128,39
  assert.equal(newCentsFor(12345, 4, "dinar"), 12800);
  assert.equal(newCentsFor(12345, -3.5), 11913);
  assert.equal(changePercent(100000, 104000), 4);
  assert.equal(changePercent(null, 1), null);
});

const rows = [
  { articleId: "a1", brand: "R-M", group: "RM CB", oldCents: 100000 },
  { articleId: "a2", brand: "R-M", group: "RM CB", oldCents: 50000 },
  { articleId: "a3", brand: "R-M", group: "RM PASTA", oldCents: 20000 },
  { articleId: "a4", brand: "Carsystem", group: "CS 2K", oldCents: 30000 },
  { articleId: "a5", brand: "R-M", group: "RM PASTA", oldCents: null },
];

test("prednost: cena › artikal › grupa › brend; menja se samo ono što se menja", () => {
  const { items, ignored } = planDraft(rows, { brands: { "R-M": 4 }, groups: { "RM PASTA": 0 }, articles: { a2: 10 }, prices: { a4: 31000 } });
  const by = Object.fromEntries(items.map((i) => [i.articleId, i]));
  assert.equal(by.a1.newCents, 104000);
  assert.equal(by.a1.origin, "brend R-M");
  assert.equal(by.a2.newCents, 55000);
  assert.equal(by.a2.origin, "artikal");
  assert.equal(by.a3, undefined, "grupa sa 0 % pokriva brend i ne menja cenu");
  assert.equal(by.a4.newCents, 31000);
  assert.equal(by.a4.origin, "cena");
  // a5 je pogođen grupom, ali nema staru cenu — procenat od ničega ne postoji.
  assert.deepEqual(ignored.map((x) => x.articleId), ["a5"]);
});

test("artikal bez stare cene: procenat se ne primenjuje, tačna cena da", () => {
  const p1 = planDraft(rows, { brands: { "R-M": 4 } });
  assert.ok(p1.ignored.some((x) => x.articleId === "a5"));
  const p2 = planDraft(rows, { prices: { a5: 9900 } });
  assert.equal(p2.items[0].newCents, 9900);
  assert.equal(p2.items[0].oldCents, null);
});

test("sanitizeEdits odbacuje neispravno", () => {
  const e = sanitizeEdits({ brands: { "R-M": "4", X: "abc" }, groups: { G: 1000 }, articles: { a1: -2 }, prices: { "00000000-0000-0000-0000-000000000001": 1200, bad: 5, "00000000-0000-0000-0000-000000000002": -1 } });
  assert.deepEqual(e.brands, { "R-M": 4 });
  assert.deepEqual(e.groups, {});
  assert.deepEqual(e.articles, { a1: -2 });
  assert.deepEqual(e.prices, { "00000000-0000-0000-0000-000000000001": 1200 });
});

test("Excel: zaglavlje, nova VP, prazno se preskače, ponovljena šifra se ne uzima", () => {
  const sheet = [
    ["VP cenovnik — 18.11.2026."],
    [],
    ["Šifra", "Naziv", "Brend", "VP cena", "Nova VP"],
    ["111", "A", "R-M", 1000, 1040],
    ["222", "B", "R-M", 500, ""],
    ["333", "C", "R-M", 500, "520,50"],
    ["333", "C", "R-M", 500, "530"],
    ["", "", "", "", ""],
    ["444", "D", "R-M", 500, "x"],
  ];
  const r = parseDraftSheet(sheet);
  assert.equal(r.ok, true);
  assert.deepEqual(r.rows.map((x) => [x.code, x.cents]), [["111", 104000]]);
  assert.equal(r.priceColumn, "Nova VP");
  assert.equal(r.problems.length, 2);
});

test("Excel bez kolone Nova VP koristi VP cenu; bez šifre greška", () => {
  const r = parseDraftSheet([["sifra", "naziv", "VP cena"], ["111", "A", "1.234,00"]]);
  assert.equal(r.ok, true);
  assert.equal(r.rows[0].cents, 123400);
  assert.equal(parseDraftSheet([["naziv", "cena"]]).ok, false);
});
