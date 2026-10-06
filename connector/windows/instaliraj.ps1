<#
  Carsystem konektor - instalacija ili azuriranje (KORAK 1, kao Administrator).

  Pokretanje (PowerShell -> desni klik -> Run as administrator), iz foldera
  raspakovanog paketa:

    .\windows\instaliraj.ps1 -RunAsAccount 'RACUNAR\nalog' `
      -IzvorniFolder 'C:\Users\nalog\Desktop\Fakture\Fakture 2026' `
      -ServerOrigin 'https://...' -PosaljiOdDatuma '2026-10-06'

  Azuriranje: isto, bez -IzvorniFolder/-ServerOrigin - postojeci config.json,
  kljuc i red se cuvaju.

  Sta radi (samo omotac oko vec pregledanih skripti; nijedno bezbednosno
  pravilo se ne zaobilazi):
    1. preduslovi: Administrator, x64, Node 24 u Program Files, RunAs nalog
       postoji i NIJE administrator;
    2. prethodna verzija -> C:\Program Files\CarsystemConnector.prethodna-<verzija>-<vreme>
       (za vrati-prethodnu.ps1); config.json se prenosi;
    3. config.json (prva instalacija) ili izmena samo zadatih polja;
    4. harden-install-dir.ps1 -Apply;
    Posle ovoga: KORAK 2, podesi.ps1 kao svakodnevni nalog (BEZ
    administratora) - folder stanja, kljuc, provera foldera, test veze,
    prvi prolaz i zakazani zadatak (task.ps1 proverava folder stanja u
    profilu naloga koji ga pokrece, pa ga mora pokrenuti taj nalog).

  Folder stanja (%LOCALAPPDATA%\CarsystemConnector: kljuc i queue.db) se NE dira.
#>
#Requires -Version 5.1
param(
  [string]$RunAsAccount = "$env:USERDOMAIN\$env:USERNAME",
  [string]$IzvorniFolder,
  [string]$ServerOrigin,
  [string]$DeviceCode = 'KANC-01',
  [string]$PosaljiOdDatuma,
  [string]$VercelZastita,
  # Jedini Windows nalog je administrator: isti nalog, UAC ukljucen, zadatak sa ogranicenim tokenom (docs/b2b/49).
  [switch]$JedanNalogSaUAC
)

$ErrorActionPreference = 'Stop'
function Stani([string]$poruka) { Write-Host "[STOP] $poruka" -ForegroundColor Red; exit 1 }
function Ok([string]$poruka) { Write-Host "[OK]   $poruka" -ForegroundColor Green }
function Info([string]$poruka) { Write-Host "[..]   $poruka" }

$izvorPaketa = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$cilj = Join-Path $env:ProgramFiles 'CarsystemConnector'
$imeZadatka = 'CarsystemConnector'

# ---------------------------------------------------------------- 1. preduslovi
$identitet = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not (New-Object Security.Principal.WindowsPrincipal($identitet)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Stani 'Pokrenite PowerShell kao Administrator (desni klik -> Run as administrator).'
}
if (-not [Environment]::Is64BitOperatingSystem) { Stani 'Potreban je 64-bitni Windows.' }

$node = Join-Path $env:ProgramFiles 'nodejs\node.exe'
if (-not (Test-Path -LiteralPath $node)) {
  Stani "Node nije nadjen u $node. Instalirajte zvanicni Node 24 LTS x64 sa nodejs.org (podrazumevana putanja), pa ponovite."
}
$nodeVerzija = (& $node --version).Trim()
if ($nodeVerzija -notmatch '^v24\.') { Stani "Potreban je Node 24 LTS; nadjen je $nodeVerzija." }

try {
  $runAsSid = (New-Object Security.Principal.NTAccount($RunAsAccount)).Translate([Security.Principal.SecurityIdentifier]).Value
} catch {
  Stani "Nalog '$RunAsAccount' ne postoji na ovom racunaru."
}
$adminSidovi = @()
try { $adminSidovi = @(Get-LocalGroupMember -SID 'S-1-5-32-544' | ForEach-Object { $_.SID.Value }) } catch { }
$uacPolitika = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' -ErrorAction SilentlyContinue
$uacUkljucen = $uacPolitika -and $uacPolitika.EnableLUA -eq 1 -and $uacPolitika.ConsentPromptBehaviorAdmin -ne 0
$runAsJeTekuci = $runAsSid -eq $identitet.User.Value
if ($adminSidovi -contains $runAsSid) {
  if (-not $JedanNalogSaUAC) {
    Stani ("Nalog '$RunAsAccount' je administrator. Ako je to jedini nalog na racunaru, ponovite sa -JedanNalogSaUAC " +
           '(zadatak ce raditi sa ogranicenim tokenom, bez povisenih prava). Vidi UPUTSTVO-KANCELARIJA.md, korak 0.')
  }
  if (-not $runAsJeTekuci) { Stani '-JedanNalogSaUAC: pokrenite ovu skriptu iz sesije istog naloga (Run as administrator), ne pod drugim administratorom.' }
  if (-not $uacUkljucen) { Stani '-JedanNalogSaUAC trazi ukljucen UAC bez tihog podizanja prava (EnableLUA=1, ConsentPromptBehaviorAdmin<>0).' }
  Info "Nalog '$RunAsAccount' je administrator (jedini nalog); UAC je ukljucen - zadatak ce raditi bez povisenih prava."
}

