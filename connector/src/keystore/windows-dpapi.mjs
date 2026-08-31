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
 * Tajna kroz CEVI, ne kroz komandnu liniju
 * ----------------------------------------
 * PowerShell se poziva sa skriptom na `stdin`, a materijal ključa se šalje kao
 * zaseban red na `stdin`. Interpolacija u komandnu liniju bi ostavila tajnu u
 * `Get-CimInstance Win32_Process`, u istoriji komandi i u tuđim alatima za
 * nadzor procesa.
 */

/** Marker u fajlu, da se šifrovan sadržaj ne pomeša sa plaintext greškom. */
const ZAGLAVLJE = "cs-dpapi-v1";

function pokreniPowerShell(skripta, ulaz) {
  return new Promise((resolve, reject) => {
    /*
     * `-NoProfile` da tuđi profil ne može da presretne izvršavanje;
     * `-NonInteractive` da nikad ne čeka na unos;
     * `-Command -` čita skriptu sa `stdin`.
     */
    const dete = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", "-"],
      { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
    );

    let izlaz = "";
    let greska = "";
    dete.stdout.on("data", (d) => (izlaz += d.toString("utf8")));
    dete.stderr.on("data", (d) => (greska += d.toString("utf8")));
    dete.on("error", reject);
    dete.on("close", (kod) => {
      if (kod !== 0) {
        /*
         * Poruka PowerShell-a se NE prosleđuje dalje: ume da sadrži deo ulaza
         * i pune putanje. Vraća se samo izlazni kod.
         */
        reject(new Error(`DPAPI operacija nije uspela (izlazni kod ${kod}).`));
        return;
      }
      resolve(izlaz.trim());
    });

    dete.stdin.write(`${skripta}\n`);
    if (ulaz !== undefined) dete.stdin.write(`${ulaz}\n`);
    dete.stdin.end();
  });
}

/*
 * Skripte čitaju red sa `stdin` i rade sa `ProtectedData`.
 *
 * `$ErrorActionPreference = 'Stop'` da tiha greška ne prođe kao prazan izlaz —
 * prazan izlaz bi se lako pročitao kao „ključ je prazan“, a ne kao neuspeh.
 */
const SKRIPTA_ZASTITI = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$plain = [Console]::In.ReadLine()
$bytes = [Convert]::FromBase64String($plain)
$prot = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, 'CurrentUser')
[Convert]::ToBase64String($prot)
`.trim();

const SKRIPTA_OTKLJUCAJ = `
$ErrorActionPreference = 'Stop'
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
