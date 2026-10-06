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

  Akcija zadatka poziva `node.exe` DIREKTNO — apsolutna, proverena putanja,
  apsolutni entry point u instalacionom (package) folderu. NEMA posrednog
  `.cmd`/`.ps1` launchera u folderu stanja: taj folder je upisiv za
  `RunAsAccount` (mora biti, drži ključ i red), pa bi bilo koji fajl koji
  Task Scheduler odatle izvršava bio deo izvršnog lanca koji isti nalog može
  sam izmeniti bez ikakve eskalacije. Ranija verzija je generisala baš takav
  fajl (`run-connector.cmd`) — WIN-INSTALL-01 korekcija ga uklanja u celosti.

  `-Mode Production | Smoke` je OBAVEZAN za `-Action install` i
  `-Action uninstall` (i za dry-run) — svaki režim ima potpuno drugačiji
  ugovor:

    - `Production`: STROGO i BLOKIRAJUĆE. Bilo koji neuspeh PREKIDA instalaciju
      pre `Register-ScheduledTask`. Nema WARN-samo puta, nema `-Force`/bypass
      opcije koja neuspeh pretvara u upozorenje. Vidi `OFFICE-INSTALL.md`.
    - `Smoke`: kućni/test tok (paket obično na Desktop-u, lični nalog, često
      administratorski). Provere koje bi u `Production` bile blokirajuće ovde
      SAMO upozoravaju (`[WARN]`) — vidi `connector/smoke/START-HERE.md`.

  Svaki režim registruje POD DRUGIM IMENOM zadatka — `Production` i `Smoke`
  fizički ne mogu zameniti jedan drugog (Task Scheduler razlikuje zadatke po
  Path+Name; imena se ovde nikad ne poklapaju).

.PARAMETER Action
  install | status | uninstall

.PARAMETER Mode
  Production | Smoke. OBAVEZAN za `install` i `uninstall` (i dry-run) — bez
  njega se instalacija/uklanjanje odbija PRE bilo kakve provere ili izmene.
  Za `status` je opcion: bez njega se prikazuju OBA zadatka ako postoje.

.PARAMETER PackagePath
  Folder u koji je raspakovan konektor (sadrzi `connector.cmd` i
  `connector\bin\connector.mjs`).

.PARAMETER RunAsAccount
  Nalog pod kojim zadatak radi. Podrazumevano trenutni nalog ($env:USERNAME).
  DPAPI `CurrentUser` ključ otključava SAMO ovaj nalog, pa mora biti isti
  nalog pod kojim se konektor i ručno pokreće.

.PARAMETER Apply
  Bez njega se nista ne menja na sistemu.
#>
[CmdletBinding()]
param(
  [ValidateSet('install', 'status', 'uninstall')]
  [string]$Action = 'status',
  [ValidateSet('Production', 'Smoke')]
  [string]$Mode,
  [string]$PackagePath = "$PSScriptRoot\..",
  [string]$RunAsAccount = $env:USERNAME,
  [switch]$Apply
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'PathGuards.ps1')

# Imenovani zadaci — skripta dira ISKLJUCIVO ta dva, i nikad unakrsno.
$TaskPath = '\Carsystem\'
$TaskNames = @{
  Production = 'CarsystemConnector'
  Smoke      = 'CarsystemConnectorSMOKE'
}

if ($Action -in @('install', 'uninstall') -and -not $Mode) {
  throw "-Mode je obavezan za -Action $Action (Production ili Smoke). Vidi OFFICE-INSTALL.md za Production, smoke/START-HERE.md za Smoke."
}

function Write-Plan([string]$text) {
  if ($Apply) { Write-Host $text } else { Write-Host "[dry-run] $text" }
}

function Write-Warn([string]$text) {
  Write-Host "[WARN] $text"
}

function Write-Fail-Production([string]$text) {
  throw "[Production] $text"
}

$exe = Join-Path (Resolve-Path $PackagePath) 'connector.cmd'
if (-not (Test-Path $exe)) { throw "Ne postoji $exe — proveri -PackagePath." }

