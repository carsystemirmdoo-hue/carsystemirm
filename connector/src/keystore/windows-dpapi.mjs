import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Privatni ključ pod Windows DPAPI, opseg `CurrentUser`.
 *
 * Zašto `CurrentUser`, a ne `LocalMachine`
 * ----------------------------------------
 * `LocalMachine` opseg mogu da otključaju SVI procesi na toj mašini — Microsoft
 * to izričito navodi uz `DataProtectionScope`. Ključ kojim se potpisuje ulazak
 * u promet ne sme da bude dostupan svakom nalogu na računaru.
 *
 * `CurrentUser` vezuje ključ za nalog pod kojim konektor radi. To NE štiti od
 * kompromitovanog naloga koji izvršava konektor — takav napadač ionako može da
 * pozove konektor. Štiti od drugih naloga i od kopiranja fajla na drugi računar.
 *
 * Posledica koju treba znati: autostart i ručno pokretanje MORAJU ići pod istim
 * nalogom. Zadatak pokrenut kao `SYSTEM` ne bi mogao da otključa ključ, i
 * „rešenje“ tog problema prelaskom na `LocalMachine` bi poništilo celu zaštitu.
 *
 * DPAPI se poziva u ISTOM procesu (nativni modul), bez PowerShell-a
 * ----------------------------------------------------------------
 * Ranije je DPAPI išao kroz `powershell.exe` (prvo `-EncodedCommand`, pa
 * čitljiv `-File`). Antivirus na kancelarijskom računaru (Avast Behavior
 * Shield, IDP.HELU.PSE92 i IDP.HELU.PSD11) blokira oba oblika: obrazac
 * „PowerShell + ProtectedData“ je heuristika, ne propust u skripti.
 *
 * Sada `node.exe` sam poziva `CryptProtectData`/`CryptUnprotectData` iz
 * `crypt32.dll`, kroz N-API modul `@primno/dpapi` 2.0.1 (MIT, izvor identičan
 * tagu v2.0.1 na GitHub-u; pregled u docs/b2b/50). Modul je jedan fajl u
 * paketu (`native/dpapi-win32-x64.node`), bez npm instalacije i bez skripti
 * pri instalaciji. Pre učitavanja se proverava njegov SHA-256: izmenjen fajl
 * se odbija (`dpapi_native_altered`) i nikad se ne učitava.
 *
 * Nema procesa-deteta, pa materijal ključa ne prolazi kroz argumente, stdin,
 * promenljive okruženja ni privremeni fajl — ostaje u memoriji ovog procesa.
 *
 * Format fajla ključa se NE menja
 * -------------------------------
 * `cs-dpapi-v1\n<base64 DPAPI bloba>\n`, opseg `CurrentUser`, bez dodatne
 * entropije. Blob koji je napravio .NET `ProtectedData.Protect` (raniji
 * PowerShell kanal) je isti DPAPI blob koji otključava `CryptUnprotectData`:
 * postojeći ključ se otključava bez ponovnog pravljenja.
 *
 * Greške nose samo stabilan kod
 * -----------------------------
 * Poruka nativnog modula se ne prosleđuje. Jedino što iz nje prolazi je
 * Windows kod greške (broj), kao deo koda (`dpapi_unprotect_failed_8009000b`).
 */

/** Marker u fajlu, da se šifrovan sadržaj ne pomeša sa plaintext greškom. */
const ZAGLAVLJE = "cs-dpapi-v1";

/** Opseg DPAPI-ja — jedini dozvoljen; vidi gore. */
const OPSEG = "CurrentUser";

/** Gornja granica podatka u oba smera; PKCS#8 Ed25519 je 48 bajtova, blob ispod 1 KB. */
export const MAX_PODATKA_BAJTOVA = 64 * 1024;

/** Base64 bloba u fajlu: jedan red standardnog base64. */
const BASE64_RED = /^[A-Za-z0-9+/]+={0,2}$/;

export class DpapiError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DpapiError";
    this.code = code;
  }
}

/** Nativni modul: fajl pored ovog modula (u paketu i u izvoru). */
export const NATIVNI_MODUL = fileURLToPath(new URL("./native/dpapi-win32-x64.node", import.meta.url));

