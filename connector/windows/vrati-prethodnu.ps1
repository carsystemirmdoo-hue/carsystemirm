<#
  Carsystem konektor - povratak na prethodnu verziju (kao Administrator).

    .\vrati-prethodnu.ps1 -JedanNalogSaUAC      (jedan administratorski nalog)
    .\vrati-prethodnu.ps1 -RunAsAccount 'RACUNAR\nalog'

  Vraca poslednju sacuvanu verziju (C:\Program Files\CarsystemConnector.prethodna-*)
  na mesto aktivne; aktivna se cuva kao .vraceno-*. Folder stanja (kljuc,
  queue.db) i config.json prethodne verzije se ne diraju. Zakazani zadatak
  pokazuje na istu putanju i ostaje.
#>
#Requires -Version 5.1
param(
  [string]$RunAsAccount = "$env:USERDOMAIN\$env:USERNAME",
  [switch]$JedanNalogSaUAC
)
$ErrorActionPreference = 'Stop'
function Stani([string]$poruka) { Write-Host "[STOP] $poruka" -ForegroundColor Red; exit 1 }
if (-not (New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Stani 'Pokrenite PowerShell kao Administrator.'
}
$cilj = Join-Path $env:ProgramFiles 'CarsystemConnector'
$prethodna = Get-ChildItem -LiteralPath $env:ProgramFiles -Directory -Filter 'CarsystemConnector.prethodna-*' | Sort-Object Name | Select-Object -Last 1
if (-not $prethodna) { Stani 'Nema sacuvane prethodne verzije.' }
$zadatak = Get-ScheduledTask -TaskName 'CarsystemConnector' -ErrorAction SilentlyContinue
if ($zadatak -and $zadatak.State -eq 'Running') { Stani 'Zakazani zadatak trenutno radi; sacekajte da zavrsi.' }
if (Test-Path -LiteralPath $cilj) { Move-Item -LiteralPath $cilj -Destination "$cilj.vraceno-$(Get-Date -Format 'yyyyMMddHHmmss')" }
Move-Item -LiteralPath $prethodna.FullName -Destination $cilj
$global:LASTEXITCODE = 0
if ($JedanNalogSaUAC) { & (Join-Path $cilj 'windows\harden-install-dir.ps1') -PackagePath $cilj -RunAsAccount $RunAsAccount -Apply -JedanNalogSaUAC }
else { & (Join-Path $cilj 'windows\harden-install-dir.ps1') -PackagePath $cilj -RunAsAccount $RunAsAccount -Apply }
if ($global:LASTEXITCODE -ne 0) { Stani "harden-install-dir nije prosao (kod $global:LASTEXITCODE)." }
Write-Host "[OK]   Vracena verzija iz $($prethodna.Name)." -ForegroundColor Green
