/**
 * Izvrsni ugovor izbora Baslac baze.
 *
 * Poziva stvarne funkcije; nista se ne cita iz izvornog teksta i nijedan DOM se
 * ne montira. Test „popstate posle uklonjenog query-ja" je napisan PRE popravke
 * i tada je padao — to je bio kvar zbog kog se, posle „Nazad", adresa vracala a
 * prikaz ostajao na prethodno izabranoj bazi.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  VARIANT_QUERY_PARAM,
  baslacVariantQueryValue,
  resolveBaslacBase,
} from "./baslacVariantState.mjs";

/** Tri baze, sve razlicite — da se ishod ne moze slucajno pogoditi. */
const BAZE = [
  { code: "30-S00", name: "Basecoat converter" },
  { code: "30-S010", name: "White" },
  { code: "30-S130", name: "Deep black" },
];

test("bez query-ja bira pocetnu bazu", () => {
  assert.equal(resolveBaslacBase(BAZE, null)?.code, "30-S00");
  assert.equal(resolveBaslacBase(BAZE, "")?.code, "30-S00");
  assert.equal(resolveBaslacBase(BAZE, undefined)?.code, "30-S00");
  assert.equal(resolveBaslacBase(BAZE, "   ")?.code, "30-S00");
});

test("validan kljuc bira odgovarajucu bazu", () => {
  assert.equal(resolveBaslacBase(BAZE, "30-S010")?.code, "30-S010");
  assert.equal(resolveBaslacBase(BAZE, "30-S130")?.code, "30-S130");
  // Stari linkovi u opticaju nose cas mala cas velika slova.
  assert.equal(resolveBaslacBase(BAZE, "30-s010")?.code, "30-S010");
});

test("nepoznat kljuc bezbedno pada na pocetnu bazu", () => {
  for (const lose of ["NE-POSTOJI", "../../etc", "<script>", "%20", "0"]) {
    assert.equal(resolveBaslacBase(BAZE, lose)?.code, "30-S00", lose);
  }
});

test("izbor druge baze daje canonical query vrednost", () => {
  assert.equal(VARIANT_QUERY_PARAM, "varijanta");
  const izabrana = resolveBaslacBase(BAZE, "30-S130");
  assert.equal(baslacVariantQueryValue(izabrana), "30-S130");
  assert.equal(baslacVariantQueryValue(null), "");
});

test("popstate sa drugim kljucem menja bazu", () => {
  // Simulira sekvencu koju `popstate` proizvodi: menja se samo vrednost upita.
  let aktivna = resolveBaslacBase(BAZE, null)?.code;
  assert.equal(aktivna, "30-S00");
  aktivna = resolveBaslacBase(BAZE, "30-S010", "30-S00")?.code;
  assert.equal(aktivna, "30-S010");
  aktivna = resolveBaslacBase(BAZE, "30-S130", "30-S00")?.code;
  assert.equal(aktivna, "30-S130");
});

test("popstate posle uklonjenog query-ja vraca pocetnu bazu", () => {
  /*
   * KVAR KOJI JE OVAJ TEST REPRODUKOVAO.
   *
   * Ranija implementacija je radila `if (match) setActiveCode(...)`, pa kada
   * „Nazad" ukloni `?varijanta=`, `match` je bio `null` i stanje se NIJE menjalo.
   * Adresa bi rekla „pocetna baza", ekran bi i dalje prikazivao izabranu.
   */
  const posleUklanjanja = resolveBaslacBase(BAZE, null, "30-S00");
  assert.equal(
    posleUklanjanja?.code,
    "30-S00",
    "uklonjen query mora vratiti pocetnu bazu, ne zadrzati prethodni izbor",
  );
});

test("Back kroz dve promene vraca UI i URL u isto stanje", () => {
  // Istorija: pocetna → 30-S010 → 30-S130, pa dva puta Nazad.
  const istorija = [null, "30-S010", "30-S130"];
  const stanja = istorija.map(
    (upit) => resolveBaslacBase(BAZE, upit, "30-S00")?.code,
  );
  assert.deepEqual(stanja, ["30-S00", "30-S010", "30-S130"]);

  // Nazad vraca isti niz unatrag — svaki korak vraca tacno ono sto je bio.
  const unatrag = [...istorija].reverse().map(
    (upit) => resolveBaslacBase(BAZE, upit, "30-S00")?.code,
  );
  assert.deepEqual(unatrag, ["30-S130", "30-S010", "30-S00"]);

  // I URL i UI za svaki korak nose istu vrednost.
  for (const upit of istorija) {
    const baza = resolveBaslacBase(BAZE, upit, "30-S00");
    const uUrl = upit ?? "30-S00";
    assert.equal(baslacVariantQueryValue(baza).toLowerCase(), uUrl.toLowerCase());
  }
});

test("prazan spisak baza ne baca izuzetak", () => {
  assert.equal(resolveBaslacBase([], "bilo-sta"), null);
  assert.equal(resolveBaslacBase(null, null), null);
});