/**
 * SHA-256 isporučenog `dpapi-win32-x64.node` = `prebuilds/win32-x64/@primno+dpapi.node`
 * iz npm paketa `@primno/dpapi@2.0.1` (integritet paketa proveren prema registru).
 * Test proverava da se poklapa sa fajlom.
 */
export const NATIVNI_MODUL_SHA256 = "386e7a520b143aa7b6fa1a28a0237391a938bbedd0b245733a3da3a215026a3f";

/** Keš učitanog modula za podrazumevanu putanju; jedan `dlopen` po procesu. */
let ucitanPodrazumevani = null;

/**
 * Učitava nativni modul posle provere platforme i SHA-256.
 *
 * Sve zavisnosti su parametri da bi se svaka grana proverila i van Windowsa.
 *
 * @param {{putanja?: string, ocekivanSha?: string, citaj?: Function, dlopen?: Function,
 *          platforma?: string, arhitektura?: string}} [opcije]
 * @returns {Promise<{protectData: Function, unprotectData: Function}>}
 */
export async function ucitajNativni(opcije = {}) {
  const podrazumevano = Object.keys(opcije).length === 0;
  if (podrazumevano && ucitanPodrazumevani) return ucitanPodrazumevani;

  const {
    putanja = NATIVNI_MODUL,
    ocekivanSha = NATIVNI_MODUL_SHA256,
    citaj = readFile,
    dlopen = (modul, p) => process.dlopen(modul, p),
    platforma = process.platform,
    arhitektura = process.arch,
  } = opcije;

  if (platforma !== "win32" || arhitektura !== "x64") {
    throw new DpapiError("dpapi_native_unsupported", "Nativni DPAPI modul postoji samo za Windows x64.");
  }

  let bajtovi;
  try {
    bajtovi = await citaj(putanja);
  } catch {
    throw new DpapiError("dpapi_native_missing", "Nativni DPAPI modul nije pronađen u paketu.");
  }
  if (createHash("sha256").update(bajtovi).digest("hex") !== ocekivanSha) {
    throw new DpapiError("dpapi_native_altered", "Nativni DPAPI modul u paketu nije isporučena verzija.");
  }

  /*
   * Između provere i učitavanja fajl se ne kopira nigde: instalacioni folder je
   * posle `harden-install-dir.ps1` upisiv samo administratoru, pa nalog koji
   * pokreće konektor ne može da ga zameni između ta dva koraka.
   */
  const modul = { exports: {} };
  try {
    dlopen(modul, putanja);
  } catch {
    throw new DpapiError("dpapi_native_load_failed", "Nativni DPAPI modul se nije učitao.");
  }
  const { protectData, unprotectData } = modul.exports ?? {};
  if (typeof protectData !== "function" || typeof unprotectData !== "function") {
    throw new DpapiError("dpapi_native_invalid", "Nativni DPAPI modul nema očekivane funkcije.");
  }

  const vezivanje = Object.freeze({ protectData, unprotectData });
  if (podrazumevano) ucitanPodrazumevani = vezivanje;
  return vezivanje;
}

/** Windows kod iz poruke nativnog modula („… Error code: 2148073483“) → heks, ništa drugo. */
function windowsKod(greska) {
  const m = /Error code:\s*(-?\d{1,10})\b/.exec(String(greska?.message ?? ""));
  if (!m) return null;
  return (Number(m[1]) >>> 0).toString(16).padStart(8, "0");
}

function proveriPodatak(podatak) {
  if (!(podatak instanceof Uint8Array) || podatak.length === 0 || podatak.length > MAX_PODATKA_BAJTOVA) {
    throw new DpapiError("dpapi_input_invalid", "Podatak za DPAPI nije ispravan niz bajtova.");
  }
}

/**
 * Jedna DPAPI operacija.
 *
 * @param {"zastiti"|"otkljucaj"} rezim
 * @param {Uint8Array} podatak
 * @param {{vezivanje?: {protectData: Function, unprotectData: Function}}} [opcije]
 * @returns {Promise<Uint8Array>}
 */
