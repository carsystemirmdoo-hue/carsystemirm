<#
  Kopije na kancelarijskom racunaru (isti koraci koje radi zakazani zadatak).

    -Akcija Provera   : sta je podeseno, bez mreze i bez upisa
    -Akcija Preuzmi   : poslednja sifrovana kopija baze sa GitHub-a -> provera otiska -> druga kopija -> potpisana potvrda
    -Akcija Pdf       : dnevna inkrementalna sifrovana kopija PDF-ova -> druga kopija -> potpisana potvrda
    -Akcija Sve       : Preuzmi, pa Pdf (zakazani zadatak)

  Ovaj racunar NEMA lozinku baze. Potvrdu u portal salje konektor
  (`prijavi-kopiju`), potpisom kljuca ovog uredjaja; portal prihvata kopiju van
  GitHub-a samo ako se otisak poklapa sa proverenim GitHub prolazom.
  Token za preuzimanje se desifruje (DPAPI) samo u okruzenje podprocesa; ne ispisuje se.
#>
[CmdletBinding()]
param([Parameter(Mandatory)][ValidateSet('Provera', 'Preuzmi', 'Pdf', 'Sve')] [string] $Akcija)
$ErrorActionPreference = 'Stop'
$root = Join-Path $env:LOCALAPPDATA 'CarsystemKopije'
$app = Join-Path (Split-Path -Parent $PSScriptRoot) 'app'
$node = Join-Path $env:ProgramFiles 'nodejs\node.exe'
$cfgPath = Join-Path $root 'podesavanja.json'
if (-not (Test-Path -LiteralPath $cfgPath)) { Write-Host '[STOP] Prvo pokrenite podesi-kopije.ps1.'; exit 1 }
$cfg = Get-Content -LiteralPath $cfgPath -Raw | ConvertFrom-Json
$age = Join-Path $root 'bin\age.exe'
New-Item -ItemType Directory -Force -Path (Join-Path $root 'log') | Out-Null
$log = Join-Path $root ("log\" + (Get-Date -Format 'yyyy-MM-dd') + '.log')

function Otkljucaj([string] $sifrovano) {
  $ss = ConvertTo-SecureString -String $sifrovano
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($ss)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

function Zapisi([string] $poruka) { Add-Content -LiteralPath $log -Value ("{0} {1}" -f (Get-Date -Format 's'), $poruka) }

# Potpisana potvrda kroz konektor (isti nalog, isti DPAPI kljuc uredjaja).
function Potvrdi([string] $izvestaj) {
  & $node --no-warnings $cfg.konektor --packaged --config $cfg.konektorConfig prijavi-kopiju --izvestaj $izvestaj *>> $log
  return $LASTEXITCODE
}

if ($Akcija -eq 'Provera') {
  Write-Host "Node:          $(& $node --version)"
  Write-Host "age.exe:       $(Test-Path -LiteralPath $age)"
  Write-Host "Javni kljuc:   $((Get-Content -LiteralPath (Join-Path $root 'age-primaoci.txt') | Select-Object -First 1).Substring(0, 12))..."
  Write-Host "PDF izvor:     $($cfg.pdfIzvor) ($((Get-ChildItem -LiteralPath $cfg.pdfIzvor -Recurse -Filter *.pdf -File | Measure-Object).Count) PDF)"
  Write-Host "Druga kopija:  $($cfg.drugaKopija) (postoji: $(Test-Path -LiteralPath $cfg.drugaKopija))"
  Write-Host "Repo:          $($cfg.repo)"
  Write-Host "Konektor:      $(Test-Path -LiteralPath $cfg.konektor) / config $(Test-Path -LiteralPath $cfg.konektorConfig)"
  Write-Host "DPAPI fajl:     $(Test-Path -LiteralPath (Join-Path $root 'tajne.dpapi.json'))"
  exit 0
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
    & $node (Join-Path $app 'scripts\backup\offsite-pull.mjs') --dest (Join-Path $cfg.drugaKopija 'baza') --izvestaj $izv *>> $log
    $k = $LASTEXITCODE
    Remove-Item Env:\GH_BACKUP_TOKEN, Env:\BACKUP_REPO -ErrorAction SilentlyContinue
    if ($k -eq 0) { $k = Potvrdi $izv }
    Remove-Item -LiteralPath $izv -ErrorAction SilentlyContinue
    Zapisi "kopija baze: izlaz $k"
    if ($k -ne 0) { $kod = $k }
  }
  if ($Akcija -in @('Pdf', 'Sve')) {
    $izv = Join-Path $root 'izvestaj-pdf.json'
    Remove-Item -LiteralPath $izv -ErrorAction SilentlyContinue
    & $node (Join-Path $app 'scripts\backup\pdf-backup.mjs') run --source $cfg.pdfIzvor --dest (Join-Path $cfg.drugaKopija 'pdf') `
      --state (Join-Path $root 'pdf-stanje.json') --recipients (Join-Path $root 'age-primaoci.txt') --izvestaj $izv *>> $log
    $k = $LASTEXITCODE
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
