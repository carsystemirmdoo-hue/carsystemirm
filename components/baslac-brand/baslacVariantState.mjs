/**
 * Razrešavanje aktivne Baslac baze iz adrese.
 *
 * Bez Reacta i bez DOM-a, da se ugovor može dokazati testom umesto klikom.
 *
 * Zašto ovde, a ne još jedna kopija u komponenti
 * ----------------------------------------------
 * `BaslacSystemPdp` je imao sopstvenu logiku: čitao je `?varijanta=`, tražio
 * bazu i — ako je nije našao — NIJE radio ništa. Posledica se videla tek na
 * „Nazad": kada bi taj korak uklonio query, adresa bi se vratila a prikaz
 * ostao na prethodno izabranoj bazi. Adresa i ekran bi se razišli.
 *
 * `ProductVariantProvider` iz zajedničkog sloja isti slučaj rešava
 * `resolveActiveVariant`-om, koji pada na početnu varijantu kada upita nema.
 * Umesto da se to pravilo prepiše i ovde, ovaj modul ga POZIVA — pa URL logika
 * ima jednog vlasnika, a Baslac zadržava svoj prikaz i svoj model baze.
 *
 * Adapter je namerno minimalan: `BaslacBase` nosi `code`, a zajednički sloj
 * traži `key`. Ništa drugo se ne izmišlja.
 *
 * @typedef {{ code: string }} BaslacBaseLike
 */

import {
  VARIANT_QUERY_PARAM,
  resolveActiveVariant,
} from "../product/productVariantState.mjs";

export { VARIANT_QUERY_PARAM };

/**
 * Baza u obliku koji zajednički sloj razume.
 *
 * `key` i `id` su ista šifra — Baslac baza nema drugi identifikator, pa se ne
 * pravi sintetički.
 *
 * @param {BaslacBaseLike} base
 * @returns {{ key: string, id: string, base: BaslacBaseLike }}
 */
export function baslacBaseIdentity(base) {
  return { key: base.code, id: base.code, base };
}

/**
 * Aktivna baza za traženi ključ, ili početna kada ključa nema.
 *
 * Redosled je isti kao u zajedničkom sloju: tražena → početna → prva. Zato
 * nepoznat ključ i uklonjen query daju ISTI ishod — početnu bazu — umesto da
 * jedan od njih tiho ostavi prethodni izbor na ekranu.
 *
 * @param {readonly BaslacBaseLike[]} bases
 * @param {string | null | undefined} requested vrednost iz `?varijanta=`
 * @param {string | null | undefined} [initialCode] šifra polazne baze
 * @returns {BaslacBaseLike | null}
 */
export function resolveBaslacBase(bases, requested, initialCode) {
  const list = bases ?? [];
  if (list.length === 0) return null;

  const identities = list.map(baslacBaseIdentity);
  const resolved = resolveActiveVariant(
    identities,
    requested,
    initialCode ?? list[0].code,
  );
  return resolved ? resolved.base : list[0];
}

/**
 * Šifra koju treba upisati u `?varijanta=`.
 *
 * @param {BaslacBaseLike | null | undefined} base
 * @returns {string}
 */
export function baslacVariantQueryValue(base) {
  return base?.code ?? "";
}
