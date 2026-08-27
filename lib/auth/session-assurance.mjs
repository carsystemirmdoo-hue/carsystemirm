/**
 * Nivo pouzdanosti sesije.
 *
 * Do sada je sesija bila binarna: postoji ili ne postoji. Sa drugim faktorom to
 * nije dovoljno — postoji stanje između, kada je lozinka tačna ali drugi faktor
 * još nije dat. Bez imena za to stanje jedini izbor bi bio „pusti ga" ili
 * „odbij ga", a treba nam treće: pusti ga **samo** na vezivanje.
 *
 * @typedef {"password" | "mfa" | "recovery"} AssuranceLevel
 */

/** Samo lozinka. Nedovoljno za portal kada je drugi faktor obavezan. */
export const ASSURANCE_PASSWORD = "password";
/** Lozinka + TOTP. Pun pristup. */
export const ASSURANCE_MFA = "mfa";
/** Lozinka + rezervni kod. Ravnopravno sa `mfa`, ali se posebno beleži. */
export const ASSURANCE_RECOVERY = "recovery";

export const ASSURANCE_LEVELS = [
  ASSURANCE_PASSWORD,
  ASSURANCE_MFA,
  ASSURANCE_RECOVERY,
];

/**
 * Da li je drugi faktor stvarno dat.
 *
 * `recovery` se računa kao potvrđen drugi faktor: rezervni kod je zamena za
 * authenticator, ne slabija verzija lozinke. Razlika je samo u tome što se
 * posebno beleži i što korisniku prikazuje upozorenje.
 *
 * Prima proizvoljan tekst, ne samo poznate nivoe: vrednost stiže iz tokena i
 * ne sme se pretpostaviti da je ispravna. Sve što nije `mfa` ili `recovery`
 * tretira se kao nedovoljno.
 *
 * @param {string | null | undefined} level
 * @returns {boolean}
 */
export function isSecondFactorSatisfied(level) {
  return level === ASSURANCE_MFA || level === ASSURANCE_RECOVERY;
}

/**
 * Koliko dugo potvrda drugog faktora važi za osetljive radnje.
 *
 * Sesija traje osam sati, ali brisanje naloga ili promena lozinke ne smeju
 * proći na osnovu potvrde od jutros. Ovo je „sudo" prozor.
 */
export const RECENT_MFA_WINDOW_MS = 10 * 60_000;

/**
 * Da li je drugi faktor potvrđen dovoljno skoro za osetljivu radnju.
 *
 * @param {number | null | undefined} verifiedAtMs  epoch ms
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isMfaRecent(verifiedAtMs, now = new Date()) {
  if (typeof verifiedAtMs !== "number" || !Number.isFinite(verifiedAtMs)) {
    return false;
  }
  const age = now.getTime() - verifiedAtMs;
  // Negativno znači token iz budućnosti — ne veruje se.
  return age >= 0 && age <= RECENT_MFA_WINDOW_MS;
}

/**
 * Polja koja smeju u token.
 *
 * Namerno kratak spisak. Sve ostalo — uloga, dozvole, stanje MFA, ključevi —
 * čita se iz baze pri svakom zahtevu, pa oduzimanje prava deluje odmah i ništa
 * osetljivo ne putuje kroz kolačić.
 */
export const ALLOWED_TOKEN_FIELDS = [
  "sub",
  "assurance",
  "mfaVerifiedAt",
  "sessionVersion",
];

/**
 * Provera da u token nije ušlo nešto što ne sme.
 *
 * Postoji da bi test mogao da tvrdi ugovor, a ne samo da ga opiše.
 *
 * @param {Record<string, unknown>} token
 * @returns {string[]} imena polja koja ne pripadaju tokenu
 */
export function forbiddenTokenFields(token) {
  const standard = new Set(["iat", "exp", "jti", "nbf", "iss", "aud", "name", "email", "picture"]);
  return Object.keys(token ?? {}).filter(
    (key) => !ALLOWED_TOKEN_FIELDS.includes(key) && !standard.has(key),
  );
}
