import assert from "node:assert/strict";
import test from "node:test";
import { daysOverdue, findHeader, nameKey, normalizePib, parseAmount, parseDate, parseReceivables } from "./receivablesParse.mjs";

test("iznosi: srpski i engleski zapis, zagrade, valuta; nečitljivo nije nula", () => {
  assert.equal(parseAmount("1.234,56"), 1234.56);
  assert.equal(parseAmount("1 234,56 RSD"), 1234.56);
  assert.equal(parseAmount("1,234.56"), 1234.56);
  assert.equal(parseAmount("1.234.567"), 1234567);
  assert.equal(parseAmount("12,5"), 12.5);
  assert.equal(parseAmount("12.5"), 12.5);
  assert.equal(parseAmount("(500)"), -500);
  assert.equal(parseAmount("-500 din."), -500);
  assert.equal(parseAmount(4500), 4500);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount(null), null);
  assert.equal(parseAmount("dvesta"), undefined);
});

test("datumi: tačke, kose crte, ISO, kratka godina i serijski broj tabele", () => {
  assert.equal(parseDate("10.11.2026."), "2026-11-10");
  assert.equal(parseDate("10/11/2026"), "2026-11-10");
  assert.equal(parseDate("2026-11-10"), "2026-11-10");
  assert.equal(parseDate("1.2.26"), "2026-02-01");
  assert.equal(parseDate(46336), "2026-11-10");
  assert.equal(parseDate("31.02.2026"), null);
  assert.equal(parseDate("sutra"), null);
});

test("PIB i naziv", () => {
  assert.equal(normalizePib("100 123 456"), "100123456");
  assert.equal(normalizePib(100123456), "100123456");
  assert.equal(normalizePib("12345"), null);
  assert.equal(nameKey("AUTO-LAK D.O.O. Šabac"), nameKey("auto lak doo sabac"));
});

test("zaglavlje se traži po nazivu kolona, ne po mestu", () => {
  const h = findHeader([["Stanje na dan 10.11."], [], ["Rb", "Kupac", "PIB", "Br. fakture", "Datum", "Valuta", "Iznos", "Uplaćeno", "Ostatak"]]);
  assert.equal(h?.index, 2);
  assert.deepEqual(Object.keys(h?.columns ?? {}).sort(), ["amount", "customer", "due", "invoice", "issued", "paid", "pib", "remaining"].sort());
  assert.equal(findHeader([["a", "b"], ["1", "2"]]), null);
});

test("ostatak iz kolone ili iznos − uplaćeno; plaćeno se ne uvozi; ukupno se preskače", () => {
  const r = parseReceivables([
    ["Kupac", "PIB", "Faktura", "Datum", "Valuta", "Iznos", "Uplaćeno"],
    ["Auto Lak doo", "100123456", "F-101/26", "01.10.2026", "31.10.2026", "120.000,00", "20.000,00"],
    [null, null, "F-140/26", "15.10.2026", "14.11.2026", "50.000,00", null],
    ["Lakirnica Mika", "", "F-150/26", "20.10.2026", "", "30.000,00", "30.000,00"],
    ["Ukupno", null, null, null, null, "200.000,00", "50.000,00"],
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.lines.length, 2);
  assert.equal(r.paidRows, 1);
  assert.deepEqual(
    r.lines.map((l) => [l.customerLabel, l.pib, l.invoiceNumber, l.remaining, l.dueOn]),
    [
      ["Auto Lak doo", "100123456", "F-101/26", 100000, "2026-10-31"],
      ["Auto Lak doo", "100123456", "F-140/26", 50000, "2026-11-14"],
    ],
  );
});

test("kolona ostatka ima prednost; nečitljiv iznos je upozorenje; ponovljena faktura se javlja", () => {
  const r = parseReceivables([
    ["Naziv partnera", "Broj računa", "Iznos", "Saldo"],
    ["Firma A", "1", "1000", "400"],
    ["Firma A", "1", "1000", "400"],
    ["Firma B", "2", "abc", "100"],
  ]);
  assert.deepEqual(r.lines.map((l) => l.remaining), [400, 400]);
  assert.ok(r.warnings.some((w) => w.row === 4 && w.text.includes("nečitljiv")));
  assert.ok(r.warnings.some((w) => w.text.includes("ponavlja")));
});

test("bez zaglavlja: jasna greška", () => {
  const r = parseReceivables([["x"], ["y"]]);
  assert.equal(r.ok, false);
  assert.match(r.error ?? "", /zaglavlje/);
});

test("kašnjenje po valuti", () => {
  assert.equal(daysOverdue("2026-10-31", "2026-11-10"), 10);
  assert.equal(daysOverdue("2026-11-14", "2026-11-10"), -4);
  assert.equal(daysOverdue(null, "2026-11-10"), null);
});
