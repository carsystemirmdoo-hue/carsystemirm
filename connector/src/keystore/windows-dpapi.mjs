import { spawn } from "node:child_process";
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
 * Program je ČITLJIV FAJL, podatak ide kroz stdin
 * ---------------------------------------------
 * PowerShell program je `windows-dpapi.ps1` pored ovog modula, u zaštićenom
 * instalacionom folderu, pokrenut sa `-File` i `-ExecutionPolicy RemoteSigned`.
 * Jedini argument je režim (`zastiti` / `otkljucaj`). Pre svakog pokretanja se
 * proverava SHA-256 fajla; izmenjen fajl se odbija (`dpapi_script_altered`).
 *
 * Ranije je program išao kao skriveni `-EncodedCommand` uz
 * `-ExecutionPolicy Bypass`. To je ispravno odvajalo program od podatka, ali je
 * isti obrazac koji antivirusna heuristika (Avast IDP.HELU.PSE92) blokira na
 * kancelarijskom računaru. `-File` čuva isto odvajanje: program dolazi iz
 * fajla, na stdin-u je samo podatak.
 *
 * PODATAK (materijal ključa) ide ISKLJUČIVO kroz `stdin`, kao jedan red. Nikad
 * kroz argumente (`Get-CimInstance Win32_Process`, istorija komandi, alati za
 * nadzor procesa), nikad kroz promenljive okruženja, nikad kroz privremeni fajl.
 *
 * Format fajla ključa (`cs-dpapi-v1` + DPAPI blob, `CurrentUser`) se NE menja:
 * ključ napravljen ranijom verzijom otključava se i ovom.
 *
 * Izlaz se NE prikazuje
 * ---------------------
 * `stdout` deteta je cev u memoriju ovog procesa, ograničena na
 * `MAX_IZLAZA_BAJTOVA`; nikad se ne nasleđuje na konzolu. `stderr` deteta se
 * prazni da cev ne bi zaustavila dete, ali se sadržaj ne čuva i ne prosleđuje.
 * Greška nosi isključivo stabilan kod.
 */

/** Marker u fajlu, da se šifrovan sadržaj ne pomeša sa plaintext greškom. */
const ZAGLAVLJE = "cs-dpapi-v1";

/** Gornja granica `stdout`-a deteta; DPAPI izlaz ključa je daleko ispod. */
export const MAX_IZLAZA_BAJTOVA = 64 * 1024;

/** Proces koji visi ne sme da zaustavi konektor zauvek. */
export const TIMEOUT_MS = 60_000;

/** Jedini dozvoljen oblik podatka na `stdin`-u: jedan red standardnog base64. */
const BASE64_RED = /^[A-Za-z0-9+/]+={0,2}$/;

export class DpapiError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DpapiError";
    this.code = code;
  }
}

/** Program DPAPI adaptera: čitljiv fajl pored ovog modula (u paketu i u izvoru). */
export const DPAPI_SKRIPTA = fileURLToPath(new URL("./windows-dpapi.ps1", import.meta.url));

/** SHA-256 isporučenog `windows-dpapi.ps1`; test proverava da se poklapa sa fajlom. */
export const DPAPI_SKRIPTA_SHA256 = "2ef582ebf3573d0f96c6dd2a09b7af9e93ddbe8a1b2ff6d02716cb4b782ea9ff";

export const DPAPI_REZIMI = Object.freeze(["zastiti", "otkljucaj"]);

/** Argumenti procesa. Sadrže SAMO putanju programa i režim — nikad podatak. */
export function argumentiZaDpapi(putanjaSkripte, rezim) {
  if (!DPAPI_REZIMI.includes(rezim)) throw new DpapiError("dpapi_mode_invalid", "Nepoznat DPAPI režim.");
  return ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "RemoteSigned", "-File", putanjaSkripte, "-Rezim", rezim];
}

/** Fajl programa mora biti tačno isporučeni — izmenjen program bi video ključ. */
async function proveriSkriptu(putanja, ocekivanSha, citaj = readFile) {
  let bajtovi;
  try {
    bajtovi = await citaj(putanja);
  } catch {
    throw new DpapiError("dpapi_script_missing", "DPAPI program nije pronađen u paketu.");
  }
  if (createHash("sha256").update(bajtovi).digest("hex") !== ocekivanSha) {
    throw new DpapiError("dpapi_script_altered", "DPAPI program u paketu nije isporučena verzija.");
  }
}

/**
 * DPAPI operacija kroz čitljiv `windows-dpapi.ps1`.
 *
 * @param {"zastiti"|"otkljucaj"} rezim
 * @param {string} ulaz jedan red base64 podatka
 * @param {{spawnImpl?: Function, timeoutMs?: number, maxIzlaza?: number,
 *          putanjaSkripte?: string, ocekivanSha?: string, citaj?: Function}} [opcije]
 * @returns {Promise<string>}
 */
export async function pokreniDpapi(rezim, ulaz, opcije = {}) {
  const putanja = opcije.putanjaSkripte ?? DPAPI_SKRIPTA;
  if (ulaz === undefined || !BASE64_RED.test(String(ulaz))) {
    throw new DpapiError("dpapi_input_invalid", "Podatak za DPAPI nije jedan red base64.");
  }
  const argumenti = argumentiZaDpapi(putanja, rezim);
  await proveriSkriptu(putanja, opcije.ocekivanSha ?? DPAPI_SKRIPTA_SHA256, opcije.citaj);
  return pokreniProces(argumenti, ulaz, opcije);
}

