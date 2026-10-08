<#
  Rucno pokretanje kopija (isti koraci koje ce kasnije raditi zakazani zadatak).

    -Akcija Provera   : sta je podeseno, bez mreze i bez upisa
    -Akcija Preuzmi   : poslednja sifrovana kopija baze sa GitHub-a -> provera otiska -> druga kopija -> upis u portal
    -Akcija Pdf       : dnevna inkrementalna sifrovana kopija PDF-ova -> druga kopija -> upis u portal

  Tajne se desifruju (DPAPI) samo u okruzenje podprocesa; ne ispisuju se.
#>
[CmdletBinding()]
param([Parameter(Mandatory)][ValidateSet('Provera', 'Preuzmi', 'Pdf')] [string] $Akcija)
$ErrorActionPreference = 'Stop'
$root = Join-Path $env:LOCALAPPDATA 'CarsystemKopije'
$app = Join-Path (Split-Path -Parent $PSScriptRoot) 'app'
$node = Join-Path $env:ProgramFiles 'nodejs\node.exe'
$cfgPath = Join-Path $root 'podesavanja.json'
if (-not (Test-Path -LiteralPath $cfgPath)) { Write-Host '[STOP] Prvo pokrenite podesi-kopije.ps1.'; exit 1 }
$cfg = Get-Content -LiteralPath $cfgPath -Raw | ConvertFrom-Json
$age = Join-Path $root 'bin\age.exe'
$log = Join-Path $root ("log\" + (Get-Date -Format 'yyyy-MM-dd') + '.log')

function Otkljucaj([string] $sifrovano) {
  $ss = ConvertTo-SecureString -String $sifrovano
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($ss)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

if ($Akcija -eq 'Provera') {
  Write-Host "Node:          $(& $node --version)"
  Write-Host "age.exe:       $(Test-Path -LiteralPath $age)"
  Write-Host "Javni kljuc:   $((Get-Content -LiteralPath (Join-Path $root 'age-primaoci.txt') | Select-Object -First 1).Substring(0, 12))..."
  Write-Host "PDF izvor:     $($cfg.pdfIzvor) ($((Get-ChildItem -LiteralPath $cfg.pdfIzvor -Recurse -Filter *.pdf -File | Measure-Object).Count) PDF)"
  Write-Host "Druga kopija:  $($cfg.drugaKopija)"
  Write-Host "Repo:          $($cfg.repo)"
  Write-Host "Tajne:         $(Test-Path -LiteralPath (Join-Path $root 'tajne.dpapi.json'))"
  exit 0
}

$tajne = Get-Content -LiteralPath (Join-Path $root 'tajne.dpapi.json') -Raw | ConvertFrom-Json
$env:AGE_BIN = $age
$env:BACKUP_STATUS_URL = Otkljucaj $tajne.status
try {
  if ($Akcija -eq 'Preuzmi') {
    $env:GH_BACKUP_TOKEN = Otkljucaj $tajne.token
    $env:BACKUP_REPO = $cfg.repo
    & $node (Join-Path $app 'scripts\backup\offsite-pull.mjs') --dest (Join-Path $cfg.drugaKopija 'baza') --label $cfg.oznaka *>> $log
  } else {
    & $node (Join-Path $app 'scripts\backup\pdf-backup.mjs') run --source $cfg.pdfIzvor --dest (Join-Path $cfg.drugaKopija 'pdf') `
      --state (Join-Path $root 'pdf-stanje.json') --recipients (Join-Path $root 'age-primaoci.txt') --label $cfg.oznaka *>> $log
  }
  $kod = $LASTEXITCODE
} finally {
  Remove-Item Env:\BACKUP_STATUS_URL, Env:\GH_BACKUP_TOKEN, Env:\BACKUP_REPO -ErrorAction SilentlyContinue
}
Get-Content -LiteralPath $log -Tail 5
exit $kod
