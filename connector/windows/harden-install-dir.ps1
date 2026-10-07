<#
.SYNOPSIS
  Učvršćuje instalacioni (package) folder konektora na least-privilege ACL.

.DESCRIPTION
  WIN-INSTALL-01 (bezbednosni audit): instalacioni folder sadrži izvršni kod
  konektora (`scanner.mjs`, `client.mjs`, `windows-dpapi.mjs`, `connector.cmd`).
  `harden-state-dir.ps1` štiti SAMO folder stanja (ključ, red) — ništa dosad
  nije štitilo sam kod. Bez zaštite, bilo ko sa write pravom na tu putanju
  (drugi lokalni nalog na deljenom Desktop-u, malver pod istim nalogom, ili
  samo greška u izboru foldera) može izmeniti taj kod PRE sledećeg zakazanog
  pokretanja — bez potrebe da ikad probije server ili bazu.

  Cilj: SAMO `BUILTIN\Administrators` i `NT AUTHORITY\SYSTEM` imaju
  FullControl. Nalog kojim Task Scheduler svakodnevno pokreće konektor
  (`RunAsAccount`) dobija ISKLJUČIVO `ReadAndExecute`. Niko drugi (Users,
  Authenticated Users, Everyone) nema ništa — nasleđivanje sa roditeljskog
  foldera je isključeno, pa se allow-lista ne može zaobići izmenom roditelja.

  PODRAZUMEVANO JE AUDIT/DRY-RUN — ispisuje PASS/FAIL/WOULD CHANGE, ne dira
  ništa. Stvarna izmena traži `-Apply`, koji dodatno traži administratorska
  prava trenutnog procesa.

  Ponovljeno pokretanje je idempotentno: drugi `-Apply` nad već ispravnim
  ACL-om ne menja ništa suštinski i post-verifikacija i dalje prolazi.

.PARAMETER PackagePath
  Apsolutna putanja instalacionog foldera (sadrži `connector.cmd`). OBAVEZAN,
  bez podrazumevane vrednosti — pogrešno pozvana skripta ne sme pogoditi
  pogrešan folder ćutke.

.PARAMETER RunAsAccount
  Nalog pod kojim Task Scheduler svakodnevno pokreće konektor (npr.
  "RACUNAR\korisnik"). OBAVEZAN. Skripta ga NE bira, NE pravi i NE menja
  članstvo — samo razrešava u SID i proverava da NIJE administrator/SYSTEM.
  Operater mora doneti tu odluku unapred.

.PARAMETER Apply
  Bez ovoga se ništa ne menja — samo audit izveštaj (PASS/FAIL/WOULD CHANGE).

.EXAMPLE
  .\harden-install-dir.ps1 -PackagePath 'C:\Program Files\CarsystemConnector' -RunAsAccount 'RACUNAR\konektor'

  Dry-run audit — ništa se ne menja.

.EXAMPLE
  .\harden-install-dir.ps1 -PackagePath 'C:\Program Files\CarsystemConnector' -RunAsAccount 'RACUNAR\konektor' -Apply

  Stvarna primena. Zahteva administratorski PowerShell.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)] [string]$PackagePath,
  [Parameter(Mandatory)] [string]$RunAsAccount,
  [switch]$Apply,
  # Jedini nalog je administrator (docs/b2b/49): dozvoljeno samo za isti nalog uz ukljucen UAC.
  [switch]$JedanNalogSaUAC
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'PathGuards.ps1')

$global:HardenInstallDirExitCode = 0

function Write-Result {
  param([ValidateSet('PASS', 'FAIL', 'WOULD CHANGE', 'CHANGED')] [string]$Status, [string]$Message)
  Write-Host "[$Status] $Message"
  if ($Status -eq 'FAIL') { $global:HardenInstallDirExitCode = 1 }
}

# ===========================================================================
# 1. Sve provere PRE bilo kakve izmene — uslovi moraju proći da bi se
#    razmatrala bilo koja izmena, dry-run ili stvarna.
# ===========================================================================

