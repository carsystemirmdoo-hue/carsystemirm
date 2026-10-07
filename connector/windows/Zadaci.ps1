<#
  Carsystem konektor - pouzdano stanje zakazanog zadatka (Task Scheduler).

  Dot-source:  . (Join-Path $PSScriptRoot 'Zadaci.ps1')

  ZASTO NE Get-ScheduledTask
  --------------------------
  `Get-ScheduledTask` / `Get-ScheduledTaskInfo` / `Start-ScheduledTask` /
  `Unregister-ScheduledTask` idu kroz CIM/WMI provajder. Na kancelarijskom
  racunaru (2026-10-07) taj provajder vraca HRESULT 0x80070002 cak i za opste
  listanje, a `-ErrorAction SilentlyContinue` je tu gresku pretvarao u
  "zadatak ne postoji" - i skripta je prijavila uklanjanje zadatka koji je
  i dalje postojao. Servis Schedule i schtasks.exe su pri tom radili ispravno.

  Ovde se stanje cita direktno iz servisa, kroz Task Scheduler COM API
  (Schedule.Service), a schtasks.exe je nezavisna potvrda. Nista se ne
  popravlja u registru ni u WMI-ju.

  PRAVILO: "ne postoji" se prijavljuje SAMO kada ga COM odredjeno kaze
  (folder ili zadatak nije nadjen) I schtasks.exe ga ne nadje. Svaka druga
  kombinacija je ili "postoji" ili izuzetak "zadatak_stanje_nepoznato" -
  nikad tiho "ne postoji".
#>

$script:HR_NIJE_NADJENO = @(-2147024894, -2147024893)  # 0x80070002, 0x80070003

function Get-ZadatakHResult($greska) {
  # HRESULT iz COM izuzetka (moze biti umotan u MethodInvocationException).
  $e = $greska
  if ($e -is [System.Management.Automation.ErrorRecord]) { $e = $e.Exception }
  $prvi = 0
  while ($null -ne $e) {
    if ($e -is [System.Runtime.InteropServices.COMException]) { return [int]$e.HResult }
    if ($prvi -eq 0 -and $e.HResult -ne -2146233087 -and $e.HResult -ne -2146233088) { $prvi = [int]$e.HResult }
    $e = $e.InnerException
  }
  return $prvi
}

function Format-ZadatakHResult([int]$hr) { '0x{0:X8}' -f ([int64]$hr -band [int64]4294967295) }

