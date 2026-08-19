/**
 * Preusmeravanje na prijavu i povratak posle nje.
 *
 * Putanja zaštićene rute se NIKADA ne nadovezuje na adresu prijave —
 * ide isključivo kao `callbackUrl` parametar. Nadovezivanje bi napravilo
 * nepostojeću rutu tipa `/prijava/dozvole` i završilo na 404 javnog sajta.
 */

export const LOGIN_ROUTE = "/prijava";
export const CALLBACK_PARAM = "callbackUrl";

/** Posle prijave se sme vratiti samo unutar portala. */
const ALLOWED_PREFIX = "/portal";

/**
 * Adresa prijave za zaštićenu putanju.
 *
 * @param {string} [pathname] putanja sa koje je korisnik odbijen
 * @returns {string}
 */
export function loginUrlFor(pathname) {
  const target = normalizeCallback(pathname);
  if (!target) return LOGIN_ROUTE;
  return `${LOGIN_ROUTE}?${CALLBACK_PARAM}=${encodeURIComponent(target)}`;
}

/**
 * Prihvata isključivo putanju unutar portala na istom sajtu.
 *
 * Odbija sve što bi moglo da odvede korisnika van sistema ili u petlju:
 * apsolutne adrese, protokol-relativne (`//zlonamerno`), obrnute kose crte
 * koje neki pregledači normalizuju u `//`, kontrolne znakove i samu prijavu.
 *
 * @param {unknown} raw
 * @returns {string | null} bezbedna putanja ili `null`
 */
export function normalizeCallback(raw) {
  if (typeof raw !== "string") return null;

  const value = raw;
  if (value === "") return null;

  // Bilo kakva belina ili kontrolni znak je razlog za odbijanje, a ne za
  // „čišćenje“. Vrednost se ne skraćuje: ` /portal` i `/portal\nSet-Cookie: …`
  // nisu ono što je sistem izdao, pa im se ne veruje.
  if (/[\s\u0000-\u001f\u007f]/.test(value)) return null;

  // Mora biti relativna putanja sa jednom vodećom kosom crtom.
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  // `/\host` i `/%2F...` pregledači umeju da svedu na protokol-relativnu adresu.
  if (value.startsWith("/\\")) return null;
  if (/^\/%2f/i.test(value)) return null;
  if (value.includes("\\")) return null;

  // Bez šeme (`javascript:`, `http:`) i bez korisničkog dela adrese.
  if (value.includes(":")) return null;

  const [pathOnly] = value.split(/[?#]/);
  if (pathOnly !== ALLOWED_PREFIX && !pathOnly.startsWith(`${ALLOWED_PREFIX}/`)) {
    return null;
  }

  // Povratak na samu prijavu bi napravio petlju.
  if (pathOnly === LOGIN_ROUTE || pathOnly.startsWith(`${LOGIN_ROUTE}/`)) {
    return null;
  }

  return value;
}

/**
 * Odredište posle uspešne prijave: `callbackUrl` ako je bezbedan,
 * inače početni ekran koji odgovara ulozi korisnika.
 *
 * @param {unknown} raw
 * @param {string} roleLanding
 * @returns {string}
 */
export function resolvePostLoginTarget(raw, roleLanding) {
  return normalizeCallback(raw) ?? roleLanding;
}
