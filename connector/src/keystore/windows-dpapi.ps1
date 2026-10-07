<#
  Carsystem konektor - DPAPI (CurrentUser) za kljuc uredjaja.

  Pokrece ga windows-dpapi.mjs kao:
    powershell.exe -NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -File <ovaj fajl> -Rezim zastiti|otkljucaj

  Citljiv fajl u zasticenom instalacionom folderu (bez -EncodedCommand).
  Konektor pre svakog pokretanja proverava SHA-256 ovog fajla.

  Podatak (materijal kljuca) stize ISKLJUCIVO kroz stdin, kao TACNO JEDAN red
  base64 - nikad kroz argumente, promenljive okruzenja ili privremeni fajl.
  Izlaz je jedan red base64 na stdout; greska je samo izlazni kod.
#>
param(
  [Parameter(Mandatory)] [ValidateSet('zastiti', 'otkljucaj')] [string]$Rezim
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try {
  Add-Type -AssemblyName System.Security
  $ulaz = [Console]::In.ReadLine()
  if (-not $ulaz -or $ulaz -notmatch '^[A-Za-z0-9+/]+={0,2}$') { exit 3 }
  $bajtovi = [Convert]::FromBase64String($ulaz)
  if ($Rezim -eq 'zastiti') {
    $izlaz = [System.Security.Cryptography.ProtectedData]::Protect($bajtovi, $null, 'CurrentUser')
  } else {
    $izlaz = [System.Security.Cryptography.ProtectedData]::Unprotect($bajtovi, $null, 'CurrentUser')
  }
  [Console]::Out.WriteLine([Convert]::ToBase64String($izlaz))
  exit 0
} catch {
  # Bez poruke: tekst greske ume da nosi putanje; konektor cita samo kod.
  exit 2
}