function Get-ZadatakPuno([string]$TaskPath, [string]$TaskName) {
  $folder = '\' + $TaskPath.Trim('\')
  if ($folder -eq '\') { return "\$TaskName" }
  return "$folder\$TaskName"
}

function Invoke-ZadatakSchtasks([string[]]$Argumenti) {
  # PS 5.1: stderr spoljnog programa uz 'Stop' bi prekinuo skriptu.
  $eap = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try {
    $izlaz = & "$env:SystemRoot\System32\schtasks.exe" @Argumenti 2>&1
    $kod = $LASTEXITCODE
  }
  finally { $ErrorActionPreference = $eap }
  return [pscustomobject]@{ Kod = $kod; Tekst = (@($izlaz) | ForEach-Object { "$_" }) -join "`n" }
}

function Connect-ZadatakServis {
  $svc = New-Object -ComObject 'Schedule.Service'
  $svc.Connect()
  return $svc
}

<#
  Vraca objekat sa Postoji = $true/$false i, kada postoji, stanjem i definicijom.
  Baca 'zadatak_stanje_nepoznato: ...' kada stanje ne moze pouzdano da se utvrdi.
#>
function Get-ZadatakCs {
  param([Parameter(Mandatory)] [string]$TaskPath, [Parameter(Mandatory)] [string]$TaskName)

  $puno = Get-ZadatakPuno $TaskPath $TaskName
  $comNema = $false
  $comGreska = $null
  $t = $null
  try {
    $svc = Connect-ZadatakServis
    $folderPut = '\' + $TaskPath.Trim('\')
    $folder = $null
    try { $folder = $svc.GetFolder($folderPut) }
    catch {
      $hr = Get-ZadatakHResult $_
      if ($script:HR_NIJE_NADJENO -contains $hr) { $comNema = $true } else { $comGreska = "GetFolder $(Format-ZadatakHResult $hr)" }
    }
    if ($folder) {
      try { $t = $folder.GetTask($TaskName) }
      catch {
        $hr = Get-ZadatakHResult $_
        if ($script:HR_NIJE_NADJENO -contains $hr) { $comNema = $true } else { $comGreska = "GetTask $(Format-ZadatakHResult $hr)" }
      }
    }
  }
  catch { $comGreska = "Schedule.Service $(Format-ZadatakHResult (Get-ZadatakHResult $_))" }

  if ($t) {
    $def = $t.Definition
    $akcija = $null
    if ($def.Actions.Count -ge 1) { $akcija = $def.Actions.Item(1) }
    $stanja = @{ 0 = 'Unknown'; 1 = 'Disabled'; 2 = 'Queued'; 3 = 'Ready'; 4 = 'Running' }
    $poslednje = $t.LastRunTime
    if ($poslednje -and $poslednje.Year -lt 2000) { $poslednje = $null }
    $sledece = $t.NextRunTime
    if ($sledece -and $sledece.Year -lt 2000) { $sledece = $null }
    return [pscustomobject]@{
      Postoji          = $true
      Izvor            = 'com'
      Puno             = $puno
      Stanje           = $stanja[[int]$t.State]
      LastRunTime      = $poslednje
      LastTaskResult   = [int64]$t.LastTaskResult
      NextRunTime      = $sledece
      UserId           = $def.Principal.UserId
      RunLevel         = $(if ([int]$def.Principal.RunLevel -eq 1) { 'Highest' } else { 'Limited' })
      LogonType        = [int]$def.Principal.LogonType
      Execute          = $(if ($akcija) { $akcija.Path } else { $null })
      Arguments        = $(if ($akcija) { $akcija.Arguments } else { $null })
      WorkingDirectory = $(if ($akcija) { $akcija.WorkingDirectory } else { $null })
      BrojOkidaca      = [int]$def.Triggers.Count
    }
  }

  # Nezavisna potvrda: schtasks.exe (isti servis, bez WMI-ja).
  $s = Invoke-ZadatakSchtasks @('/Query', '/TN', $puno, '/XML')
  if ($s.Kod -eq 0) {
    # Postoji, a COM ga nije procitao: stanje se ne izmislja.
    return [pscustomobject]@{
      Postoji = $true; Izvor = 'schtasks'; Puno = $puno; Stanje = 'Unknown'
      LastRunTime = $null; LastTaskResult = $null; NextRunTime = $null
      UserId = $null; RunLevel = $null; LogonType = $null
      Execute = $null; Arguments = $null; WorkingDirectory = $null; BrojOkidaca = $null
    }
  }
  if ($comNema -and -not $comGreska) {
    return [pscustomobject]@{ Postoji = $false; Izvor = 'com+schtasks'; Puno = $puno }
  }
  throw "zadatak_stanje_nepoznato: $puno (COM: $(if ($comGreska) { $comGreska } else { 'nije procitan' }); schtasks izlaz $($s.Kod))"
}

<# Pokrece zadatak: COM Run, pa schtasks /Run ako COM ne uspe. Baca na neuspeh. #>
function Start-ZadatakCs {
  param([Parameter(Mandatory)] [string]$TaskPath, [Parameter(Mandatory)] [string]$TaskName)
  $puno = Get-ZadatakPuno $TaskPath $TaskName
  try {
    $svc = Connect-ZadatakServis
    $null = $svc.GetFolder('\' + $TaskPath.Trim('\')).GetTask($TaskName).Run($null)
    return 'com'
  }
  catch {
    $comKod = Format-ZadatakHResult (Get-ZadatakHResult $_)
    $s = Invoke-ZadatakSchtasks @('/Run', '/TN', $puno)
    if ($s.Kod -eq 0) { return 'schtasks' }
    throw "zadatak_pokretanje_nije_uspelo: $puno (COM $comKod; schtasks izlaz $($s.Kod))"
  }
}

<#
  Uklanja zadatak i PROVERAVA da ga vise nema. Vraca $true samo kada je
  Get-ZadatakCs potvrdio Postoji = $false. Baca kada uklanjanje ili potvrda ne uspe.
#>
function Remove-ZadatakCs {
  param([Parameter(Mandatory)] [string]$TaskPath, [Parameter(Mandatory)] [string]$TaskName)
  $puno = Get-ZadatakPuno $TaskPath $TaskName
  $pre = Get-ZadatakCs -TaskPath $TaskPath -TaskName $TaskName
  if ($pre.Postoji) {
    $comKod = $null
    try {
      $svc = Connect-ZadatakServis
      $svc.GetFolder('\' + $TaskPath.Trim('\')).DeleteTask($TaskName, 0)
    }
    catch {
      $comKod = Format-ZadatakHResult (Get-ZadatakHResult $_)
      $s = Invoke-ZadatakSchtasks @('/Delete', '/TN', $puno, '/F')
      if ($s.Kod -ne 0) { throw "zadatak_uklanjanje_nije_uspelo: $puno (COM $comKod; schtasks izlaz $($s.Kod))" }
    }
  }
  $posle = Get-ZadatakCs -TaskPath $TaskPath -TaskName $TaskName
  if ($posle.Postoji) { throw "zadatak_i_dalje_postoji: $puno" }
  return $true
}
