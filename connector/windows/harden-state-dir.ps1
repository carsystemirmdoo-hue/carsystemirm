<#
.SYNOPSIS
  Suzava pristup folderu lokalnog stanja na nalog konektora i administratore.

.DESCRIPTION
  Folder stanja sadrzi privatni kljuc (DPAPI-zasticen) i canonical payload-e sa
  poslovnim podacima. `chmod` iz Node-a na Windowsu NE postavlja ACL, pa se to
  radi ovde.

  PODRAZUMEVANO DRY-RUN; za izmenu treba `-Apply`.
#>
[CmdletBinding()]
param(
  [string]$StateDir = "$env:LOCALAPPDATA\CarsystemConnector",
  [switch]$Apply
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $StateDir)) { throw "Folder stanja ne postoji: $StateDir" }

$plan = @(
  "Iskljucujem nasledjivanje dozvola na $StateDir",
  "Ostavljam pun pristup: $env:USERDOMAIN\$env:USERNAME i BUILTIN\Administrators",
  "Uklanjam sve ostale (ukljucujuci Users/Everyone)"
)
foreach ($p in $plan) { if ($Apply) { Write-Host $p } else { Write-Host "[dry-run] $p" } }

if ($Apply) {
  $acl = Get-Acl $StateDir
  $acl.SetAccessRuleProtection($true, $false)   # bez nasledjivanja, bez kopiranja
  $acl.Access | ForEach-Object { [void]$acl.RemoveAccessRule($_) }

  foreach ($who in @("$env:USERDOMAIN\$env:USERNAME", 'BUILTIN\Administrators')) {
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
      $who, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $acl.AddAccessRule($rule)
  }
  Set-Acl -Path $StateDir -AclObject $acl
  Write-Host "ACL postavljen. Provera: icacls `"$StateDir`""
}
