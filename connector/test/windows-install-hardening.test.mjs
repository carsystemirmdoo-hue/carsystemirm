import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

/**
 * P0-WIN-01 (WIN-INSTALL-01) + korektivna revizija istog paketa.
 *
 * Revizija je potvrdila i ispravila TRI propusta u prvobitnoj verziji:
 *  1. Task Scheduler je izvršavao generisan `.cmd` LAUNCHER iz foldera stanja
 *     — foldera koji `RunAsAccount` mora moći da piše. Kompromitovan proces
 *     pod istim nalogom je mogao da izmeni taj launcher bez ikakve eskalacije.
 *     Ispravka: akcija zove `node.exe` DIREKTNO, apsolutnom putanjom, bez
 *     posrednog fajla nigde.
 *  2. `task.ps1` je bio isključivo savetodavan (WARN), čak i za kancelarijsku
 *     instalaciju. Ispravka: `-Mode Production | Smoke`, gde `Production`
 *     baca (throw) na SVAKI neuspeh, pre `Register-ScheduledTask`, bez
 *     bypass opcije.
 *  3. `verify-invoice-folder.ps1` je nudio `-ProbeWrite`, opcioni upis nad
 *     sentinel fajlom UNUTAR prosleđenog (potencijalno pravog) foldera.
 *     Ispravka: uklonjeno u potpunosti; probni upis postoji SAMO kao
 *     Windows test ovde, nad jednokratnim test-only folderom.
 *
 * STATUS: sve niže je code-reviewed i statički testirano na macOS-u (bez
 * `pwsh`). NIJEDNA `.ps1` skripta nije stvarno izvršena na Windows-u u ovom
 * krugu — WIN-01 ostaje operativno nepotvrđen dok se Windows-only testovi
 * ispod stvarno ne pokrenu na kućnom Windows 11.
 *
 * Dve grupe:
 *  - CROSS-PLATFORM: statička/strukturna provera skripti i runbook-a, PLUS
 *    stvarno izvršive provere `bin/connector.mjs`-a (Node je Node svuda —
 *    ovo NIJE Windows-specifično i STVARNO SE IZVRŠAVA na macOS/Linux CI).
 *  - WINDOWS-ONLY, u propisanom redosledu: (1) parser SVIH .ps1 fajlova,
 *    (2) dry-run, (3) forbidden-path, (4) disposable-folder ACL, (5) opt-in
 *    admin testovi, (6) registracija/uklanjanje ISKLJUČIVO testnog taska.
 */

const WIN_DIR = fileURLToPath(new URL("../windows/", import.meta.url));
const p = (name) => join(WIN_DIR, name);

const SKRIPTE = ["PathGuards.ps1", "harden-install-dir.ps1", "verify-invoice-folder.ps1", "task.ps1", "instaliraj.ps1"];

async function citajSve() {
  const sadrzaji = await Promise.all(SKRIPTE.map((s) => readFile(p(s), "utf8")));
  return Object.fromEntries(SKRIPTE.map((s, i) => [s, sadrzaji[i]]));
}

