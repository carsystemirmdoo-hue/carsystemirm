<#
  Carsystem konektor - podesavanje naloga, prvi prolaz i zakazani zadatak
  (KORAK 2, kao svakodnevni nalog, BEZ administratora).

    & 'C:\Program Files\CarsystemConnector\windows\podesi.ps1'

  Bezbedno za ponavljanje: kljuc se ne menja (init ga ne zamenjuje), red se
  nastavlja, zadatak se registruje ponovo istim podesavanjima.

  Koraci:
    1. folder stanja (%LOCALAPPDATA%\CarsystemConnector) - harden-state-dir.ps1;
    2. kljuc uredjaja kroz DPAPI (init) - ispisuje OTISAK za registraciju u portalu;
    3. provera foldera faktura - verify-invoice-folder.ps1 (samo citanje ACL-a;
       u rezimu jednog naloga upis istog naloga je ocekivan i prijavljuje se kao upozorenje);
    4. test veze (heartbeat) - ako uredjaj jos nije aktiviran u portalu, staje
       ovde sa uputstvom; posle aktivacije pokrenuti podesi.ps1 ponovo;
    5. prvi prolaz (run-once dok ne ostane nista): dokumenti izdati pre
       posaljiOdDatuma se samo zabelezavaju, NE salju; noviji se salju;
    6. zakazani zadatak (task.ps1 -Mode Production -Apply) pod ovim nalogom;
    7. provera.ps1.
#>
#Requires -Version 5.1
param(
  [switch]$BezPrvogProlaza,
  # Jedini nalog je administrator: pokrenuti u administratorskoj sesiji TOG naloga (docs/b2b/49).
  [switch]$JedanNalogSaUAC
)

$ErrorActionPreference = 'Stop'
function Stani([string]$poruka, [int]$kod = 1) { Write-Host "[STOP] $poruka" -ForegroundColor Red; exit $kod }
function Ok([string]$poruka) { Write-Host "[OK]   $poruka" -ForegroundColor Green }
function Info([string]$poruka) { Write-Host "[..]   $poruka" }

$cilj = Join-Path $env:ProgramFiles 'CarsystemConnector'
$konfiguracija = Join-Path $cilj 'config.json'
$node = Join-Path $env:ProgramFiles 'nodejs\node.exe'
$ulaz = Join-Path $cilj 'connector\bin\connector.mjs'
$nalog = "$env:USERDOMAIN\$env:USERNAME"

function Konektor([string[]]$argumenti) {
  # Isti ulaz i ista konfiguracija kao zakazani zadatak (--packaged --config).
  # PS 5.1: stderr spoljnog programa uz 'Stop' bi prekinuo skriptu - zato 'Continue' ovde.
  $eap = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  $izlaz = & $node --no-warnings $ulaz --packaged --config $konfiguracija @argumenti 2>$null
  $kod = $global:LASTEXITCODE
  $ErrorActionPreference = $eap
  $json = $null
  try { $json = ($izlaz -join "`n") | ConvertFrom-Json } catch { }
  return [pscustomobject]@{ Kod = $kod; Json = $json; Tekst = ($izlaz -join "`n") }
}

