<#
  Podesavanje kopija na kancelarijskom racunaru (bez zakazanih zadataka).

  Sta radi:
    1. proverava node.exe (Program Files), konektor 0.3.12+ i age.exe (SHA-256 zvanicnog izdanja v1.3.2);
    2. pita za LOKALNU fasciklu kopija (Google Drive se otprema rucno i portal ga ne potvrdjuje);
       PDF kopija samo uz -SaPdf (fascikla PDF-ova samo za citanje; predlog iz konektora);
    3. cuva JAVNI age kljuc (age1...), nikad privatni;
    4. token za preuzimanje cuva DPAPI-jem, vezano za OVAJ nalog na OVOM racunaru;
    5. ograniceno cuvanje: -Dnevnih/-Nedeljnih/-Mesecnih (podrazumevano 7/4/3, najvise ~14 kopija).
  Lozinka baze se NE trazi: potvrdu salje konektor potpisom ovog uredjaja.
  Pokrece se pod ISTIM nalogom pod kojim radi konektor.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)] [string] $AgeZip,
  [Parameter(Mandatory)] [string] $JavniKljucFajl,
  [string] $Konektor = (Join-Path $env:ProgramFiles 'CarsystemConnector\connector\bin\connector.mjs'),
  [string] $KonektorConfig = (Join-Path $env:ProgramFiles 'CarsystemConnector\config.json'),
  [switch] $SaPdf,
  [ValidateRange(1, 60)] [int] $Dnevnih = 7,
  [ValidateRange(1, 60)] [int] $Nedeljnih = 4,
  [ValidateRange(1, 60)] [int] $Mesecnih = 3
)
$ErrorActionPreference = 'Stop'
$AGE_ZIP_SHA256 = 'f48d8f8f9ebe903ab5027ed067652f2cc1db94bc206976430133b905dcd8e8c7'
$root = Join-Path $env:LOCALAPPDATA 'CarsystemKopije'

function Ok($m) { Write-Host "[OK] $m" -ForegroundColor Green }
function Stani($m) { Write-Host "[STOP] $m" -ForegroundColor Red; exit 1 }

$node = Join-Path $env:ProgramFiles 'nodejs\node.exe'
if (-not (Test-Path -LiteralPath $node)) { Stani "Nema $node (isti Node kao za konektor)." }
Ok "Node: $(& $node --version)"

foreach ($p in @($Konektor, $KonektorConfig)) { if (-not (Test-Path -LiteralPath $p)) { Stani "Nema konektora: $p" } }
# Instalacija: <koren>\connector\bin\connector.mjs, a package.json je u <koren>.
$verzija = (Get-Content -LiteralPath (Join-Path (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $Konektor))) 'package.json') -Raw | ConvertFrom-Json).version
if ([version]$verzija -lt [version]'0.3.12') { Stani "Konektor $verzija nema potpisanu potvrdu kopije - potreban je 0.3.12 ili noviji." }
Ok "Konektor $verzija (potpisana potvrda kopije)."

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

$podrazumevano = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Carsystem kopije'
$dest = Read-Host "Lokalna fascikla za kopije [Enter = $podrazumevano]"
if (-not $dest) { $dest = $podrazumevano }
if (-not (Test-Path -LiteralPath $dest -PathType Container)) { New-Item -ItemType Directory -Path $dest | Out-Null; Ok "Napravljena fascikla $dest" }
$destPun = (Resolve-Path -LiteralPath $dest).Path.TrimEnd('\')
$pdfPun = $null
if ($SaPdf) {
  $predlog = (Get-Content -LiteralPath $KonektorConfig -Raw | ConvertFrom-Json).izvorniFolder
  $pdf = Read-Host "Fascikla sa izvornim PDF-ovima (samo citanje) [Enter = $predlog]"
  if (-not $pdf) { $pdf = $predlog }
  if (-not (Test-Path -LiteralPath $pdf -PathType Container)) { Stani "Fascikla ne postoji: $pdf" }
  $pdfPun = (Resolve-Path -LiteralPath $pdf).Path.TrimEnd('\')
  if ($destPun.StartsWith($pdfPun + '\', [StringComparison]::OrdinalIgnoreCase) -or $destPun -ieq $pdfPun) { Stani 'Fascikla kopije ne sme biti unutar fascikle sa PDF-ovima.' }
} else {
  Ok 'PDF kopija nije ukljucena (samo kopija baze).'
}
$repo = Read-Host 'Privatni repo kopija [Enter = carsystemirmdoo-hue/carsystem-backup]'
if (-not $repo) { $repo = 'carsystemirmdoo-hue/carsystem-backup' }
if ($repo -notmatch '^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$') { Stani 'Neispravno ime repoa.' }

@{ pdfIzvor = $pdfPun; drugaKopija = $destPun; repo = $repo; konektor = $Konektor; konektorConfig = $KonektorConfig
   cuvanje = @{ dnevnih = $Dnevnih; nedeljnih = $Nedeljnih; mesecnih = $Mesecnih } } |
  ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root 'podesavanja.json') -Encoding utf8
Ok "Podesavanja sacuvana (cuvanje: $Dnevnih dnevnih, $Nedeljnih nedeljnih, $Mesecnih mesecnih)."

$tok = Read-Host 'Fine-grained token (samo repo kopija, Actions: Read)' -AsSecureString
if ($tok.Length -lt 40) { Stani 'Token je prazan ili prekratak (fine-grained token ima oko 90 znakova). Nista nije sacuvano.' }
@{ token = (ConvertFrom-SecureString -SecureString $tok) } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root 'tajne.dpapi.json') -Encoding utf8
Ok 'Token sacuvan (DPAPI, samo ovaj nalog na ovom racunaru). Lozinka baze nije potrebna.'
Write-Host ''
Write-Host 'Sledece: .\windows\kopije.ps1 -Akcija Provera, pa .\windows\kopije.ps1 -Akcija Preuzmi'