if ($ServerOrigin -and $ServerOrigin -notmatch '^https://') { Stani 'ServerOrigin mora poceti sa https://' }
if ($PosaljiOdDatuma -and $PosaljiOdDatuma -notmatch '^\d{4}-\d{2}-\d{2}$') { Stani 'PosaljiOdDatuma mora biti u obliku GGGG-MM-DD.' }
if ($IzvorniFolder -and -not (Test-Path -LiteralPath $IzvorniFolder -PathType Container)) { Stani "Folder '$IzvorniFolder' ne postoji." }
if ($DeviceCode -notmatch '^[A-Za-z0-9._-]{1,64}$') { Stani 'DeviceCode sme da sadrzi samo slova, cifre, tacku, crticu i donju crtu.' }
Ok "Preduslovi: Administrator, x64, Node $nodeVerzija, nalog $RunAsAccount."

$novaVerzija = (Get-Content -LiteralPath (Join-Path $izvorPaketa 'VERSION') -Raw).Trim()

# ------------------------------------------------------ konfiguracija unapred
$staraKonfiguracija = $null
if (Test-Path -LiteralPath (Join-Path $cilj 'config.json')) {
  $staraKonfiguracija = Get-Content -LiteralPath (Join-Path $cilj 'config.json') -Raw | ConvertFrom-Json
}
if (-not $staraKonfiguracija -and (-not $IzvorniFolder -or -not $ServerOrigin)) {
  Stani 'Prva instalacija trazi -IzvorniFolder i -ServerOrigin.'
}
$k = [ordered]@{}
if ($staraKonfiguracija) { $staraKonfiguracija.PSObject.Properties | ForEach-Object { $k[$_.Name] = $_.Value } }
else {
  $k.serverOrigin = $ServerOrigin; $k.deviceCode = $DeviceCode; $k.keyId = 'k1'
  $k.sourceSystem = 'biznisoft'; $k.issuerCode = 'CSRM'; $k.izvorniFolder = $IzvorniFolder; $k.maxPoCiklusu = 50
  # Bez datuma pocetka nova instalacija bi poslala celu istoriju iz foldera.
  if (-not $PosaljiOdDatuma) { $PosaljiOdDatuma = Get-Date -Format 'yyyy-MM-dd' }
}
if ($ServerOrigin) { $k.serverOrigin = $ServerOrigin }
if ($IzvorniFolder) { $k.izvorniFolder = (Resolve-Path -LiteralPath $IzvorniFolder).Path }
if ($PosaljiOdDatuma) { $k.posaljiOdDatuma = $PosaljiOdDatuma }
if (-not $k.Contains('posaljiOdDatuma') -or -not $k.posaljiOdDatuma) {
  # Ni azuriranje ne sme da otvori slanje istorije: bez datuma vazi danasnji.
  $k.posaljiOdDatuma = Get-Date -Format 'yyyy-MM-dd'
  Info "posaljiOdDatuma nije bio podesen - postavljen na $($k.posaljiOdDatuma)."
}
if ($VercelZastita) { $k.vercelZastita = $VercelZastita }

# --------------------------------------------- 2. prethodna verzija i kopija
$zadatak = Get-ScheduledTask -TaskName $imeZadatka -ErrorAction SilentlyContinue
if ($zadatak -and $zadatak.State -eq 'Running') { Stani 'Zakazani zadatak trenutno radi. Sacekajte da zavrsi, pa ponovite.' }

if (Test-Path -LiteralPath $cilj) {
  $staraVerzija = 'nepoznata'
  if (Test-Path -LiteralPath (Join-Path $cilj 'VERSION')) { $staraVerzija = (Get-Content -LiteralPath (Join-Path $cilj 'VERSION') -Raw).Trim() }
  $rezerva = "$cilj.prethodna-$staraVerzija-$(Get-Date -Format 'yyyyMMddHHmmss')"
  Move-Item -LiteralPath $cilj -Destination $rezerva
  Ok "Prethodna verzija ($staraVerzija) sacuvana u: $rezerva"
}
New-Item -ItemType Directory -Path $cilj | Out-Null
Copy-Item -Path (Join-Path $izvorPaketa '*') -Destination $cilj -Recurse
$utf8 = New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $cilj 'config.json'), ($k | ConvertTo-Json), $utf8)
Ok "Instalirana verzija $novaVerzija u $cilj (config.json: izvor '$($k.izvorniFolder)', slanje od $($k.posaljiOdDatuma))."

# ------------------------------------------------- 4. ucvrscivanje instalacije
$LASTEXITCODE = 0
try {
  & (Join-Path $cilj 'windows\harden-install-dir.ps1') -PackagePath $cilj -RunAsAccount $RunAsAccount -Apply
} catch {
  Stani "harden-install-dir nije prosao: $($_.Exception.Message). Prethodnu verziju vratite sa .\windows\vrati-prethodnu.ps1."
}
if ($LASTEXITCODE -ne 0) { Stani "harden-install-dir nije prosao (kod $LASTEXITCODE). Prethodnu verziju vratite sa .\windows\vrati-prethodnu.ps1." }
Ok 'Instalacioni folder je ucvrscen (nalog konektora ima samo citanje).'

Write-Host ''
if ($JedanNalogSaUAC) {
  Write-Host 'KORAK 2: u ISTOJ administratorskoj sesiji pokrenite:' -ForegroundColor Cyan
  Write-Host "  & '$cilj\windows\podesi.ps1' -JedanNalogSaUAC" -ForegroundColor Cyan
} else {
  Write-Host "KORAK 2: prijavite se kao $RunAsAccount i pokrenite:" -ForegroundColor Cyan
  Write-Host "  & '$cilj\windows\podesi.ps1'" -ForegroundColor Cyan
}
