import { test } from "node:test";
import assert from "node:assert/strict";
import { buildXlsx } from "./xlsxFile.mjs";
import { readXlsx } from "../import/xlsx/readXlsx.mjs";

test("xlsx se čita nazad: tekst, brojevi, ćirilica/latinica, zaštita formule", () => {
  const buf = buildXlsx({
    sheetName: "Porudžbina",
    rows: [["Šifra", "Naziv", "Količina", "JM"], ["651061", "RM CHRONOTOP KLAR LAK 1L", 12, "LIT"], ["=1+1", "Đ & <x>", 2.5, "KOM"]],
    boldRows: [0],
    widths: [12, 50, 10, 6],
  });
  assert.equal(buf.subarray(0, 2).toString(), "PK");
  const rows = readXlsx(buf);
  const flat = JSON.stringify(rows);
  assert.match(flat, /RM CHRONOTOP KLAR LAK 1L/);
  assert.match(flat, /Đ & <x>/);
  assert.match(flat, /651061/);
  assert.doesNotMatch(flat, /"=1\+1"/);
});
