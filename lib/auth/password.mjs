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
