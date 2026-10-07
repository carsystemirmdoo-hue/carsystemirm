<#
  Carsystem konektor - PROBA zakazanog zadatka (Task Scheduler) uz ukljucen antivirus.

    & 'C:\Program Files\CarsystemConnector\windows\proba-zadatka.ps1' -JedanNalogSaUAC

  Sta radi (sve u ovom istom PowerShell prozoru, bez novog powershell.exe):
    1. registruje ZASEBAN zadatak \Carsystem\CarsystemProba pod ovim nalogom,
       istim podesavanjima kao pravi zadatak (Interactive, RunLevel Limited,
       MultipleInstances IgnoreNew), BEZ okidaca - ne pokrece se sam;
    2. akcija: node.exe (apsolutna putanja) connector.mjs --packaged --help;
       --help ne cita kljuc ni konfiguraciju, ne otvara mrezu i ne dira fakture;
    3. pokrece ga (Start-ScheduledTask) i ceka kraj;
    4. trazi LastTaskResult = 0 i LastRunTime posle pokretanja;
    5. UVEK uklanja zadatak (i kada nesto pukne) i proverava da ga vise nema.

  NE dira: pravi zadatak CarsystemConnector, config.json, kljuc, red, fakture.
  Izlaz: 0 = PROBA PROSLA, 1 = proba nije prosla, 2 = preduslov nije ispunjen.
  Svaki korak nosi vreme (HH:mm:ss) radi poredjenja sa istorijom detekcija antivirusa.

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

$TaskPath = '\Carsystem\'
$TaskName = 'CarsystemProba'
$nalog = "$env:USERDOMAIN\$env:USERNAME"

function Vreme { (Get-Date).ToString('HH:mm:ss') }
function Korak([string]$poruka) { Write-Host "[$(Vreme)] [..]   $poruka" }
function Ok([string]$poruka) { Write-Host "[$(Vreme)] [OK]   $poruka" -ForegroundColor Green }
function Los([string]$poruka) { Write-Host "[$(Vreme)] [FAIL] $poruka" -ForegroundColor Red }

function Get-Proba { Get-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -ErrorAction SilentlyContinue }

function Ukloni-Probu {
  if (Get-Proba) {
    Unregister-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -Confirm:$false
  }
  if (Get-Proba) { Los "Zadatak $TaskPath$TaskName i dalje postoji posle uklanjanja."; return $false }
  Ok "Zadatak $TaskPath$TaskName ne postoji (uklonjen)."
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
if (Get-Proba) { Los "Zadatak $TaskPath$TaskName vec postoji (prekinuta ranija proba). Pokrenite sa -SamoUkloni, pa ponovo."; exit 2 }
if (Get-ScheduledTask -TaskName 'CarsystemConnector' -TaskPath $TaskPath -ErrorAction SilentlyContinue) {
  Korak 'Pravi zadatak CarsystemConnector postoji; proba ga ne dira.'
}

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
  if (-not $t) { throw 'Zadatak nije vidljiv posle registracije.' }
  if ($t.Principal.RunLevel -ne 'Limited') { throw "RunLevel je $($t.Principal.RunLevel), ocekivano Limited." }
  if ($t.Actions[0].Execute -ne $nodeInfo.Path) { throw 'Akcija ne pokrece ocekivani node.exe.' }
  Ok 'Registrovan (RunLevel Limited, akcija = node.exe direktno).'

  $pre = Get-Date
  Start-Sleep -Seconds 1
  Korak 'Pokrecem (Start-ScheduledTask)...'
  Start-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath

  $rok = (Get-Date).AddSeconds($CekanjeSekundi)
  $info = $null
  do {
    Start-Sleep -Seconds 2
    $stanje = (Get-Proba).State
    $info = Get-ScheduledTaskInfo -TaskName $TaskName -TaskPath $TaskPath
  } while (($stanje -eq 'Running' -or $info.LastRunTime -lt $pre) -and (Get-Date) -lt $rok)

  $rez = [int64]$info.LastTaskResult
  $hex = '0x{0:X8}' -f ([uint32]($rez -band 0xFFFFFFFF))
  Korak "Stanje $stanje, poslednje pokretanje $($info.LastRunTime.ToString('HH:mm:ss')), rezultat $rez ($hex)."
  if ($info.LastRunTime -lt $pre) {
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
  $uklonjen = $false
  try { $uklonjen = Ukloni-Probu } catch { Los "Uklanjanje nije uspelo: $($_.Exception.Message). Pokrenite ponovo sa -SamoUkloni." }
  if (-not $uklonjen) { $uspeh = $false }
}

Write-Host ''
if ($uspeh) {
  Write-Host "[$(Vreme)] PROBA PROSLA: registracija, pokretanje kroz Task Scheduler i uklanjanje. Proverite istoriju detekcija antivirusa za ovaj period." -ForegroundColor Green
  exit 0
}
Write-Host "[$(Vreme)] PROBA NIJE PROSLA - vidi [FAIL] iznad." -ForegroundColor Red
exit 1
