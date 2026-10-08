<#
  Carsystem konektor - kratka provera (bilo koji nalog; podaci reda samo za nalog konektora).

    & 'C:\Program Files\CarsystemConnector\windows\provera.ps1'

  Prikazuje: verziju, poslednji ciklus i sledeci termin, stanje reda
  (ceka / poslato / za pregled), storna za rucni upload, upozorenje za
  folder nove godine i rezultat zakazanog zadatka. Ne salje nista.
#>
#Requires -Version 5.1
$ErrorActionPreference = 'Continue'
$cilj = Join-Path $env:ProgramFiles 'CarsystemConnector'
$node = Join-Path $env:ProgramFiles 'nodejs\node.exe'
$ulaz = Join-Path $cilj 'connector\bin\connector.mjs'
$konfiguracija = Join-Path $cilj 'config.json'

$verzija = if (Test-Path (Join-Path $cilj 'VERSION')) { (Get-Content (Join-Path $cilj 'VERSION') -Raw).Trim() } else { 'nepoznata' }
Write-Host "Carsystem konektor $verzija"

$izlaz = & $node --no-warnings $ulaz --packaged --config $konfiguracija status 2>$null
try { $s = ($izlaz -join "`n") | ConvertFrom-Json } catch { $s = $null }
if (-not $s) { Write-Host '[!!] Status nije procitan (pokrenite kao nalog konektora).' -ForegroundColor Yellow }
else {
  Write-Host "Poslednji ciklus: $($s.poslednjiCiklus)   Sledeci termin: $($s.sledeciTermin)"
  $red = $s.red
  Write-Host ("Red: potvrdjeno {0}, ceka slanje {1}, za pregled {2}, odlozeno {3}, odbijeno/blokirano {4}, nije za slanje {5}" -f `
    [int]$red.potvrdjeno, ([int]$red.spremno + [int]$red.salje_se), [int]$red.za_pregled, [int]$red.odlozeno,
    ([int]$red.odbijeno + [int]$red.blokirano), [int]$red.nepodrzano)
  if ($s.prePocetkaSlanja) { Write-Host "Pre pocetka slanja ($($s.prePocetkaSlanja.posaljiOdDatuma)): $($s.prePocetkaSlanja.nijePoslato) dokumenata zabelezeno, nije poslato (namerno)." }
  if ($s.nastaviPosle) { Write-Host "Server je trazio pauzu do: $($s.nastaviPosle)" -ForegroundColor Yellow }
  if ($s.stornaZaRucniUpload) {
    Write-Host "[!!] STORNA ZA RUCNI UPLOAD: $($s.stornaZaRucniUpload.broj). $($s.stornaZaRucniUpload.uputstvo)" -ForegroundColor Yellow
    Write-Host "     Spisak fajlova: & `"$node`" `"$ulaz`" --packaged --config `"$konfiguracija`" rucno"
  }
  if ($s.kasniIzvoz) {
    Write-Host "[!!] STARIJI RACUNI IZVEZENI NAKNADNO: $($s.kasniIzvoz.broj). $($s.kasniIzvoz.uputstvo)" -ForegroundColor Yellow
    Write-Host "     Spisak fajlova: & `"$node`" `"$ulaz`" --packaged --config `"$konfiguracija`" rucno"
  }
  if ($s.upozorenjeGodina) { Write-Host "[!!] $($s.upozorenjeGodina.uputstvo) Novi folder: $($s.upozorenjeGodina.folder)" -ForegroundColor Yellow }
}

# Stanje zadatka kroz Task Scheduler COM + schtasks.exe, ne kroz Get-ScheduledTask (CIM):
# na kancelarijskom racunaru CIM vraca 0x80070002, sto je ranije izgledalo kao "nije registrovan".
. (Join-Path $PSScriptRoot 'Zadaci.ps1')
$z = $null
try { $z = Get-ZadatakCs -TaskPath '\Carsystem\' -TaskName 'CarsystemConnector' }
catch { Write-Host "[!!] Stanje zakazanog zadatka NIJE MOGUCE UTVRDITI: $($_.Exception.Message)" -ForegroundColor Yellow }
if ($z -and -not $z.Postoji) { Write-Host '[!!] Zakazani zadatak CarsystemConnector nije registrovan.' -ForegroundColor Yellow }
elseif ($z -and $z.Izvor -ne 'com') { Write-Host "Zakazani zadatak postoji (potvrdio schtasks.exe); poslednji rezultat nije procitan." }
elseif ($z) {
  $rezultat = if ($z.LastTaskResult -eq 0) { 'uspeh (0)' } else { 'kod {0} (0x{1:X8})' -f $z.LastTaskResult, ([int64]$z.LastTaskResult -band [int64]4294967295) }
  Write-Host "Zakazani zadatak: stanje $($z.Stanje), poslednje pokretanje $($z.LastRunTime), rezultat $rezultat, sledece $($z.NextRunTime), nalog $($z.UserId)"
}
Write-Host "Dnevnik: $env:LOCALAPPDATA\CarsystemConnector\ (connector.log)"
