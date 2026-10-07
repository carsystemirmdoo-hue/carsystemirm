<#
.SYNOPSIS
  READ-ONLY audit — da li je BizniSoft folder sa fakturama bezbedno podešen
  za connector nalog, PRE nego što se konektor uperi na njega.

.DESCRIPTION
  Ova skripta NIKAD ne piše, ne briše i ne pokušava upis u prosleđeni folder,
  i NIKAD ne čita/prikazuje sadržaj nijedne fakture. Isključivo čita ACL
  (`Get-Acl`), razrešava naloge/grupe u SID preko .NET API-ja, i izveštava
  PASS/FAIL/WARN.

  Kada članstvo u nekoj grupi iz ACL-a ne može pouzdano da se proveri
  ugrađenim alatima (npr. domenska grupa bez AD modula), rezultat je
  `NOT VERIFIED / FAIL-CLOSED` — NIKAD pokušaj pisanja radi merenja.
  Probni upis nad jednokratnim (disposable) test folderom postoji ISKLJUČIVO
  kao odvojena Windows test funkcija u test paketu
  (`connector/test/windows-install-hardening.test.mjs`), nikad ovde, i nikad
  nad proizvoljnom prosleđenom putanjom.

  Namenjena kancelarijskoj instalaciji, POSLE home/smoke prolaza sa lažnim
  PDF-ovima — vidi `OFFICE-INSTALL.md`.

.PARAMETER InvoiceFolder
  Apsolutna putanja BizniSoft izvoznog foldera (npr.
  "C:\BizniSoft\Izvoz\Fakture"). OBAVEZAN.

.PARAMETER RunAsAccount
  Nalog pod kojim konektor čita fakture. OBAVEZAN.

.PARAMETER PackagePath
  Instalacioni folder konektora — koristi se SAMO da potvrdi da folder sa
  fakturama NIJE isti folder (ili podfolder) kao instalacioni/state folder.
  Opcion; ako se izostavi, ta provera se preskače uz upozorenje.

.EXAMPLE
  .\verify-invoice-folder.ps1 -InvoiceFolder 'C:\BizniSoft\Izvoz\Fakture' -RunAsAccount 'RACUNAR\konektor' -PackagePath 'C:\Program Files\CarsystemConnector'
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)] [string]$InvoiceFolder,
  [Parameter(Mandatory)] [string]$RunAsAccount,
  [string]$PackagePath,
  <#
    Jedini Windows nalog je i nalog pod kojim se fakture izvoze (docs/b2b/49).
    Taj nalog MORA imati upis u folder. U ovom rezimu nalazi o upisu nisu
    FAIL nego upozorenje — uz izricitu napomenu da Windows tada NE sprecava
    konektor da pise; konektor samo cita po svom kodu.
  #>
  [switch]$JedanNalogSaUAC
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'PathGuards.ps1')

$exitCode = 0
function Write-Result {
  param([ValidateSet('PASS', 'FAIL', 'WARN')] [string]$Status, [string]$Message)
  Write-Host "[$Status] $Message"
  if ($Status -eq 'FAIL') { $script:exitCode = 1 }
}

if ([string]::IsNullOrWhiteSpace($InvoiceFolder)) {
  Write-Result 'FAIL' 'InvoiceFolder je prazan.'
  exit 1
}
if ($InvoiceFolder.StartsWith('\\')) {
  Write-Result 'WARN' "Folder je mrežna (UNC) putanja: $InvoiceFolder — proverite da li je to stvarno namerno pre nastavka."
}
if (-not (Test-Path -LiteralPath $InvoiceFolder)) {
  Write-Result 'FAIL' "Folder ne postoji: $InvoiceFolder"
  exit 1
}

$full = [System.IO.Path]::GetFullPath($InvoiceFolder).TrimEnd('\')
$item = Get-Item -LiteralPath $full -Force
if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
  $target = $null
  try { $target = $item.Target } catch { }
  Write-Result 'FAIL' "Folder je symlink/junction/reparse-point (cilj: $target) — ne prihvata se bez ručne provere krajnje putanje."
}
else {
  Write-Result 'PASS' "Folder nije link — putanja je stvarna: $full"
}

# --- Folder sa fakturama ne sme biti isti kao package/state folder. --------