$putanjaGreska = Test-ForbiddenPackagePath -Path $PackagePath
if ($putanjaGreska) {
  Write-Result 'FAIL' "Instalacioni folder odbijen: $putanjaGreska"
  exit 1
}
$full = [System.IO.Path]::GetFullPath($PackagePath).TrimEnd('\')
Write-Result 'PASS' "Putanja prihvatljiva: $full"

try {
  $runAsSid = Resolve-AccountSid -AccountName $RunAsAccount
}
catch {
  Write-Result 'FAIL' $_.Exception.Message
  exit 1
}
Write-Result 'PASS' "Nalog '$RunAsAccount' razrešen u SID $($runAsSid.Value)."

try {
  $jeAdmin = Test-IsAdministratorAccount -AccountName $RunAsAccount
}
catch {
  Write-Result 'FAIL' "Provera administratorskog članstva nije uspela: $($_.Exception.Message)"
  exit 1
}
if ($jeAdmin) {
  $jedan = if ($JedanNalogSaUAC) { Test-JedanNalogSaUAC -AccountName $RunAsAccount } else { $null }
  if ($jedan -and $jedan.Dozvoljeno) {
    Write-Result 'PASS' "RunAsAccount '$RunAsAccount' je administrator (jedini nalog); dozvoljeno uz -JedanNalogSaUAC: isti nalog, UAC ukljucen. Konektor ima samo Read & Execute nad ovim folderom (ogranicen token)."
  }
  elseif ($jedan) {
    Write-Result 'FAIL' "-JedanNalogSaUAC nije ispunjen: $($jedan.Razlog)."
    exit 1
  }
  else {
    Write-Result 'FAIL' "RunAsAccount '$RunAsAccount' je administrator ili SYSTEM — nalog za svakodnevni rad konektora ne sme biti."
    exit 1
  }
}
else {
  Write-Result 'PASS' "RunAsAccount nije administrator ni SYSTEM."
}

if ($Apply -and -not (Test-CurrentProcessIsElevated)) {
  Write-Result 'FAIL' "-Apply zahteva administratorska prava. Pokrenite PowerShell kao administrator."
  exit 1
}

# ===========================================================================
# 2. Rezervna kopija postojećeg ACL-a — PRE bilo koje izmene, uvek se
#    priprema (i u dry-run se samo najavljuje gde bi otišla).
# ===========================================================================

$backupRoot = Join-Path $env:ProgramData 'CarsystemConnector\install-acl-backup'
$backupFile = Join-Path $backupRoot ("install-dir-acl-{0:yyyyMMdd-HHmmss}.sddl.txt" -f (Get-Date))

if ($Apply) {
  Protect-AdminOnlyFolder -Path $backupRoot
  $prethodniSddl = Get-AclSddl -Path $full
  Set-Content -LiteralPath $backupFile -Value $prethodniSddl -Encoding utf8 -NoNewline
  Write-Result 'CHANGED' "Prethodni ACL sačuvan: $backupFile"
}
else {
  Write-Result 'WOULD CHANGE' "Prethodni ACL bi bio sačuvan u: $backupFile"
}

# ===========================================================================
# 3. Nova allow-lista.
# ===========================================================================

$planPrava = @(
  "$RunAsAccount -> Read & Execute",
  'BUILTIN\Administrators -> FullControl',
  'NT AUTHORITY\SYSTEM -> FullControl',
  'Nasleđivanje sa roditeljskog foldera ISKLJUČENO',
  'Svi ostali unosi (Users, Authenticated Users, Everyone, ...) UKLONJENI'
)
foreach ($p in $planPrava) {
  if ($Apply) { Write-Result 'CHANGED' $p } else { Write-Result 'WOULD CHANGE' $p }
}

if (-not $Apply) {
  Write-Result 'WOULD CHANGE' 'Post-verifikacija bi se izvršila posle primene (samo uz -Apply).'
  Write-Host ''
  Write-Host 'Dry-run završen — ništa nije promenjeno. Ponovite sa -Apply za stvarnu izmenu (zahteva administratorska prava).'
  exit $global:HardenInstallDirExitCode
}

# ===========================================================================
# 4. Primena + post-verifikacija; rollback na bilo koji neuspeh.
# ===========================================================================

function Test-EffectivePermissions {
  param(
    [Parameter(Mandatory)] [string]$Path,
    [Parameter(Mandatory)] [System.Security.Principal.SecurityIdentifier]$RunAsSid
  )

  $acl = Get-Acl -LiteralPath $Path
  $problemi = New-Object System.Collections.Generic.List[string]

  if (-not $acl.AreAccessRulesProtected) {
    $problemi.Add('Nasleđivanje nije isključeno posle primene.')
  }

  $imaAdminFull = $false
  $imaSystemFull = $false
  $imaRunAsReadOnly = $false

  foreach ($ace in $acl.Access) {
    $rights = $ace.FileSystemRights
    try {
      $identitySid = $ace.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier])
    }
    catch {
      $identitySid = $null
    }

    if ($identitySid -and $identitySid.Value -eq 'S-1-5-32-544' -and $rights.HasFlag([System.Security.AccessControl.FileSystemRights]::FullControl)) {
      $imaAdminFull = $true
      continue
    }
    if ($identitySid -and $identitySid.Value -eq 'S-1-5-18' -and $rights.HasFlag([System.Security.AccessControl.FileSystemRights]::FullControl)) {
      $imaSystemFull = $true
      continue
    }
    if ($identitySid -and $identitySid -eq $RunAsSid) {
      $opasnaPrava = $rights.HasFlag([System.Security.AccessControl.FileSystemRights]::Write) -or
                     $rights.HasFlag([System.Security.AccessControl.FileSystemRights]::Modify) -or
                     $rights.HasFlag([System.Security.AccessControl.FileSystemRights]::FullControl) -or
                     $rights.HasFlag([System.Security.AccessControl.FileSystemRights]::ChangePermissions) -or
                     $rights.HasFlag([System.Security.AccessControl.FileSystemRights]::TakeOwnership) -or
                     $rights.HasFlag([System.Security.AccessControl.FileSystemRights]::Delete)
      if ($opasnaPrava) {
        $problemi.Add("RunAsAccount ima šira prava od Read & Execute: $rights")
      }
      $imaRunAsReadOnly = $true
      continue
    }

    $problemi.Add("Neočekivan unos u ACL-u posle primene: $($ace.IdentityReference) ($rights)")
  }

  if (-not $imaAdminFull) { $problemi.Add('BUILTIN\Administrators nema FullControl posle primene.') }
  if (-not $imaSystemFull) { $problemi.Add('NT AUTHORITY\SYSTEM nema FullControl posle primene.') }
  if (-not $imaRunAsReadOnly) { $problemi.Add('RunAsAccount se ne pojavljuje u ACL-u posle primene.') }

  return $problemi
}