/**
 * Pokreće `powershell.exe` sa datim argumentima i šalje (opciono) jedan red
 * podatka na `stdin`. Isti kanal meri i kancelarijska dijagnostika (`D06`).
 *
 * @param {string[]} argumenti
 * @param {string} [ulaz] jedan red base64 podatka; ništa drugo
 * @param {{spawnImpl?: Function, timeoutMs?: number, maxIzlaza?: number}} [opcije]
 * @returns {Promise<string>} `stdout` deteta, bez okolnih belina
 */
function pokreniProces(argumenti, ulaz, opcije = {}) {
  const {
    spawnImpl = spawn,
    timeoutMs = TIMEOUT_MS,
    maxIzlaza = MAX_IZLAZA_BAJTOVA,
  } = opcije;

  return new Promise((resolve, reject) => {
    /*
     * Podatak se proverava PRE pokretanja procesa.
     *
     * Novi red u podatku bi bio drugi red na `stdin`-u, a skripta čita tačno
     * jedan — ostatak bi ostao nepročitan ili, u ranijem modelu, izvršen.
     */
    if (ulaz !== undefined && !BASE64_RED.test(String(ulaz))) {
      reject(new DpapiError("dpapi_input_invalid", "Podatak za DPAPI nije jedan red base64."));
      return;
    }

    let dete;
    try {
      dete = spawnImpl("powershell.exe", argumenti, {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (greska) {
      reject(new DpapiError(kodSpawnGreske(greska), "PowerShell se nije pokrenuo."));
      return;
    }

    const delovi = [];
    let bajtova = 0;
    let gotovo = false;

    const zavrsi = (fn, vrednost) => {
      if (gotovo) return;
      gotovo = true;
      clearTimeout(sat);
      fn(vrednost);
    };

    const ubij = () => {
      try {
        dete.kill();
      } catch {
        /* proces je možda već završio */
      }
    };

    const sat = setTimeout(() => {
      ubij();
      zavrsi(reject, new DpapiError("dpapi_timeout", "DPAPI operacija je prekoračila vreme."));
    }, timeoutMs);

    dete.stdout.on("data", (d) => {
      bajtova += d.length;
      if (bajtova > maxIzlaza) {
        ubij();
        zavrsi(reject, new DpapiError("dpapi_output_too_large", "DPAPI izlaz je prevelik."));
        return;
      }
      delovi.push(d);
    });
    dete.stderr.on("data", () => {});

    dete.on("error", (greska) =>
      zavrsi(reject, new DpapiError(kodSpawnGreske(greska), "PowerShell se nije pokrenuo.")),
    );
    dete.on("close", (kod) => {
      if (kod !== 0) {
        zavrsi(
          reject,
          new DpapiError("dpapi_process_failed", `DPAPI operacija nije uspela (izlazni kod ${kod}).`),
        );
        return;
      }
      zavrsi(resolve, Buffer.concat(delovi).toString("utf8").trim());
    });

    /*
     * `EPIPE` kada dete izađe pre nego što pročita ulaz ne sme da postane
     * neuhvaćen izuzetak — on bi ispisao stack trace sa putanjama.
     */
    dete.stdin.on("error", () => {});
    try {
      if (ulaz !== undefined) dete.stdin.write(`${ulaz}\n`);
      dete.stdin.end();
    } catch {
      /* `close` sa izlaznim kodom nosi pravi ishod */
    }
  });
}

/** Kod greške pokretanja — nikad poruka, koja nosi putanju izvršnog fajla. */
function kodSpawnGreske(greska) {
  const kod = String(greska?.code ?? "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 32);
  return kod ? `dpapi_spawn_${kod.toLowerCase()}` : "dpapi_spawn_failed";
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
export async function sacuvaj({ putanja, privateKeyPkcs8Der }) {
  const sifrovano = await pokreniDpapi("zastiti", Buffer.from(privateKeyPkcs8Der).toString("base64"));
  if (!sifrovano) throw new Error("DPAPI nije vratio šifrovan sadržaj.");

  await mkdir(dirname(putanja), { recursive: true });
  await writeFile(putanja, `${ZAGLAVLJE}\n${sifrovano}\n`, { encoding: "utf8", mode: 0o600 });
  /*
   * `mode` na Windowsu ne postavlja ACL — zato instalaciona skripta zasebno
   * sužava pristup folderu stanja. Ovde ostaje jer isti kod radi i u testu na
   * POSIX-u, gde jeste delotvoran.
   */
  await chmod(putanja, 0o600).catch(() => {});
  return { adapter: adapterIme };
}

/** Čita i otključava ključ. Neuspeh je greška, nikad tihi plaintext fallback. */
export async function ucitaj({ putanja }) {
  const sadrzaj = await readFile(putanja, "utf8");
  const [zaglavlje, telo] = sadrzaj.split("\n");
  if (zaglavlje !== ZAGLAVLJE || !telo) {
    throw new Error("Fajl ključa nije u očekivanom DPAPI obliku.");
  }
  const plain = await pokreniDpapi("otkljucaj", telo.trim());
  if (!plain) throw new Error("DPAPI nije vratio ključ.");
  return new Uint8Array(Buffer.from(plain, "base64"));
}

/** Provera bez trajnih posledica — za `doctor`. */
export async function proveri() {
  const uzorak = Buffer.from("cs-dpapi-provera");
  const sifrovano = await pokreniDpapi("zastiti", uzorak.toString("base64"));
  const nazad = await pokreniDpapi("otkljucaj", sifrovano);
  const ok = Buffer.from(nazad, "base64").equals(uzorak);
  if (!ok) throw new Error("DPAPI provera nije vratila isti sadržaj.");
  return { adapter: adapterIme, ok: true };
}
