import assert from "node:assert/strict";
import test from "node:test";
import { allocateArrivals, buildArticleIndex, countdown, rankArticles, findOrderHeader, leadFor, leadLabel, parseOrderSheet, settleArrival } from "./incoming.mjs";

test("rokovi po dobavljaču (odluka vlasnika 2026-11-12)", () => {
  assert.deepEqual(leadFor("Baslac"), { min: 7, max: 10 });
  assert.deepEqual(leadFor("Norbin"), { min: 7, max: 10 });
  assert.deepEqual(leadFor("Carsystem"), { min: 0, max: 14 });
  assert.equal(leadFor("R-M").max, 14);
  assert.match(leadFor("Cosmos Lac").note ?? "", /60/);
  assert.deepEqual(leadFor("Nepoznat"), { min: 14, max: 14 });
  assert.equal(leadLabel(0, 14), "do 14 dana");
  assert.equal(leadLabel(7, 10), "7–10 dana");
  assert.equal(leadLabel(1, 1), "1 dan");
});

test("odbrojavanje: 10–14 → sutra 9–13 → posle roka kasni", () => {
  assert.equal(countdown("2026-11-12", 10, 14, "2026-11-12").label, "stiže za 10–14 dana");
  assert.equal(countdown("2026-11-12", 10, 14, "2026-11-13").label, "stiže za 9–13 dana");
  assert.equal(countdown("2026-11-12", 10, 14, "2026-11-23").label, "stiže za najviše 3 dana");
  assert.equal(countdown("2026-11-12", 10, 14, "2026-11-26").state, "danas");
  const k = countdown("2026-11-12", 10, 14, "2026-11-29");
  assert.equal(k.state, "kasni");
  assert.equal(k.label, "kasni 3 dana");
  assert.equal(countdown("2026-11-12", 0, 14, "2026-11-12").label, "stiže za najviše 14 dana");
  assert.equal(countdown("2026-11-12", 14, 14, "2026-11-13").label, "stiže za 13 dana");
  assert.equal(countdown("2026-11-12", 10, 14, "2026-11-12").expectedTo, "2026-11-26");
});

test("zaglavlje potvrde: srpski, engleski i nemački nazivi kolona, ispod naslova", () => {
  const rows = [
    ["Potvrda porudžbine br. 4711"],
    [],
    ["Rb", "Artikelnummer", "Bezeichnung", "Menge", "ME"],
    [1, "1.10200", "SATAjet X 5500", 2, "Stk"],
  ];
  const h = findOrderHeader(rows);
  assert.deepEqual(h, { index: 2, columns: { code: 1, name: 2, qty: 3, unit: 4 } });
  assert.deepEqual(findOrderHeader([["Šifra artikla", "Naziv", "Količina"]])?.columns, { code: 0, name: 1, qty: 2 });
  assert.equal(findOrderHeader([["a", "b"], [1, 2]]), null);
});

test("stavke: srpski brojevi, zbir na dnu i red bez količine se preskaču", () => {
  const rows = [
    ["Šifra", "Naziv", "Količina", "JM"],
    ["SR-1", "  BASLAC   razređivač 1L ", "12", "KOM"],
    ["SR-2", "Lak 5L", "1.250,5", "LIT"],
    ["SR-3", "Bez količine", "", "KOM"],
    [null, null, null, null],
    ["", "Ukupno", "13", ""],
  ];
  const r = parseOrderSheet(rows);
  assert.equal(r.ok, true);
  assert.deepEqual(r.lines.map((l) => [l.supplierCode, l.supplierName, l.quantity, l.unit]), [
    ["SR-1", "BASLAC razređivač 1L", 12, "KOM"],
    ["SR-2", "Lak 5L", 1250.5, "LIT"],
  ]);
  assert.equal(r.skipped, 1);
});

