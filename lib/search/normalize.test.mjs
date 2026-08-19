import assert from "node:assert/strict";
import test from "node:test";

import {
  boundedEditDistance,
  compactText,
  fuzzyToleranceFor,
  isMeasureToken,
  normalizeText,
  queryWords,
  tokenAlternatives,
  tokenize,
} from "./normalize.mjs";

test("dijakritika se skida, a `đ` postaje `dj` u oba smera", () => {
  assert.equal(normalizeText("Razređivač"), "razredjivac");
  assert.equal(normalizeText("razredjivac"), "razredjivac");
  assert.equal(normalizeText("Učvršćivač"), "ucvrscivac");
  assert.equal(normalizeText("ŠMIRGLA žuta ćošak"), "smirgla zuta cosak");
});

test("decimalni zarez i tačka daju isti token", () => {
  assert.deepEqual(new Set(tokenize("3,5 l")), new Set(tokenize("3.5 l")));
  assert.equal(normalizeText("3,5"), "3.5");
});

test("tačka koja nije decimalna je separator", () => {
  assert.deepEqual(tokenize("Pasta 190."), ["pasta", "190"]);
  assert.deepEqual(tokenize("Spray.Bike"), ["spray", "bike"]);
});

test("broj i jedinica se razlažu u oba zapisa", () => {
  const joined = new Set(tokenize("600ml"));
  const spaced = new Set(tokenize("600 ml"));
  for (const token of ["600", "ml", "600ml"]) {
    assert.ok(joined.has(token), `„600ml" nema token ${token}`);
    assert.ok(spaced.has(token), `„600 ml" nema token ${token}`);
  }
});

test("oznaka modela ostaje ceo token", () => {
  assert.deepEqual(tokenize("C 2E50"), ["c", "2e50"]);
  assert.equal(compactText("C 2E50"), "c2e50");
  assert.equal(compactText("c-2e50"), "c2e50");
});

test("separatori u SKU-u ne menjaju kompaktni oblik", () => {
  assert.equal(
    compactText("CL-AUTOMOTIVE-250-400-ML"),
    compactText("cl automotive 250 400 ml"),
  );
});

test("mera se traži samo kao spojen token", () => {
  /*
   * Razlaganje na „600" I „ml" je uklonjeno jer je poklapalo šifru u jednom
   * polju i jedinicu u drugom (`FB 600` na pakovanju od 400 ml). Indeksna
   * strana emituje spojen oblik svuda gde mera stvarno postoji.
   */
  assert.deepEqual(tokenAlternatives("600ml"), [["600ml"]]);
  assert.deepEqual(tokenAlternatives("antichip"), [["antichip"]]);
  assert.ok(tokenize("600 ml").includes("600ml"));
  assert.ok(tokenize("600ml").includes("600ml"));
});

test("mera se prepoznaje u svim oblicima", () => {
  for (const token of ["600", "ml", "600ml", "3.5", "3.5l", "l", "1kg"]) {
    assert.ok(isMeasureToken(token), `„${token}" nije prepoznat kao mera`);
  }
  for (const token of ["ral", "antichip", "2e50", "sjaj", "cl"]) {
    assert.ok(!isMeasureToken(token), `„${token}" je pogrešno prepoznat kao mera`);
  }
});

test("reči upita spajaju meru pisanu razdvojeno", () => {
  assert.deepEqual(queryWords("600 ml"), ["600ml"]);
  assert.deepEqual(queryWords("3.5 l"), ["3.5l"]);
  assert.deepEqual(queryWords("antichip 400 ml"), ["antichip", "400ml"]);
  assert.deepEqual(queryWords("molotow chrome"), ["molotow", "chrome"]);
});

test("transpozicija je jedna greška, ne dve", () => {
  assert.equal(boundedEditDistance("antichip", "antihcip", 2), 1);
  assert.equal(boundedEditDistance("antichip", "antichp", 2), 1);
  assert.equal(boundedEditDistance("antichip", "zzzzzzzz", 2), 3);
});

test("tolerancija raste sa dužinom tokena, kratki nemaju nijednu", () => {
  assert.equal(fuzzyToleranceFor("ral"), 0);
  assert.equal(fuzzyToleranceFor("lak"), 0);
  assert.equal(fuzzyToleranceFor("prajmer"), 1);
  assert.equal(fuzzyToleranceFor("antichip"), 2);
});

test("prazan i beskoristan upit ne daju tokene", () => {
  assert.deepEqual(tokenize(""), []);
  assert.deepEqual(tokenize("   "), []);
  assert.deepEqual(tokenize("---"), []);
});