if ($PackagePath) {
  try {
    $pkgFull = [System.IO.Path]::GetFullPath($PackagePath).TrimEnd('\')
    if ($full -eq $pkgFull -or $full.StartsWith("$pkgFull\", [System.StringComparison]::OrdinalIgnoreCase) -or
        $pkgFull.StartsWith("$full\", [System.StringComparison]::OrdinalIgnoreCase)) {
      Write-Result 'FAIL' "Folder sa fakturama se preklapa sa instalacionim folderom ($pkgFull) — moraju biti odvojeni."
    }
    else {
      Write-Result 'PASS' 'Folder sa fakturama je odvojen od instalacionog foldera.'
    }
  }
  catch {
    Write-Result 'WARN' "Nije moglo da se uporedi sa PackagePath: $($_.Exception.Message)"
  }
}
else {
  Write-Result 'WARN' '-PackagePath nije naveden — provera preklapanja sa instalacionim folderom je preskočena.'
}

$stateDir = [System.IO.Path]::GetFullPath("$env:LOCALAPPDATA\CarsystemConnector").TrimEnd('\')
if ($full -eq $stateDir -or $full.StartsWith("$stateDir\", [System.StringComparison]::OrdinalIgnoreCase)) {
  Write-Result 'FAIL' "Folder sa fakturama je unutar foldera stanja konektora ($stateDir) — moraju biti odvojeni."
}
else {
  Write-Result 'PASS' 'Folder sa fakturama je odvojen od foldera stanja konektora.'
}

# --- Čitanje: eksplicitan ACE za RunAsAccount. -----------------------------

try {
  $runAsSid = Resolve-AccountSid -AccountName $RunAsAccount
}
catch {
  Write-Result 'FAIL' $_.Exception.Message
  exit 1
}

$acl = Get-Acl -LiteralPath $full

$mozeCitati = $false
foreach ($ace in $acl.Access) {
  if ($ace.AccessControlType -ne 'Allow') { continue }
  try {
    $sid = $ace.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier])
  }
  catch {
    continue
  }
  if ($sid -ne $runAsSid) { continue }
  $rights = $ace.FileSystemRights
  if ($rights.HasFlag([System.Security.AccessControl.FileSystemRights]::ReadData) -or
      $rights.HasFlag([System.Security.AccessControl.FileSystemRights]::ReadAndExecute)) {
    $mozeCitati = $true
  }
}

if ($mozeCitati) {
  Write-Result 'PASS' "'$RunAsAccount' ima čitanje na folderu (eksplicitan ACE)."
}
else {
  Write-Result 'WARN' "Nije nađen eksplicitan ACE za čitanje za '$RunAsAccount' — proverite da pristup ne dolazi isključivo iz grupe, ili da čitanje uopšte postoji."
}

<#
.SYNOPSIS
  Procenjuje da li RunAsAccount efektivno ima neko od Write/Modify/Delete/
  Create/ChangePermissions/TakeOwnership/FullControl prava nad folderom —
  READ-ONLY (samo `Get-Acl` i razrešavanje identiteta), nikad probni upis.

.DESCRIPTION
  Tri moguća ishoda:
    - 'clean'        — nijedan opasan ACE ne pokriva RunAsAccount, i svako
                        grupno članstvo koje je moglo da bude relevantno je
                        PROVERENO (ne samo pretpostavljeno) i ne pokriva ga.
    - 'has-write'     — neki opasan ACE POKRIVA RunAsAccount (direktno, kroz
                        Everyone/Authenticated Users, ili kroz proverenu
                        lokalnu grupu).
    - 'not-verified'  — postoji bar jedan opasan ACE za identitet čije
                        članstvo NE MOŽE pouzdano da se proveri ugrađenim
                        alatima (npr. domenska grupa bez AD modula). Ovo NIJE
                        'clean' — nepoznato članstvo se ne tumači kao
                        "nije član".
#>
function Get-EffectiveWriteVerdict {
  param(
    [Parameter(Mandatory)] [System.Security.AccessControl.DirectorySecurity]$Acl,
    [Parameter(Mandatory)] [System.Security.Principal.SecurityIdentifier]$RunAsSid,
    [Parameter(Mandatory)] [string]$RunAsAccountIme
  )

  $opasnaPrava = @('Write', 'Modify', 'Delete', 'CreateFiles', 'CreateDirectories', 'ChangePermissions', 'TakeOwnership', 'FullControl')
  # Ove dve SID vrednosti pokrivaju SVAKI autentifikovani nalog (pa i
  # RunAsAccount) — nema potrebe za proverom "članstva", uvek važe.
  $uvekPokrivaSve = @{
    'S-1-1-0'  = 'Everyone'
    'S-1-5-11' = 'Authenticated Users'
  }

  $direktnoOpasno = New-Object System.Collections.Generic.List[string]
  $nerazresivo = New-Object System.Collections.Generic.List[string]

  foreach ($ace in $Acl.Access) {
    if ($ace.AccessControlType -ne 'Allow') { continue }
    $rights = $ace.FileSystemRights
    $imaOpasnoPravo = $false
    foreach ($naziv in $opasnaPrava) {
      if ($rights.HasFlag([System.Security.AccessControl.FileSystemRights]::$naziv)) { $imaOpasnoPravo = $true; break }
    }
    if (-not $imaOpasnoPravo) { continue }

    try {
      $sid = $ace.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier])
    }
    catch {
      $nerazresivo.Add("ACE se ne razrešava u SID: $($ace.IdentityReference) ($rights)")
      continue
    }

    if ($sid -eq $RunAsSid) {
      $direktnoOpasno.Add("Eksplicitan ACE za '$RunAsAccountIme' nosi $rights")
      continue
    }

    if ($uvekPokrivaSve.ContainsKey($sid.Value)) {
      $direktnoOpasno.Add("Grupa '$($uvekPokrivaSve[$sid.Value])' nosi $rights — pokriva svaki autentifikovani nalog, pa i '$RunAsAccountIme'")
      continue
    }

    if ($sid.Value.StartsWith('S-1-5-32-')) {
      # Ugrađena lokalna grupa (npr. BUILTIN\Users) — članstvo SE MOŽE
      # proveriti preko Get-LocalGroupMember, isti mehanizam kao
      # Test-IsAdministratorAccount.
      try {
        $clanovi = Get-LocalGroupMember -SID $sid -ErrorAction Stop
        $jeClan = $false
        foreach ($m in $clanovi) {
          $mSid = if ($m.SID) { $m.SID } else { try { Resolve-AccountSid -AccountName $m.Name } catch { $null } }
          if ($mSid -and $mSid -eq $RunAsSid) { $jeClan = $true; break }
        }
        if ($jeClan) {
          $direktnoOpasno.Add("Lokalna grupa '$($ace.IdentityReference)' nosi $rights, i '$RunAsAccountIme' JESTE član")
        }
        # Nije član — ACE je bezbedno isključen, ishod je POZNAT (nije pretpostavka).
      }
      catch {
        $nerazresivo.Add("Članstvo u lokalnoj grupi '$($ace.IdentityReference)' ne može da se proveri: $($_.Exception.Message)")
      }
      continue
    }

    # Domenska grupa ili bilo šta van ugrađenih lokalnih grupa — članstvo se
    # NE MOŽE pouzdano proveriti bez AD modula. Nepoznato NIJE "nije član".
    $nerazresivo.Add("Nemoguće pouzdano proveriti članstvo za '$($ace.IdentityReference)' ($($sid.Value)) — potrebna je ručna provera")
  }

  if ($direktnoOpasno.Count -gt 0) {
    return [pscustomobject]@{ Verdict = 'has-write'; Detalji = $direktnoOpasno }
  }
  if ($nerazresivo.Count -gt 0) {
    return [pscustomobject]@{ Verdict = 'not-verified'; Detalji = $nerazresivo }
  }
  return [pscustomobject]@{ Verdict = 'clean'; Detalji = @() }
}

$verdikt = Get-EffectiveWriteVerdict -Acl $acl -RunAsSid $runAsSid -RunAsAccountIme $RunAsAccount
$jedanNalog = $null
if ($JedanNalogSaUAC -and $verdikt.Verdict -ne 'clean') {
  $jedanNalog = Test-JedanNalogSaUAC -AccountName $RunAsAccount
  if (-not $jedanNalog.Dozvoljeno) {
    Write-Result 'FAIL' "-JedanNalogSaUAC nije ispunjen: $($jedanNalog.Razlog). Provera upisa ostaje stroga."
    $jedanNalog = $null
  }
}
if ($jedanNalog) {
  foreach ($d in $verdikt.Detalji) { Write-Result 'WARN' "(rezim jednog naloga) $d" }
  Write-Result 'WARN' ("REZIM JEDNOG NALOGA: '$RunAsAccount' je i nalog pod kojim se fakture izvoze, pa ima pravo upisa u ovaj folder. " +
    'Windows u ovom rezimu NE sprecava konektor da pise. Konektor po svom kodu samo cita PDF-ove (ne menja, ne brise, ne premesta); ' +
    'ACL foldera se ne menja i upis za svakodnevni rad ostaje.')
}
else {
  switch ($verdikt.Verdict) {
    'has-write' {
      foreach ($d in $verdikt.Detalji) { Write-Result 'FAIL' $d }
    }
    'not-verified' {
      foreach ($d in $verdikt.Detalji) { Write-Result 'WARN' $d }
      Write-Result 'FAIL' 'NOT VERIFIED / FAIL-CLOSED — efektivno odsustvo write prava se ne može pouzdano dokazati samo ACL inspekcijom (nerazrešivo grupno članstvo). Rezultat je FAIL, ne pokušaj upisa u pravi folder.'
    }
    'clean' {
      Write-Result 'PASS' "'$RunAsAccount' nema Write/Modify/Delete/Create/ChangePermissions/TakeOwnership/FullControl (provereno uključujući poznata lokalna grupna članstva)."
    }
  }
}

Write-Host ''
Write-Host 'Provera je isključivo pročitala ACL; nijedan upis nije pokušan, nijedan sadržaj fakture nije dotaknut ni prikazan.'
exit $exitCode
