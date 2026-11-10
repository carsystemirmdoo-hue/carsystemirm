import assert from "node:assert/strict";
import test from "node:test";
import { nextSort, sortRows } from "./sortRows.mjs";

test("prazne vrednosti uvek na kraju; tekst po srpskom redosledu; stabilno", () => {
  const rows = [{ n: "Šabac", v: 3 }, { n: "Čačak", v: null }, { n: "Beograd", v: 1 }, { n: "Ćuprija", v: 3 }, { n: "Zrenjanin", v: undefined }];
  assert.deepEqual(sortRows(rows, (r) => r.v, "asc").map((r) => r.n), ["Beograd", "Šabac", "Ćuprija", "Čačak", "Zrenjanin"]);
  assert.deepEqual(sortRows(rows, (r) => r.v, "desc").map((r) => r.n), ["Šabac", "Ćuprija", "Beograd", "Čačak", "Zrenjanin"]);
  assert.deepEqual(sortRows(rows, (r) => r.n, "asc").map((r) => r.n), ["Beograd", "Čačak", "Ćuprija", "Šabac", "Zrenjanin"]);
  assert.deepEqual(sortRows(["2026-01-05", "2025-12-31"], (d) => d, "asc"), ["2025-12-31", "2026-01-05"]);
});

test("klik na istu kolonu menja smer, nova kolona kreće svojim smerom", () => {
  assert.deepEqual(nextSort({ key: "a", dir: "asc" }, "a"), { key: "a", dir: "desc" });
  assert.deepEqual(nextSort({ key: "a", dir: "desc" }, "a"), { key: "a", dir: "asc" });
  assert.deepEqual(nextSort({ key: "a", dir: "asc" }, "b", "desc"), { key: "b", dir: "desc" });
});
