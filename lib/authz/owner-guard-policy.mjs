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
