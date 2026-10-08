<#
  Podesavanje kopija na kancelarijskom racunaru (bez zakazanih zadataka).

  Sta radi:
    1. proverava node.exe (Program Files) i age.exe (SHA-256 zvanicnog izdanja v1.3.2);
    2. pita za fasciklu sa PDF-ovima (samo citanje) i fasciklu druge kopije (oblak);
    3. cuva JAVNI age kljuc (age1...), nikad privatni;
    4. tajne (token za preuzimanje, adresa za upis statusa) cuva DPAPI-jem,
       vezano za OVAJ nalog na OVOM racunaru.
  Ne registruje zakazane zadatke i ne pokrece kopiju.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)] [string] $AgeZip,
  [Parameter(Mandatory)] [string] $JavniKljucFajl
)
$ErrorActionPreference = 'Stop'
$AGE_ZIP_SHA256 = 'f48d8f8f9ebe903ab5027ed067652f2cc1db94bc206976430133b905dcd8e8c7'
$root = Join-Path $env:LOCALAPPDATA 'CarsystemKopije'
$paket = Split-Path -Parent $PSScriptRoot

function Ok($m) { Write-Host "[OK] $m" -ForegroundColor Green }
function Stani($m) { Write-Host "[STOP] $m" -ForegroundColor Red; exit 1 }

$node = Join-Path $env:ProgramFiles 'nodejs\node.exe'
if (-not (Test-Path -LiteralPath $node)) { Stani "Nema $node (isti Node kao za konektor)." }
Ok "Node: $(& $node --version)"

$hash = (Get-FileHash -LiteralPath $AgeZip -Algorithm SHA256).Hash.ToLowerInvariant()
if ($hash -ne $AGE_ZIP_SHA256) { Stani "age zip nema ocekivani SHA-256 (dobijeno $hash)." }
New-Item -ItemType Directory -Force -Path (Join-Path $root 'bin'), (Join-Path $root 'log') | Out-Null
$tmp = Join-Path $root 'age-raspakovano'
if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Recurse -Force }
Expand-Archive -LiteralPath $AgeZip -DestinationPath $tmp
Copy-Item -LiteralPath (Join-Path $tmp 'age\age.exe') -Destination (Join-Path $root 'bin\age.exe') -Force
Remove-Item -LiteralPath $tmp -Recurse -Force
Ok "age.exe proveren (SHA-256 zvanicnog izdanja) i postavljen."

$kljuc = (Get-Content -LiteralPath $JavniKljucFajl | Where-Object { $_ -match '^age1[0-9a-z]{50,}$' })
if (-not $kljuc) { Stani 'U fajlu nema javnog age kljuca (red koji pocinje sa age1).' }
if ((Get-Content -LiteralPath $JavniKljucFajl -Raw) -match 'AGE-SECRET-KEY') { Stani 'Fajl sadrzi PRIVATNI kljuc. Ovde ide samo javni.' }
Set-Content -LiteralPath (Join-Path $root 'age-primaoci.txt') -Value $kljuc -Encoding ascii
Ok 'Javni kljuc sacuvan.'

$pdf = Read-Host 'Fascikla sa izvornim PDF-ovima (samo citanje)'
$dest = Read-Host 'Fascikla druge kopije (sinhronizuje je oblak firme)'
foreach ($p in @($pdf, $dest)) { if (-not (Test-Path -LiteralPath $p -PathType Container)) { Stani "Fascikla ne postoji: $p" } }
$pdfPun = (Resolve-Path -LiteralPath $pdf).Path.TrimEnd('\')
$destPun = (Resolve-Path -LiteralPath $dest).Path.TrimEnd('\')
if ($destPun.StartsWith($pdfPun + '\', [StringComparison]::OrdinalIgnoreCase) -or $destPun -ieq $pdfPun) { Stani 'Fascikla kopije ne sme biti unutar fascikle sa PDF-ovima.' }
$repo = Read-Host 'Privatni repo kopija (vlasnik/ime)'
if ($repo -notmatch '^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$') { Stani 'Neispravno ime repoa.' }

@{ pdfIzvor = $pdfPun; drugaKopija = $destPun; repo = $repo; oznaka = 'kancelarija' } |
  ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root 'podesavanja.json') -Encoding utf8
Ok 'Podesavanja sacuvana.'

$tok = Read-Host 'Fine-grained token (samo repo kopija, Actions: Read)' -AsSecureString
$status = Read-Host 'Adresa za upis statusa (uloga carsystem_backup_status)' -AsSecureString
@{
  token  = (ConvertFrom-SecureString -SecureString $tok)
  status = (ConvertFrom-SecureString -SecureString $status)
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root 'tajne.dpapi.json') -Encoding utf8
Ok 'Tajne sacuvane (DPAPI, samo ovaj nalog na ovom racunaru).'
Write-Host ''
Write-Host 'Zakazani zadaci NISU registrovani. Sledece: .\windows\kopije.ps1 -Akcija Provera'
