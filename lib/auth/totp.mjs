/**
 * TOTP: parametri, provera i pravilo protiv ponovne upotrebe koda.
 *
 * Čista logika oko `otpauth`, bez baze — da se prozor drifta i odbijanje
 * ponovljenog koda mogu dokazati testom, uključujući RFC 6238 vektore.
 */

import { randomBytes } from "node:crypto";
import { Secret, TOTP, URI } from "otpauth";

/**
 * Parametri usklađeni sa onim što standardne authenticator aplikacije
 * podrazumevaju.
 *
 * SHA-1 nije izbor iz nemara: Google Authenticator i veći deo ostalih ignorišu
 * `algorithm` iz `otpauth://` adrese i uvek računaju SHA-1. Postavljanje SHA-256
 * ovde bi značilo da korisnik skenira ključ i dobija kodove koji nikad ne prolaze.
 * TOTP ionako ne štiti od phishinga — vidi napomenu na dnu.
 */
export const TOTP_ISSUER = "Carsystem i R-M";
export const TOTP_ALGORITHM = "SHA1";
export const TOTP_DIGITS = 6;
export const TOTP_PERIOD = 30;

/**
 * Dozvoljeno odstupanje sata, u koracima od 30 s.
 *
 * `1` znači da prolaze prethodni, tekući i sledeći prozor — ukupno 90 sekundi.
 * Podizanje ove vrednosti linearno povećava broj kodova koje napadač pogađa u
 * jednom trenutku, pa se ne diže da bi prošao test sa pomerenim satom.
 */
export const TOTP_WINDOW = 1;

/** Najmanje 20 bajtova, kako RFC 4226 preporučuje za HMAC-SHA1. */
export const TOTP_SECRET_BYTES = 20;

/**
 * Nova slučajna tajna.
 *
 * @returns {{ bytes: Buffer, base32: string }}
 */
export function generateTotpSecret() {
  const bytes = randomBytes(TOTP_SECRET_BYTES);
  return { bytes, base32: secretFrom(bytes).base32 };
}

/**
 * `Secret` iz sirovih bajtova.
 *
 * NE koristi `new Secret({ buffer: buf.buffer })`. Node-ov `Buffer` je pogled
 * nad deljenim pool-om: za tajnu od 20 bajtova `.buffer` vraća ceo pool od
 * 8 KB uz `byteOffset`, pa bi `Secret` dobio pogrešan materijal i nijedan
 * generisani kod se ne bi poklapao. Heksadecimalni zapis nema tu dvosmislenost.
 *
 * @param {Buffer | Uint8Array} bytes
 */
function secretFrom(bytes) {
  return Secret.fromHex(Buffer.from(bytes).toString("hex"));
}

/**
 * TOTP instanca nad datom tajnom.
 *
 * @param {Buffer | Uint8Array} secretBytes
 * @param {string} [label]  nalog koji se prikazuje u aplikaciji
 */
export function totpFor(secretBytes, label = "portal") {
  return new TOTP({
    issuer: TOTP_ISSUER,
    label,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: secretFrom(secretBytes),
  });
}

/**
 * `otpauth://` adresa za ručno vezivanje.
 *
 * Vraća se SAMO prijavljenom korisniku tokom enrollmenta i nikad se ne beleži.
 * QR kod se namerno ne generiše preko treće strane — to bi značilo da tajna
 * napusti sistem.
 *
 * @param {Buffer | Uint8Array} secretBytes
 * @param {string} label
 * @returns {string}
 */
export function totpUri(secretBytes, label) {
  return URI.stringify(totpFor(secretBytes, label));
}

/**
 * Broj TOTP prozora za dati trenutak.
 *
 * @param {Date} [now]
 * @returns {number}
 */
export function counterAt(now = new Date()) {
  return Math.floor(now.getTime() / 1000 / TOTP_PERIOD);
}

/**
 * Provera koda uz utvrđivanje prozora u kome je prihvaćen.
 *
 * `otpauth` vraća delta (−1, 0, +1) ili `null`. Delta se pretvara u apsolutni
 * broj prozora, jer se baš on upisuje kao „poslednji prihvaćeni" — bez toga se
 * ne može znati da li je kod već iskorišćen.
 *
 * @param {object} input
 * @param {Buffer | Uint8Array} input.secretBytes
 * @param {string} input.token
 * @param {string} [input.label]
 * @param {Date} [input.now]
 * @returns {{ valid: boolean, counter: number | null, delta: number | null }}
 */
export function verifyTotp({ secretBytes, token, label = "portal", now = new Date() }) {
  const normalized = normalizeTotpToken(token);
  if (normalized.length !== TOTP_DIGITS) {
    return { valid: false, counter: null, delta: null };
  }

  const delta = totpFor(secretBytes, label).validate({
    token: normalized,
    window: TOTP_WINDOW,
    timestamp: now.getTime(),
  });

  if (delta === null) return { valid: false, counter: null, delta: null };
  return { valid: true, counter: counterAt(now) + delta, delta };
}

/**
 * Uklanja razmake koje aplikacije ubacuju radi čitljivosti („123 456").
 *
 * @param {unknown} token
 * @returns {string}
 */
export function normalizeTotpToken(token) {
  return typeof token === "string" ? token.replace(/\s/g, "") : "";
}

/**
 * Da li se prozor sme prihvatiti s obzirom na poslednji iskorišćeni.
 *
 * Ovo je pravilo protiv ponovne upotrebe: isti kod važi 30 sekundi, pa bi
 * presretnut kod inače prošao i drugi put. Traži se **strogo veći** prozor —
 * time pada i ponovljeni kod i pokušaj da se iskoristi stariji iz dozvoljenog
 * drifta.
 *
 * Sama provera nije dovoljna: upis mora ići istim uslovom u `WHERE`, da dve
 * paralelne prijave ne prođu obe. Vidi `lib/auth/mfa-service.ts`.
 *
 * @param {number} counter
 * @param {number | null | undefined} lastAcceptedCounter
 * @returns {boolean}
 */
export function isCounterFresh(counter, lastAcceptedCounter) {
  if (lastAcceptedCounter === null || lastAcceptedCounter === undefined) {
    return true;
  }
  return counter > lastAcceptedCounter;
}

/*
 * Napomena o dometu zaštite
 * -------------------------
 * TOTP štiti od ukradene lozinke, ali NIJE otporan na phishing: korisnik koji
 * unese kod na lažnu stranu daje napadaču i drugi faktor, jer kod nije vezan za
 * adresu sajta. Passkeys/WebAuthn to rešavaju i ostaju buduće poboljšanje —
 * vidi docs/b2b/02-auth-roles-tenancy.md.
 */
