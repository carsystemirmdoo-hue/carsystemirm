import assert from "node:assert/strict";
import test from "node:test";
import { cellValue, columnKind, compareCells, firstDir } from "./tableSort.mjs";

test("srpski brojevi, procenti i jedinice", () => {
  assert.deepEqual(cellValue("40.625.541"), { kind: "number", value: 40625541 });
  assert.deepEqual(cellValue("1.234,56 RSD"), { kind: "number", value: 1234.56 });
  assert.deepEqual(cellValue("40,9 %"), { kind: "number", value: 40.9 });
  assert.deepEqual(cellValue("-12 KOM"), { kind: "number", value: -12 });
  assert.deepEqual(cellValue("675"), { kind: "number", value: 675 });
});

test("datumi i prazno", () => {
  assert.deepEqual(cellValue("09.09.2026."), { kind: "date", value: "2026-09-09" });
  assert.deepEqual(cellValue("2026-10-18 bez roka"), { kind: "date", value: "2026-10-18" });
  assert.deepEqual(cellValue("—"), { kind: "empty" });
  assert.deepEqual(cellValue("  "), { kind: "empty" });
});

test("tekst ostaje tekst (šifra sa slovima, naziv)", () => {
  assert.equal(cellValue("CS P19 KRUŽNA").kind, "text");
  assert.equal(cellValue("156362 · poslednja prodaja").kind, "number");
  assert.equal(cellValue("12.10.–10.11.").kind, "text");
});

test("vrsta kolone po većini i prvi smer", () => {
  assert.equal(columnKind(["1", "2", "—", "3"].map(cellValue)), "number");
  assert.equal(columnKind(["01.02.2026.", "03.04.2026."].map(cellValue)), "date");
  assert.equal(columnKind(["IGOR", "1", "INTER"].map(cellValue)), "text");
  assert.equal(firstDir("number"), "desc");
  assert.equal(firstDir("text"), "asc");
});

test("prazno uvek na kraju, u oba smera", () => {
  const vals = ["5", "—", "40", "7"].map(cellValue);
  const asc = [...vals].sort((a, b) => compareCells(a, b, "number", "asc")).map((v) => (v.kind === "number" ? v.value : "x"));
  const desc = [...vals].sort((a, b) => compareCells(a, b, "number", "desc")).map((v) => (v.kind === "number" ? v.value : "x"));
  assert.deepEqual(asc, [5, 7, 40, "x"]);
  assert.deepEqual(desc, [40, 7, 5, "x"]);
});

test("tekst po srpskom redu (č, ć, š, ž)", () => {
  const vals = ["Šokčić", "Auto", "Čačak", "Zrenjanin"].map(cellValue);
  const out = vals.sort((a, b) => compareCells(a, b, "text", "asc")).map((v) => (v.kind === "text" ? v.value : ""));
  assert.deepEqual(out, ["auto", "čačak", "šokčić", "zrenjanin"]);
});