export async function dpapiOperacija(rezim, podatak, opcije = {}) {
  if (rezim !== "zastiti" && rezim !== "otkljucaj") {
    throw new DpapiError("dpapi_mode_invalid", "Nepoznat DPAPI režim.");
  }
  proveriPodatak(podatak);
  const vezivanje = opcije.vezivanje ?? (await ucitajNativni());
  const osnova = rezim === "zastiti" ? "dpapi_protect_failed" : "dpapi_unprotect_failed";

  /*
   * Sopstvena kopija bez deljenog `ArrayBuffer`-a (Buffer iz bazena ima pomak),
   * obrisana posle poziva — da ulaz za šifrovanje ne ostaje u memoriji duže
   * nego što mora.
   */
  const ulaz = new Uint8Array(podatak);
  let izlaz;
  try {
    izlaz =
      rezim === "zastiti"
        ? vezivanje.protectData(ulaz, null, OPSEG)
        : vezivanje.unprotectData(ulaz, null, OPSEG);
  } catch (greska) {
    const kod = windowsKod(greska);
    throw new DpapiError(
      kod ? `${osnova}_${kod}` : osnova,
      rezim === "zastiti" ? "DPAPI šifrovanje nije uspelo." : "DPAPI otključavanje nije uspelo.",
    );
  } finally {
    ulaz.fill(0);
  }
  if (!(izlaz instanceof Uint8Array) || izlaz.length === 0 || izlaz.length > MAX_PODATKA_BAJTOVA) {
    throw new DpapiError(`${osnova.replace(/_failed$/, "")}_empty`, "DPAPI nije vratio sadržaj.");
  }
  return izlaz;
}

export const adapterIme = "windows-dpapi-currentuser";

export function dostupan() {
  return process.platform === "win32";
}

/**
 * Šifruje i upisuje privatni ključ.
 *
 * Plaintext NIKAD ne dodiruje disk: u fajl ide samo DPAPI izlaz. Nema privremenog
 * plaintext fajla koji bi „samo nakratko“ postojao.
 */
export async function sacuvaj({ putanja, privateKeyPkcs8Der }, opcije = {}) {
  const sifrovano = await dpapiOperacija("zastiti", new Uint8Array(privateKeyPkcs8Der), opcije);

  await mkdir(dirname(putanja), { recursive: true });
  await writeFile(putanja, `${ZAGLAVLJE}\n${Buffer.from(sifrovano).toString("base64")}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  /*
   * `mode` na Windowsu ne postavlja ACL — zato instalaciona skripta zasebno
   * sužava pristup folderu stanja. Ovde ostaje jer isti kod radi i u testu na
   * POSIX-u, gde jeste delotvoran.
   */
  await chmod(putanja, 0o600).catch(() => {});
  return { adapter: adapterIme };
}

/** Čita i otključava ključ. Neuspeh je greška, nikad tihi plaintext fallback. */
export async function ucitaj({ putanja }, opcije = {}) {
  const sadrzaj = await readFile(putanja, "utf8");
  const [zaglavlje, telo] = sadrzaj.split("\n");
  const blob = String(telo ?? "").trim();
  if (zaglavlje !== ZAGLAVLJE || !blob || !BASE64_RED.test(blob)) {
    throw new DpapiError("dpapi_key_file_invalid", "Fajl ključa nije u očekivanom DPAPI obliku.");
  }
  return new Uint8Array(await dpapiOperacija("otkljucaj", Buffer.from(blob, "base64"), opcije));
}

/** Provera bez trajnih posledica — za `doctor`. */
export async function proveri(opcije = {}) {
  const uzorak = Buffer.from("cs-dpapi-provera");
  const sifrovano = await dpapiOperacija("zastiti", uzorak, opcije);
  const nazad = await dpapiOperacija("otkljucaj", sifrovano, opcije);
  if (!Buffer.from(nazad).equals(uzorak)) {
    throw new DpapiError("dpapi_roundtrip_mismatch", "DPAPI provera nije vratila isti sadržaj.");
  }
  return { adapter: adapterIme, ok: true, kanal: "nativni" };
}
