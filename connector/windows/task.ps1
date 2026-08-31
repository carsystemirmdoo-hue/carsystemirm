<#
.SYNOPSIS
  Instalira, prikazuje ili uklanja imenovani Task Scheduler zadatak konektora.

.DESCRIPTION
  JEDNA autostart putanja: Task Scheduler, pod nalogom operatera. Namerno se ne
  pravi i Windows servis — dva paralelna pokretaca bi mogla da rade istovremeno,
  a i servis bi po pravilu radio pod drugim nalogom, gde DPAPI `CurrentUser`
  kljuc nije dostupan.

  Task Scheduler POKRECE proces; aplikacija odlucuje da li je poslovni termin
  dozvoljen. `StartWhenAvailable` ume da pokrene propusten zadatak kasnije i
  NIJE zamena za praznicni kalendar — konektor zato i sam proverava raspored.

  PODRAZUMEVANO JE DRY-RUN: skripta samo ispisuje sta bi uradila. Za stvarnu
  izmenu treba `-Apply`.

.PARAMETER Action
  install | status | uninstall

.PARAMETER PackagePath
  Folder u koji je raspakovan konektor (sadrzi `connector.cmd`).

.PARAMETER Apply
  Bez njega se nista ne menja na sistemu.
#>
[CmdletBinding()]
param(
  [ValidateSet('install', 'status', 'uninstall')]
  [string]$Action = 'status',
  [string]$PackagePath = "$PSScriptRoot\..",
  [switch]$Apply
)

$ErrorActionPreference = 'Stop'

# Imenovan zadatak — skripta dira ISKLJUCIVO njega.
$TaskName = 'CarsystemConnector'
$TaskPath = '\Carsystem\'

function Write-Plan([string]$text) {
  if ($Apply) { Write-Host $text } else { Write-Host "[dry-run] $text" }
}

$exe = Join-Path (Resolve-Path $PackagePath) 'connector.cmd'
if (-not (Test-Path $exe)) { throw "Ne postoji $exe — proveri -PackagePath." }

switch ($Action) {
  'status' {
    $t = Get-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -ErrorAction SilentlyContinue
    if ($null -eq $t) { Write-Host "Zadatak '$TaskName' nije registrovan." }
    else {
      $info = Get-ScheduledTaskInfo -TaskName $TaskName -TaskPath $TaskPath
      [pscustomobject]@{
        Zadatak        = $t.TaskName
        Stanje         = $t.State
        Nalog          = $t.Principal.UserId
        PoslednjeVreme = $info.LastRunTime
        PoslednjiIshod = $info.LastTaskResult
        SledeceVreme   = $info.NextRunTime
      } | Format-List
    }
  }

  'install' {
    <#
      Pokrece se u 09:05, pet minuta POSLE poslovnog termina.

      Razlog: aplikacija sama proverava da li je 09:00 proslo. Pokretanje tacno
      u 09:00 bi na sporom racunaru moglo da padne sekund ranije i ciklus bi
      cekao ceo dan. Pet minuta je jeftina rezerva.

      `-StartWhenAvailable` hvata slucaj kada je racunar bio ugasen; konektor
      tada izvrsi NAJVISE JEDAN naknadni ciklus, jer to proverava sam.
    #>
    $action  = New-ScheduledTaskAction -Execute $exe -Argument 'auto' -WorkingDirectory (Resolve-Path $PackagePath)
    $trigger = New-ScheduledTaskTrigger -Daily -At '09:05'
    $settings = New-ScheduledTaskSettingsSet `
      -StartWhenAvailable `
      -DontStopIfGoingOnBatteries `
      -AllowStartIfOnBatteries `
      -MultipleInstances IgnoreNew `
      -ExecutionTimeLimit (New-TimeSpan -Hours 2)

    <#
      ISTI nalog kao pri rucnom pokretanju.

      DPAPI `CurrentUser` kljuc otkljucava samo taj nalog. Pokretanje kao SYSTEM
      radi zaobilazenja DPAPI problema ponistilo bi celu zastitu i zato se ovde
      ne nudi.

      `-LogonType Interactive`: zadatak radi kada je nalog prijavljen. Rad bez
      prijave trazi sacuvanu lozinku (`-LogonType Password`) i NIJE testiran —
      vidi dokumentaciju, ostaje otvoreno.
    #>
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

    Write-Plan "Registrujem '$TaskPath$TaskName': $exe auto, dnevno u 09:05, nalog $env:USERNAME."
    if ($Apply) {
      Register-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath `
        -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
      Write-Host "Registrovano. Provera: .\task.ps1 -Action status"
    }
  }

  'uninstall' {
    <#
      Uklanja SAMO ovaj zadatak.

      Ne dira izvorne PDF-ove, privatni kljuc ni lokalni red — uklanjanje
      autostarta nije brisanje podataka, i nesalte stavke moraju ostati.
    #>
    Write-Plan "Uklanjam zadatak '$TaskPath$TaskName' (PDF-ovi, kljuc i red ostaju netaknuti)."
    if ($Apply) {
      Unregister-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -Confirm:$false
      Write-Host "Uklonjeno."
    }
  }
}
