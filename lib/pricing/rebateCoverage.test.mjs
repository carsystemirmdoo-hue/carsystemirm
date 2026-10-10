import assert from "node:assert/strict";
import test from "node:test";
import { classifyCustomer, familyCandidates, familyCondition, segmentPair } from "./rebateCoverage.mjs";

const AS_OF = "2026-10-10";
let n = 0;
const line = (articleId, articleName, issuedOn, discountPercent, invoiceId = `F${issuedOn}`) => ({ articleId, articleName, issuedOn, discountPercent, invoiceId, documentLabel: invoiceId, _n: n++ });
const run = (lines, rules = [], out = new Set()) => classifyCustomer({ lines, rules, outOfProgramme: out, asOf: AS_OF });
const pair = (r, id) => r.pairs.find((p) => p.articleId === id);

/** Porodica CS 40 %: pet artikala na četiri fakture u poslednjih 6 meseci. */
const csFamily = () => [
  line("a1", "CS GIT MULTI 1KG", "2026-05-04", 40), line("a2", "CS F19 KRUŽNA P80", "2026-05-04", 40),
  line("a3", "CS 2K FILLER 1L", "2026-06-10", 40), line("a1", "CS GIT MULTI 1KG", "2026-07-15", 40),
  line("a4", "CS RAŠPA 300", "2026-07-15", 40), line("a5", "CS PROFLEX PLUTO", "2026-09-01", 40),
];

test("kandidati porodice: brend i linija; opšti nazivi samo prve dve reči", () => {
  assert.deepEqual(familyCandidates("CS 2K FILLER 1L"), ["CS", "CS 2K"]);
  assert.deepEqual(familyCandidates("BASLAC 35-M218 1L"), ["BASLAC", "BASLAC 35-M"]);
  assert.deepEqual(familyCandidates("BASLACUNIVERZALHS LAK 40-450"), ["BASLAC", "BASLAC UNIVERZALHS"]);
  assert.deepEqual(familyCandidates("COS.SPREJ EASYMAX BELA"), ["COSMOS", "COSMOS EASYMAX"]);
  assert.deepEqual(familyCandidates("BLANKO KANTA 1L"), ["BLANKO KANTA"]);
});

test("jedna kupovina artikla: izvedeno iz porodice koju kupac dokazuje drugim artiklima", () => {
  const r = run([...csFamily(), line("x", "CS POSUDA PVC 0.75L", "2026-08-20", 40)]);
  const p = pair(r, "x");
  assert.equal(p.outcome, "izvedeno");
  assert.equal(p.percent, 40);
});

test("prva reč nije dokaz: porodica sa dva artikla ne izvodi uslov", () => {
  const r = run([line("a1", "CS GIT", "2026-05-04", 40), line("a2", "CS F19", "2026-06-04", 40), line("x", "CS POSUDA", "2026-08-20", 40)]);
  assert.equal(pair(r, "x").outcome, "nejasno");
});

test("nedosledna porodica (kupac pregovara po porudžbini) ostaje nejasna", () => {
  const ls = [37, 42, 40, 37, 45, 42].map((p, i) => line(`a${i}`, `CS ART${i}`, `2026-0${4 + i}-10`, p));
  const r = run([...ls, line("x", "CS NOVI", "2026-09-20", 42)]);
  assert.equal(pair(r, "x").outcome, "nejasno");
  assert.match(pair(r, "x").reason, /nije dosledan|samo na|samo u/);
});

test("akcija na celoj fakturi ne menja uslov porodice; artikal kupljen samo na akciji dobija uslov porodice", () => {
  const akcija = [line("a2", "CS F19 KRUŽNA P80", "2026-08-01", 50, "AK"), line("a3", "CS 2K FILLER 1L", "2026-08-01", 50, "AK"), line("x", "CS POSUDA PVC", "2026-08-01", 50, "AK")];
  const r = run([...csFamily(), ...akcija]);
  const f = r.families.find((x) => x.key === "CS");
  assert.equal(f.ok, true);
  assert.equal(f.percent, 40);
  assert.equal(f.actions.length, 1);
  assert.equal(pair(r, "x").outcome, "izvedeno");
  assert.equal(pair(r, "x").percent, 40);
  assert.match(pair(r, "x").reason, /akcij/);
});

