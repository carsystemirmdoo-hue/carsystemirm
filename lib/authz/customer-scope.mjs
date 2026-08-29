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

/** Stanja naloga koja uopšte smeju da se prijave. */
export const SIGNABLE_CUSTOMER_STATUSES = ["approved", "active"];

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

/**
 * JEDINI dozvoljeni izvor `customer_id` u kupčevoj putanji.
 *
 * Prima ono što je sesija donela iz baze i ono što je stiglo iz zahteva, i
 * vraća uvek prvo. Postoji da bi „iz sesije, nikad iz URL-a" bilo funkcija koju
 * test može da pozove, umesto pravila koje svaki handler mora da zapamti.
 *
 * Kada zahtev traži DRUGOG kupca, to nije tiho ignorisanje nego odbijanje:
 * kupac koji menja ID u adresi ne sme dobiti svoje podatke kao da se ništa nije
 * desilo — takav pokušaj mora biti vidljiv.
 *
 * @param {object} input
 * @param {string} input.sessionCustomerId  iz baze, po ID-u naloga
 * @param {string | null | undefined} [input.requestedCustomerId]  iz URL-a/body-ja
 * @returns {{ customerId: string, refused: boolean }}
 */
export function resolveCustomerScope({ sessionCustomerId, requestedCustomerId }) {
  if (!sessionCustomerId) {
    throw new Error("Kupčeva sesija bez customer_id — upit se ne sme izvršiti.");
  }
  const refused =
    typeof requestedCustomerId === "string" &&
    requestedCustomerId.length > 0 &&
    requestedCustomerId !== sessionCustomerId;

  return { customerId: sessionCustomerId, refused };
}

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
 * @param {(user: { role: string, permissions?: readonly string[] }) => boolean} seesAll
 * @returns {string[] | null}
 */
export function customerIdScopeFor(user, assignedCustomerIds, seesAll) {
  if (seesAll(user)) return null;
  return [...(assignedCustomerIds ?? [])];
}
