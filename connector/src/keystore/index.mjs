import * as dpapi from "./windows-dpapi.mjs";
import * as testAdapter from "./test-insecure.mjs";
import * as macosKeychain from "./macos-keychain.mjs";

/**
 * Bira skladište ključa — i odbija nebezbedno u produkciji.
 *
 * Dva nezavisna uslova moraju biti ispunjena da bi test adapter uopšte bio
 * kandidat: izričita promenljiva i odsustvo produkcionog režima. Jedan uslov bi
 * bio dovoljan da zaboravljena promenljiva na kancelarijskom računaru ostavi
 * ključ nešifrovan.
 */

/** Paket se gradi sa ovom promenljivom; postavlja je `scripts/build.mjs`. */
export const PRODUKCIJA_PROMENLJIVA = "CS_CONNECTOR_PACKAGED";

export class KeystoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "KeystoreError";
    this.code = code;
  }
}

export function jeProdukcioniPaket(env = process.env) {
  return env[PRODUKCIJA_PROMENLJIVA] === "1";
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {{ adapter: object, ime: string }}
 */
export function izaberiAdapter(env = process.env) {
  if (dpapi.dostupan()) return { adapter: dpapi, ime: dpapi.adapterIme };

  if (testAdapter.dostupan(env)) {
    if (jeProdukcioniPaket(env)) {
      /*
       * Fail closed.
       *
       * Spakovan konektor NIKAD ne sme da padne na plaintext ključ, ma šta
       * pisalo u okruženju. Radije staje.
       */
      throw new KeystoreError(
        "insecure_keystore_refused",
        "Test skladište ključa je odbijeno u spakovanom konektoru.",
      );
    }
    return { adapter: testAdapter, ime: testAdapter.adapterIme };
  }
  // macOS Keychain — samo izričito (uvoz istorijske arhive sa Mac-a).
  if (macosKeychain.dostupan(env)) return { adapter: macosKeychain, ime: macosKeychain.adapterIme };

  /*
   * Nema bezbednog skladišta i test nije izričito tražen.
   *
   * Ne pravi se plaintext fallback: bolje da konektor ne radi nego da ključ
   * kojim se potpisuje ulazak u promet leži čitljiv.
   */
  throw new KeystoreError(
    "no_secure_keystore",
    process.platform === "win32"
      ? "Windows DPAPI nije dostupan."
      : process.platform === "darwin"
        ? "Na macOS-u se ključ čuva u Keychain-u tek uz izričito CS_CONNECTOR_MACOS_KEYCHAIN=1."
        : "Van Windows-a i macOS-a nema bezbednog skladišta ključa; ostatak se testira uz izričit test adapter.",
  );
}