function ukloniKomentare(ps1Tekst) {
  return ps1Tekst
    .replace(/<#[\s\S]*?#>/g, "")
    .split("\n")
    .map((red) => red.replace(/(?<!["'`])#.*$/, ""))
    .join("\n");
}

/* =========================================================================
 * CROSS-PLATFORM — statička provera, izvršava se svuda.
 * ====================================================================== */

test("[hardening] sve nove skripte i runbook postoje", async () => {
  for (const s of SKRIPTE) {
    await readFile(p(s), "utf8");
  }
  await readFile(fileURLToPath(new URL("../windows/OFFICE-INSTALL.md", import.meta.url)), "utf8");
});

test("[hardening] PowerShell sintaksa je validna (ako je parser dostupan)", async (t) => {
  let pwshDostupan = true;
  try {
    execFileSync("pwsh", ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.Major"], { encoding: "utf8" });
  } catch {
    pwshDostupan = false;
  }
  if (!pwshDostupan) {
    t.skip("pwsh (PowerShell Core) nije dostupan na ovoj mašini — sintaksna provera NIJE IZVRŠENA.");
    return;
  }
  for (const s of SKRIPTE) {
    const izlaz = execFileSync(
      "pwsh",
      ["-NoProfile", "-Command", `[void][System.Management.Automation.PSParser]::Tokenize((Get-Content -Raw '${p(s)}'), [ref]$null)`],
      { encoding: "utf8" },
    );
    assert.equal(izlaz, "", `${s}: parser je prijavio grešku`);
  }
});

test("[hardening] nijedan zadatak ne traži RunLevel Highest", async () => {
  const sadrzaji = await citajSve();
  for (const [naziv, tekst] of Object.entries(sadrzaji)) {
    assert.doesNotMatch(tekst, /RunLevel\s+Highest/i, `${naziv} traži povišena prava — ugovor to zabranjuje`);
  }
});

test("[hardening] task.ps1 nikad ne koristi SYSTEM ili fiksni admin nalog kao principal", async () => {
  const tekst = (await citajSve())["task.ps1"];
  assert.match(tekst, /New-ScheduledTaskPrincipal -UserId \$RunAsAccount/, "principal mora biti parametrizovan preko $RunAsAccount");
  assert.doesNotMatch(tekst, /UserId\s+['"]NT AUTHORITY\\SYSTEM['"]/i);
  assert.doesNotMatch(tekst, /UserId\s+['"]BUILTIN\\Administrators['"]/i);
});

test("[hardening] task.ps1 koristi RunLevel Limited i nema izvršni LogonType Password (nema sačuvanu lozinku)", async () => {
  const tekst = (await citajSve())["task.ps1"];
  assert.match(tekst, /-RunLevel Limited/);
  // Dokumentacija SME da POMENE `-LogonType Password` (objašnjava zašto nije
  // izabrano) — provera je nad izvršnim kodom, van komentara.
  assert.doesNotMatch(ukloniKomentare(tekst), /LogonType\s+Password/i, "sačuvana lozinka za zadatak se nikad ne koristi u izvršnom kodu");
});

test("[hardening] task.ps1 ograničava paralelna izvršavanja i vremenski limit", async () => {
  const tekst = (await citajSve())["task.ps1"];
  assert.match(tekst, /-MultipleInstances IgnoreNew/);
  assert.match(tekst, /-ExecutionTimeLimit/);
});

test("[hardening] nijedna skripta ne sadrži mehanizam preuzimanja/samo-ažuriranja", async () => {
  const sadrzaji = await citajSve();
  const zabranjeno = [
    /Invoke-WebRequest/i,
    /Invoke-RestMethod/i,
    /Start-BitsTransfer/i,
    /System\.Net\.WebClient/i,
    /DownloadFile\(/i,
    /\bcurl(\.exe)?\b/i,
    /\bwget\b/i,
  ];
  for (const [naziv, tekst] of Object.entries(sadrzaji)) {
    for (const rx of zabranjeno) {
      assert.doesNotMatch(tekst, rx, `${naziv} sadrži mogući mehanizam preuzimanja/ažuriranja (${rx})`);
    }
  }
});

test("[hardening] identitet se razrešava isključivo preko .NET API-ja, nikad shell interpolacijom", async () => {
  const tekst = (await citajSve())["PathGuards.ps1"];
  assert.match(tekst, /NTAccount\(\$AccountName\)/);
  assert.match(tekst, /\.Translate\(\[System\.Security\.Principal\.SecurityIdentifier\]\)/);
  // Nijedna skripta ne sme sastavljati -Command string ulepljivanjem naziva naloga.
  const sve = Object.values(await citajSve()).join("\n");
  assert.doesNotMatch(sve, /-Command\s*["'`]?\s*\+\s*\$(RunAsAccount|AccountName)/i);
  assert.doesNotMatch(sve, /Invoke-Expression/i);
});

test("[hardening] harden-install-dir.ps1: PackagePath i RunAsAccount su obavezni, bez podrazumevane vrednosti", async () => {
  const tekst = (await citajSve())["harden-install-dir.ps1"];
  assert.match(tekst, /\[Parameter\(Mandatory\)\]\s*\[string\]\$PackagePath\s*,/);
  assert.match(tekst, /\[Parameter\(Mandatory\)\]\s*\[string\]\$RunAsAccount\s*,?/);
});

test("[hardening] harden-install-dir.ps1: dry-run grana izlazi PRE stvarnog Set-Acl poziva", async () => {
  const tekst = (await citajSve())["harden-install-dir.ps1"];
  const idxDryRunExit = tekst.indexOf("if (-not $Apply) {");
  const idxSetAcl = tekst.indexOf("Set-Acl -LiteralPath $full -AclObject $acl");
  assert.ok(idxDryRunExit > -1, "dry-run grana nije nađena");
  assert.ok(idxSetAcl > -1, "stvarna primena ACL-a nije nađena");
  assert.ok(idxDryRunExit < idxSetAcl, "dry-run izlazak mora biti PRE stvarne izmene ACL-a u tekstu skripte");
});

test("[hardening] harden-install-dir.ps1: -Apply bez elevacije se odbija PRE bilo koje izmene", async () => {
  const tekst = (await citajSve())["harden-install-dir.ps1"];
  const idxElevacija = tekst.indexOf("Test-CurrentProcessIsElevated");
  const idxBackup = tekst.indexOf("$backupRoot = Join-Path");
  assert.ok(idxElevacija > -1 && idxBackup > -1);
  assert.ok(idxElevacija < idxBackup, "provera elevacije mora biti PRE rezervne kopije/izmene ACL-a");
});

/* --- Korekcija #1: launcher u folderu stanja je UKLONJEN. ---------------- */

test("[hardening] task.ps1 NE generiše nijedan launcher fajl u folderu stanja", async () => {
  const tekst = ukloniKomentare((await citajSve())["task.ps1"]);
  assert.doesNotMatch(tekst, /run-connector\.cmd/, "generisanje launchera je uklonjeno u korekciji — ne sme se vratiti u izvršnom kodu");
  assert.doesNotMatch(tekst, /Set-Content\s+-LiteralPath\s+\$launcher/i);
  assert.doesNotMatch(tekst, /New-ScheduledTaskAction\s+-Execute\s+\$launcher/i);
});

test("[hardening] task.ps1 registruje akciju sa apsolutnom node.exe putanjom — ne launcher, PATH, ni cmd.exe /c", async () => {
  const tekst = ukloniKomentare((await citajSve())["task.ps1"]);
  assert.match(tekst, /New-ScheduledTaskAction\s+-Execute\s+\$nodeInfo\.Path/, "akcija mora pozivati proverenu Node putanju direktno");
  assert.doesNotMatch(tekst, /-Execute\s+['"]node['"]|-Execute\s+node\b/i, "bare 'node' oslanja se na PATH");
  assert.doesNotMatch(tekst, /cmd\.exe\s*['"]?\s*\/c/i, "akcija ne sme ići kroz cmd.exe /c");
});

test("[hardening] task.ps1: -Mode je obavezan za install/uninstall, bez podrazumevane vrednosti", async () => {
  const tekst = (await citajSve())["task.ps1"];
  assert.match(tekst, /\[ValidateSet\('Production',\s*'Smoke'\)\]\s*\n\s*\[string\]\$Mode\s*,/, "Mode ne sme imati podrazumevanu vrednost");
  assert.match(
    tekst,
    /if \(\$Action -in @\('install',\s*'uninstall'\)\s+-and\s+-not\s+\$Mode\)\s*\{\s*throw/,
    "install/uninstall bez -Mode moraju baciti grešku PRE bilo koje provere",
  );
});

test("[hardening] Smoke i Production koriste različita imena zadatka", async () => {
  const tekst = (await citajSve())["task.ps1"];
  assert.match(tekst, /Production\s*=\s*'CarsystemConnector'/);
  assert.match(tekst, /Smoke\s*=\s*'CarsystemConnectorSMOKE'/);
});

/* --- Korekcija #2: Production je strogo blokirajući, bez bypass opcije. - */

test("[hardening] task.ps1: Production nema -Force/bypass parametar koji FAIL pretvara u WARN", async () => {
  const tekst = (await citajSve())["task.ps1"];
  const paramBlok = tekst.match(/\[CmdletBinding\(\)\]\s*param\(([\s\S]*?)\)\r?\n/)[1];
  assert.doesNotMatch(paramBlok, /\$Force\b/i, "param blok ne sme sadržati -Force");
  assert.doesNotMatch(paramBlok, /\$Skip\w*/i, "param blok ne sme sadržati bilo kakav -SkipXxx bypass");
  assert.doesNotMatch(paramBlok, /\$Bypass\b/i);
});

test("[hardening] task.ps1: SVAKA Production provera baca (throw) pre Register-ScheduledTask", async () => {
  const tekst = (await citajSve())["task.ps1"];
  const idxRegister = tekst.indexOf("Register-ScheduledTask -TaskName $TaskName");
  assert.ok(idxRegister > -1, "Register-ScheduledTask poziv nije nađen");

  const ocekivaneProvere = [
    "instalacioni folder odbijen:",
    "instalacioni folder nije učvršćen",
    "folder stanja nije učvršćen",
    "entry point ne postoji:",
    "config.json ne postoji u instalacionom folderu",
    "config.json je symlink/reparse-point:",
    "Node se ne može razrešiti:",
    "Node putanja nije prihvatljiva za produkciju:",
    "provera administratorskog članstva za",
    "je administrator ili SYSTEM",
    "-Apply zahteva administratorska prava",
  ];
  for (const fragment of ocekivaneProvere) {
    const idxFragment = tekst.indexOf(fragment);
    assert.ok(idxFragment > -1, `Production provera nije nađena u tekstu: "${fragment}"`);
    assert.ok(idxFragment < idxRegister, `provera "${fragment}" mora biti PRE Register-ScheduledTask`);
  }

  // Sve gore navedeno mora ići kroz Write-Fail-Production (throw), ne Write-Warn.
  const blokProdukcije = tekst.slice(tekst.indexOf("if ($Mode -eq 'Production')"), tekst.indexOf("else {\n      <#\n        Smoke"));
  assert.doesNotMatch(blokProdukcije, /Write-Warn/, "Production blok ne sme koristiti Write-Warn — sve mora biti blokirajuće");
});

test("[hardening] task.ps1: -JedanNalogSaUAC dozvoljava administratorski nalog SAMO kroz Test-JedanNalogSaUAC", async () => {
  const tekst = (await citajSve())["task.ps1"];
  const blok = tekst.slice(tekst.indexOf("if ($jeAdmin) {"), tekst.indexOf("if ($Apply -and -not (Test-CurrentProcessIsElevated))"));
  assert.match(blok, /Test-JedanNalogSaUAC -AccountName \$RunAsAccount/);
  assert.match(blok, /if \(\$JedanNalogSaUAC -and \$jedan\.Dozvoljeno\)/);
  assert.equal((blok.match(/Write-Fail-Production/g) ?? []).length, 2);
  assert.match(tekst, /-LogonType Interactive -RunLevel Limited/);
});

test("[hardening] PathGuards: UAC i jedan nalog — StrictMode-bezbedno čitanje registra", async () => {
  const pg = (await citajSve())["PathGuards.ps1"];
  assert.match(pg, /PSObject\.Properties\['EnableLUA'\]/);
  assert.match(pg, /PSObject\.Properties\['ConsentPromptBehaviorAdmin'\]/);
  assert.match(pg, /\(\$lua -eq 1\) -and \(\$null -ne \$saglasnost\) -and \(\$saglasnost -ne 0\)/);
  assert.match(pg, /GetCurrent\(\)\.User\.Value/);
});

test("[hardening] rezultat funkcije čiji se .Count čita je uvek niz (@(...)) — StrictMode na 5.1", async () => {
  const sve = await citajSve();
  for (const [ime, tekst] of Object.entries(sve)) {
    for (const m of tekst.matchAll(/\$(\w+)\.Count\b/g)) {
      const dodele = [...tekst.matchAll(new RegExp(`\\$${m[1]}\\s*=\\s*(.+)`, "g"))].map((d) => d[1].trim());
      for (const rhs of dodele) {
        if (/^[A-Z][a-z]+-[A-Za-z]+/.test(rhs) && !/^New-Object\b/.test(rhs)) assert.fail(`${ime}: $${m[1]} = ${rhs} — poziv funkcije bez @(...), a čita se .Count`);
      }
    }
  }
});

test("[hardening] harden-install-dir i instaliraj: jedan nalog samo uz Test-JedanNalogSaUAC; ACL se proverava nezavisno od izlaznog koda", async () => {
  const sve = await citajSve();
  const harden = sve["harden-install-dir.ps1"];
  const blok = harden.slice(harden.indexOf("if ($jeAdmin) {"), harden.indexOf("-Apply zahteva administratorska prava"));
  assert.match(harden, /\$problemi = @\(Test-EffectivePermissions/);
  assert.match(blok, /Test-JedanNalogSaUAC -AccountName \$RunAsAccount/);
  assert.equal((blok.match(/exit 1/g) ?? []).length, 2, "oba neispunjena slučaja moraju da prekinu");
  const inst = sve["instaliraj.ps1"];
  assert.match(inst, /-Apply -JedanNalogSaUAC/);
  assert.match(inst, /\$global:LASTEXITCODE -ne 0/);
  assert.doesNotMatch(inst, /^\$LASTEXITCODE = 0/m, "lokalna dodela zaklanja izlazni kod");
  assert.ok(inst.indexOf("Test-PackageDirectoryHardened -Path $cilj") < inst.indexOf("Instalacioni folder je ucvrscen"), "ACL se proverava pre poruke o uspehu");
});

test("[hardening] task.ps1: Production zahteva config.json u INSTALACIONOM folderu, ne u folderu stanja", async () => {
  const tekst = (await citajSve())["task.ps1"];
  assert.match(tekst, /\$productionConfigPath\s*=\s*Join-Path\s+\$resolvedPackagePath\s+'config\.json'/);
  assert.match(tekst, /--config\s+`"\$productionConfigPath`"/, "Production akcija mora prosleđivati --config ka paketu");
});

test("[hardening] bin/connector.mjs: --config i --packaged se skidaju pre main(), nisu vidljivi kao komanda", async () => {
  const tekst = await readFile(fileURLToPath(new URL("../bin/connector.mjs", import.meta.url)), "utf8");
  assert.match(tekst, /argv\.indexOf\("--packaged"\)/);
  assert.match(tekst, /process\.env\.CS_CONNECTOR_PACKAGED\s*=\s*"1"/);
  assert.match(tekst, /argv\.indexOf\("--config"\)/);
  assert.match(tekst, /process\.env\.CS_CONNECTOR_CONFIG\s*=\s*putanja/);
  assert.match(tekst, /await main\(argv\)/, "main() mora dobiti argv BEZ --packaged/--config");
});

/* --- Korekcija #3: probni upis je uklonjen iz production skripte. -------- */

test("[hardening] verify-invoice-folder.ps1 nikad ne otvara/prikazuje sadržaj fajla", async () => {
  const tekst = (await citajSve())["verify-invoice-folder.ps1"];
  assert.doesNotMatch(tekst, /Get-Content\s+-LiteralPath\s+\$(full|InvoiceFolder)\b/);
  assert.doesNotMatch(tekst, /Import-Csv|ConvertFrom-Json.*InvoiceFolder/i);
  assert.match(tekst, /nijedan sadržaj fakture nije dotaknut ni prikazan/);
});

test("[hardening] verify-invoice-folder.ps1 NEMA -ProbeWrite ni bilo koju write/delete operaciju", async () => {
  const tekst = (await citajSve())["verify-invoice-folder.ps1"];
  assert.doesNotMatch(tekst, /ProbeWrite/i, "opcija za probni upis nad prosleđenim folderom je uklonjena u korekciji");
  assert.doesNotMatch(tekst, /\bForce\b.*upis|upis.*\bForce\b/i);
  assert.doesNotMatch(tekst, /WriteAllText|Set-Content|New-Item|Remove-Item|\[System\.IO\.File\]::(Write|Create|Delete)/i);
});

test("[hardening] verify-invoice-folder.ps1: nerazrešivo grupno članstvo daje FAIL-CLOSED, ne pokušaj upisa", async () => {
  const tekst = (await citajSve())["verify-invoice-folder.ps1"];
  assert.match(tekst, /not-verified/);
  assert.match(tekst, /NOT VERIFIED \/ FAIL-CLOSED/);
  // 'not-verified' mora rezultovati u FAIL (blokirajuće), ne u PASS ili tihom WARN-only ishodu.
  const svicIndex = tekst.indexOf("switch ($verdikt.Verdict)");
  const notVerifiedBlok = tekst.slice(tekst.indexOf("'not-verified' {", svicIndex), tekst.indexOf("'clean' {", svicIndex));
  assert.match(notVerifiedBlok, /Write-Result 'FAIL'/);
});

test("[hardening] folder sa fakturama i folder stanja se eksplicitno proveravaju kao odvojeni", async () => {
  const tekst = (await citajSve())["verify-invoice-folder.ps1"];
  assert.match(tekst, /LOCALAPPDATA\\CarsystemConnector/);
  assert.match(tekst, /odvojen od foldera stanja konektora/);
});

test("[hardening] OFFICE-INSTALL.md sadrži obavezna upozorenja i rollback proceduru", async () => {
  const tekst = await readFile(fileURLToPath(new URL("../windows/OFFICE-INSTALL.md", import.meta.url)), "utf8");
  assert.match(tekst, /DPAPI[\s\S]{0,80}ne štiti ako je NALOG konektora već kompromitovan/);
  assert.match(tekst, /admin[\s\S]{0,300}kompromis[\s\S]{0,300}nije nešto što softverski ACL može sprečiti/);
  assert.match(tekst, /## 8\. Rollback/);
  assert.match(tekst, /## 1\. Integritet prenosa/);
  assert.match(tekst, /## 3\. Config\.json/);
  assert.match(tekst, /Ovo NIJE code signing/);
  assert.match(tekst, /code-reviewed, NIJE operativno potvrđen/);
});

test("[hardening] README.md upućuje na OFFICE-INSTALL.md i razdvaja smoke od produkcije", async () => {
  const tekst = await readFile(fileURLToPath(new URL("../README.md", import.meta.url)), "utf8");
  assert.match(tekst, /windows\/OFFICE-INSTALL\.md/);
  assert.match(tekst, /Kancelarijska produkciona instalacija/);
  assert.match(tekst, /-Mode/);
});

/* =========================================================================
 * CROSS-PLATFORM, IZVRŠIVO — bin/connector.mjs (Node, ne Windows-specifično).
 *
 * Ovo je STVARAN dokaz da direktna node.exe akcija (bez launchera) radi:
 * `--packaged`/`--config` moraju stvarno promeniti ponašanje procesa, ne
 * samo postojati u izvornom kodu.
 * ====================================================================== */

const BIN = fileURLToPath(new URL("../dist/connector/bin/connector.mjs", import.meta.url));

function pokreniKonektor(args, env = {}) {
  return spawnSync(process.execPath, [BIN, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

test("[bin] --packaged menja ponašanje identično kao CS_CONNECTOR_PACKAGED=1 (test keystore odbijen)", async () => {
  const saOznakom = pokreniKonektor(["--packaged", "doctor"], { CS_CONNECTOR_INSECURE_KEYSTORE: "1" });
  assert.match(saOznakom.stdout, /insecure_keystore_refused/, "--packaged mora prisiliti fail-closed kao i env promenljiva");

  const bezOznake = pokreniKonektor(["doctor"], { CS_CONNECTOR_INSECURE_KEYSTORE: "1" });
  assert.doesNotMatch(bezOznake.stdout, /insecure_keystore_refused/, "bez --packaged, isti env NE SME dati refused (razlikovni dokaz)");
});

test("[bin] --config <putanja> stvarno menja putanju konfiguracije koju konektor koristi", async () => {
  const proizvoljnaPutanja = "/tmp/cs-nepostojeca-konfiguracija-za-test.json";
  const r = pokreniKonektor(["--config", proizvoljnaPutanja, "--help"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, new RegExp(`Konfiguracija: ${proizvoljnaPutanja.replace(/[/.]/g, "\\$&")}`));
});

test("[bin] --packaged i --config zajedno se skidaju iz argv — komanda iza njih i dalje prepoznata", async () => {
  const r = pokreniKonektor(["--packaged", "--config", "/tmp/cs-bilo-sta.json", "--help"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Carsystem konektor/);
  assert.doesNotMatch(r.stderr, /Nepoznata komanda/);
});

test("[bin] --config bez vrednosti se bezbedno odbija (exit 2), ne ruši proces neuhvaćenim izuzetkom", async () => {
  const r = pokreniKonektor(["--config"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /zahteva apsolutnu putanju/);
  assert.doesNotMatch(r.stderr, /at file:|node:internal/, "ne sme procuriti neuhvaćen stack trace");
});

/* =========================================================================
 * WINDOWS-ONLY — propisan redosled: parse → dry-run → forbidden-path →
 * disposable-folder ACL → opt-in admin → registracija/uklanjanje testnog taska.
 * ====================================================================== */

const naWindowsu = process.platform === "win32";
const RAZLOG = `Zahteva Windows; tekuća platforma je ${process.platform}. NIJE IZVRŠENO.`;
const guard = (t) => {
  if (!naWindowsu) {
    t.skip(RAZLOG);
    return true;
  }
  return false;
};

/* --- 1. Parser — SVAKI .ps1 fajl, ugrađenim Windows PowerShell-om. ------- */

test("[WIN] 1/6 — SVE .ps1 skripte parsiraju bez greške (ugrađeni Windows PowerShell parser)", async (t) => {
  if (guard(t)) return;
  for (const naziv of SKRIPTE) {
    const izlaz = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command",
       `$greske = $null; [System.Management.Automation.Language.Parser]::ParseFile('${p(naziv)}', [ref]$null, [ref]$greske) | Out-Null; if ($greske.Count -gt 0) { $greske | ForEach-Object { $_.ToString() } } else { 'OK' }`],
      { encoding: "utf8" },
    ).trim();
    assert.equal(izlaz, "OK", `${naziv}: parser je prijavio grešku:\n${izlaz}`);
  }
});

function pokreniHardening(args) {
  return execFileSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", p("harden-install-dir.ps1"), ...args],
    { encoding: "utf8" },
  );
}

function pokreniTask(args) {
  return execFileSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", p("task.ps1"), ...args],
    { encoding: "utf8" },
  );
}

async function napraviLazniPaket(baza) {
  const paket = join(baza, "paket");
  await mkdir(join(paket, "connector", "bin"), { recursive: true });
  await writeFile(join(paket, "connector.cmd"), "@echo off\r\n");
  await writeFile(join(paket, "connector", "bin", "connector.mjs"), "// test stub\r\n");
  return paket;
}

/* --- 2. Dry-run. ---------------------------------------------------------- */

test("[WIN] 2/6 — dry-run (harden-install-dir.ps1) ne menja ACL instalacionog foldera", async (t) => {
  if (guard(t)) return;
  const baza = await mkdtemp(join(tmpdir(), "cs-harden-"));
  try {
    const paket = await napraviLazniPaket(baza);
    const pre = execFileSync("powershell.exe", ["-NoProfile", "-Command", `(Get-Acl -LiteralPath '${paket}').Sddl`], { encoding: "utf8" });
    const izlaz = pokreniHardening(["-PackagePath", paket, "-RunAsAccount", process.env.USERNAME]);
    assert.match(izlaz, /WOULD CHANGE/);
    const posle = execFileSync("powershell.exe", ["-NoProfile", "-Command", `(Get-Acl -LiteralPath '${paket}').Sddl`], { encoding: "utf8" });
    assert.equal(pre, posle, "dry-run je promenio stvarni ACL");
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("[WIN] 2/6 — task.ps1 dry-run (Smoke) ne registruje zadatak, izlaz nosi [dry-run]", async (t) => {
  if (guard(t)) return;
  const baza = await mkdtemp(join(tmpdir(), "cs-task-dryrun-"));
  try {
    const paket = await napraviLazniPaket(baza);
    const izlaz = pokreniTask(["-Action", "install", "-Mode", "Smoke", "-PackagePath", paket, "-RunAsAccount", process.env.USERNAME]);
    assert.match(izlaz, /\[dry-run\]/);
    const postoji = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-Command",
       "if (Get-ScheduledTask -TaskName CarsystemConnectorSMOKE -TaskPath '\\Carsystem\\' -ErrorAction SilentlyContinue) { 'DA' } else { 'NE' }"],
      { encoding: "utf8" },
    ).trim();
    assert.equal(postoji, "NE", "dry-run je registrovao zadatak");
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

/* --- 3. Forbidden-path. --------------------------------------------------- */

test("[WIN] 3/6 — odbija koren diska, UNC i profil korisnika kao instalacioni folder", async (t) => {
  if (guard(t)) return;
  const zabranjene = ["C:\\", "\\\\server\\share\\pkg", process.env.USERPROFILE];
  for (const putanja of zabranjene) {
    assert.throws(
      () => pokreniHardening(["-PackagePath", putanja, "-RunAsAccount", process.env.USERNAME]),
      `putanja '${putanja}' je trebalo da bude odbijena`,
    );
  }
});

test("[WIN] 3/6 — odbija reparse-point (junction) umesto pravog foldera", async (t) => {
  if (guard(t)) return;
  const baza = await mkdtemp(join(tmpdir(), "cs-harden-junction-"));
  try {
    const stvarni = await napraviLazniPaket(baza);
    const junction = join(baza, "precica");
    execFileSync("cmd.exe", ["/c", "mklink", "/J", junction, stvarni], { encoding: "utf8" });
    assert.throws(() => pokreniHardening(["-PackagePath", junction, "-RunAsAccount", process.env.USERNAME]));
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("[WIN] 3/6 — task.ps1 install bez -Mode se odbija pre bilo koje provere", async (t) => {
  if (guard(t)) return;
  const baza = await mkdtemp(join(tmpdir(), "cs-task-nomode-"));
  try {
    const paket = await napraviLazniPaket(baza);
    assert.throws(() => pokreniTask(["-Action", "install", "-PackagePath", paket]));
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("[WIN] 3/6 — task.ps1 -Mode Production odbija SYSTEM kao RunAsAccount", async (t) => {
  if (guard(t)) return;
  const baza = await mkdtemp(join(tmpdir(), "cs-task-system-"));
  try {
    const paket = await napraviLazniPaket(baza);
    assert.throws(() =>
      pokreniTask(["-Action", "install", "-Mode", "Production", "-PackagePath", paket, "-RunAsAccount", "NT AUTHORITY\\SYSTEM"]),
    );
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("[WIN] 3/6 — task.ps1 -Mode Production odbija neučvršćen (fresh) instalacioni folder", async (t) => {
  if (guard(t)) return;
  const baza = await mkdtemp(join(tmpdir(), "cs-task-neucvrsceno-"));
  try {
    const paket = await napraviLazniPaket(baza);
    // Svež temp folder nasleđuje dozvole roditelja — Test-PackageDirectoryHardened
    // vraća FAIL PRE nego što se ijedan kasniji uslov (config.json, state dir) proveri.
    assert.throws(() =>
      pokreniTask(["-Action", "install", "-Mode", "Production", "-PackagePath", paket, "-RunAsAccount", process.env.USERNAME]),
    );
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("[WIN] 3/6 — verify-invoice-folder.ps1 nema -ProbeWrite (odbačen nepoznat parametar)", async (t) => {
  if (guard(t)) return;
  const baza = await mkdtemp(join(tmpdir(), "cs-verify-noprobe-"));
  try {
    const folder = join(baza, "fakture");
    await mkdir(folder, { recursive: true });
    assert.throws(() =>
      execFileSync(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", p("verify-invoice-folder.ps1"),
         "-InvoiceFolder", folder, "-RunAsAccount", process.env.USERNAME, "-ProbeWrite"],
        { encoding: "utf8" },
      ),
    );
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

/* --- 4. Disposable-folder ACL (bez potrebe za admin pravima). ------------- */

test("[WIN] 4/6 — putanja sa razmacima i srpskim slovima ne izaziva grešku parsiranja", async (t) => {
  if (guard(t)) return;
  const baza = await mkdtemp(join(tmpdir(), "cs-harden-unicode-"));
  try {
    const paket = join(baza, "Moj Paket ČĆŽŠĐ");
    await mkdir(paket, { recursive: true });
    await writeFile(join(paket, "connector.cmd"), "@echo off\r\n");
    const izlaz = pokreniHardening(["-PackagePath", paket, "-RunAsAccount", process.env.USERNAME]);
    assert.match(izlaz, /Putanja prihvatljiva/);
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("[WIN] 4/6 — naziv naloga sa specijalnim znacima se tretira kao string, ne izvršava se", async (t) => {
  if (guard(t)) return;
  const baza = await mkdtemp(join(tmpdir(), "cs-harden-injekcija-"));
  try {
    const paket = await napraviLazniPaket(baza);
    const sumnjivNalog = 'a"; calc.exe #';
    let izlaz = "";
    let pao = false;
    try {
      izlaz = pokreniHardening(["-PackagePath", paket, "-RunAsAccount", sumnjivNalog]);
    } catch (e) {
      pao = true;
      izlaz = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    }
    // Očekivan ishod: nalog se ne razrešava u SID (FAIL), ne izvršavanje ubačene komande.
    assert.ok(pao || /FAIL/.test(izlaz), "sumnjiv naziv naloga nije jasno odbijen");
    assert.doesNotMatch(izlaz, /^\s*\d+\s*$/m, "izlaz liči na rezultat izvršene calc.exe/aritmetičke komande");
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("[WIN] 4/6 — verify-invoice-folder.ps1: probni upis SAMO nad jednokratnim (disposable) test folderom", async (t) => {
  if (guard(t)) return;
  // Ovo je JEDINO mesto gde se probni upis ikad izvršava — nad folderom koji
  // TEST sam pravi, koristi i briše. Production skripta ovo ne nudi (vidi
  // "[hardening] verify-invoice-folder.ps1 NEMA -ProbeWrite..." iznad).
  const baza = await mkdtemp(join(tmpdir(), "cs-disposable-write-probe-"));
  try {
    const sentinel = join(baza, `.probe-${Date.now()}.tmp`);
    execFileSync(
      "powershell.exe",
      ["-NoProfile", "-Command", `[System.IO.File]::WriteAllText('${sentinel}', 'probe'); Remove-Item -LiteralPath '${sentinel}' -Force; 'OK'`],
      { encoding: "utf8" },
    );
    // Folder i sentinel su isključivo test-only — nikad prosleđeni put ka pravoj skripti.
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

/* --- 5. Opt-in admin testovi. ---------------------------------------------- */

test("[WIN] 5/6 — -Apply bez administratorskih prava se bezbedno odbija (harden-install-dir.ps1)", async (t) => {
  if (guard(t)) return;
  const jeElevovan = execFileSync(
    "powershell.exe",
    ["-NoProfile", "-Command",
     "([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)"],
    { encoding: "utf8" },
  ).trim();
  if (jeElevovan === "True") {
    t.skip("Test proces JE administrator — odbijanje zbog nedostatka elevacije se ne može proveriti u ovom okruženju.");
    return;
  }
  const baza = await mkdtemp(join(tmpdir(), "cs-harden-noadmin-"));
  try {
    const paket = await napraviLazniPaket(baza);
    assert.throws(() => pokreniHardening(["-PackagePath", paket, "-RunAsAccount", process.env.USERNAME, "-Apply"]));
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("[WIN] 5/6 — Production pun lanac: hardened paket + hardened state + config.json → ACL allow-lista, idempotentno, rollback", async (t) => {
  if (guard(t)) return;
  t.skip(
    "Zahteva administratorska prava i poseban least-privilege nalog na mašini. Ručni postupak (OFFICE-INSTALL.md §3-§6): " +
      "1) postaviti config.json u probni paket; " +
      "2) harden-install-dir.ps1 -Apply nad probnim paketom; " +
      "3) harden-state-dir.ps1 -Apply (prijavljen kao RunAsAccount); " +
      "4) task.ps1 -Action install -Mode Production -Apply — mora uspeti tek sada; " +
      "5) icacls <folder> potvrđuje RunAsAccount=ReadAndExecute, Administrators+SYSTEM=FullControl; " +
      "6) ponovljen -Apply (harden-install-dir.ps1) daje isti rezultat (idempotentnost); " +
      "7) namerno oštećen post-verifikacioni uslov dovodi do rollback-a iz SDDL rezervne kopije.",
  );
});

/* --- 6. Registracija/uklanjanje ISKLJUČIVO testnog taska. ------------------ */

test("[WIN] 6/6 — registracija i uklanjanje ZASEBNIH Smoke i Production zadataka, bez međusobnog preklapanja", async (t) => {
  if (guard(t)) return;
  t.skip(
    "Menja Task Scheduler na mašini; pokreće se ručno na izolovanom Windows okruženju: " +
      "`task.ps1 -Action install -Mode Smoke -Apply` i `-Mode Production -Apply` (nad probnim paketom sa config.json), " +
      "pa odgovarajući `-Action uninstall -Mode ... -Apply`. Potvrditi: (a) DVA različita imena zadatka " +
      "(CarsystemConnectorSMOKE, CarsystemConnector) postoje istovremeno; (b) uklanjanje jednog ne dira drugi; " +
      "(c) `Get-ScheduledTask` za oba pokazuje `Actions[0].Execute` = apsolutna node.exe putanja, NIKAD launcher/cmd; " +
      "(d) Production akcija sadrži `--config <package>\\config.json` u argumentima, Smoke ne sadrži --config.",
  );
});
