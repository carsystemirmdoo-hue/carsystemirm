<#
  Carsystem konektor - PROBA zakazanog zadatka (Task Scheduler) uz ukljucen antivirus.

    & 'C:\Program Files\CarsystemConnector\windows\proba-zadatka.ps1' -JedanNalogSaUAC

  Sta radi (sve u ovom istom PowerShell prozoru, bez novog powershell.exe):
    1. registruje ZASEBAN zadatak \Carsystem\CarsystemProba pod ovim nalogom,
       istim podesavanjima kao pravi zadatak (Interactive, RunLevel Limited,
       MultipleInstances IgnoreNew), BEZ okidaca - ne pokrece se sam;
    2. akcija: node.exe (apsolutna putanja) connector.mjs --packaged --help;
       --help ne cita kljuc ni konfiguraciju, ne otvara mrezu i ne dira fakture;
    3. pokrece ga (Task Scheduler COM, rezervno schtasks /Run) i ceka kraj;
    4. trazi LastTaskResult = 0 i LastRunTime posle pokretanja;
    5. UVEK uklanja zadatak (i kada nesto pukne) i proverava da ga vise nema.

  NE dira: pravi zadatak CarsystemConnector, config.json, kljuc, red, fakture.
  Izlaz: 0 = PROBA PROSLA, 1 = proba nije prosla, 2 = preduslov nije ispunjen.
  Svaki korak nosi vreme (HH:mm:ss) radi poredjenja sa istorijom detekcija antivirusa.

  Stanje, pokretanje i uklanjanje idu kroz Task Scheduler COM + schtasks.exe
  (Zadaci.ps1), NE kroz Get-ScheduledTask/CIM: na kancelarijskom racunaru CIM
  vraca 0x80070002 i proba 0.3.6 je zato pogresno prijavila uklanjanje.

  Ako je prethodna proba prekinuta pa zadatak ostao: -SamoUkloni.
#>
#Requires -Version 5.1
param(
  [string]$PackagePath = (Join-Path $env:ProgramFiles 'CarsystemConnector'),
  [int]$CekanjeSekundi = 90,
  [switch]$SamoUkloni,
  # Jedini nalog je administrator: pokrenuti u administratorskoj sesiji TOG naloga (docs/b2b/49).
  [switch]$JedanNalogSaUAC
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'PathGuards.ps1')
. (Join-Path $PSScriptRoot 'Zadaci.ps1')

$TaskPath = '\Carsystem\'
$TaskName = 'CarsystemProba'
$nalog = "$env:USERDOMAIN\$env:USERNAME"

function Vreme { (Get-Date).ToString('HH:mm:ss') }
function Korak([string]$poruka) { Write-Host "[$(Vreme)] [..]   $poruka" }
function Ok([string]$poruka) { Write-Host "[$(Vreme)] [OK]   $poruka" -ForegroundColor Green }
function Los([string]$poruka) { Write-Host "[$(Vreme)] [FAIL] $poruka" -ForegroundColor Red }

function Get-Proba { Get-ZadatakCs -TaskPath $TaskPath -TaskName $TaskName }

function Ukloni-Probu {
  # Remove-ZadatakCs uklanja i POTVRDJUJE (COM + schtasks) da zadatka vise nema; inace baca.
  try { $null = Remove-ZadatakCs -TaskPath $TaskPath -TaskName $TaskName }
  catch { Los "Uklanjanje nije potvrdjeno: $($_.Exception.Message). Rucno: schtasks /Delete /TN $TaskPath$TaskName /F"; return $false }
  Ok "Zadatak $TaskPath$TaskName ne postoji (uklanjanje potvrdjeno)."
  return $true
}

Write-Host "Carsystem - proba zakazanog zadatka ($TaskPath$TaskName), nalog $nalog"

if ($SamoUkloni) {
  if (Ukloni-Probu) { exit 0 } else { exit 1 }
}

# ------------------------------------------------------------------ preduslovi
$povisena = Test-CurrentProcessIsElevated
if ($JedanNalogSaUAC) {
  if (-not $povisena) { Los 'Sa -JedanNalogSaUAC pokrenite PowerShell kao Administrator (isti tok kao podesi.ps1).'; exit 2 }
  $jedan = Test-JedanNalogSaUAC -AccountName $nalog
  if (-not $jedan.Dozvoljeno) { Los "-JedanNalogSaUAC nije ispunjen: $($jedan.Razlog)"; exit 2 }
  Ok 'Jedan nalog sa UAC: isti nalog, UAC ukljucen; zadatak radi sa ogranicenim tokenom.'
}
$entry = Join-Path $PackagePath 'connector\bin\connector.mjs'
if (-not (Test-Path -LiteralPath $entry)) { Los "Nema $entry - prvo instaliraj.ps1."; exit 2 }
try { $nodeInfo = Resolve-VerifiedNodePath } catch { Los "Node nije razresen: $($_.Exception.Message)"; exit 2 }
if ($nodeInfo.Warning) { Los "Node putanja nije prihvatljiva: $($nodeInfo.Warning)"; exit 2 }
Ok "Node: $($nodeInfo.Path)"
try { $pre = Get-Proba } catch { Los "Stanje zadatka nije moguce utvrditi: $($_.Exception.Message)"; exit 2 }
if ($pre.Postoji) { Los "Zadatak $TaskPath$TaskName vec postoji (prekinuta ranija proba). Pokrenite sa -SamoUkloni, pa ponovo."; exit 2 }
Ok "Pre probe: $TaskPath$TaskName ne postoji (potvrdjeno: $($pre.Izvor))."
try {
  if ((Get-ZadatakCs -TaskPath $TaskPath -TaskName 'CarsystemConnector').Postoji) { Korak 'Pravi zadatak CarsystemConnector postoji; proba ga ne dira.' }
} catch { Korak 'Stanje pravog zadatka CarsystemConnector nije procitano; proba ga ne dira.' }

