/**
 * Šifrovanje MFA tajne i izvođenje ključeva.
 *
 * TOTP tajna je ekvivalent lozinke: ko je pročita, može da generiše kodove
 * zauvek. Zato u bazi nikada ne stoji u čitljivom obliku, a u aplikaciji postoji
 * samo u trenutku provere koda.
 *
 * Postupak
 * --------
 * AES-256-GCM iz `node:crypto`, bez dodatne zavisnosti. GCM je izabran jer uz
 * poverljivost daje i **proveru celovitosti**: izmenjen ciphertext ili tag ne
 * daju pogrešnu tajnu nego grešku. Bez toga bi napadač sa pristupom bazi mogao
 * da menja bajtove i posmatra ponašanje.
 *
 * Izvođenje ključeva
 * ------------------
 * Iz jednog master ključa se HKDF-om izvode DVA odvojena ključa, sa različitim
 * `info` oznakama:
 *
 *   - `mfa-secret-encryption` → AES ključ za TOTP tajnu,
 *   - `recovery-code-hmac`    → ključ za HMAC recovery kodova.
 *
 * Isti sirovi ključ se ne sme koristiti za dve namene: kompromitovana jedna
 * upotreba tada otvara i drugu, a i kriptografski je loša praksa ponovo koristiti
 * ključ u različitim algoritmima.
 *
 * Verzionisanje
 * -------------
 * Uz svaki zapis se čuva verzija ključa. Rotacija ključa tako ne traži da se svi
 * postojeći zapisi prepišu odjednom — stari se i dalje mogu pročitati dok se ne
 * presele. Aktivna verzija se bira `PORTAL_MFA_ACTIVE_KEY_VERSION`.
 *
 * Ako ključ nedostaje, sve operacije **padaju zatvoreno** (bacaju), umesto da
 * tiho rade sa slabijom zaštitom.
 */

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/** AES-256-GCM: 32-bajtni ključ, 12-bajtni IV, 16-bajtni tag. */
const KEY_BYTES = 32;
export const IV_BYTES = 12;
/** Dužinu taga postavlja sam GCM; ovde stoji radi provere u testu. */
export const TAG_BYTES = 16;

/** Oznake namene za HKDF. Menjanje bilo koje obesmišljava postojeće zapise. */
const INFO_SECRET_ENCRYPTION = "carsystem:mfa-secret-encryption:v1";
const INFO_RECOVERY_HMAC = "carsystem:recovery-code-hmac:v1";

/** Ime promenljive sa master ključem za datu verziju. */
export function masterKeyEnvName(version) {
  return `PORTAL_MFA_MASTER_KEY_V${version}`;
}

export class MfaKeyMissingError extends Error {
  constructor(version) {
    super(
      `Nedostaje ${masterKeyEnvName(version)}. MFA operacije su onemogućene.`,
    );
    this.name = "MfaKeyMissingError";
    this.keyVersion = version;
  }
}

export class MfaDecryptError extends Error {
  constructor(message = "MFA tajna se ne može pročitati.") {
    super(message);
    this.name = "MfaDecryptError";
  }
}

/**
 * Aktivna verzija ključa.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {number}
 */
export function activeKeyVersion(env = {}) {
  const raw = env.PORTAL_MFA_ACTIVE_KEY_VERSION;
  const parsed = Number.parseInt(raw ?? "1", 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(
      "PORTAL_MFA_ACTIVE_KEY_VERSION mora biti ceo broj veći od nule.",
    );
  }
  return parsed;
}

/**
 * Master ključ za datu verziju, kao bajtovi.
 *
 * Očekuje se base64 zapis od najmanje 32 bajta. Kraći ključ se odbija — bolje
 * da MFA ne radi nego da radi sa slabim ključem.
 *
 * @param {number} version
 * @param {Record<string, string | undefined>} env
 * @returns {Buffer}
 */
function masterKey(version, env) {
  const raw = env[masterKeyEnvName(version)];
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new MfaKeyMissingError(version);
  }

  const key = Buffer.from(raw.trim(), "base64");
  if (key.length < KEY_BYTES) {
    throw new Error(
      `${masterKeyEnvName(version)} mora imati najmanje ${KEY_BYTES} bajta (base64).`,
    );
  }
  return key;
}

/**
 * Izvedeni ključ za tačno jednu namenu.
 *
 * @param {number} version
 * @param {string} info  oznaka namene
 * @param {Record<string, string | undefined>} env
 * @returns {Buffer}
 */
function derivedKey(version, info, env) {
  const master = masterKey(version, env);
  // Salt je namerno prazan: HKDF ga sme izostaviti kada je ulazni materijal već
  // visokoentropijski, a `info` nosi razdvajanje namena.
  return Buffer.from(hkdfSync("sha256", master, Buffer.alloc(0), info, KEY_BYTES));
}

