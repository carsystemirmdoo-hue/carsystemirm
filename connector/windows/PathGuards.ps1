<#
.SYNOPSIS
  Deljene provere putanje i identiteta za Windows hardening skripte.

.DESCRIPTION
  Dot-sourced iz `harden-install-dir.ps1` i `task.ps1` — JEDNO mesto koje zna
  koje putanje i naloge treba odbiti. Da svaka skripta piše sopstvenu listu,
  jedna bi pre ili kasnije zaboravila slučaj koji druga pokriva — tačno onako
  kako je `harden-state-dir.ps1` štitio SAMO folder stanja, a niko nije
  proverio instalacioni folder (WIN-INSTALL-01).

  Sve funkcije ovde su ČITANJE i ODLUKA, nikad upis. `-Apply` grane u
  pozivajućim skriptama zovu ove funkcije, ne obrnuto — ovaj fajl sam po sebi
  ne menja ništa na sistemu.

  Identitet se razrešava ISKLJUČIVO preko .NET/Windows API-ja
  (`NTAccount.Translate`, `Get-LocalGroupMember`) — nikad interpolacijom u
  `-Command` string ili spoljni shell poziv. To je isti razlog zbog kog
  `windows-dpapi.mjs` šalje materijal kroz `stdin`, ne kroz argumente: naziv
  naloga koji dolazi od operatera (potencijalno sa razmacima, navodnicima ili
  Unicode znakovima) ne sme nikad postati deo komande koja se parsira.
#>

Set-StrictMode -Version Latest

<#
.SYNOPSIS
  Vraća razlog odbijanja instalacionog (package) foldera, ili $null ako je
  prihvatljiv.

.DESCRIPTION
  Namerno vraća STRING razlog, ne boolean — poziv koji odbija mora reći ZAŠTO,
  jer će operater to čitati sa ekrana kancelarijskog računara, ne iz izvornog
  koda.

  Provera je ALLOW-LIST po duhu: umesto da pokuša da nabroji svaku opasnu
  putanju, odbija sve poznate korisnički-upisive lokacije i zahteva da
  preostala putanja stvarno sadrži connector paket (marker fajl). Prazna,
  slučajno pogođena putanja se time ne prihvata kao "dovoljno bezbedna" samo
  zato što nije na crnoj listi.
