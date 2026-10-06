# Carsystem konektor — instalacija i provera (kancelarija)

Paket: `carsystem-connector-<verzija>.zip`. Pre pokretanja proveriti SHA-256
(dobija se odvojeno): `Get-FileHash .\carsystem-connector-<verzija>.zip -Algorithm SHA256`.

Konektor **samo čita** PDF fakture iz foldera i šalje ih portalu. Ne menja,
ne briše i ne premešta fajlove. Izvoz iz BizniSofta ostaje kao do sada.

## 0. Pre početka (jednom)

- Node 24 LTS x64 sa nodejs.org, podrazumevana putanja (`C:\Program Files\nodejs`).
- Nalog koji svakodnevno radi na računaru mora biti **standardni** (ne
  administrator): zakazani zadatak namerno ne radi pod administratorom.
  Provera: `net localgroup Administrators`. Ako je jedini nalog administrator,
  javiti — to je odluka (drugi nalog ili drugačiji režim zadatka).
- Zadatak radi radnim danima posle 09:00, **dok je taj nalog prijavljen**.
  Računar ugašen u 09:00 → jedan propušteni ciklus pri sledećem paljenju.
  Bez interneta → dokumenti čekaju u lokalnom redu, ništa se ne gubi.
- HTTPS adresa portala (pilot) i, ako je zaštićena, tajna zaštite pristupa.

## 1. Instalacija ili ažuriranje — kao Administrator

Raspakovati ZIP (npr. `Downloads\carsystem-connector-<verzija>`), pa u
PowerShell-u „Run as administrator":

```powershell
cd "$env:USERPROFILE\Downloads\carsystem-connector-<verzija>"
.\windows\instaliraj.ps1 -RunAsAccount 'RACUNAR\nalog' `
  -IzvorniFolder 'C:\Users\nalog\Desktop\Fakture\Fakture 2026' `
  -ServerOrigin 'https://<adresa pilota>' -PosaljiOdDatuma '2026-10-06' `
  -VercelZastita '<tajna, ako je adresa zaštićena>'
```

- `-PosaljiOdDatuma`: fakture izdate **pre** tog datuma se samo zabeleže i
  **nikad ne šalju** (istorija je već u portalu). Bez tog parametra važi današnji.
- Ažuriranje: isto, bez `-IzvorniFolder`/`-ServerOrigin` — `config.json`,
  ključ i red se čuvaju; prethodna verzija ostaje kao
  `C:\Program Files\CarsystemConnector.prethodna-…`.

## 2. Podešavanje naloga, prvi prolaz i zadatak — kao svakodnevni nalog

Običan PowerShell (bez administratora), prijavljen kao nalog iz koraka 0:

```powershell
& 'C:\Program Files\CarsystemConnector\windows\podesi.ps1'
```

Prvi put staje sa porukom „Uređaj još nije aktiviran" i ispisuje **otisak**.
Vlasnik u portalu: **Uvoz → Sinhronizacija → registruj uređaj** (oznaka
`KANC-01`, opseg `biznisoft / CSRM`) → **aktiviraj** uz potvrdu da se otisak
poklapa. Zatim ponovo `podesi.ps1`: test veze, prvi prolaz (nove fakture se
šalju, starije samo zabeleže), registracija zadatka i provera.

## 3. Svakodnevna provera

```powershell
& 'C:\Program Files\CarsystemConnector\windows\provera.ps1'
```

Prikazuje poslednji ciklus, sledeći termin, šta čeka slanje ili pregled,
rezultat zakazanog zadatka i **upozorenja**:

- **Storna za ručni upload** — storno se ne šalje automatski. Spisak fajlova:
  komanda iz upozorenja (`… storna`). Otpremiti ih u portalu: **Uvoz**
  (`/portal/importi`), izdavalac `CSRM`. Portal sam povezuje potpuno storno
  sa originalom ili ga stavlja na pregled.
- **Folder nove godine** (npr. „Fakture 2027") — konektor ga ne uključuje sam.
  U januaru: korak 1 sa `-IzvorniFolder '...\Fakture 2027'`.

Ručno pokretanje odmah (bez čekanja 09:00):
`Start-ScheduledTask -TaskName CarsystemConnector`, pa `provera.ps1`.

## 4. Povratak na prethodnu verziju — kao Administrator

```powershell
& 'C:\Program Files\CarsystemConnector\windows\vrati-prethodnu.ps1' -RunAsAccount 'RACUNAR\nalog'
```

Ključ, red i podešavanja se ne diraju. Potpuno uklanjanje zadatka:
`task.ps1 -Action uninstall -Mode Production -Apply` (fajlovi faktura se nikad ne diraju).
