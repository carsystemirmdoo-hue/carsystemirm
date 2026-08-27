import { createHash, randomBytes } from "node:crypto";

/**
 * Provera okruženja pre QA prolaza.
 *
 * Zašto postoji
 * -------------
 * Prvi browser prolaz je pao na osmom koraku sa „Nedostaje
 * PORTAL_MFA_MASTER_KEY_V1", pa je osam narednih koraka palo kaskadno — jer je
 * svaki od njih zavisio od MFA tajne koja nikad nije nastala. Poruka o pravom
 * uzroku bila je zakopana među osam posledica.
 *
 * Zato se okruženje proverava **pre** nego što se bilo šta pokrene, i prolaz
 * staje odmah, sa jednim jasnim razlogom.
 *
 * Nijedna funkcija ovde ne vraća i ne ispisuje vrednost ključa.
 */

/** AES-256 traži 32 bajta; kraći ključ se odbija. Vidi `lib/auth/mfa-crypto.mjs`. */
export const MIN_KEY_BYTES = 32;

/**
 * Namenska QA promenljiva, odvojena od produkcijske.
 *
 * Odvojeno ime je zaštita, ne udobnost: da runner čita `PORTAL_MFA_MASTER_KEY_V1`,
 * dovoljno bi bilo da je produkcijski ključ slučajno u ljusci pa da QA prolaz
 * počne da šifruje test podatke pravim ključem.
 */
export const QA_KEY_VAR = "QA_MFA_MASTER_KEY_V1";

/** Otisak za poređenje bez otkrivanja vrednosti. */
function otisak(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
}

/**
 * Proverava QA master ključ.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {{ ok: boolean, reason: string | null, bytes: number }}
 */
export function checkQaMasterKey(env = {}) {
  const raw = env[QA_KEY_VAR];

  if (typeof raw !== "string" || raw.trim() === "") {
    return { ok: false, reason: "missing", bytes: 0 };
  }

  const bytes = Buffer.from(raw.trim(), "base64").length;
  if (bytes < MIN_KEY_BYTES) {
    return { ok: false, reason: "too-short", bytes };
  }

  /*
   * QA ključ ne sme biti isti kao produkcijski.
   *
   * Poređenje ide preko otiska, pa nijedna vrednost ne mora da postoji u
   * poruci kada provera padne.
   */
  const produkcijski = env.PORTAL_MFA_MASTER_KEY_V1;
  if (produkcijski && otisak(produkcijski) === otisak(raw)) {
    return { ok: false, reason: "same-as-production", bytes };
  }

  return { ok: true, reason: null, bytes };
}

/** Poruke za čoveka. Nijedna ne sadrži vrednost. */
export const QA_ENV_MESSAGES = {
  missing:
    `${QA_KEY_VAR} nije postavljen. Bez njega MFA ne može ni da se veže ni da se ` +
    "proveri, pa bi ceo browser prolaz pao kaskadno.\n" +
    `  Postavite JEDNOKRATNI test ključ:  export ${QA_KEY_VAR}="$(openssl rand -base64 32)"`,
  "too-short":
    `${QA_KEY_VAR} je prekratak. Traži se base64 zapis od najmanje ${MIN_KEY_BYTES} bajta.\n` +
    `  Ispravno:  export ${QA_KEY_VAR}="$(openssl rand -base64 32)"`,
  "same-as-production":
    `${QA_KEY_VAR} ima isti otisak kao PORTAL_MFA_MASTER_KEY_V1. QA prolaz ne sme ` +
    "koristiti produkcijski ključ — napravite zaseban jednokratni.",
};

/**
 * Ključevi koje QA potproces dobija.
 *
 * Vraća JEDAN skup vrednosti, koji koriste i roditeljski proces i pokrenuti
 * server. To je suština popravke: raniji runner je detetu davao nasumičan ključ,
 * a sebi nijedan — pa je dozvola koju roditelj izda bila potpisana jednim
 * ključem, a server ju je proveravao drugim. Otisci se nikad ne bi poklopili.
 *
 * @param {Record<string, string | undefined>} env
 */
export function qaCryptoEnv(env = {}) {
  const key = env[QA_KEY_VAR];
  return {
    PORTAL_MFA_MASTER_KEY_V1: key,
    PORTAL_MFA_ACTIVE_KEY_VERSION: "1",
    // Ostale tajne smeju biti nasumične po prolazu; ne moraju biti stabilne
    // između procesa jer se ne koriste za otiske koji putuju kroz bazu.
    AUTH_SECRET: env.AUTH_SECRET ?? randomBytes(32).toString("base64"),
    AUTH_RATE_LIMIT_HMAC_KEY:
      env.AUTH_RATE_LIMIT_HMAC_KEY ?? randomBytes(32).toString("base64"),
  };
}
