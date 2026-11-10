/**
 * Apsolutni rok sesije i identitet pojedinačne sesije (revizija 2026-10-11, B8).
 *
 * Zašto apsolutni rok
 * -------------------
 * Auth.js pri svakom čitanju sesije ponovo izdaje JWT sa novim `exp`, pa je
 * `maxAge` u praksi rok MIROVANJA: aktivna (ili ukradena) sesija nikad ne
 * ističe. Vreme prijave (`loginAt`) se postavlja jednom, pri prijavi, i ne
 * pomera se — posle roka (kupac 8 h, zaposleni 30 dana) potrebna je nova prijava.
 *
 * Zašto `sid`
 * -----------
 * Odjava je ranije samo brisala kolačić; kopiran token je važio do isteka.
 * Svaka prijava dobija nasumičan `sid`; odjava ga upisuje u
 * `auth_revoked_sessions`, a serverska kapija takav token odbija. Ostali
 * uređaji istog naloga ostaju prijavljeni (za „odjavu svuda“ postoji verzija
 * sesije).
 *
 * Token bez `loginAt` ili `sid` (izdat pre ove izmene) se odbija: posle
 * objave svi se jednom ponovo prijavljuju.
 */

/** Apsolutni rok KUPČEVE sesije (bez „Zapamti me“): osam sati od prijave. */
export const SESSION_ABSOLUTE_SECONDS = 60 * 60 * 8;

/** Tolerancija za razliku satova između instanci. */
const CLOCK_SKEW_SECONDS = 60;

const SID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param {unknown} loginAt sekunde od epohe, iz tokena
 * @param {number} [nowSeconds]
 * @returns {boolean}
 */
export function isWithinAbsoluteLifetime(loginAt, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof loginAt !== "number" || !Number.isFinite(loginAt)) return false;
  if (loginAt > nowSeconds + CLOCK_SKEW_SECONDS) return false;
  return nowSeconds - loginAt <= SESSION_ABSOLUTE_SECONDS;
}

/**
 * Sesija ZAPOSLENOG na jednom uređaju (odluka 10. 11. 2026, zamenjuje „8 h / ponoć“ od 16. 10.):
 * prijava lozinkom i kodom iz aplikacije važi 30 dana od prijave. Aktivnost ne produžava rok
 * (`loginAt` se ne pomera); posle 30 dana potrebna je nova prijava sa kodom.
 * Odjava (`sid`) i „odjava svuda“ (verzija sesije) deluju odmah, a osetljive radnje i dalje
 * traže svež kod (`RECENT_MFA_WINDOW_MS`, 10 minuta).
 * Kupčeve sesije ovo ne koriste (samo `isWithinAbsoluteLifetime` + „Zapamti me“).
 */
export const STAFF_SESSION_SECONDS = 60 * 60 * 24 * 30;

/**
 * @param {unknown} loginAt sekunde od epohe, iz tokena
 * @param {number} [nowSeconds]
 * @returns {boolean}
 */
export function isWithinStaffSession(loginAt, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof loginAt !== "number" || !Number.isFinite(loginAt)) return false;
  if (loginAt > nowSeconds + CLOCK_SKEW_SECONDS) return false;
  return nowSeconds - loginAt <= STAFF_SESSION_SECONDS;
}

/**
 * @param {unknown} sid
 * @returns {sid is string}
 */
export function isValidSessionId(sid) {
  return typeof sid === "string" && SID.test(sid);
}

/**
 * Do kada zapis o opozivu mora da postoji: posle najdužeg roka (sesija
 * zaposlenog, 30 dana) token i onako pada, pa se zapis sme obrisati.
 *
 * @param {number} loginAt
 * @returns {Date}
 */
export function revocationExpiresAt(loginAt) {
  return new Date((loginAt + Math.max(SESSION_ABSOLUTE_SECONDS, STAFF_SESSION_SECONDS) + CLOCK_SKEW_SECONDS) * 1000);
}
