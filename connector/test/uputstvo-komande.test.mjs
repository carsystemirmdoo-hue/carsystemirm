import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Production instalacija drži config.json u instalacionoj fascikli; `connector.cmd`
 * ne prosleđuje `--config` i zato vraća `config_missing` (KANC-01, 2026-10-09).
 * Ručne komande u uputstvu moraju ići kao zakazani zadatak: node.exe --packaged --config.
 */
const uputstvo = readFileSync(new URL("../windows/UPUTSTVO-KANCELARIJA.md", import.meta.url), "utf8");
const NODE = '& "$env:ProgramFiles\\nodejs\\node.exe" --no-warnings "C:\\Program Files\\CarsystemConnector\\connector\\bin\\connector.mjs" --packaged --config "C:\\Program Files\\CarsystemConnector\\config.json"';

test("ručne komande u uputstvu idu direktno preko node.exe sa --packaged i --config", () => {
  for (const komanda of ["doctor", "preseli-adresu", "preseli-adresu --potvrdi", "rucno", "potvrdi-rucno --otisak"]) {
    assert.ok(uputstvo.includes(`${NODE} ${komanda}`), komanda);
  }
  const blokovi = [...uputstvo.matchAll(/```powershell\n([\s\S]*?)```/g)].map((m) => m[1]);
  assert.ok(!blokovi.some((b) => /connector\.cmd'?\s+(preseli-adresu|potvrdi-rucno|rucno|storna|heartbeat|doctor)/.test(b)), "connector.cmd se ne koristi za ručne komande");
});

test("uputstvo za potvrdu traži poređenje razloga sa izlazom rucno (kasni izvoz vs storno)", () => {
  assert.match(uputstvo, /kasni_izvoz_rucna_provera/);
  assert.match(uputstvo, /ISTI razlog kao `rucno`/);
});
