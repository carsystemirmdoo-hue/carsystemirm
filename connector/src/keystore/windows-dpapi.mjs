import { spawn } from "node:child_process";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

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
 * Program i podatak idu kroz DVA RAZLIČITA kanala
 * ----------------------------------------------
 * PowerShell PROGRAM ide kao `-EncodedCommand` (UTF-16LE, base64). Program nije
 * tajna — isti je na svakoj mašini i stoji u ovom fajlu.
 *
 * PODATAK (materijal ključa) ide ISKLJUČIVO kroz `stdin`, kao jedan red. Nikad
 * kroz argumente (`Get-CimInstance Win32_Process`, istorija komandi, alati za
 * nadzor procesa), nikad kroz promenljive okruženja, nikad kroz privremeni fajl.
 *
 * Zašto ne `-Command -` kao ranije
 * --------------------------------
 * Ranija verzija je slala i program i podatak kroz ISTI `stdin`, sa
 * `-Command -`. Taj prekidač znači da PowerShell svoj program čita sa `stdin`-a,
 * pa je red sa ključem, umesto da ga pročita `[Console]::In.ReadLine()`, bio
 * parsiran kao naredba — nepoznata naredba, izlaz 1. Kancelarijska dijagnostika
 * je to izmerila: `D05` (DPAPI bez podatka na stdin-u) prolazi, `D06` (program +
 * podatak na stdin-u) pada. Sa `-EncodedCommand` na `stdin`-u ostaje samo
 * podatak, i `ReadLine()` dobija baš njega.
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

/**
 * PowerShell program kao `-EncodedCommand` vrednost.
 *
 * `-EncodedCommand` po specifikaciji prima base64 UTF-16LE teksta. Tako program
 * prolazi kroz Windows komandnu liniju kao jedan ASCII token, bez navodnika,
 * novih redova i znakova koje bi `CreateProcess` morao da escape-uje.
 */
export function kodiranaKomanda(skripta) {
  return Buffer.from(String(skripta), "utf16le").toString("base64");
}

/** Argumenti procesa. Sadrže SAMO program — nikad podatak. */
export function argumentiZa(skripta) {
  return [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-EncodedCommand",
    kodiranaKomanda(skripta),
  ];
}

/**
 * Pokreće PowerShell program i šalje mu (opciono) jedan red podatka na `stdin`.
 *
 * Isti kanal koristi i kancelarijska dijagnostika (`D06`), pa ono što ona izmeri
 * jeste ponašanje ovog adaptera, a ne njegove kopije.
 *
 * @param {string} skripta PowerShell program
 * @param {string} [ulaz] jedan red base64 podatka; ništa drugo
 * @param {{spawnImpl?: Function, timeoutMs?: number, maxIzlaza?: number}} [opcije]
 * @returns {Promise<string>} `stdout` deteta, bez okolnih belina
 */
export function pokreniPowerShell(skripta, ulaz, opcije = {}) {
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
      dete = spawnImpl("powershell.exe", argumentiZa(skripta), {
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

/*
 * Skripte čitaju TAČNO JEDAN red podatka sa `stdin` i rade sa `ProtectedData`.
 * Sam program stiže kroz `-EncodedCommand`, ne kroz `stdin`.
 *
 * `$ErrorActionPreference = 'Stop'` da tiha greška ne prođe kao prazan izlaz —
 * prazan izlaz bi se lako pročitao kao „ključ je prazan“, a ne kao neuspeh.
 */
const SKRIPTA_ZASTITI = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Security
$plain = [Console]::In.ReadLine()
$bytes = [Convert]::FromBase64String($plain)
$prot = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, 'CurrentUser')
[Convert]::ToBase64String($prot)
`.trim();

const SKRIPTA_OTKLJUCAJ = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Security
$enc = [Console]::In.ReadLine()
$bytes = [Convert]::FromBase64String($enc)
$plain = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, 'CurrentUser')
[Convert]::ToBase64String($plain)
`.trim();

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
  const sifrovano = await pokreniPowerShell(
    SKRIPTA_ZASTITI,
    Buffer.from(privateKeyPkcs8Der).toString("base64"),
  );
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
  const plain = await pokreniPowerShell(SKRIPTA_OTKLJUCAJ, telo.trim());
  if (!plain) throw new Error("DPAPI nije vratio ključ.");
  return new Uint8Array(Buffer.from(plain, "base64"));
}

/** Provera bez trajnih posledica — za `doctor`. */
export async function proveri() {
  const uzorak = Buffer.from("cs-dpapi-provera");
  const sifrovano = await pokreniPowerShell(SKRIPTA_ZASTITI, uzorak.toString("base64"));
  const nazad = await pokreniPowerShell(SKRIPTA_OTKLJUCAJ, sifrovano);
  const ok = Buffer.from(nazad, "base64").equals(uzorak);
  if (!ok) throw new Error("DPAPI provera nije vratila isti sadržaj.");
  return { adapter: adapterIme, ok: true };
}