function Restore-PreviousAcl {
  param([Parameter(Mandatory)] [string]$Path, [Parameter(Mandatory)] [string]$SddlFile)
  $sddl = Get-Content -LiteralPath $SddlFile -Raw
  $acl = Get-Acl -LiteralPath $Path
  $acl.SetSecurityDescriptorSddlForm($sddl)
  Set-Acl -LiteralPath $Path -AclObject $acl
}

try {
  $acl = Get-Acl -LiteralPath $full
  $acl.SetAccessRuleProtection($true, $false)
  $acl.Access | ForEach-Object { [void]$acl.RemoveAccessRule($_) }

  $readRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    $runAsSid, 'ReadAndExecute', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
  $acl.AddAccessRule($readRule)

  foreach ($who in @('BUILTIN\Administrators', 'NT AUTHORITY\SYSTEM')) {
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
      $who, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $acl.AddAccessRule($rule)
  }

  Set-Acl -LiteralPath $full -AclObject $acl

  # @(...): pod StrictMode prazna lista postaje $null, a jedan rezultat obican string (pad 0.3.1 na 5.1).
  $problemi = @(Test-EffectivePermissions -Path $full -RunAsSid $runAsSid)
  if ($problemi.Count -gt 0) {
    throw "Post-verifikacija nije prošla:`n - $($problemi -join "`n - ")"
  }

  Write-Result 'PASS' 'Post-verifikacija: efektivne dozvole odgovaraju ugovoru.'
}
catch {
  $greska = $_.Exception.Message
  Write-Result 'FAIL' "Primena ili post-verifikacija nije uspela: $greska"
  Write-Host '[FAIL] Pokušavam vraćanje prethodnog ACL-a...'
  try {
    Restore-PreviousAcl -Path $full -SddlFile $backupFile
    Write-Host "[FAIL] Prethodni ACL vraćen iz $backupFile. Primena NIJE uspela — pogledajte grešku iznad."
  }
  catch {
    Write-Host "[FAIL] KRITIČNO: rollback takođe nije uspeo: $($_.Exception.Message)"
    Write-Host "[FAIL] Ručno vratite ACL iz: $backupFile (SDDL tekst, primenite preko Set-Acl/SetSecurityDescriptorSddlForm)."
  }
  exit 1
}

Write-Host ''
Write-Host "Završeno. Provera: icacls `"$full`""
exit $global:HardenInstallDirExitCode
