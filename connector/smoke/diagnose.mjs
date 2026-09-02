/**
 * Dijagnostika PowerShell/DPAPI okruženja — pokretač.
 *
 * Ovde je SAMO pokretanje: platforma, mehanizmi, upis fajla i zaštita od
 * neuhvaćenog izuzetka. Sva logika i redakcija su u `diagnose-core.mjs`, pa se
 * mogu testirati bez Windowsa — i pad pokretača se može simulirati.
 *
 * Prva verzija je pala u `spawnSync` PRE ijednog merenja i pritom ispisala
 * stack trace sa apsolutnom putanjom i korisničkim folderom. Oba su ovde
 * strukturno nemoguća: izuzetak pokretanja je nalaz, a ispis prolazi kroz
 * redakciju.
 *
 * Pokretanje:  smoke\\RUN-SMOKE.cmd diagnose
 */

import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { arch, release, tmpdir, version as osVersion } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { izmeri, KODOVI, redigovan, sastaviIzvestaj } from "./diagnose-core.mjs";

const OVDE = dirname(fileURLToPath(import.meta.url));
const SMOKE = join(tmpdir(), "Carsystem Smoke ČĆŽŠĐ");

/** Zajednički argumenti; skripta NIKAD ne ide kroz komandnu liniju. */
const ARGUMENTI = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", "-"];
const TIMEOUT_MS = 30_000;

/* =========================================================================
 * Mehanizmi pokretanja
 * ====================================================================== */

/**
 * Isti put kojim ide STVARNI DPAPI adapter: asinhroni `spawn`, ručni `stdin`.
 *
 * Ovo je merenje koje jedino zaista nešto znači — ako ovaj mehanizam radi, radi
 * i adapter; ako ne radi, uzrok pada `W05`/`W06` je pronađen.
 */
