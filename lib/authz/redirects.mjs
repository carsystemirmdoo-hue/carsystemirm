/**
 * Preusmeravanje na prijavu i povratak posle nje.
 *
 * Putanja zaštićene rute se NIKADA ne nadovezuje na adresu prijave —
 * ide isključivo kao `callbackUrl` parametar. Nadovezivanje bi napravilo
 * nepostojeću rutu tipa `/prijava/dozvole` i završilo na 404 javnog sajta.
 */

export const LOGIN_ROUTE = "/prijava";
export const CALLBACK_PARAM = "callbackUrl";

/** Kupčeva prijava i kupčev prostor — odvojene rute od internog portala. */
export const CUSTOMER_LOGIN_ROUTE = "/prijava/kupac";
export const CUSTOMER_HOME_ROUTE = "/kupac";

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
 * Kupčeva varijanta: dozvoljen je isključivo prostor `/kupac`.
 *
 * Zaseban spisak, a ne parametar postojeće funkcije sa podrazumevanom
 * vrednošću: kupčev token ne sme dobiti povratak u `/portal` ni greškom, a
 * podrazumevana vrednost je tačno onaj oblik greške koji se ne primeti.
 *
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeCustomerCallback(raw) {
  if (typeof raw !== "string" || raw === "") return null;
  if (/[\s\u0000-\u001f\u007f]/.test(raw)) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (/^\/%2f/i.test(raw)) return null;
  if (raw.includes("\\") || raw.includes(":")) return null;

  const [pathOnly] = raw.split(/[?#]/);
  if (
    pathOnly !== CUSTOMER_HOME_ROUTE &&
    !pathOnly.startsWith(`${CUSTOMER_HOME_ROUTE}/`)
  ) {
    return null;
  }
  return raw;
}

/** Prostori u koje kupčev povratak NIKAD ne vodi. */
const CUSTOMER_RETURN_FORBIDDEN = ["/portal", "/prijava", "/api", "/_next"];

/**
 * Kupčev povratak na JAVNI sajt (F5): stranica sa koje je došao, ili `null`.
 *
 * Iste provere oblika kao `normalizeCustomerCallback` (samo relativna putanja,
 * bez šeme, bez `//`, `\`, kontrolnih znakova), ali je dozvoljen ceo javni
 * sajt i `/kupac`. Interni portal, prijava i API su izričito zabranjeni —
 * kupčev token ne sme dobiti ni povratak u `/portal`.
 *
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeCustomerReturn(raw) {
  if (typeof raw !== "string" || raw === "") return null;
  if (/[\s\u0000-\u001f\u007f]/.test(raw)) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (/^\/%2f/i.test(raw)) return null;
  if (raw.includes("\\") || raw.includes(":")) return null;
  const [pathOnly] = raw.split(/[?#]/);
  let decoded;
  try {
    decoded = decodeURIComponent(pathOnly).toLowerCase();
  } catch {
    return null;
  }
  for (const prefix of CUSTOMER_RETURN_FORBIDDEN) {
    if (decoded === prefix || decoded.startsWith(`${prefix}/`)) return null;
  }
  return raw;
}

/**
 * Zajednička kapija za Auth.js `redirect` callback.
 *
 * Prihvata bezbednu putanju iz BILO KOG od dva prostora. Sve ostalo i dalje
 * pada — kapija se proširuje, ne otvara.
 *
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeAnyCallback(raw) {
  // Namerno BEZ `normalizeCustomerReturn`: Auth.js kapija ostaje portal ili
  // `/kupac`. Povratak kupca na javni sajt radi sama akcija prijave (F5).
  return normalizeCallback(raw) ?? normalizeCustomerCallback(raw);
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
