<#
  Kopije na kancelarijskom racunaru (isti koraci koje radi zakazani zadatak).

    -Akcija Provera   : sta je podeseno, bez mreze i bez upisa
    -Akcija ProveraGitHub : token i repo na GitHub-u (bez preuzimanja i bez upisa)
    -Akcija Preuzmi   : poslednja sifrovana kopija baze sa GitHub-a -> provera otiska -> druga kopija -> potpisana potvrda
    -Akcija Pdf       : dnevna inkrementalna sifrovana kopija PDF-ova -> druga kopija -> potpisana potvrda
    -Akcija Sve       : Preuzmi, pa Pdf ako je PDF kopija podesena

  Kopije se cuvaju LOKALNO (fascikla iz podesavanja), uz ograniceno cuvanje.
  Google Drive se otprema rucno; portal ga ne prati i ne potvrdjuje.

  Ovaj racunar NEMA lozinku baze. Potvrdu u portal salje konektor
  (`prijavi-kopiju`), potpisom kljuca ovog uredjaja; portal prihvata kopiju van
  GitHub-a samo ako se otisak poklapa sa proverenim GitHub prolazom.
  Token za preuzimanje se desifruje (DPAPI) samo u okruzenje podprocesa; ne ispisuje se.
#>
[CmdletBinding()]
param([Parameter(Mandatory)][ValidateSet('Provera', 'ProveraGitHub', 'Preuzmi', 'Pdf', 'Sve')] [string] $Akcija)
$ErrorActionPreference = 'Stop'
$root = Join-Path $env:LOCALAPPDATA 'CarsystemKopije'
$app = Join-Path (Split-Path -Parent $PSScriptRoot) 'app'
$node = Join-Path $env:ProgramFiles 'nodejs\node.exe'
$cfgPath = Join-Path $root 'podesavanja.json'
if (-not (Test-Path -LiteralPath $cfgPath)) { Write-Host '[STOP] Prvo pokrenite podesi-kopije.ps1.'; exit 1 }
$cfg = Get-Content -LiteralPath $cfgPath -Raw | ConvertFrom-Json
$age = Join-Path $root 'bin\age.exe'
# Ograniceno cuvanje; stara podesavanja bez ovog polja dobijaju 7/4/3.
$cuvanje = if ($cfg.cuvanje) { $cfg.cuvanje } else { [pscustomobject]@{ dnevnih = 7; nedeljnih = 4; mesecnih = 3 } }
New-Item -ItemType Directory -Force -Path (Join-Path $root 'log') | Out-Null
$log = Join-Path $root ("log\" + (Get-Date -Format 'yyyy-MM-dd') + '.log')

function Otkljucaj([string] $sifrovano) {
  $ss = ConvertTo-SecureString -String $sifrovano
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($ss)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

function Zapisi([string] $poruka) { Add-Content -LiteralPath $log -Value ("{0} {1}" -f (Get-Date -Format 's'), $poruka) }

# Node u log. PS 5.1: stderr spoljnog programa uz 'Stop' bi prekinuo skriptu
# (NativeCommandError) i izgubio izlazni kod - zato privremeno 'Continue'.
function Node-U-Log([string[]] $argumenti) {
  $eap = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try { & $node --no-warnings @argumenti *>> $log; return $LASTEXITCODE } finally { $ErrorActionPreference = $eap }
}

# Potpisana potvrda kroz konektor (isti nalog, isti DPAPI kljuc uredjaja).
function Potvrdi([string] $izvestaj) {
  return Node-U-Log @($cfg.konektor, '--packaged', '--config', $cfg.konektorConfig, 'prijavi-kopiju', '--izvestaj', $izvestaj)
}

if ($Akcija -eq 'Provera') {
  Write-Host "Node:          $(& $node --version)"
  Write-Host "age.exe:       $(Test-Path -LiteralPath $age)"
  Write-Host "Javni kljuc:   $((Get-Content -LiteralPath (Join-Path $root 'age-primaoci.txt') | Select-Object -First 1).Substring(0, 12))..."
  if ($cfg.pdfIzvor) { Write-Host "PDF izvor:     $($cfg.pdfIzvor) ($((Get-ChildItem -LiteralPath $cfg.pdfIzvor -Recurse -Filter *.pdf -File | Measure-Object).Count) PDF)" }
  else { Write-Host 'PDF kopija:    nije ukljucena' }
  Write-Host "Lokalne kopije: $($cfg.drugaKopija) (postoji: $(Test-Path -LiteralPath $cfg.drugaKopija))"
  Write-Host "Cuvanje:       $($cuvanje.dnevnih) dnevnih, $($cuvanje.nedeljnih) nedeljnih, $($cuvanje.mesecnih) mesecnih"
  $baza = Join-Path $cfg.drugaKopija 'baza'
  if (Test-Path -LiteralPath $baza) {
    $sve = @(Get-ChildItem -LiteralPath $baza -Directory | Where-Object { $_.Name -match '^\d{8}T\d{6}Z$' } | Sort-Object Name)
    $mb = [math]::Round(((Get-ChildItem -LiteralPath $baza -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB), 1)
    Write-Host "Sacuvano:      $($sve.Count) kopija, $mb MB; najnovija: $(if ($sve) { $sve[-1].Name } else { '-' })"
  }
  Write-Host "Repo:          $($cfg.repo)"
  Write-Host "Konektor:      $(Test-Path -LiteralPath $cfg.konektor) / config $(Test-Path -LiteralPath $cfg.konektorConfig)"
  Write-Host "DPAPI fajl:     $(Test-Path -LiteralPath (Join-Path $root 'tajne.dpapi.json'))"
  exit 0
}

if ($Akcija -eq 'ProveraGitHub') {
  $tajne = Get-Content -LiteralPath (Join-Path $root 'tajne.dpapi.json') -Raw | ConvertFrom-Json
  $env:GH_BACKUP_TOKEN = Otkljucaj $tajne.token
  $env:BACKUP_REPO = $cfg.repo
  try { $k = Node-U-Log @((Join-Path $app 'scripts\backup\offsite-pull.mjs'), '--samo-provera') }
  finally { Remove-Item Env:\GH_BACKUP_TOKEN, Env:\BACKUP_REPO -ErrorAction SilentlyContinue }
  Get-Content -LiteralPath $log -Tail 1
  exit $k
}

$kod = 0
$env:AGE_BIN = $age
try {
  if ($Akcija -in @('Preuzmi', 'Sve')) {
    $tajne = Get-Content -LiteralPath (Join-Path $root 'tajne.dpapi.json') -Raw | ConvertFrom-Json
    $env:GH_BACKUP_TOKEN = Otkljucaj $tajne.token
    $env:BACKUP_REPO = $cfg.repo
    $izv = Join-Path $root 'izvestaj-baza.json'
    Remove-Item -LiteralPath $izv -ErrorAction SilentlyContinue
    $k = Node-U-Log @((Join-Path $app 'scripts\backup\offsite-pull.mjs'), '--dest', (Join-Path $cfg.drugaKopija 'baza'), '--izvestaj', $izv,
      '--dnevnih', "$($cuvanje.dnevnih)", '--nedeljnih', "$($cuvanje.nedeljnih)", '--mesecnih', "$($cuvanje.mesecnih)")
    Remove-Item Env:\GH_BACKUP_TOKEN, Env:\BACKUP_REPO -ErrorAction SilentlyContinue
    if ($k -eq 0) { $k = Potvrdi $izv }
    Remove-Item -LiteralPath $izv -ErrorAction SilentlyContinue
    Zapisi "kopija baze: izlaz $k"
    if ($k -ne 0) { $kod = $k }
  }
  if ($Akcija -eq 'Pdf' -and -not $cfg.pdfIzvor) { Write-Host '[STOP] PDF kopija nije podesena (podesi-kopije.ps1 -SaPdf).'; exit 1 }
  if ($Akcija -eq 'Pdf' -or ($Akcija -eq 'Sve' -and $cfg.pdfIzvor)) {
    $izv = Join-Path $root 'izvestaj-pdf.json'
    Remove-Item -LiteralPath $izv -ErrorAction SilentlyContinue
    $k = Node-U-Log @((Join-Path $app 'scripts\backup\pdf-backup.mjs'), 'run', '--source', $cfg.pdfIzvor, '--dest', (Join-Path $cfg.drugaKopija 'pdf'),
      '--state', (Join-Path $root 'pdf-stanje.json'), '--recipients', (Join-Path $root 'age-primaoci.txt'), '--izvestaj', $izv)
    if ($k -eq 0) { $k = Potvrdi $izv }
    Remove-Item -LiteralPath $izv -ErrorAction SilentlyContinue
    Zapisi "PDF kopija: izlaz $k"
    if ($k -ne 0 -and $kod -eq 0) { $kod = $k }
  }
} finally {
  Remove-Item Env:\GH_BACKUP_TOKEN, Env:\BACKUP_REPO, Env:\AGE_BIN -ErrorAction SilentlyContinue
}
Get-Content -LiteralPath $log -Tail 6
exit $kod
