import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

/**
 * `Zadaci.ps1` — stanje zakazanog zadatka bez CIM-a.
 *
 * Kancelarija 0.3.6: `Get-ScheduledTask` je vraćao 0x80070002 i za opšte
 * listanje; uz `-ErrorAction SilentlyContinue` to je izgledalo kao „ne
 * postoji", pa je proba prijavila uklanjanje zadatka koji je postojao.
 *
 * Logika se proverava sa LAŽNIM COM servisom i lažnim `schtasks.exe`
 * (funkcije `Connect-ZadatakServis` i `Invoke-ZadatakSchtasks` se zamenjuju
 * posle dot-source-a). Treba PowerShell: `CS_PWSH` (npr. portabilni pwsh na
 * Mac-u), `pwsh` u PATH-u, ili `powershell.exe` na Windowsu.
 */

const ZADACI = fileURLToPath(new URL("../windows/Zadaci.ps1", import.meta.url));

function nadjiPowerShell() {
  const kandidati = [process.env.CS_PWSH, "pwsh", process.platform === "win32" ? "powershell.exe" : null].filter(Boolean);
  for (const k of kandidati) {
    const r = spawnSync(k, ["-NoProfile", "-Command", "1"], { encoding: "utf8" });
    if (r.status === 0) return k;
  }
  return null;
}
const PS = nadjiPowerShell();

