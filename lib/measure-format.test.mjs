import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMeasureSr, formatSerbianMeasureText } from "./measure-format.mjs";

test("decimalna tačka ispred jedinice postaje zarez", () => {
  assert.equal(formatMeasureSr("1.6 kg limenka sa učvršćivačem"), "1,6 kg limenka sa učvršćivačem");
  assert.equal(formatMeasureSr("1.8 kg / 2 kg"), "1,8 kg / 2 kg");
  assert.equal(formatMeasureSr("0.5 L"), "0,5 L");
  assert.equal(formatMeasureSr("10.0 kg"), "10,0 kg");
  assert.equal(formatMeasureSr("2.52 kg kartuša"), "2,52 kg kartuša");
  assert.equal(formatMeasureSr("0.5mm"), "0,5mm");
  assert.equal(formatMeasureSr("2.5 m"), "2,5 m");
});

test("šifre, hiljade i reči ostaju netaknute", () => {
  assert.equal(formatMeasureSr("159.218–159.226"), "159.218–159.226");
  assert.equal(formatMeasureSr("1.000 otkidnih listova"), "1.000 otkidnih listova");
  assert.equal(formatMeasureSr("Art. 1201996"), "Art. 1201996");
  assert.equal(formatMeasureSr("Coverall 2.0"), "Coverall 2.0");
  assert.equal(formatMeasureSr("SATA filter 500 series"), "SATA filter 500 series");
  assert.equal(formatMeasureSr("1.5 mmol"), "1.5 mmol");
  assert.equal(formatMeasureSr("verzija 2.1 maj"), "verzija 2.1 maj");
});

test("opsezi i dimenzije dobijaju zarez u svakom broju", () => {
  assert.equal(formatMeasureSr("1.4 -1.5 mm"), "1,4 -1,5 mm");
  assert.equal(formatMeasureSr("1.6-1.8 mm"), "1,6-1,8 mm");
  assert.equal(formatMeasureSr("9 x 3.5 mm, rolna 50 m"), "9 x 3,5 mm, rolna 50 m");
  assert.equal(formatMeasureSr("za SATA RPS 0.6l / 0.9l"), "za SATA RPS 0,6l / 0,9l");
  assert.equal(formatMeasureSr("RP 1.3 · 1.0 l"), "RP 1.3 · 1,0 l");
  assert.equal(formatMeasureSr("1.560 g"), "1.560 g");
});

test("srpski opis: zvaničan naziv pod navodnicima i engleski izvorni tekst ostaju", () => {
  assert.equal(
    formatSerbianMeasureText("Crevo za materijal, otporno na rastvarače, 9 x 3.5 mm. Zvanični SATA naziv: „Material hose 9x3.5 mm, solvent-resistant”."),
    "Crevo za materijal, otporno na rastvarače, 9 x 3,5 mm. Zvanični SATA naziv: „Material hose 9x3.5 mm, solvent-resistant”.",
  );
  assert.equal(
    formatSerbianMeasureText('SATA crevo za vazduh, 13 mm, plavo, 0.5 m, G 1/2" unutrašnji navoj. Zvanični SATA naziv: „SATA air hose, blue, 13 mm, 0.5 m, G 1/2" (female thread)”.'),
    'SATA crevo za vazduh, 13 mm, plavo, 0,5 m, G 1/2" unutrašnji navoj. Zvanični SATA naziv: „SATA air hose, blue, 13 mm, 0.5 m, G 1/2" (female thread)”.',
  );
  assert.equal(formatSerbianMeasureText("višekratna aluminijumska čaša 0.75 l"), "višekratna aluminijumska čaša 0,75 l");
  assert.equal(formatSerbianMeasureText("pressurised cup gun with 1.0 l cup (max. 10 bar)"), "pressurised cup gun with 1.0 l cup (max. 10 bar)");
  assert.equal(formatSerbianMeasureText("SATA Fibre air hose, 2.5 m long"), "SATA Fibre air hose, 2.5 m long");
  assert.equal(formatSerbianMeasureText("paint pressure pot 2.0 l; double pressure reducer"), "paint pressure pot 2.0 l; double pressure reducer");
});

test("engleski zapis hiljada uz o/min, K, W, L/min i g postaje srpski", () => {
  assert.equal(formatMeasureSr("Podesiv do 7,500 o/min"), "Podesiv do 7.500 o/min");
  assert.equal(formatMeasureSr("do 11,000 o/min"), "do 11.000 o/min");
  assert.equal(formatMeasureSr("2,700K - 500 lumena"), "2.700K - 500 lumena");
  assert.equal(formatMeasureSr("Protok vazduha 3,400 L/min, snaga 1,200 W"), "Protok vazduha 3.400 L/min, snaga 1.200 W");
  assert.equal(formatMeasureSr("Limenka 1,000 g sa učvršćivačem"), "Limenka 1.000 g sa učvršćivačem");
  // prave decimale ostaju
  assert.equal(formatMeasureSr("Limenka 0,820 kg"), "Limenka 0,820 kg");
  assert.equal(formatMeasureSr("kartuša 2,523 kg"), "kartuša 2,523 kg");
  assert.equal(formatMeasureSr("0,385 L, 0,75 L"), "0,385 L, 0,75 L");
  assert.equal(formatMeasureSr("debljina 0,265 mm"), "debljina 0,265 mm");
});