$exeItem = Get-Item -LiteralPath $exe -Force
if ($exeItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
  throw "$exe je symlink/reparse-point — odbijeno bez obzira na kontekst (smoke ili produkcija)."
}

$resolvedPackagePath = Resolve-Path $PackagePath

$entryPoint = Join-Path $resolvedPackagePath 'connector\bin\connector.mjs'
$entryPointPostoji = Test-Path -LiteralPath $entryPoint
if ($entryPointPostoji) {
  $entryItem = Get-Item -LiteralPath $entryPoint -Force
  if ($entryItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
    throw "$entryPoint je symlink/reparse-point — odbijeno bez obzira na kontekst (smoke ili produkcija)."
  }
}

switch ($Action) {
  'status' {
    $imenaZaPrikaz = if ($Mode) { @($TaskNames[$Mode]) } else { $TaskNames.Values }
    foreach ($ime in $imenaZaPrikaz) {
      $t = Get-ScheduledTask -TaskName $ime -TaskPath $TaskPath -ErrorAction SilentlyContinue
      if ($null -eq $t) { Write-Host "Zadatak '$ime' nije registrovan." }
      else {
        $info = Get-ScheduledTaskInfo -TaskName $ime -TaskPath $TaskPath
        [pscustomobject]@{
          Zadatak        = $t.TaskName
          Stanje         = $t.State
          Nalog          = $t.Principal.UserId
          RunLevel       = $t.Principal.RunLevel
          Izvrsni        = $t.Actions[0].Execute
          Argumenti      = $t.Actions[0].Arguments
          RadniDirekt    = $t.Actions[0].WorkingDirectory
          PoslednjeVreme = $info.LastRunTime
          PoslednjiIshod = $info.LastTaskResult
          SledeceVreme   = $info.NextRunTime
        } | Format-List
      }
    }
  }

  'install' {
    $TaskName = $TaskNames[$Mode]

    <#
      Node se MORA razrešiti da bi se registrovao zadatak — bez njega akcija
      ne bi imala šta da pokrene. `Production` zahteva i da putanja bude
      bez upozorenja (van korisnički upisive lokacije); `Smoke` samo
      upozorava.
    #>
    $nodeInfo = $null
    $nodeGreska = $null
    try {
      $nodeInfo = Resolve-VerifiedNodePath
    }
    catch {
      $nodeGreska = $_.Exception.Message
    }

    if ($Mode -eq 'Production') {
      <#
        STROGE, BLOKIRAJUĆE provere — SVAKA ide PRE Register-ScheduledTask,
        i SVAKA baca (throw) na neuspeh. Nema WARN puta, nema -Force/bypass
        opcije koja bi FAIL pretvorila u upozorenje. Ako bilo šta ovde
        pukne, instalacija se NE dešava.
      #>
      Write-Host '[Production] Stroge provere pre registracije zadatka...'

      $folderGreska = Test-ForbiddenPackagePath -Path $resolvedPackagePath
      if ($folderGreska) {
        Write-Fail-Production "instalacioni folder odbijen: $folderGreska"
      }

      $paketNeucvrscen = Test-PackageDirectoryHardened -Path $resolvedPackagePath
      if ($paketNeucvrscen) {
        Write-Fail-Production "instalacioni folder nije učvršćen ($paketNeucvrscen). Pokrenite prvo: harden-install-dir.ps1 -PackagePath ... -RunAsAccount ... -Apply"
      }

      $stateDirZaProveru = "$env:LOCALAPPDATA\CarsystemConnector"
      $stanjeNeucvrsceno = Test-StateDirHardened -Path $stateDirZaProveru -RunAsAccount $RunAsAccount
      if ($stanjeNeucvrsceno) {
        Write-Fail-Production "folder stanja nije učvršćen ($stanjeNeucvrsceno). Pokrenite (prijavljeni KAO RunAsAccount): harden-state-dir.ps1 -Apply"
      }

      if (-not $entryPointPostoji) {
        Write-Fail-Production "entry point ne postoji: $entryPoint"
      }

      <#
        Production config.json MORA biti u instalacionom (package) folderu,
        NE u folderu stanja: taj folder je admin-write-only posle
        `harden-install-dir.ps1 -Apply` (RunAsAccount = samo Read & Execute),
        pa `serverOrigin`/`izvorniFolder` postaju van domašaja pisanja naloga
        koji svakodnevno pokreće konektor. Operater ga postavlja RUČNO, kao
        administrator, pre (ili posle) hardening-a — vidi OFFICE-INSTALL.md.
      #>
      $productionConfigPath = Join-Path $resolvedPackagePath 'config.json'
      if (-not (Test-Path -LiteralPath $productionConfigPath)) {
        Write-Fail-Production "config.json ne postoji u instalacionom folderu ($productionConfigPath). Production zahteva config.json u paketu, ne u folderu stanja — postavite ga (kao administrator) pre registracije."
      }
      else {
        $configItem = Get-Item -LiteralPath $productionConfigPath -Force
        if ($configItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
          Write-Fail-Production "config.json je symlink/reparse-point: $productionConfigPath"
        }
      }

      if ($nodeGreska) {
        Write-Fail-Production "Node se ne može razrešiti: $nodeGreska"
      }
      if ($nodeInfo.Warning) {
        Write-Fail-Production "Node putanja nije prihvatljiva za produkciju: $($nodeInfo.Warning). Instalirajte zvanični Node u 'Program Files'."
      }

      $jeAdmin = $false
      try {
        $jeAdmin = Test-IsAdministratorAccount -AccountName $RunAsAccount
      }
      catch {
        Write-Fail-Production "provera administratorskog članstva za '$RunAsAccount' nije uspela: $($_.Exception.Message)"
      }
      if ($jeAdmin) {
        Write-Fail-Production "RunAsAccount '$RunAsAccount' je administrator ili SYSTEM — Production zahteva poseban least-privilege nalog."
      }

      if ($Apply -and -not (Test-CurrentProcessIsElevated)) {
        Write-Fail-Production '-Apply zahteva administratorska prava. Pokrenite PowerShell kao administrator.'
      }

      Write-Host '[Production] Sve stroge provere PROŠLE.'
    }
    else {
      <#
        Smoke — savetodavne provere, isti duh kao ranije: ova grana pokreće
        kućni/test tok (Desktop, obično lični admin nalog) i NIKAD se ne
        predstavlja kao dozvoljena za pravi BizniSoft folder.
      #>
      Write-Warn 'SMOKE REŽIM — nije za pravi BizniSoft folder ni za kancelarijsku instalaciju. Za produkciju koristite -Mode Production (vidi OFFICE-INSTALL.md).'

      try {
        $jeAdmin = Test-IsAdministratorAccount -AccountName $RunAsAccount
        if ($jeAdmin) {
          Write-Warn "RunAsAccount '$RunAsAccount' JESTE administrator ili SYSTEM. Za Production ovo nije dozvoljeno; za smoke je uobičajeno i prihvatljivo."
        }
      }
      catch {
        Write-Warn "Nije moglo da se proveri da li je '$RunAsAccount' administrator: $($_.Exception.Message)"
      }

      try {
        $neucvrsceno = Test-PackageDirectoryHardened -Path $resolvedPackagePath
        if ($neucvrsceno) {
          Write-Warn "Instalacioni folder ne izgleda učvršćen ($neucvrsceno). Za smoke je ovo očekivano."
        }
      }
      catch {
        Write-Warn "Nije moglo da se proveri da li je instalacioni folder učvršćen: $($_.Exception.Message)"
      }

      if (-not $entryPointPostoji) {
        Write-Warn "Entry point ne postoji: $entryPoint — status pri pokretanju zadatka će se ovo javiti kao greška."
      }

      if ($nodeGreska) {
        if ($Apply) { throw "Node se ne može razrešiti — registracija je odbijena i za smoke: $nodeGreska" }
        Write-Warn "Node se ne može razrešiti: $nodeGreska"
      }
      elseif ($nodeInfo.Warning) {
        Write-Warn "$($nodeInfo.Warning). Za Production ovo nije dozvoljeno — vidi OFFICE-INSTALL.md."
      }
    }

    if ($Apply -and -not $nodeInfo) {
      throw 'Node se ne može razrešiti — registracija zadatka je odbijena (vidi poruku iznad).'
    }

    <#
      Pokrece se u 09:05, pet minuta POSLE poslovnog termina.

      Razlog: aplikacija sama proverava da li je 09:00 proslo. Pokretanje tacno
      u 09:00 bi na sporom racunaru moglo da padne sekund ranije i ciklus bi
      cekao ceo dan. Pet minuta je jeftina rezerva.

      `-StartWhenAvailable` hvata slucaj kada je racunar bio ugasen; konektor
      tada izvrsi NAJVISE JEDAN naknadni ciklus, jer to proverava sam.
    #>
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
    $principal = New-ScheduledTaskPrincipal -UserId $RunAsAccount -LogonType Interactive -RunLevel Limited

    <#
      Akcija poziva `node.exe` DIREKTNO — apsolutna, PROVERENA putanja,
      apsolutni entry point unutar instalacionog foldera, radni direktorijum
      = isti instalacioni folder. NEMA posrednog fajla u folderu stanja: nema
      šta da RunAsAccount izmeni da bi promenio šta se sledeći put izvršava,
      van samog paketa (koji je u Production read-only za taj nalog).

      `--packaged` zamenjuje `set CS_CONNECTOR_PACKAGED=1` iz `connector.cmd`
      — javni ScheduledTasks API nema način da zakači promenljivu okruženja
      na akciju, pa je argument liniji jedini kanal koji ostaje bez posrednog
      fajla. `bin/connector.mjs` je skida pre prosleđivanja komande dalje.

      `Production` dodaje i `--config <package>\config.json` — config.json u
      Production ugovoru ŽIVI u instalacionom (admin-write-only) folderu, ne
      u folderu stanja koji RunAsAccount mora moći da piše. `Smoke` ostaje na
      podrazumevanoj putanji (folder stanja) — kućni tok na to i dalje računa.
    #>
    $nodePathZaPrikaz = if ($nodeInfo) { $nodeInfo.Path } else { '(nije razrešen — videti poruku iznad)' }
    $argumentZaPrikaz = if ($Mode -eq 'Production') {
      "--no-warnings `"$resolvedPackagePath\connector\bin\connector.mjs`" --packaged --config `"$productionConfigPath`" auto"
    }
    else {
      "--no-warnings `"$resolvedPackagePath\connector\bin\connector.mjs`" --packaged auto"
    }
    Write-Plan "Registrujem '$TaskPath$TaskName' [$Mode]: izvršni $nodePathZaPrikaz, argumenti $argumentZaPrikaz, nalog $RunAsAccount, radni direktorijum $resolvedPackagePath."
    if ($Apply) {
      $action = New-ScheduledTaskAction -Execute $nodeInfo.Path `
        -Argument $argumentZaPrikaz `
        -WorkingDirectory $resolvedPackagePath
      Register-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath `
        -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
      Write-Host "Registrovano. Provera: .\task.ps1 -Action status -Mode $Mode"
    }
  }

  'uninstall' {
    $TaskName = $TaskNames[$Mode]
    <#
      Uklanja SAMO zadatak izabranog režima.

      Ne dira izvorne PDF-ove, privatni kljuc ni lokalni red — uklanjanje
      autostarta nije brisanje podataka, i nesalte stavke moraju ostati.
    #>
    Write-Plan "Uklanjam zadatak '$TaskPath$TaskName' [$Mode] (PDF-ovi, kljuc i red ostaju netaknuti)."
    if ($Apply) {
      Unregister-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -Confirm:$false
      Write-Host "Uklonjeno."
    }
  }
}