/** Pokreće scenario; vraća JSON koji scenario ispiše. */
function scenario(telo) {
  const skripta = [
    "$ErrorActionPreference = 'Stop'",
    "Set-StrictMode -Version Latest",
    `. '${ZADACI.replace(/'/g, "''")}'`,
    "function Nadjeno { throw [System.Runtime.InteropServices.COMException]::new('nije nadjeno', -2147024894) }",
    "function Pristup { throw [System.Runtime.InteropServices.COMException]::new('pristup', -2147024891) }",
    "$global:schtasksPozivi = @()",
    "function SchtasksVraca([int]$kod) { $global:schtasksKod = $kod }",
    "function Invoke-ZadatakSchtasks([string[]]$Argumenti) { $global:schtasksPozivi += ($Argumenti -join ' '); [pscustomobject]@{ Kod = $global:schtasksKod; Tekst = '' } }",
    telo,
  ].join("\n");
  // Kroz privremen .ps1 (-File): `-Command -` u pwsh-u ispisuje kontrolne sekvence terminala.
  const dir = mkdtempSync(join(tmpdir(), "cs-zadaci-"));
  const fajl = join(dir, "scenario.ps1");
  writeFileSync(fajl, `\uFEFF${skripta}`, "utf8");
  let r;
  try {
    r = spawnSync(PS, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", fajl], { encoding: "utf8" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const izlaz = (r.stdout ?? "").trim().split("\n").pop();
  try {
    return JSON.parse(izlaz);
  } catch {
    throw new Error(`scenario nije vratio JSON (izlaz ${r.status}): ${r.stdout}\n${r.stderr}`);
  }
}

/** Lažan COM servis: `folder` = 'nema' | 'greska' | objekat sa zadacima. */
const SERVIS = `
function Novi-Servis($ponasanje) {
  $svc = [pscustomobject]@{ P = $ponasanje }
  $svc | Add-Member ScriptMethod GetFolder {
    param($put)
    if ($this.P.folder -eq 'nema') { Nadjeno }
    if ($this.P.folder -eq 'greska') { Pristup }
    $f = [pscustomobject]@{ P = $this.P }
    $f | Add-Member ScriptMethod GetTask {
      param($ime)
      if ($this.P.zadatak -eq 'nema') { Nadjeno }
      if ($this.P.zadatak -eq 'greska') { Pristup }
      $akcija = [pscustomobject]@{ Path = 'C:\\Program Files\\nodejs\\node.exe'; Arguments = '--help'; WorkingDirectory = 'C:\\x' }
      $akcije = [pscustomobject]@{ Count = 1 }
      $akcije | Add-Member ScriptMethod Item { param($i) $akcija }.GetNewClosure()
      $def = [pscustomobject]@{
        Actions = $akcije
        Principal = [pscustomobject]@{ UserId = 'PC\\Korisnik'; RunLevel = 0; LogonType = 3 }
        Triggers = [pscustomobject]@{ Count = 0 }
      }
      $t = [pscustomobject]@{ State = 3; LastRunTime = [datetime]'2026-10-07T08:41:49'; LastTaskResult = 0; NextRunTime = [datetime]'1899-12-30'; Definition = $def }
      $t | Add-Member ScriptMethod Run { param($a) $global:pokrenuto = $true; $null }
      $t
    }
    $f | Add-Member ScriptMethod DeleteTask { param($ime, $fl) $global:obrisano = $true; if ($this.P.ContainsKey('brisanjeNeUspeva')) { Pristup }; $this.P.zadatak = 'nema' }
    $f
  }
  $svc
}
`;

const skip = PS ? false : "PowerShell nije dostupan (postaviti CS_PWSH) — NIJE IZVRŠENO.";

test("COM: folder ne postoji + schtasks ne nalazi → ne postoji (oba se slažu)", { skip }, () => {
  const r = scenario(`${SERVIS}
    $global:p = @{ folder = 'nema' }
    function Connect-ZadatakServis { Novi-Servis $global:p }
    SchtasksVraca 1
    Get-ZadatakCs -TaskPath '\\Carsystem\\' -TaskName 'CarsystemProba' | ConvertTo-Json -Compress`);
  assert.equal(r.Postoji, false);
  assert.equal(r.Izvor, "com+schtasks");
});

test("COM kaže 'nema', ali schtasks NALAZI → postoji (nikad tiho 'ne postoji')", { skip }, () => {
  const r = scenario(`${SERVIS}
    $global:p = @{ folder = 'ok'; zadatak = 'nema' }
    function Connect-ZadatakServis { Novi-Servis $global:p }
    SchtasksVraca 0
    Get-ZadatakCs -TaskPath '\\Carsystem\\' -TaskName 'CarsystemProba' | ConvertTo-Json -Compress`);
  assert.equal(r.Postoji, true);
  assert.equal(r.Izvor, "schtasks");
  assert.equal(r.Stanje, "Unknown", "stanje se ne izmišlja");
});

test("COM greška (ne 'nije nađeno') + schtasks ne nalazi → stanje NEPOZNATO, izuzetak", { skip }, () => {
  for (const ponasanje of ["@{ folder = 'greska' }", "@{ folder = 'ok'; zadatak = 'greska' }"]) {
    const r = scenario(`${SERVIS}
      $global:p = ${ponasanje}
      function Connect-ZadatakServis { Novi-Servis $global:p }
      SchtasksVraca 1
      try { Get-ZadatakCs -TaskPath '\\Carsystem\\' -TaskName 'CarsystemProba' | Out-Null; '{"bacio":false}' }
      catch { @{ bacio = $true; poruka = $_.Exception.Message } | ConvertTo-Json -Compress }`);
    assert.equal(r.bacio, true, ponasanje);
    assert.match(r.poruka, /^zadatak_stanje_nepoznato: \\Carsystem\\CarsystemProba \(COM: Get(Folder|Task) 0x80070005; schtasks izlaz 1\)$/);
  }
});

test("Schedule.Service se ne povezuje (kao pokvaren WMI/CIM) → schtasks odlučuje ili izuzetak", { skip }, () => {
  const r = scenario(`
    function Connect-ZadatakServis { Pristup }
    SchtasksVraca 0
    Get-ZadatakCs -TaskPath '\\Carsystem\\' -TaskName 'CarsystemConnector' | ConvertTo-Json -Compress`);
  assert.equal(r.Postoji, true);
  assert.equal(r.Izvor, "schtasks");
});

test("COM čita zadatak: stanje, rezultat, nalog, RunLevel, akcija; 1899 = nikad", { skip }, () => {
  const r = scenario(`${SERVIS}
    $global:p = @{ folder = 'ok'; zadatak = 'ok' }
    function Connect-ZadatakServis { Novi-Servis $global:p }
    SchtasksVraca 1
    $z = Get-ZadatakCs -TaskPath '\\Carsystem\\' -TaskName 'CarsystemProba'
    @{ Postoji = $z.Postoji; Izvor = $z.Izvor; Stanje = $z.Stanje; Rez = $z.LastTaskResult; Nalog = $z.UserId;
       RunLevel = $z.RunLevel; Exe = $z.Execute; Okidaci = $z.BrojOkidaca; Sledece = $z.NextRunTime;
       Schtasks = $global:schtasksPozivi.Count } | ConvertTo-Json -Compress`);
  assert.equal(r.Postoji, true);
  assert.equal(r.Izvor, "com");
  assert.equal(r.Stanje, "Ready");
  assert.equal(r.Rez, 0);
  assert.equal(r.RunLevel, "Limited");
  assert.match(r.Exe, /node\.exe$/);
  assert.equal(r.Okidaci, 0);
  assert.equal(r.Sledece, null);
  assert.equal(r.Schtasks, 0, "kada COM pročita zadatak, schtasks nije potreban");
});

test("Remove-ZadatakCs potvrđuje uklanjanje; neuspeh COM brisanja ide na schtasks /Delete", { skip }, () => {
  const ok = scenario(`${SERVIS}
    $global:p = @{ folder = 'ok'; zadatak = 'ok' }
    function Connect-ZadatakServis { Novi-Servis $global:p }
    SchtasksVraca 1
    @{ r = (Remove-ZadatakCs -TaskPath '\\Carsystem\\' -TaskName 'CarsystemProba'); obrisano = $global:obrisano } | ConvertTo-Json -Compress`);
  assert.equal(ok.r, true);
  assert.equal(ok.obrisano, true);

  // COM brisanje ne uspe, schtasks /Delete takođe ne → izuzetak, ne „uklonjeno".
  const los = scenario(`${SERVIS}
    $global:p = @{ folder = 'ok'; zadatak = 'ok'; brisanjeNeUspeva = $true }
    function Connect-ZadatakServis { Novi-Servis $global:p }
    SchtasksVraca 1
    try { Remove-ZadatakCs -TaskPath '\\Carsystem\\' -TaskName 'CarsystemProba' | Out-Null; '{"bacio":false}' }
    catch { @{ bacio = $true; poruka = $_.Exception.Message; pozivi = ($global:schtasksPozivi -join '|') } | ConvertTo-Json -Compress }`);
  assert.equal(los.bacio, true);
  assert.match(los.poruka, /^zadatak_uklanjanje_nije_uspelo/);
  assert.match(los.pozivi, /\/Delete \/TN \\Carsystem\\CarsystemProba \/F/);
});

test("Start-ZadatakCs: COM Run, a kad COM ne uspe — schtasks /Run; oba neuspela → izuzetak", { skip }, () => {
  const com = scenario(`${SERVIS}
    $global:p = @{ folder = 'ok'; zadatak = 'ok' }
    function Connect-ZadatakServis { Novi-Servis $global:p }
    SchtasksVraca 1
    @{ kanal = (Start-ZadatakCs -TaskPath '\\Carsystem\\' -TaskName 'CarsystemProba'); pokrenuto = $global:pokrenuto } | ConvertTo-Json -Compress`);
  assert.deepEqual(com, { kanal: "com", pokrenuto: true });
  const sch = scenario(`
    function Connect-ZadatakServis { Pristup }
    SchtasksVraca 0
    @{ kanal = (Start-ZadatakCs -TaskPath '\\Carsystem\\' -TaskName 'CarsystemProba') } | ConvertTo-Json -Compress`);
  assert.equal(sch.kanal, "schtasks");
  const nista = scenario(`
    function Connect-ZadatakServis { Pristup }
    SchtasksVraca 1
    try { Start-ZadatakCs -TaskPath '\\Carsystem\\' -TaskName 'CarsystemProba' | Out-Null; '{"bacio":false}' }
    catch { @{ bacio = $true } | ConvertTo-Json -Compress }`);
  assert.equal(nista.bacio, true);
});

test("nijedna Windows skripta više ne čita, ne pokreće i ne uklanja zadatak kroz CIM", async () => {
  const { readdir } = await import("node:fs/promises");
  const dir = fileURLToPath(new URL("../windows/", import.meta.url));
  for (const ime of (await readdir(dir)).filter((f) => f.endsWith(".ps1"))) {
    const kod = (await readFile(`${dir}${ime}`, "utf8"))
      .replace(/<#[\s\S]*?#>/g, "")
      .split("\n")
      .map((r) => r.replace(/(?<!["'`])#.*$/, ""))
      .join("\n");
    assert.doesNotMatch(
      kod,
      /\b(Get-ScheduledTask|Get-ScheduledTaskInfo|Start-ScheduledTask|Unregister-ScheduledTask)\b/,
      `${ime} koristi CIM cmdlet za stanje/pokretanje/uklanjanje (vidi Zadaci.ps1)`,
    );
  }
});
