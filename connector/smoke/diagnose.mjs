/**
 * Dijagnostika PowerShell/DPAPI okruženja — kada smoke padne, a uzrok se ne vidi.
 *
 * ZAŠTO POSTOJI
 * =============
 * Prvi stvarni prolaz je vratio `W05: doctor_reported_problem` i
 * `W06: init_failed`, oba bez detalja. Oba vode u isti poziv:
 * `keystore/windows-dpapi.mjs` pokreće `powershell.exe` i, kada ovaj padne,
 * NAMERNO odbacuje njegovu poruku — jer poruka ume da nosi deo ulaza i pune
 * putanje. Bezbedno, ali nedijagnostikovano.
 *
 * Umesto da se nagađa (Constrained Language Mode? Group Policy? AppLocker?
 * `Add-Type` blokiran?), ovaj alat te uslove MERI, svaki posebno, i piše
 * redigovan izveštaj.
 *
 * ŠTA NE RADI
 * ===========
 *  - ne menja nijedno podešavanje računara, ni politiku, ni ACL, ni registry;
 *  - ne pravi i ne čita uređajni ključ; DPAPI proba ide nad 16 bajtova konstante;
 *  - ne dodiruje BizniSoft folder, ne čita nijedan PDF i ne izlazi na mrežu;
 *  - ne ispisuje korisničko ime, ime računara, putanje, ključeve, potpise,
 *    PIB, kupce ni stack trace.
 *
 * Pokretanje:  smoke\\RUN-SMOKE.cmd diagnose
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { arch, release, tmpdir, version as osVersion } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OVDE = dirname(fileURLToPath(import.meta.url));
const META = JSON.parse(readFileSync(join(OVDE, "package-meta.json"), "utf8"));
const SMOKE = join(tmpdir(), "Carsystem Smoke ČĆŽŠĐ");

if (process.platform !== "win32") {
  console.error(
    `Dijagnostika meri Windows okruženje; tekuća platforma je ${process.platform}.\n`,
  );
  process.exit(2);
}

/* =========================================================================
 * Redakcija
 * ====================================================================== */

/**
 * Ista pravila kao u runneru, plus imena naloga.
 *
 * Izveštaj se šalje, pa se ne oslanja na to da PowerShell „verovatno neće"
 * ispisati putanju: sve prolazi kroz filter, i tek onda u fajl.
 */