/**
 * Da li je MFA konfiguracija upotrebljiva.
 *
 * Koristi se da portal može da radi u razvoju dok MFA nije uključen, a da u
 * produkciji sa obaveznim MFA odbije da krene bez ključa.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {boolean}
 */
export function isMfaConfigured(env = {}) {
  try {
    derivedKey(activeKeyVersion(env), INFO_SECRET_ENCRYPTION, env);
    return true;
  } catch {
    return false;
  }
}

/**
 * @typedef {object} EncryptedSecret
 * @property {string} ciphertext  base64
 * @property {string} iv          base64, 12 bajtova
 * @property {string} authTag     base64, 16 bajtova
 * @property {number} keyVersion
 */

/**
 * Šifruje TOTP tajnu.
 *
 * IV je slučajan za svaki poziv — ista tajna šifrovana dvaput daje različit
 * zapis. Ponovljeni IV uz isti ključ u GCM-u ruši celu garanciju, pa se nikad ne
 * izvodi iz sadržaja.
 *
 * @param {Buffer | Uint8Array} secret  sirova TOTP tajna
 * @param {Record<string, string | undefined>} env
 * @returns {EncryptedSecret}
 */
export function encryptMfaSecret(secret, env = {}) {
  if (!secret || secret.length === 0) {
    throw new Error("Prazna MFA tajna se ne šifruje.");
  }

  const version = activeKeyVersion(env);
  const key = derivedKey(version, INFO_SECRET_ENCRYPTION, env);
  const iv = randomBytes(IV_BYTES);

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(secret)),
    cipher.final(),
  ]);

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: version,
  };
}

/**
 * Dešifruje TOTP tajnu.
 *
 * Baca `MfaDecryptError` na svaku neispravnost — pogrešan ključ, izmenjen
 * ciphertext ili izmenjen tag daju isti ishod, pa se iz ponašanja ne može
 * zaključiti šta je tačno pokvareno.
 *
 * @param {EncryptedSecret} record
 * @param {Record<string, string | undefined>} env
 * @returns {Buffer}
 */
export function decryptMfaSecret(record, env = {}) {
  if (!record || typeof record !== "object") {
    throw new MfaDecryptError();
  }

  const { ciphertext, iv, authTag, keyVersion } = record;
  if (!ciphertext || !iv || !authTag) throw new MfaDecryptError();

  // Verzija iz ZAPISA, ne aktivna — tako stari zapisi ostaju čitljivi posle
  // rotacije ključa.
  const version = Number(keyVersion);
  if (!Number.isInteger(version) || version < 1) throw new MfaDecryptError();

  let key;
  try {
    key = derivedKey(version, INFO_SECRET_ENCRYPTION, env);
  } catch (error) {
    if (error instanceof MfaKeyMissingError) throw error;
    throw new MfaDecryptError();
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(authTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64")),
      decipher.final(),
    ]);
  } catch {
    // Ovde završava i izmenjen tag i pogrešan ključ — namerno isti ishod.
    throw new MfaDecryptError();
  }
}

/**
 * Otisak recovery koda.
 *
 * HMAC sa izvedenim ključem, ne obična hash funkcija: bez ključa napadač sa
 * kopijom baze može da predračuna otiske, jer su kodovi iz poznatog alfabeta.
 * Recovery kodovi su visokoentropijski tokeni, pa im ne treba spora KDF —
 * treba im tajni ključ.
 *
 * @param {string} code
 * @param {Record<string, string | undefined>} env
 * @param {number} [version]
 * @returns {string} base64
 */
export function recoveryCodeFingerprint(code, env = {}, version) {
  const keyVersion = version ?? activeKeyVersion(env);
  const key = derivedKey(keyVersion, INFO_RECOVERY_HMAC, env);
  return createHmac("sha256", key)
    .update(normalizeRecoveryCode(code))
    .digest("base64");
}

/**
 * Normalizacija unetog recovery koda.
 *
 * Korisnik ga prepisuje sa papira: crtice, razmaci i mala slova se uklanjaju pre
 * poređenja, da tačan kod ne padne zbog načina kucanja.
 *
 * @param {unknown} code
 * @returns {string}
 */
export function normalizeRecoveryCode(code) {
  return typeof code === "string"
    ? code.replace(/[\s-]/g, "").toUpperCase()
    : "";
}

/**
 * Poređenje otisaka u konstantnom vremenu.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function fingerprintsMatch(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const left = Buffer.from(a, "base64");
  const right = Buffer.from(b, "base64");
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
