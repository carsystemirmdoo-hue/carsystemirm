/**
 * Opseg kupčeve sesije — čista pravila, bez baze i bez `next/navigation`.
 *
 * Odvojeno da bi se izolacija mogla dokazati testom, a ne obećanjem: sva tri
 * pravila ispod su tvrdnje koje bi inače živele razbacane po handlerima, gde ih
 * niko ne bi mogao pročitati na jednom mestu.
 */

/** Vrednost `subject` claim-a u tokenu. Kupac mora biti IZRIČIT. */
export const SUBJECT_INTERNAL = "internal";
export const SUBJECT_CUSTOMER = "customer";

/**
 * Stanja naloga koja uopšte smeju da se prijave.
 *
 * SAMO `active`. `approved` znači „poziv izdat, kupac još nije postavio
 * lozinku" — takav nalog nema `password_hash` i ne sme se prijaviti. Ranije je
 * `approved` bio dovoljan jer je kancelarija postavljala početnu lozinku;
 * postflight audit (F-6) je to ukinuo.
 */
export const SIGNABLE_CUSTOMER_STATUSES = ["active"];

/**
 * Da li token sme da bude protumačen kao KUPČEV.
 *
 * Traži se izričito `subject === "customer"`. Odsustvo claim-a se NE tumači kao
 * kupac — tokeni izdati pre uvođenja ovog polja pripadaju internim nalozima, i
 * podrazumevana vrednost sme da vodi samo ka manjem pristupu, nikad ka većem.
 *
 * @param {{ subject?: unknown } | null | undefined} token
 */
export function isCustomerSubject(token) {
  return token?.subject === SUBJECT_CUSTOMER;
}

/**
 * Da li token sme da bude protumačen kao INTERNI.
 *
 * Ovde je odsustvo dozvoljeno, jer je interni nalog zatečeno stanje i tokeni
 * izdati ranije moraju nastaviti da važe. Izričit `customer` se odbija — nikada
 * se ne sme desiti da kupčev token prođe kroz internu kapiju.
 *
 * @param {{ subject?: unknown } | null | undefined} token
 */
export function isInternalSubject(token) {
  const subject = token?.subject;
  return subject === undefined || subject === null || subject === SUBJECT_INTERNAL;
}

/**
 * Da li se nalog u datom stanju sme prijaviti.
 * @param {string} status
 */
export function canCustomerSignIn(status) {
  return SIGNABLE_CUSTOMER_STATUSES.includes(status);
}

/*
 * `resolveCustomerScope` je UKLONJEN zajedno sa `assertCustomerScope`.
 *
 * Opisivao je pravilo „ID iz zahteva se odbija" za rute koje ne postoje.
 * Pravilo i dalje važi, ali ga danas garantuje STRUKTURA, ne funkcija:
 * `app/kupac/page.tsx` ne prima `searchParams` ni `params`, pa tuđi ID nema
 * kuda da uđe. Test `customerIsolation.test.mjs` to proverava nad izvorom.
 */

/**
 * Opseg kupaca za INTERNOG korisnika, kao lista za `WHERE … IN (…)`.
 *
 * Vraća `null` kada korisnik sme da vidi sve — pozivalac tada izostavlja uslov.
 * Prazna lista NIJE isto što i `null`: komercijalista bez ijedne dodele mora
 * dobiti prazan rezultat, ne sve kupce. To je razlika zbog koje ova funkcija
 * postoji umesto da svaki upit sam gradi uslov.
 *
 * @param {{ role: string, permissions?: readonly string[] }} user
 * @param {readonly string[]} assignedCustomerIds
 * @param {(user: any) => boolean} seesAll
 *   Namerno `any`: `seesAllCustomers` prima suženi `Role`, a funkcija koja
 *   prima samo `Role` nije dodeljiva parametru koji obećava bilo koji `string`
 *   (kontravarijantnost). Sam poziv je i dalje tipski proveren kod pozivaoca.
 * @returns {string[] | null}
 */
export function customerIdScopeFor(user, assignedCustomerIds, seesAll) {
  if (seesAll(user)) return null;
  return [...(assignedCustomerIds ?? [])];
}