const SUMNJIVO = [
  /[A-Za-z]:\\[^\s"']+/g,
  /\/(?:Users|home)\/[^\s"']+/g,
  /\\\\[^\s"']+/g,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  /[A-Za-z0-9+/]{40,}={0,2}/g,
  /-----BEGIN [^-]+-----/g,
];

function redigovan(tekst) {
  let t = String(tekst ?? "");
  for (const r of SUMNJIVO) t = t.replace(r, "[redigovano]");
  // Jedan red, ograničena dužina: izveštaj je za čoveka, ne za arhiviranje.
  return t.replace(/\s+/g, " ").trim().slice(0, 300);
}

/* =========================================================================
 * Merenje
 * ====================================================================== */

const nalazi = [];
function meri(id, pitanje, fn) {
  try {
    const r = fn();
    nalazi.push({ id, pitanje, ishod: r.ishod, detalj: redigovan(r.detalj) });
  } catch (e) {
    nalazi.push({ id, pitanje, ishod: "GREŠKA", detalj: redigovan(e?.message) });
  }
  const n = nalazi[nalazi.length - 1];
  console.log(`${n.ishod.padEnd(8)} ${n.id}  ${n.pitanje}${n.detalj ? " :: " + n.detalj : ""}`);
}

/**
 * PowerShell sa skriptom na `stdin` — isti put kojim ide i DPAPI adapter.
 *
 * Namerno se ne koristi `-File`: ono što se ovde meri je da li DPAPI put radi,
 * a on skriptu nikad ne čita sa diska.
 */
function ps(skripta, { ulaz, timeout = 30000 } = {}) {
  const r = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", "-"],
    { encoding: "utf8", input: `${skripta}\n${ulaz === undefined ? "" : `${ulaz}\n`}`, timeout },
  );
  return {
    kod: r.status,
    stdout: (r.stdout ?? "").trim(),
    stderr: (r.stderr ?? "").trim(),
    nemaBinarni: r.error?.code === "ENOENT",
  };
}

console.log("Carsystem — dijagnostika PowerShell/DPAPI okruženja");
console.log("Ništa se ne menja; ključ se ne pravi i ne čita.");
console.log("");

meri("D01", "powershell.exe je dostupan", () => {
  const r = ps("$PSVersionTable.PSVersion.ToString()");
  if (r.nemaBinarni) return { ishod: "NEMA", detalj: "powershell.exe nije pronađen u PATH" };
  if (r.kod !== 0) return { ishod: "PAD", detalj: `izlaz ${r.kod}: ${r.stderr}` };
  return { ishod: "OK", detalj: `PowerShell ${r.stdout}` };
});

meri("D02", "jezički režim (Constrained Language blokira Add-Type)", () => {
  const r = ps("$ExecutionContext.SessionState.LanguageMode.ToString()");
  if (r.kod !== 0) return { ishod: "PAD", detalj: `izlaz ${r.kod}: ${r.stderr}` };
  const rezim = r.stdout;
  /*
   * `ConstrainedLanguage` je najverovatniji tihi uzrok pada DPAPI-ja: u njemu
   * `Add-Type` i pozivi .NET tipova ne rade, a adapter oba koristi.
   */
  return {
    ishod: rezim === "FullLanguage" ? "OK" : "PAŽNJA",
    detalj:
      rezim === "FullLanguage"
        ? "FullLanguage"
        : `${rezim} — Add-Type i .NET pozivi su ograničeni; DPAPI adapter ih traži`,
  };
});

meri("D03", "efektivna politika izvršavanja po opsezima", () => {
  const r = ps("(Get-ExecutionPolicy -List | Out-String)");
  if (r.kod !== 0) return { ishod: "PAD", detalj: `izlaz ${r.kod}: ${r.stderr}` };
  const redovi = r.stdout
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter((x) => /^(MachinePolicy|UserPolicy|Process|CurrentUser|LocalMachine)\s+\S+/.test(x))
    .map((x) => x.replace(/\s+/g, "="));
  /*
   * Politika postavljena kroz Group Policy (`MachinePolicy`/`UserPolicy`) NE
   * MOŽE se pregaziti sa `-ExecutionPolicy Bypass`. To pogađa `-File` pozive,
   * dakle `task.ps1` (W13) — ali ne i DPAPI, koji skriptu šalje na `stdin`.
   */
  const gp = redovi.filter((x) => /^(MachinePolicy|UserPolicy)=/.test(x) && !/=Undefined$/.test(x));
  return {
    ishod: gp.length > 0 ? "PAŽNJA" : "OK",
    detalj:
      redovi.join(" ") +
      (gp.length > 0 ? " — postavljeno Group Policy-jem; -ExecutionPolicy se ignoriše" : ""),
  };
});

meri("D04", "Add-Type System.Security radi", () => {
  const r = ps("$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; 'OK'");
  if (r.kod !== 0 || r.stdout !== "OK") {
    return { ishod: "PAD", detalj: `izlaz ${r.kod}: ${r.stderr || "bez poruke"}` };
  }
  return { ishod: "OK", detalj: "sklop učitan" };
});

meri("D05", "ProtectedData Protect/Unprotect nad konstantom", () => {
  /*
   * 16 bajtova konstante, nikad ključ.
   *
   * Ovo je tačno ono što `windows-dpapi.mjs::proveri()` radi. Ako ovde padne,
   * pad `W05`/`W06` je objašnjen i nije u konektoru.
   */
  const skripta = [
    "$ErrorActionPreference='Stop'",
    "Add-Type -AssemblyName System.Security",
    "$b = [Text.Encoding]::ASCII.GetBytes('cs-dpapi-proba1')",
    "$p = [System.Security.Cryptography.ProtectedData]::Protect($b, $null, 'CurrentUser')",
    "$u = [System.Security.Cryptography.ProtectedData]::Unprotect($p, $null, 'CurrentUser')",
    "if ([Text.Encoding]::ASCII.GetString($u) -eq 'cs-dpapi-proba1') { 'OK' } else { 'NEJEDNAKO' }",
  ].join("; ");
  const r = ps(skripta);
  if (r.kod !== 0) return { ishod: "PAD", detalj: `izlaz ${r.kod}: ${r.stderr || "bez poruke"}` };
  if (r.stdout !== "OK") return { ishod: "PAD", detalj: `rezultat: ${r.stdout}` };
  return { ishod: "OK", detalj: "šifrovanje i dešifrovanje vraćaju isti sadržaj" };
});

meri("D06", "skripta sa stdin prolazi (put kojim ide DPAPI)", () => {
  const r = ps("[Console]::In.ReadLine()", { ulaz: "cs-stdin-proba" });
  if (r.kod !== 0) return { ishod: "PAD", detalj: `izlaz ${r.kod}: ${r.stderr}` };
  return {
    ishod: r.stdout === "cs-stdin-proba" ? "OK" : "PAD",
    detalj: r.stdout === "cs-stdin-proba" ? "stdin kanal radi" : "stdin nije pročitan",
  };
});

meri("D07", "AppLocker/WDAC politika je aktivna", () => {
  const r = ps("if ($env:__PSLockdownPolicy) { $env:__PSLockdownPolicy } else { 'nije postavljeno' }");
  if (r.kod !== 0) return { ishod: "PAD", detalj: `izlaz ${r.kod}` };
  return {
    ishod: r.stdout === "nije postavljeno" ? "OK" : "PAŽNJA",
    detalj: `__PSLockdownPolicy = ${r.stdout}`,
  };
});

/* =========================================================================
 * Izveštaj
 * ====================================================================== */

const problem = nalazi.filter((n) => n.ishod !== "OK");

const zakljucak = (() => {
  const po = (id) => nalazi.find((n) => n.id === id);
  if (po("D01")?.ishod === "NEMA") {
    return "PowerShell nije dostupan — DPAPI adapter nema kroz šta da radi.";
  }
  if (po("D02")?.ishod === "PAŽNJA" || po("D04")?.ishod === "PAD") {
    return (
      "Jezički režim ili blokiran `Add-Type` sprečavaju DPAPI adapter. " +
      "To objašnjava pad W05/W06 i nije kvar konektora."
    );
  }
  if (po("D05")?.ishod === "PAD") {
    return "DPAPI Protect/Unprotect ne radi za ovaj nalog; W05/W06 su posledica.";
  }
  if (po("D03")?.ishod === "PAŽNJA") {
    return (
      "Politika izvršavanja je postavljena Group Policy-jem: pogađa `-File` " +
      "pozive (W13), ali ne i DPAPI, koji skriptu šalje na stdin."
    );
  }
  return problem.length === 0
    ? "PowerShell okruženje je ispravno; uzrok pada je negde drugde."
    : "Vidi nalaze označene sa PAŽNJA.";
})();

const IZVESTAJ = join(SMOKE, `windows-smoke-diagnose-${META.shortHead}.md`);
const tekst = [
  `# Dijagnostika PowerShell/DPAPI okruženja (${META.shortHead})`,
  "",
  "**OFFLINE — ništa nije promenjeno na računaru.**",
  "",
  "| | |",
  "|---|---|",
  `| Windows | ${osVersion()} (build ${release()}) |`,
  `| Arhitektura | ${arch()} |`,
  `| Node | ${process.versions.node} |`,
  `| Izvorni HEAD | ${META.sourceHead} |`,
  "",
  "## Nalazi",
  "",
  "| ID | Pitanje | Ishod | Detalj |",
  "|---|---|---|---|",
  ...nalazi.map((n) => `| ${n.id} | ${n.pitanje} | ${n.ishod} | ${n.detalj || "—"} |`),
  "",
  "## Zaključak",
  "",
  zakljucak,
  "",
  "## Šta ovaj alat NIJE radio",
  "",
  "- nije menjao politiku izvršavanja, ACL, registry ni bilo koje podešavanje;",
  "- nije pravio ni čitao uređajni ključ — DPAPI proba ide nad konstantom;",
  "- nije dodirnuo BizniSoft folder, nijedan PDF i nijednu mrežnu adresu;",
  "- nije ispisao korisničko ime, ime računara, putanje, ključeve ni potpise.",
  "",
  "Ovaj fajl je bezbedan za slanje.",
  "",
].join("\n");

writeFileSync(IZVESTAJ, tekst);

console.log("");
console.log(zakljucak);
console.log("");
console.log(
  `Izveštaj (redigovan): %TEMP%\\Carsystem Smoke ČĆŽŠĐ\\windows-smoke-diagnose-${META.shortHead}.md`,
);

// Dijagnostika ne presuđuje: 0 kada je izmerila, bez obzira na nalaze.
process.exitCode = 0;