# ------------------------------------------------------------------ preduslovi
$povisena = (New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($JedanNalogSaUAC -and -not $povisena) {
  Stani 'Sa -JedanNalogSaUAC pokrenite PowerShell kao Administrator iz sesije svakodnevnog naloga (registracija zadatka trazi povisenu sesiju).'
}
if (-not $JedanNalogSaUAC -and $povisena) {
  Stani 'Pokrenite OBICAN PowerShell (bez Run as administrator) kao svakodnevni nalog; za jedini administratorski nalog koristite -JedanNalogSaUAC.'
}
if (-not (Test-Path -LiteralPath $konfiguracija)) { Stani "Nema $konfiguracija. Prvo KORAK 1: instaliraj.ps1 kao Administrator." }
if (-not (Test-Path -LiteralPath $node)) { Stani "Node nije nadjen u $node." }
$k = Get-Content -LiteralPath $konfiguracija -Raw | ConvertFrom-Json
Ok "Konfiguracija: uredjaj $($k.deviceCode), server $($k.serverOrigin), izvor '$($k.izvorniFolder)', slanje od $($k.posaljiOdDatuma)."

# ----------------------------------------------------------- 1. folder stanja
try { & (Join-Path $cilj 'windows\harden-state-dir.ps1') -Apply } catch { Stani "Folder stanja nije ucvrscen: $($_.Exception.Message)" }
Ok 'Folder stanja je ucvrscen (kljuc i red su dostupni samo ovom nalogu).'

# --------------------------------------------------------------- 2. kljuc
$init = Konektor @('init')
if ($init.Json -and $init.Json.status -eq 'napravljen') {
  Ok 'Kljuc uredjaja je napravljen (DPAPI, samo ovaj nalog).'
} elseif ($init.Json -and $init.Json.status -eq 'vec_postoji') {
  Ok 'Kljuc uredjaja vec postoji i nije menjan.'
} else {
  Stani "init nije uspeo: $($init.Tekst)"
}
$kljuc = Konektor @('export-key')
if (-not $kljuc.Json) { Stani "Javni kljuc nije procitan: $($kljuc.Tekst)" }

# ------------------------------------------------- 3. folder faktura (citanje)
$global:LASTEXITCODE = 0
if ($JedanNalogSaUAC) {
  & (Join-Path $cilj 'windows\verify-invoice-folder.ps1') -InvoiceFolder $k.izvorniFolder -RunAsAccount $nalog -PackagePath $cilj -JedanNalogSaUAC
} else {
  & (Join-Path $cilj 'windows\verify-invoice-folder.ps1') -InvoiceFolder $k.izvorniFolder -RunAsAccount $nalog -PackagePath $cilj
}
if ($global:LASTEXITCODE -ne 0) { Stani 'Provera foldera faktura nije prosla (vidi [FAIL] iznad). Konektor ne sme da pise u taj folder.' }
if ($JedanNalogSaUAC) { Ok 'Folder faktura: isti nalog ima upis (Tamarin rad); konektor po svom kodu samo cita - Windows to u ovom rezimu ne sprecava.' }
else { Ok 'Folder faktura: nalog konektora nema pravo upisa; konektor samo cita.' }

# ----------------------------------------------------------- 4. test veze
$hb = Konektor @('heartbeat')
if (-not $hb.Json -or $hb.Json.http -ne 200) {
  Write-Host ''
  Write-Host 'Uredjaj jos nije aktiviran u portalu (ili server nije dostupan).' -ForegroundColor Yellow
  Write-Host "  Server odgovor: http $($hb.Json.http) kod $($hb.Json.kod)"
  Write-Host '  Vlasnik u portalu: Uvoz -> Sinhronizacija -> registruj uredjaj, pa aktiviraj potvrdom otiska:'
  Write-Host "    Oznaka uredjaja: $($k.deviceCode)   Opseg: biznisoft / $($k.issuerCode)"
  Write-Host "    Otisak (mora se poklopiti): $($kljuc.Json.fingerprint)"
  Write-Host "    Javni kljuc: $($kljuc.Json.javniKljucSpkiBase64)"
  Write-Host '  Zatim ponovo pokrenite ovu skriptu (sa istim parametrima).'
  exit 3
}
Ok 'Veza sa serverom i uredjaj su ispravni (heartbeat 200).'

# ------------------------------------------------------------ 5. prvi prolaz
if (-not $BezPrvogProlaza) {
  Info "Prvi prolaz: dokumenti izdati pre $($k.posaljiOdDatuma) se samo beleze, ne salju."
  for ($i = 1; $i -le 60; $i++) {
    $r = Konektor @('run-once')
    if ($r.Json -and $r.Json.status -eq 'zauzeto') { Info 'Drugi prolaz je aktivan; cekam 60 s.'; Start-Sleep -Seconds 60; continue }
    if (-not $r.Json) { Stani "run-once nije vratio izvestaj: $($r.Tekst)" }
    $s = $r.Json.slanje
    Info ("Prolaz {0}: pregledano {1}, novo {2}, poslato {3}, potvrdjeno {4}, za pregled {5}, preostalo {6}" -f $i,
      $r.Json.skeniranje.pregledano, $r.Json.skeniranje.novo, $s.poslato, $s.potvrdjeno, $s.zaPregled, $r.Json.preostalo)
    if ($s.zaustavljeno) { Info "Slanje privremeno zaustavljeno ($($s.zaustavljeno)); nastavlja se u sledecem prolazu." ; break }
    if ([int]$r.Json.preostalo -eq 0 -and [int]$r.Json.ostaloURedu -eq 0) { break }
  }
  Ok 'Prvi prolaz je zavrsen.'
}

# -------------------------------------------------------- 6. zakazani zadatak
try {
  if ($JedanNalogSaUAC) {
    & (Join-Path $cilj 'windows\task.ps1') -Action install -Mode Production -PackagePath $cilj -RunAsAccount $nalog -Apply -JedanNalogSaUAC
  } else {
    & (Join-Path $cilj 'windows\task.ps1') -Action install -Mode Production -PackagePath $cilj -RunAsAccount $nalog -Apply
  }
} catch {
  Stani "Zakazani zadatak nije registrovan: $($_.Exception.Message)"
}
Ok "Zakazani zadatak je registrovan pod nalogom $nalog (radnim danima posle 09:00, dok je nalog prijavljen)."

# ------------------------------------------------------------------ 7. provera
& (Join-Path $cilj 'windows\provera.ps1')
