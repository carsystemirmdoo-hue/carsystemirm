import assert from "node:assert/strict";
import { test } from "node:test";
import { foldText, searchHaystack, searchLager } from "./lagerSearch.mjs";

const rows = [
  { code: "091", name: "Četka za brušenje", brand: "Carsystem", group: "Pribor" },
  { code: "45-W10", name: "Baslac baza bela", brand: "baslac", group: "Baze" },
  { code: "910", name: "Đubrovnik test", brand: "R-M", group: null },
  { code: "1091", name: "Traka maskirna 19 mm", brand: "Carsystem", group: "Trake" },
].map((r) => ({ ...r, hay: searchHaystack(r) }));
const codes = (q) => searchLager(rows, q).map((r) => r.code);

test("foldText: kvačice, đ i razmaci", () => {
  assert.equal(foldText("  ČETKA  Šž Đ "), "cetka sz dj");
});

test("prazan upit vraća sve, istim redom", () => {
  assert.deepEqual(codes(""), ["091", "45-W10", "910", "1091"]);
});

test("naziv bez kvačica i više reči u bilo kom redu", () => {
  assert.deepEqual(codes("cetka"), ["091"]);
  assert.deepEqual(codes("djubrovnik"), ["910"]);
  assert.deepEqual(codes("bela baslac"), ["45-W10"]);
  assert.deepEqual(codes("traka 19"), ["1091"]);
});

test("šifra bez vodećih nula i tačna šifra na vrhu", () => {
  assert.deepEqual(codes("91"), ["091", "910", "1091"]);
  assert.deepEqual(codes("091"), ["091", "1091"]);
  assert.deepEqual(codes("45-w"), ["45-W10"]);
});

test("brend i grupa se pretražuju", () => {
  assert.deepEqual(codes("r-m"), ["910"]);
  assert.deepEqual(codes("trake"), ["1091"]);
});

test("van programa: 3M i sia po nazivu ili brendu; mere i slične reči nisu", async () => {
  const { isOutOfProgrammeBrand: out } = await import("./lagerSearch.mjs");
  assert.equal(out({ name: "3M CUBITRON TRAKA 33439" }), true);
  assert.equal(out({ name: " 3m Trizact disk" }), true);
  assert.equal(out({ name: "Traka", brand: "3M" }), true);
  assert.equal(out({ name: "SIA FAST DISC 150MM P400" }), true);
  assert.equal(out({ name: "sia max rot.disc p60" }), true);
  assert.equal(out({ name: "Disk", brand: "sia" }), true);
  assert.equal(out({ name: "3MM LAJSNA" }), false);
  assert.equal(out({ name: "CS FINE LINE TRAKA PLAVA 3MMX33M" }), false);
  assert.equal(out({ name: "RUPES SKORPIO EL.ŠLAJFERICA 150MM / 3MM" }), false);
  assert.equal(out({ name: "SIAJ test" }), false);
  assert.equal(out({ name: "CS ASIA disk" }), false);
});