function spawnStdin(skripta, ulaz) {
  return new Promise((resolve, reject) => {
    let dete;
    try {
      dete = spawn("powershell.exe", ARGUMENTI, {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (e) {
      reject(e);
      return;
    }

    let izlaz = "";
    let greska = "";
    let gotov = false;
    const kraj = (fn, arg) => {
      if (gotov) return;
      gotov = true;
      clearTimeout(sat);
      fn(arg);
    };

    const sat = setTimeout(() => {
      dete.kill();
      kraj(reject, Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }));
    }, TIMEOUT_MS);

    dete.stdout.on("data", (d) => (izlaz += d.toString("utf8")));
    dete.stderr.on("data", (d) => (greska += d.toString("utf8")));
    dete.on("error", (e) => kraj(reject, e));
    dete.on("close", (kod) => kraj(resolve, { kod, stdout: izlaz, stderr: greska }));

    try {
      dete.stdin.write(`${skripta}\n`);
      if (ulaz !== undefined) dete.stdin.write(`${ulaz}\n`);
      dete.stdin.end();
    } catch (e) {
      kraj(reject, e);
    }
  });
}

/**
 * `spawnSync` sa `input` — mehanizam koji je na Windowsu pao sa `EINVAL`.
 *
 * Ostaje u spisku NAMERNO. Isti fajl i isti argumenti kao gore; razlika je samo
 * u API-ju i u tome što `stdin` puni Node umesto nas. Ako i dalje pada, to je
 * merenje koje pokazuje da uzrok nije bio ni u skripti ni u okruženju.
 */
async function sinhroniInput(skripta, ulaz) {
  const r = spawnSync("powershell.exe", ARGUMENTI, {
    encoding: "utf8",
    input: `${skripta}\n${ulaz === undefined ? "" : `${ulaz}\n`}`,
    timeout: TIMEOUT_MS,
    windowsHide: true,
  });
  if (r.error) throw r.error;
  return { kod: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/**
 * Bez `stdin`: jedan ASCII red kroz `-Command`.
 *
 * Razdvaja „PowerShell se uopšte ne pokreće" od „stdin kanal ne radi". Skripta
 * koja ovuda ide je uvek jedan red, bez novog reda i bez znaka van ASCII-ja —
 * višelinijski i Unicode sadržaj kroz Windows komandnu liniju je upravo ono što
 * se izbegava.
 */
async function bezStdina(skripta, ulaz) {
  if (ulaz !== undefined) {
    // Ovaj mehanizam nema kanal za ulaz; ne sme da glumi da ga ima.
    throw Object.assign(new Error("bez stdin kanala"), { code: "ENOTSUP" });
  }
  if (/[\r\n]/.test(skripta) || /[^\x20-\x7E]/.test(skripta)) {
    throw Object.assign(new Error("sadržaj nije jednolinijski ASCII"), { code: "ERANGE" });
  }
  const r = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", skripta],
    { encoding: "utf8", timeout: TIMEOUT_MS, windowsHide: true },
  );
  if (r.error) throw r.error;
  return { kod: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

export const MEHANIZMI = [
  { id: "spawn-stdin", opis: "spawn + stdin (put DPAPI adaptera)", pokreni: spawnStdin },
  { id: "spawnSync-input", opis: "spawnSync + input (pao sa EINVAL)", pokreni: sinhroniInput },
  { id: "spawnSync-command", opis: "spawnSync + jednolinijski -Command", pokreni: bezStdina },
];

/* =========================================================================
 * Pokretanje
 * ====================================================================== */

/**
 * Ceo prolaz, u jednoj zaštiti.
 *
 * Šta god da baci — pokretač, merenje ili upis — izveštaj nastaje, a na ekran
 * ide isključivo redigovan tekst i kratak kod.
 */
async function glavna() {
  if (process.platform !== "win32") {
    console.error(
      `Dijagnostika meri Windows okruženje; tekuća platforma je ${process.platform}.`,
    );
    return 2;
  }

  let meta = { shortHead: "nepoznat", sourceHead: "nepoznat" };
  try {
    meta = JSON.parse(readFileSync(join(OVDE, "package-meta.json"), "utf8"));
  } catch {
    /* Bez mete se i dalje meri; verzija je tada nepoznata i to izveštaj kaže. */
  }

  const okolina = {
    os: osVersion(),
    build: release(),
    arch: arch(),
    node: process.versions.node,
  };

  console.log("Carsystem — dijagnostika PowerShell/DPAPI okruženja");
  console.log("Ništa se ne menja; ključ se ne pravi i ne čita.");
  console.log("");

  let rezultat;
  try {
    rezultat = await izmeri({ mehanizmi: MEHANIZMI, log: (red) => console.log(red) });
  } catch (e) {
    /*
     * Ni ovo ne sme da izađe kao stack trace.
     *
     * `izmeri` hvata izuzetke pojedinačnih merenja; ovde ostaje samo nešto
     * potpuno neočekivano, i ono dobija isti tretman: kod, ne poruka.
     */
    const { bezbedanKod } = await import("./diagnose-core.mjs");
    rezultat = {
      nalazi: [],
      radniMehanizam: null,
      kod: KODOVI.spawnPao,
      zakljucak: `Dijagnostika je prekinuta pre merenja (${bezbedanKod(e)}).`,
    };
  }

  const tekst = sastaviIzvestaj({ meta, okolina, ...rezultat });
  const ime = `windows-smoke-diagnose-${String(meta.shortHead).replace(/[^A-Za-z0-9]/g, "")}.md`;

  let upisan = true;
  try {
    writeFileSync(join(SMOKE, ime), tekst);
  } catch {
    upisan = false;
  }

  console.log("");
  console.log(rezultat.zakljucak);
  console.log(`Ishod: ${rezultat.kod}`);
  console.log("");
  if (upisan) {
    console.log(`Izveštaj (redigovan): %TEMP%\\Carsystem Smoke ČĆŽŠĐ\\${ime}`);
  } else {
    /*
     * Folder pravi `run-smoke`; ako dijagnostika ide prva, možda ga nema.
     * Izveštaj se tada ispisuje na ekran — redigovan je, pa sme.
     */
    console.log("Izveštaj se nije mogao upisati; sledi njegov sadržaj:");
    console.log("");
    console.log(tekst);
  }

  // Dijagnostika ne presuđuje: 0 kada je izmerila ili bar zapisala zašto nije.
  return 0;
}

/**
 * Pokreće se SAMO kada je ovaj fajl ulazna tačka.
 *
 * Bez ovog uslova bi `import` iz testa izvršio celu dijagnostiku kao sporedni
 * efekat — na Windowsu bi test koji hoće da izmeri jedan poziv pokrenuo ceo
 * prolaz i upisao izveštaj.
 */
function jeUlaznaTacka() {
  const argv = process.argv[1];
  if (!argv) return false;
  try {
    return fileURLToPath(import.meta.url) === argv;
  } catch {
    return false;
  }
}

/*
 * Poslednja brana.
 *
 * Bez nje bi neuhvaćen izuzetak ispisao stack trace sa `file:///C:/…` putanjom
 * i korisničkim folderom — što se i dogodilo u prvoj verziji.
 */
if (jeUlaznaTacka()) {
  try {
    process.exitCode = await glavna();
  } catch (e) {
    const { bezbedanKod } = await import("./diagnose-core.mjs");
    console.error(`Dijagnostika nije mogla da se izvrši. Kod: ${redigovan(bezbedanKod(e))}`);
    console.error(`Ishod: ${KODOVI.spawnPao}`);
    process.exitCode = 0;
  }
}