#>
function Test-ForbiddenPackagePath {
  param(
    [Parameter(Mandatory)] [string]$Path
  )

  if ([string]::IsNullOrWhiteSpace($Path)) {
    return "putanja je prazna"
  }

  if ($Path.StartsWith('\\')) {
    return "mrežna (UNC) putanja nije dozvoljena: $Path"
  }

  if (-not [System.IO.Path]::IsPathRooted($Path)) {
    return "putanja nije apsolutna: $Path"
  }

  # `GetFullPath` normalizuje (`..`, duplirane kose crte) BEZ dodira diska —
  # sme se pozvati i nad putanjom koja još ne postoji.
  $full = [System.IO.Path]::GetFullPath($Path).TrimEnd('\')

  if ($full.StartsWith('\\')) {
    return "mrežna (UNC) putanja nije dozvoljena posle normalizacije: $full"
  }

  $driveRoot = [System.IO.Path]::GetPathRoot($full)
  if ($driveRoot) { $driveRoot = $driveRoot.TrimEnd('\') }
  if ($full -eq $driveRoot) {
    return "koren diska nije dozvoljen kao instalacioni folder: $full"
  }

  # Celi zaštićeni koreni — folder SME biti PODFOLDER ovih (to je i preporučen
  # slučaj, npr. "C:\Program Files\CarsystemConnector"), ali ne SAM koren.
  $forbiddenExactRoots = @(
    $env:ProgramFiles,
    ${env:ProgramFiles(x86)},
    $env:windir,
    $env:SystemRoot,
    $env:USERPROFILE
  ) | Where-Object { $_ } | ForEach-Object { $_.TrimEnd('\') }

  foreach ($root in $forbiddenExactRoots) {
    if ($full -eq $root) {
      return "ceo zaštićeni koren nije dozvoljen kao instalacioni folder (mora biti PODFOLDER): $full"
    }
  }

  # Korisnički upisive lokacije — ni koren ni bilo koji podfolder unutar njih.
  $forbiddenUserRoots = @(
    (Join-Path $env:USERPROFILE 'Desktop'),
    (Join-Path $env:USERPROFILE 'Downloads'),
    (Join-Path $env:USERPROFILE 'Documents'),
    (Join-Path $env:USERPROFILE 'OneDrive'),
    $env:LOCALAPPDATA,
    $env:APPDATA,
    $env:TEMP,
    $env:TMP
  ) | Where-Object { $_ } | ForEach-Object { $_.TrimEnd('\') }

  foreach ($userRoot in $forbiddenUserRoots) {
    if ($full -eq $userRoot -or $full.StartsWith("$userRoot\", [System.StringComparison]::OrdinalIgnoreCase)) {
      return "korisnički upisiva lokacija nije dozvoljena za instalaciju: $full"
    }
  }

  # OneDrive može biti mapiran i van USERPROFILE (npr. "OneDrive - Firma").
  if ($env:OneDrive -and (
      $full -eq $env:OneDrive.TrimEnd('\') -or
      $full.StartsWith("$($env:OneDrive.TrimEnd('\'))\", [System.StringComparison]::OrdinalIgnoreCase))) {
    return "OneDrive putanja nije dozvoljena za instalaciju: $full"
  }

  if (-not (Test-Path -LiteralPath $full)) {
    return "putanja ne postoji: $full"
  }

  $item = Get-Item -LiteralPath $full -Force
  if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
    return "instalacioni koren je symlink/junction/reparse-point — ne prati se: $full"
  }

  $marker = Join-Path $full 'connector.cmd'
  if (-not (Test-Path -LiteralPath $marker)) {
    return "folder ne sadrži očekivani connector paket (nedostaje connector.cmd): $full"
  }
  $markerItem = Get-Item -LiteralPath $marker -Force
  if ($markerItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
    return "connector.cmd je symlink/reparse-point — ne prati se: $marker"
  }

  return $null
}

<#
.SYNOPSIS
  Razrešava naziv naloga u SID preko .NET API-ja — bez shell interpolacije.
#>
function Resolve-AccountSid {
  param(
    [Parameter(Mandatory)] [string]$AccountName
  )
  try {
    $account = New-Object System.Security.Principal.NTAccount($AccountName)
    return $account.Translate([System.Security.Principal.SecurityIdentifier])
  }
  catch {
    throw "Nalog '$AccountName' se ne može razrešiti u SID: $($_.Exception.Message)"
  }
}

<# .SYNOPSIS Da li je SID lokalni SYSTEM (S-1-5-18). #>
function Test-IsSystemSid {
  param([Parameter(Mandatory)] [System.Security.Principal.SecurityIdentifier]$Sid)
  return $Sid.Value -eq 'S-1-5-18'
}

<#
.SYNOPSIS
  Da li je nalog član lokalne Administrators grupe (S-1-5-32-544) ili je SYSTEM.

.DESCRIPTION
  Grupa se traži preko SID-a, ne preko imena "Administrators" — na
  lokalizovanom (npr. srpskom) Windows-u je ime grupe drugačije, a SID je
  konstantan na svakoj instalaciji.

  Ako članstvo ne može da se proveri (npr. modul nedostupan), BACA grešku
  umesto da tiho pretpostavi "nije administrator" — pogrešna pretpostavka baš
  ovde bi dozvolila upravo ono što ugovor zabranjuje.
#>
function Test-IsAdministratorAccount {
  param([Parameter(Mandatory)] [string]$AccountName)

  $sid = Resolve-AccountSid -AccountName $AccountName
  if (Test-IsSystemSid -Sid $sid) { return $true }

  $adminGroupSid = New-Object System.Security.Principal.SecurityIdentifier('S-1-5-32-544')
  try {
    $members = Get-LocalGroupMember -SID $adminGroupSid -ErrorAction Stop
  }
  catch {
    throw "Članstvo u Administrators grupi ne može da se proveri: $($_.Exception.Message)"
  }

  foreach ($member in $members) {
    try {
      $memberSid = if ($member.SID) { $member.SID } else { (Resolve-AccountSid -AccountName $member.Name) }
    }
    catch {
      continue
    }
    if ($memberSid -eq $sid) { return $true }
  }
  return $false
}

<# .SYNOPSIS Da li trenutni proces ima administratorska prava. #>
function Test-CurrentProcessIsElevated {
  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object System.Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}

<#
.SYNOPSIS
  Vraća SDDL prethodnog ACL-a nad putanjom, kao string.
#>
function Get-AclSddl {
  param([Parameter(Mandatory)] [string]$Path)
  return (Get-Acl -LiteralPath $Path).Sddl
}

<#
.SYNOPSIS
  Da li ACL instalacionog foldera već izgleda učvršćen.

.DESCRIPTION
  BRZA gate provera za `task.ps1` — ne zamena za punu post-verifikaciju iz
  `harden-install-dir.ps1`. Ne poznaje koji je RunAsAccount, pa ne može da
  potvrdi da baš TAJ nalog ima tačno Read & Execute; potvrđuje samo da
  nasleđivanje NIJE isključeno, ili da neki identitet MIMO
  Administrators/SYSTEM ima Write/Modify/FullControl — obe su znak da
  `harden-install-dir.ps1 -Apply` još nije pokrenut.

  Vraća razlog (string) ako izgleda neučvršćeno, ili $null ako izgleda u redu.
#>
function Test-PackageDirectoryHardened {
  param([Parameter(Mandatory)] [string]$Path)

  $acl = Get-Acl -LiteralPath $Path
  if (-not $acl.AreAccessRulesProtected) {
    return 'nasleđivanje dozvola nije isključeno'
  }

  $dozvoljeniSidovi = @('S-1-5-32-544', 'S-1-5-18')
  foreach ($ace in $acl.Access) {
    $rights = $ace.FileSystemRights
    $sirokaPrava = $rights.HasFlag([System.Security.AccessControl.FileSystemRights]::Write) -or
                   $rights.HasFlag([System.Security.AccessControl.FileSystemRights]::Modify) -or
                   $rights.HasFlag([System.Security.AccessControl.FileSystemRights]::FullControl)
    if (-not $sirokaPrava) { continue }
    try {
      $sid = $ace.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier])
    }
    catch {
      $sid = $null
    }
    if (-not $sid -or $dozvoljeniSidovi -notcontains $sid.Value) {
      return "identitet '$($ace.IdentityReference)' ima $rights"
    }
  }
  return $null
}

<#
.SYNOPSIS
  Da li je ACL foldera stanja usaglašen sa ugovorom `harden-state-dir.ps1`.

.DESCRIPTION
  Suprotan smer od `Test-PackageDirectoryHardened`: RunAsAccount OVDE SME
  (i MORA) imati pun pristup — folder stanja nosi ključ, red i konfiguraciju
  koje konektor svakodnevno čita i piše. Ono što se proverava je da NIKO
  DRUGI (Users, Authenticated Users, Everyone, bilo koji treći nalog) nema
  pristup, i da nasleđivanje sa roditelja nije aktivno.

  Koristi se kao STROGA (blokirajuća) `Production` provera u `task.ps1` — za
  razliku od `Test-PackageDirectoryHardened`, koji je i tamo savetodavan u
  `Smoke` grani.

  Vraća razlog (string) ako izgleda neučvršćeno, ili $null ako je u redu.
#>
function Test-StateDirHardened {
  param(
    [Parameter(Mandatory)] [string]$Path,
    [Parameter(Mandatory)] [string]$RunAsAccount
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    return "folder stanja ne postoji: $Path"
  }

  $acl = Get-Acl -LiteralPath $Path
  if (-not $acl.AreAccessRulesProtected) {
    return 'nasleđivanje dozvola nije isključeno'
  }

  $runAsSid = Resolve-AccountSid -AccountName $RunAsAccount
  $dozvoljeniSidovi = @($runAsSid.Value, 'S-1-5-32-544', 'S-1-5-18')

  foreach ($ace in $acl.Access) {
    try {
      $sid = $ace.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier])
    }
    catch {
      $sid = $null
    }
    if (-not $sid -or $dozvoljeniSidovi -notcontains $sid.Value) {
      return "neočekivan identitet '$($ace.IdentityReference)' u ACL-u foldera stanja (dozvoljeno: RunAsAccount, Administrators, SYSTEM)"
    }
  }
  return $null
}

<#
.SYNOPSIS
  Razrešava i proverava apsolutnu putanju Node izvršnog fajla iz PATH-a.

.DESCRIPTION
  `node` iz PATH-a nije dovoljno za produkcioni task: PATH se može promeniti,
  a bilo koji upisiv folder ispred zvaničnog Node-a u PATH-u bi mogao da
  podmetne drugačiji `node.exe`. Ova funkcija razrešava STVARNU apsolutnu
  putanju i vraća upozorenje (ne baca grešku) ako ta putanja izgleda
  korisnički upisiva — poziv odlučuje da li je to dovoljno da odbije nastavak.

  @returns [pscustomobject]@{ Path; Warning }  `Warning` je $null kad je OK.
#>
function Resolve-VerifiedNodePath {
  $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $cmd) { $cmd = Get-Command node -ErrorAction SilentlyContinue }
  if (-not $cmd) {
    throw 'Node nije pronađen u PATH-u. Instalirajte Node sa https://nodejs.org/ (zvanični Windows installer).'
  }
  $full = [System.IO.Path]::GetFullPath($cmd.Source)

  $upozorenje = $null
  if ($full.StartsWith('\\')) {
    $upozorenje = "Node putanja je mrežna (UNC): $full"
  }
  else {
    $userWritable = @(
      $env:TEMP, $env:TMP, $env:LOCALAPPDATA, $env:APPDATA,
      (Join-Path $env:USERPROFILE 'Desktop'),
      (Join-Path $env:USERPROFILE 'Downloads')
    ) | Where-Object { $_ } | ForEach-Object { $_.TrimEnd('\') }

    foreach ($f in $userWritable) {
      if ($full.StartsWith("$f\", [System.StringComparison]::OrdinalIgnoreCase)) {
        $upozorenje = "Node je instaliran u korisnički upisivoj lokaciji: $full"
        break
      }
    }
  }

  [pscustomobject]@{ Path = $full; Warning = $upozorenje }
}

<#
.SYNOPSIS
  Osigurava da folder postoji i da je zaključan na Administrators+SYSTEM.

.DESCRIPTION
  Koristi se za rezervnu (rollback) lokaciju: sadržaj nije tajna (SDDL tekst),
  ali izmenjena rezervna kopija bi učinila rollback beskorisnim, pa se štiti
  istim ugovorom kao i ono što čuva.
#>
function Protect-AdminOnlyFolder {
  param([Parameter(Mandatory)] [string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }

  $acl = Get-Acl -LiteralPath $Path
  $acl.SetAccessRuleProtection($true, $false)
  $acl.Access | ForEach-Object { [void]$acl.RemoveAccessRule($_) }
  foreach ($who in @('BUILTIN\Administrators', 'NT AUTHORITY\SYSTEM')) {
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
      $who, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $acl.AddAccessRule($rule)
  }
  Set-Acl -LiteralPath $Path -AclObject $acl
}
