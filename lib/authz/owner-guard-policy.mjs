/**
 * Odluka o tome da li izmena ostavlja firmu bez vlasnika.
 *
 * Izdvojeno iz `security-admin.ts` da bi bilo pozivo iz testa: taj modul je
 * `server-only` i vuče bazu, pa se ne može uvesti u `node --test`. Ovde je čista
 * funkcija bez ijedne zavisnosti — što je i tačno ono što treba proveriti, jer
 * je ovo pravilo, a ne infrastruktura.
 */

/** Uloga koja nosi upravljanje nalozima. */
export const OWNER_ROLE = "gazda";

/**
 * Da li bi izmena uklonila cilj iz skupa AKTIVNIH vlasnika.
 *
 * Tri puta vode do iste posledice — isključivanje naloga, promena uloge i
 * brisanje — i sva tri moraju koristiti isti kriterijum. Da svaki računa po
 * svome, jedan bi pre ili kasnije zaboravio slučaj koji drugi pokriva.
 *
 * @param {{ role: string, active: boolean }} target stanje PRE izmene
 * @param {{ nextRole?: string, nextActive?: boolean }} change šta se menja
 * @returns {boolean}
 */
export function removesActiveOwner(target, change = {}) {
  const wasActiveOwner = target.role === OWNER_ROLE && target.active === true;
  if (!wasActiveOwner) return false;

  const stillOwner = (change.nextRole ?? target.role) === OWNER_ROLE;
  const stillActive = change.nextActive ?? target.active;
  return !(stillOwner && stillActive);
}

/**
 * Da li broj preostalih aktivnih vlasnika dozvoljava izmenu.
 *
 * Namerno odvojeno od upita: upit mora ići pod bravom, a pravilo koje tumači
 * njegov rezultat ne mora — i tako je proverivo.
 *
 * @param {number} remainingOtherOwners aktivni vlasnici RAZLIČITI od cilja
 * @returns {boolean}
 */
export function ownerGuardAllows(remainingOtherOwners) {
  return Number.isInteger(remainingOtherOwners) && remainingOtherOwners >= 1;
}

/**
 * Da li `actor` sme da POSTAVI novog aktivnog vlasnika — bilo otvaranjem novog
 * naloga sa ulogom `OWNER_ROLE`, bilo prebacivanjem postojećeg naloga u nju.
 *
 * Zašto ovo NIJE isto što i `users:manage_security`
 * ---------------------------------------------------
 * Ta sposobnost je namerno delegabilna van uloge „gazda" — paket „Bezbednost
 * naloga" postoji baš zato da gazda može da poveri bezbednosnu administraciju
 * (reset lozinke, isključivanje naloga) nekome ko sam nije vlasnik. Ali pravo
 * da se RESETUJE tuđi pristup nije isto što i pravo da se UMNOŽI broj
 * vlasnika: ko sme da postavi vlasnika mora sam već biti vlasnik. Da je
 * dovoljna delegirana sposobnost, jedan delegiran bezbednosni paket bi bio
 * tačno jedan korak od eskalacije na puno vlasništvo — bez obzira na to koliko
 * je taj paket uzak po nameni.
 *
 * Zašto ne proverava kapacitet ni svežinu MFA
 * ---------------------------------------------
 * To rade `requireCapability`/`requireSecurityAdmin`, koji zavise od sesije i
 * baze i zato ne mogu biti čista funkcija. Ova funkcija odgovara na TAČNO
 * jedno pitanje — sme li OVAJ actor da postavi OVU ciljnu ulogu — i poziva se
 * PRE tih provera, da odbijen pokušaj nikad ne stigne do TOTP provere.
 *
 * @param {{ role: string }} actor stanje IZ SESIJE, nikad iz forme/payload-a
 * @param {string} requestedRole uloga koja se dodeljuje/postavlja
 * @returns {boolean}
 */
export function canGrantOwnerRole(actor, requestedRole) {
  // Obična ciljna uloga ne aktivira ovu kapiju — postojeća autorizacija
  // (`users:manage`, eventualno `users:manage_security` za druge radnje)
  // ostaje jedini uslov, nepromenjena ovom funkcijom.
  if (requestedRole !== OWNER_ROLE) return true;
  return actor?.role === OWNER_ROLE;
}
