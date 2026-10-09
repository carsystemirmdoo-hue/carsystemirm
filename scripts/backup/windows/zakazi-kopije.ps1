<#
  Dnevni zakazani zadatak kopija (\Carsystem\Kopije) za TRENUTNI nalog.

    .\windows\zakazi-kopije.ps1                 : napravi ili osvezi zadatak (svaki dan u 09:15)
    .\windows\zakazi-kopije.ps1 -Vreme 10:30    : drugo vreme
    .\windows\zakazi-kopije.ps1 -Ukloni         : ukloni zadatak

  Zadatak pokrece `kopije.ps1 -Akcija Sve` samo dok je nalog prijavljen (/IT),
  bez povisenih prava (/RL LIMITED): DPAPI token i kljuc konektora su vezani za
  ovaj nalog. GitHub kopija nastaje u 03:17 (01:17 UTC), pa je u 09:15 spremna.
  schtasks.exe, ne Get/Register-ScheduledTask: CIM na kancelarijskom racunaru
  ume da vrati 0x80070002 (vidi konektor Zadaci.ps1).
#>
[CmdletBinding()]
param(
  [ValidatePattern('^([01][0-9]|2[0-3]):[0-5][0-9]$')] [string] $Vreme = '09:15',
  [switch] $Ukloni
)
$ErrorActionPreference = 'Stop'
$ime = '\Carsystem\Kopije'
$schtasks = Join-Path $env:SystemRoot 'System32\schtasks.exe'

function Pokreni([string[]] $argumenti) {
  $eap = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try { $izlaz = & $schtasks @argumenti 2>&1; $kod = $LASTEXITCODE } finally { $ErrorActionPreference = $eap }
  return [pscustomobject]@{ Kod = $kod; Tekst = (@($izlaz) | ForEach-Object { "$_" }) -join ' ' }
}

if ($Ukloni) {
  $r = Pokreni @('/Delete', '/TN', $ime, '/F')
  if ($r.Kod -ne 0) { Write-Host "[STOP] Uklanjanje nije uspelo: $($r.Tekst)"; exit 1 }
  Write-Host "[OK] Zadatak $ime je uklonjen."
  exit 0
}

if (-not (Test-Path -LiteralPath (Join-Path $env:LOCALAPPDATA 'CarsystemKopije\podesavanja.json'))) {
  Write-Host '[STOP] Prvo podesi-kopije.ps1 i jedan uspesan rucni prolaz (kopije.ps1 -Akcija Sve).'; exit 1
}
$ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$skripta = Join-Path $PSScriptRoot 'kopije.ps1'
$akcija = "`"$ps`" -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File `"$skripta`" -Akcija Sve"
if ($akcija.Length -gt 261) { Write-Host "[STOP] Putanja paketa je preduga za zadatak ($($akcija.Length) znakova); raspakujte paket u kraci folder."; exit 1 }

$r = Pokreni @('/Create', '/TN', $ime, '/TR', $akcija, '/SC', 'DAILY', '/ST', $Vreme, '/RL', 'LIMITED', '/IT', '/F')
if ($r.Kod -ne 0) { Write-Host "[STOP] Zadatak nije napravljen: $($r.Tekst)"; exit 1 }
$q = Pokreni @('/Query', '/TN', $ime, '/FO', 'LIST')
if ($q.Kod -ne 0) { Write-Host "[STOP] Zadatak se ne vidi posle pravljenja: $($q.Tekst)"; exit 1 }
Write-Host "[OK] Zadatak $ime: svaki dan u $Vreme, nalog $env:USERNAME, samo dok je prijavljen."
