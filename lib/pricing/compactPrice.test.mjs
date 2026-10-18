import { test } from "node:test";
import assert from "node:assert/strict";
import { compactPrice, formatAmount, shortOptionLabel } from "./compactPrice.mjs";

test("ceo dinar bez ,00; stvarne decimale ostaju", () => {
  assert.equal(formatAmount(4061), "4.061");
  assert.equal(formatAmount(3667.5), "3.667,50");
  assert.equal(formatAmount(425.0), "425");
  assert.equal(formatAmount(0.1 + 0.2), "0,30");
});

test("redosled je uvek odloženo pa avans", () => {
  const r = compactPrice(
    [
      { code: "avans", net: 3668 },
      { code: "odlozeno_30", net: 4061 },
    ],
    { pack: "kanta 5 L" },
  );
  assert.equal(r.amounts, "4.061 / 3.668 RSD");
  assert.equal(r.detail, "Odloženo / Avans · kanta 5 L · bez PDV-a");
});

test("rok odloženog plaćanja se ne izmišlja u sažetom prikazu", () => {
  const r = compactPrice([{ code: "odlozeno_45", net: 100 }, { code: "avans", net: 90 }]);
  assert.doesNotMatch(r.detail, /dana/);
});

test("jedna opcija: bez naziva opcija", () => {
  const r = compactPrice([{ code: null, net: 2259.3 }], { pack: "set 1,25 L" });
  assert.equal(r.amounts, "2.259,30 RSD");
  assert.equal(r.detail, "set 1,25 L · bez PDV-a");
});

test("nula ili nepoznata cena se ne prikazuje kao cena", () => {
  assert.equal(compactPrice([{ code: "avans", net: 0 }]), null);
  assert.equal(compactPrice([{ code: "avans", net: Number.NaN }]), null);
  assert.equal(compactPrice([]), null);
});

test("više pakovanja → „od“", () => {
  assert.equal(compactPrice([{ code: "avans", net: 10 }], { from: true }).amounts, "od 10 RSD");
});

test("kratki nazivi", () => {
  assert.equal(shortOptionLabel("avans"), "Avans");
  assert.equal(shortOptionLabel("odlozeno_30"), "Odloženo");
  assert.equal(shortOptionLabel(null), null);
});
