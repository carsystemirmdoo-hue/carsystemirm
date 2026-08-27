/**
 * Lozinke: scrypt iz `node:crypto`, bez dodatne zavisnosti.
 * Format zapisa: `scrypt$<N>$<r>$<p>$<saltBase64>$<hashBase64>`
 * Parametri se čuvaju uz hash, pa se mogu pojačati bez migracije postojećih naloga.
 */

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const DEFAULT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;
// scrypt traži ~128 * N * r bajtova; podrazumevani limit u Node-u je manji od toga.
const MAX_MEMORY = 64 * 1024 * 1024;

/**
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  if (typeof password !== "string" || password.length < 10) {
    throw new Error("Lozinka mora imati najmanje 10 karaktera.");
  }
  const salt = randomBytes(16);
  const { N, r, p } = DEFAULT_PARAMS;
  const derived = await scryptAsync(password, salt, KEY_LENGTH, {
    N,
    r,
    p,
    maxmem: MAX_MEMORY,
  });
  return [
    "scrypt",
    N,
    r,
    p,
    salt.toString("base64"),
    Buffer.from(derived).toString("base64"),
  ].join("$");
}

/**
 * Zapis lozinke za nalog koji ne postoji.
 *
 * Bez njega prijava odaje koji nalozi postoje: za nepoznatu e-poštu odgovor
 * stiže odmah, a za poznatu tek pošto scrypt odradi svojih ~100 ms. Ta razlika
 * je merljiva i dovoljna da se izvuče spisak kupaca i zaposlenih.
 *
 * Zato se i za nepoznat nalog izvršava tačno jedna provera — nad ovim zapisom.
 * Parametri su isti kao kod stvarnih lozinki (`DEFAULT_PARAMS`, `KEY_LENGTH`),
 * pa je i cena identična.
 *
 * Vrednost je konstanta, ne tajna iz okruženja: nema šta da se otkrije. Lozinka
 * iz koje je izvedena bila je nasumičnih 32 bajta i odbačena je pri generisanju
 * — ne postoji nigde. Ni u nemogućem slučaju da je neko pogodi ne bi dobio
 * pristup: `authorize` traži i postojećeg korisnika, ne samo tačnu lozinku.
 */
export const ABSENT_USER_PASSWORD_RECORD =
  "scrypt$16384$8$1$tlzfMWRbaKTAkahMkL2JJA==$" +
  "7D6m5xv17wB9H7P5jA1dLIByhUAgUpOUgWgSf+0X3ecOYZjHCPknxZaZ4nPauIIm5aLkNctLBiMw/Tg+aft29g==";

/**
 * Poređenje je uvek u konstantnom vremenu; neispravan zapis vraća `false`
 * umesto izuzetka, da se iz ponašanja ne bi zaključivalo o stanju naloga.
 *
 * @param {string} password
 * @param {string | null | undefined} stored
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, stored) {
  if (typeof password !== "string" || typeof stored !== "string") return false;

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }

  let salt;
  let expected;
  try {
    salt = Buffer.from(parts[4], "base64");
    expected = Buffer.from(parts[5], "base64");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  let derived;
  try {
    derived = Buffer.from(
      await scryptAsync(password, salt, expected.length, {
        N,
        r,
        p,
        maxmem: MAX_MEMORY,
      }),
    );
  } catch {
    return false;
  }

  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