# ----------------------------------------------------- registracija i pokretanje
$uspeh = $false
try {
  Korak 'Registrujem probni zadatak (bez okidaca)...'
  $action = New-ScheduledTaskAction -Execute $nodeInfo.Path `
    -Argument "--no-warnings `"$entry`" --packaged --help" `
    -WorkingDirectory $PackagePath
  $settings = New-ScheduledTaskSettingsSet `
    -DontStopIfGoingOnBatteries `
    -AllowStartIfOnBatteries `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
  $principal = New-ScheduledTaskPrincipal -UserId $nalog -LogonType Interactive -RunLevel Limited
  Register-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath `
    -Action $action -Settings $settings -Principal $principal | Out-Null
  $t = Get-Proba
  if (-not $t.Postoji) { throw 'Zadatak nije vidljiv posle registracije (COM + schtasks).' }
  if ($t.Izvor -ne 'com') { throw 'Zadatak postoji (schtasks), ali COM ne cita njegovu definiciju - proba ne moze da potvrdi akciju.' }
  if ($t.RunLevel -ne 'Limited') { throw "RunLevel je $($t.RunLevel), ocekivano Limited." }
  if ($t.Execute -ne $nodeInfo.Path) { throw 'Akcija ne pokrece ocekivani node.exe.' }
  if ($t.Arguments -notmatch '--packaged --help$') { throw 'Argumenti akcije nisu --packaged --help.' }
  if ($t.BrojOkidaca -ne 0) { throw 'Probni zadatak ima okidac.' }
  Ok "Registrovan i potvrdjen (COM): RunLevel Limited, akcija = node.exe --help, bez okidaca, nalog $($t.UserId)."

  $pocetak = Get-Date
  Start-Sleep -Seconds 1
  Korak 'Pokrecem (Task Scheduler COM, rezervno schtasks /Run)...'
  $kanal = Start-ZadatakCs -TaskPath $TaskPath -TaskName $TaskName
  Korak "Pokrenut ($kanal)."

  $rok = (Get-Date).AddSeconds($CekanjeSekundi)
  $info = $null
  do {
    Start-Sleep -Seconds 2
    $info = Get-Proba
    $stanje = $info.Stanje
  } while (($stanje -eq 'Running' -or $null -eq $info.LastRunTime -or $info.LastRunTime -lt $pocetak) -and (Get-Date) -lt $rok)

  $rez = [int64]$info.LastTaskResult
  $hex = '0x{0:X8}' -f ([int64]$rez -band [int64]4294967295)
  $kada = if ($info.LastRunTime) { $info.LastRunTime.ToString('HH:mm:ss') } else { 'nikad' }
  Korak "Stanje $stanje, poslednje pokretanje $kada, rezultat $rez ($hex)."
  if ($null -eq $info.LastRunTime -or $info.LastRunTime -lt $pocetak) {
    Los "Zadatak se nije pokrenuo za $CekanjeSekundi s (rezultat $hex). 0x00041303 = jos nije pokrenut."
  } elseif ($stanje -eq 'Running') {
    Los "Zadatak i dalje radi posle $CekanjeSekundi s."
  } elseif ($rez -ne 0) {
    Los "node.exe je zavrsio sa rezultatom $rez ($hex). Proveriti istoriju detekcija antivirusa za vreme iznad."
  } else {
    Ok 'Task Scheduler je pokrenuo node.exe i dobio izlaz 0.'
    $uspeh = $true
  }
}
catch {
  Los "Proba je prekinuta: $($_.Exception.Message)"
}
finally {
  Korak 'Uklanjam probni zadatak...'
  $uklonjen = Ukloni-Probu
  if (-not $uklonjen) { $uspeh = $false }
}

Write-Host ''
if ($uspeh) {
  Write-Host "[$(Vreme)] PROBA PROSLA: registracija, pokretanje kroz Task Scheduler i uklanjanje. Proverite istoriju detekcija antivirusa za ovaj period." -ForegroundColor Green
  exit 0
}
Write-Host "[$(Vreme)] PROBA NIJE PROSLA - vidi [FAIL] iznad." -ForegroundColor Red
exit 1