test("odstupanje samo jednog artikla (poseban uslov) ostaje nejasno, ne prepisuje se porodicom", () => {
  const r = run([...csFamily(), line("x", "CS POSUDA PVC", "2026-09-01", 47, "F2026-09-01")]);
  const p = pair(r, "x");
  assert.equal(p.outcome, "nejasno");
  assert.match(p.reason, /poseban uslov/);
});

test("dosledan izuzetak artikla tokom važenja uslova porodice je direktno potvrđen sa svojim procentom", () => {
  const r = run([...csFamily(), line("x", "CS POSUDA PVC", "2026-06-10", 45), line("x", "CS POSUDA PVC", "2026-09-01", 45)]);
  const p = pair(r, "x");
  assert.equal(p.outcome, "direktno");
  assert.equal(p.percent, 45);
  assert.equal(p.exception, true);
});

test("stari uslov pre promene porodice nije izuzetak: važi sadašnji uslov porodice", () => {
  const r = run([...csFamily(), line("x", "CS POSUDA PVC", "2025-10-01", 45), line("x", "CS POSUDA PVC", "2025-11-14", 45)]);
  const p = pair(r, "x");
  assert.equal(p.outcome, "izvedeno");
  assert.equal(p.percent, 40);
  assert.match(p.reason, /pre sadašnjeg uslova/);
});

test("promena uslova u toku: poslednje dve kupovine porodice sa drugim rabatom → nejasno", () => {
  const r = run([...csFamily(), ...["2026-09-20", "2026-10-01"].flatMap((d) => [line("a1", "CS GIT MULTI 1KG", d, 35, `P${d}`), line("a2", "CS F19 KRUŽNA P80", d, 35, `P${d}`)]), line("x", "CS POSUDA", "2026-08-02", 40)]);
  const f = r.families.find((x) => x.key === "CS");
  assert.equal(f.ok, false);
});

test("odobreno pravilo se ne prepisuje; predlog na čekanju se ne ponavlja; van programa odvojeno", () => {
  const r = run([...csFamily(), line("y", "SIA 1950 P120", "2026-09-01", 30)], [{ articleId: "a1", discountPercent: 38, approved: true }, { articleId: "a2", discountPercent: 40, approved: false }], new Set(["y"]));
  assert.equal(pair(r, "a1").outcome, "odobreno");
  assert.equal(pair(r, "a1").percent, 38);
  assert.equal(pair(r, "a2").outcome, "ceka_odobrenje");
  assert.equal(pair(r, "y").outcome, "van_programa");
});

test("dve kupovine sa istim rabatom, ali razmak preko dve godine, nisu direktan dokaz", () => {
  const r = run([line("x", "OPSTI ARTIKAL", "2022-12-07", 40), line("x", "OPSTI ARTIKAL", "2026-05-19", 40)]);
  assert.equal(pair(r, "x").outcome, "nejasno");
});

test("uslov porodice traži tri artikla i tri dana; odobrena pravila protiv većine ruše porodicu", () => {
  const approved = new Map([["a1", [30]], ["a2", [30]], ["a3", [40]]]);
  const f = familyCondition("CS", csFamily(), approved, AS_OF);
  assert.equal(f.ok, false);
  assert.match(f.reason, /odobrena pravila/);
});

test("podela: aktuelno, retko, istorijsko", () => {
  const base = { customerLastOn: "2026-09-01", articleLastSoldOn: "2026-08-01", articleInStock: false, outOfProgramme: false, asOf: AS_OF };
  assert.equal(segmentPair({ ...base, pairLastOn: "2026-05-01" }), "aktuelno");
  assert.equal(segmentPair({ ...base, pairLastOn: "2024-05-01" }), "retko");
  assert.equal(segmentPair({ ...base, pairLastOn: "2026-05-01", outOfProgramme: true }), "istorijsko");
  assert.equal(segmentPair({ ...base, customerLastOn: "2024-01-01", pairLastOn: "2024-01-01" }), "istorijsko");
  assert.equal(segmentPair({ ...base, articleLastSoldOn: "2023-01-01", articleInStock: true, pairLastOn: "2023-01-01" }), "retko");
});
