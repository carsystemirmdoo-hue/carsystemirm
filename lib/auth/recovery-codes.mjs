/**
 * Jednokratni recovery kodovi.
 *
 * Služe kada korisnik izgubi telefon sa authenticator aplikacijom. Zato su
 * ravnopravna zamena drugom faktoru i moraju imati istu snagu kao i on — nisu
 * „rezervna lozinka".
 *
 * Zašto nisu obrađeni kao lozinke
 * -------------------------------
 * Lozinke su slabe i predvidive, pa im treba spora funkcija za izvođenje ključa
 * (scrypt). Ovi kodovi su nasumični tokeni od 130 bita: gruba sila je nemoguća
 * bez obzira na brzinu funkcije. Ono što im stvarno treba je **tajni ključ** u
 * otisku, da kopija baze ne dozvoli predračunavanje — otuda HMAC, ne hash.
 */

import { randomInt } from "node:crypto";

/** Deset kodova: dovoljno za više gubitaka uređaja, malo da se mogu prepisati. */
export const RECOVERY_CODE_COUNT = 10;

/**
 * Alfabet bez znakova koji se mešaju pri prepisivanju sa papira.
 *
 * Izbačeni su `0`/`O`, `1`/`I`/`L` i `U` (lako se čita kao `V`). Ostaje 26
 * znakova — po 4,7 bita svaki.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Dve grupe po pet znakova: 10 × log2(30) ≈ 49 bita po grupi, 98 ukupno… */
const GROUP_LENGTH = 5;
const GROUPS = 6;

/**
 * Ukupna entropija jednog koda.
 *
 * 30 znakova × 30 pozicija = 30^30 ≈ 2^147. Zahtev je bio najmanje 128 bita
 * **pre formatiranja**; crtice se dodaju samo radi čitljivosti i ne smanjuju je.
 */
export const RECOVERY_CODE_ENTROPY_BITS = Math.floor(
  GROUPS * GROUP_LENGTH * Math.log2(ALPHABET.length),
);

/**
 * Jedan kod, u obliku `XXXXX-XXXXX-…`.
 *
 * Koristi `randomInt` iz `node:crypto`, koji odbacuje pristrasne uzorke —
 * `Math.random()` ovde ne dolazi u obzir, a ni `% ALPHABET.length` nad sirovim
 * bajtom, jer 256 nije deljivo sa 30 pa bi prvi znakovi bili verovatniji.
 *
 * @returns {string}
 */
export function generateRecoveryCode() {
  const groups = [];
  for (let group = 0; group < GROUPS; group += 1) {
    let chunk = "";
    for (let index = 0; index < GROUP_LENGTH; index += 1) {
      chunk += ALPHABET[randomInt(ALPHABET.length)];
    }
    groups.push(chunk);
  }
  return groups.join("-");
}

/**
 * Nov set kodova.
 *
 * Jedinstvenost se proverava u samom setu: dva ista koda bi značila da se jedan
 * unos troši dvaput, a otisak nosi jedinstveni indeks pa bi upis pao.
 *
 * @param {number} [count]
 * @returns {string[]}
 */
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT) {
  const codes = new Set();
  // Sudar je praktično nemoguć na 147 bita; petlja postoji da bi tvrdnja o
  // jedinstvenosti bila garancija, a ne verovatnoća.
  while (codes.size < count) codes.add(generateRecoveryCode());
  return [...codes];
}

/**
 * Da li uneti tekst uopšte liči na recovery kod.
 *
 * Provera oblika pre poređenja štedi jedan HMAC i sprečava da se u tabelu šalje
 * proizvoljno dugačak unos.
 *
 * @param {unknown} code
 * @returns {boolean}
 */
export function looksLikeRecoveryCode(code) {
  if (typeof code !== "string") return false;
  const normalized = code.replace(/[\s-]/g, "").toUpperCase();
  if (normalized.length !== GROUPS * GROUP_LENGTH) return false;
  return [...normalized].every((char) => ALPHABET.includes(char));
}

/**
 * Prikaz kodova za korisnika, kao čist tekst.
 *
 * Namerno bez zaglavlja sa imenom korisnika ili firme: fajl završava u
 * menadžeru lozinki ili na papiru, a što manje konteksta nosi, to manje govori
 * onome ko ga nađe.
 *
 * @param {readonly string[]} codes
 * @returns {string}
 */
export function formatRecoveryCodesForDownload(codes) {
  return [
    "Carsystem i R-M — rezervni kodovi za prijavu",
    "",
    "Svaki kod važi jednom. Čuvajte ih odvojeno od lozinke.",
    "Ako ih potrošite ili izgubite, zatražite nov set.",
    "",
    ...codes,
    "",
  ].join("\n");
}
