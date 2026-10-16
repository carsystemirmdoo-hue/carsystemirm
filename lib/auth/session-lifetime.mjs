/**
 * Apsolutni rok sesije i identitet pojedinačne sesije (revizija 2026-10-11, B8).
 *
 * Zašto apsolutni rok
 * -------------------
 * Auth.js pri svakom čitanju sesije ponovo izdaje JWT sa novim `exp`, pa je
 * `maxAge` od osam sati u praksi rok MIROVANJA: aktivna (ili ukradena) sesija
 * nikad ne ističe. Vreme prijave (`loginAt`) se postavlja jednom, pri prijavi,
 * i ne pomera se — posle osmočasovne smene potrebna je nova prijava.
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

/** Osmočasovna smena — isto kao `session.maxAge` u `auth.config.ts`. */
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

/** Vremenska zona radnog dana zaposlenih (ponoć = kraj radne sesije). */
export const WORKDAY_TIME_ZONE = "Europe/Belgrade";

const dayIn = (seconds) => new Intl.DateTimeFormat("en-CA", { timeZone: WORKDAY_TIME_ZONE }).format(new Date(seconds * 1000));

/**
 * Radna sesija ZAPOSLENOG (politika vlasnika 16. 10. 2026): jutarnja prijava lozinkom i drugim
 * faktorom važi najviše 8 sati od prijave ili do ponoći po Europe/Belgrade — šta prvo nastupi.
 * Aktivnost ne produžava rok (`loginAt` se ne pomera); sledećeg dana potrebna je nova prijava.
 * Kupčeve sesije ovo ne koriste (samo `isWithinAbsoluteLifetime`).
 *
 * @param {unknown} loginAt sekunde od epohe, iz tokena
 * @param {number} [nowSeconds]
 * @returns {boolean}
 */
export function isWithinStaffWorkday(loginAt, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!isWithinAbsoluteLifetime(loginAt, nowSeconds)) return false;
  // Mali pomak satova unazad ne sme da prebaci prijavu u „sutra“.
  return dayIn(Math.min(/** @type {number} */ (loginAt), nowSeconds)) === dayIn(nowSeconds);
}

/**
 * @param {unknown} sid
 * @returns {sid is string}
 */
export function isValidSessionId(sid) {
  return typeof sid === "string" && SID.test(sid);
}

/**
 * Do kada zapis o opozivu mora da postoji: posle apsolutnog roka token i
 * onako pada, pa se zapis sme obrisati.
 *
 * @param {number} loginAt
 * @returns {Date}
 */
export function revocationExpiresAt(loginAt) {
  return new Date((loginAt + SESSION_ABSOLUTE_SECONDS + CLOCK_SKEW_SECONDS) * 1000);
}
