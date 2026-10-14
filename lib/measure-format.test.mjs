import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMeasureSr } from "./measure-format.mjs";

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