test("ručno izabrane kolone kada zaglavlje nije prepoznato", () => {
  const rows = [["x", "y", "z"], ["A1", "Prvi", 3], ["A2", "Drugi", 4]];
  assert.equal(parseOrderSheet(rows).ok, false);
  const r = parseOrderSheet(rows, { columns: { code: 0, name: 1, qty: 2 }, headerRow: 0 });
  assert.equal(r.ok, true);
  assert.equal(r.lines.length, 2);
  assert.equal(parseOrderSheet(rows, { columns: { name: 1 }, headerRow: 0 }).reason, "kolone");
});

test("prijem: povećanje lagera = primljeno, pad = prodaja, nema u izvozu = 0", () => {
  assert.deepEqual(settleArrival({ quantity: 10, received: 0, lastSeen: 2 }, 12), { received: 10, lastSeen: 12, arrived: true, delta: 10 });
  assert.deepEqual(settleArrival({ quantity: 10, received: 0, lastSeen: 2 }, 8), { received: 6, lastSeen: 8, arrived: false, delta: 6 });
  assert.deepEqual(settleArrival({ quantity: 10, received: 6, lastSeen: 8 }, 5), { received: 6, lastSeen: 5, arrived: false, delta: 0 });
  assert.deepEqual(settleArrival({ quantity: 4, received: 0, lastSeen: null }, 4), { received: 4, lastSeen: 4, arrived: true, delta: 4 });
  assert.deepEqual(settleArrival({ quantity: 4, received: 0, lastSeen: 3 }, null), { received: 0, lastSeen: 0, arrived: false, delta: 0 });
  // Više nego naručeno: prijem se ne prebacuje preko naručene količine.
  assert.equal(settleArrival({ quantity: 5, received: 0, lastSeen: 0 }, 50).received, 5);
});

test("predlog artikla: ista šifra, šifra u nazivu, pa sličnost naziva", () => {
  const idx = buildArticleIndex([
    { id: "a", code: "0712345", name: "BASLAC RAZREDJIVAC 1L", unit: "KOM" },
    { id: "b", code: "500100", name: "RM BC 800 RAZREDJIVAC 5L", unit: "LIT" },
    { id: "c", code: "500200", name: "RM KLARLAK CP 515 1L", unit: "KOM" },
  ]);
  assert.equal(rankArticles({ supplierCode: "712345", supplierName: "x" }, idx)[0].id, "a");
  assert.equal(rankArticles({ supplierCode: "BC 800", supplierName: "Basecoat thinner" }, idx)[0].id, "b");
  const n = rankArticles({ supplierCode: "99-1", supplierName: "Klarlak CP515 1 L" }, idx);
  assert.equal(n[0].id, "c");
  assert.equal(n[0].how, "naziv");
  assert.deepEqual(rankArticles({ supplierCode: null, supplierName: "potpuno drugo" }, idx), []);
});

test("isti artikal u dve porudžbine: povećanje se troši jednom, od najstarije", () => {
  const lines = [
    { id: "stara", quantity: 5, received: 0, lastSeen: 1 },
    { id: "nova", quantity: 5, received: 0, lastSeen: 1 },
  ];
  assert.deepEqual(allocateArrivals(lines, 8), [
    { id: "stara", received: 5, arrived: true },
    { id: "nova", received: 2, arrived: false },
  ]);
  assert.deepEqual(allocateArrivals(lines, 0), [
    { id: "stara", received: 0, arrived: false },
    { id: "nova", received: 0, arrived: false },
  ]);
});

test("predlog artikla: šifra sa crticom iz naziva dobavljača i pakovanje (Baslac 21-10 1 L)", () => {
  const idx = buildArticleIndex([
    { id: "cl", code: "547782", name: "BASLAC CLEANER PLASTIC 70-20 1 L", unit: "KOM" },
    { id: "p1", code: "565407", name: "BASLAC 21-10PLASTIC PRIMER 1L", unit: "KOM" },
    { id: "p5", code: "565408", name: "BASLAC 21-10PLASTIC PRIMER 5L", unit: "KOM" },
  ]);
  const r = rankArticles({ supplierCode: "BX-2110-1", supplierName: "Baslac 21-10 Plastic Primer 1 L" }, idx);
  assert.equal(r[0].id, "p1");
  assert.ok(r[0].score - (r[1]?.score ?? 0) >= 0.5);
});
