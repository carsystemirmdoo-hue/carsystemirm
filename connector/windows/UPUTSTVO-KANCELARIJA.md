# Carsystem konektor — instalacija i provera (kancelarija)

Paket: `carsystem-connector-<verzija>.zip`. Pre pokretanja proveriti SHA-256
(dobija se odvojeno): `Get-FileHash .\carsystem-connector-<verzija>.zip -Algorithm SHA256`.

Konektor **samo čita** PDF fakture iz foldera i šalje ih portalu. Ne menja,
ne briše i ne premešta fajlove. Izvoz iz BizniSofta ostaje kao do sada.

## 0. Pre početka (jednom)

- Node 24 LTS x64 sa nodejs.org, podrazumevana putanja (`C:\Program Files\nodejs`).
- Tip naloga: `whoami /groups | findstr S-1-5-32-544`. Ako se red pojavi,
  nalog je **administrator** (u običnom prozoru sa oznakom „Group used for
  deny only" — UAC radi). Kancelarija sa jednim takvim nalogom: sve skripte
  se pokreću sa **`-JedanNalogSaUAC`**, iz „Run as administrator" prozora
  **tog istog naloga**; zadatak i dalje radi sa ograničenim tokenom (bez
  povišenih prava). Nov nalog nije potreban. Isti nalog ima i **pravo upisa**
  u folder faktura (Tamara izvozi): provera foldera to prijavljuje kao
  upozorenje. Konektor po svom kodu samo čita PDF-ove — Windows ga u ovom
  režimu ne sprečava da piše; ACL foldera se ne menja.
- Zadatak radi **radnim danima svakog sata od 08:00 do 19:00** (poslednji
  ciklus oko 19:02), **dok je taj nalog prijavljen** (zaključan ekran ne
  smeta; pregledač nije potreban). Faktura izvezena u 10:20 stiže u portal u
  ciklusu oko 11:02. Računar ugašen ili u snu → posle paljenja jedan
  propušteni ciklus; posle 19:00 najviše jedan naknadni. Dva ciklusa se
  nikad ne preklapaju (brava reda + zadatak ne pokreće drugu instancu).
  Bez interneta → dokumenti čekaju u lokalnom redu, ništa se ne gubi.
- HTTPS adresa portala (pilot) i, ako je zaštićena, tajna zaštite pristupa.

## 1. Instalacija ili ažuriranje — kao Administrator

Raspakovati ZIP (npr. `Downloads\carsystem-connector-<verzija>`), pa u
PowerShell-u „Run as administrator":

```powershell
cd "$env:USERPROFILE\Downloads\carsystem-connector-<verzija>"
.\windows\instaliraj.ps1 -JedanNalogSaUAC `
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

Isti administratorski prozor istog naloga (kancelarija sa jednim nalogom):

```powershell
& 'C:\Program Files\CarsystemConnector\windows\podesi.ps1' -JedanNalogSaUAC
```

(Za standardni nalog: običan prozor, bez `-JedanNalogSaUAC`.) Prvi put staje sa porukom „Uređaj još nije aktiviran" i ispisuje **otisak**.
Vlasnik u portalu: **Uvoz → Sinhronizacija → registruj uređaj** (oznaka
`KANC-01`, opseg `biznisoft / CSRM`) → **aktiviraj** uz potvrdu da se otisak
poklapa. Zatim ponovo `podesi.ps1`: test veze, prvi prolaz (nove fakture se
šalju, starije samo zabeleže), registracija zadatka i provera.

## 2a. Proba zakazanog zadatka (pre pravog zadatka)

Isti administratorski prozor. Registruje ZASEBAN zadatak `\Carsystem\CarsystemProba`
(akcija `node.exe … --help`: bez ključa, mreže i faktura), pokreće ga, proverava
rezultat 0 i uvek ga uklanja. Pravi zadatak `CarsystemConnector` ne dira.

```powershell
& 'C:\Program Files\CarsystemConnector\windows\proba-zadatka.ps1' -JedanNalogSaUAC
```

Očekivano `PROBA PROSLA` i izlaz 0. Svaki korak ima vreme — uporediti sa
istorijom detekcija antivirusa. Ako je proba prekinuta pa zadatak ostao:
isti poziv sa `-SamoUkloni`.

## 3. Svakodnevna provera

```powershell
& 'C:\Program Files\CarsystemConnector\windows\provera.ps1'
```

Prikazuje poslednji ciklus, sledeći termin, šta čeka slanje ili pregled,
rezultat zakazanog zadatka i **upozorenja**:

- **Storna za ručni upload** i **stariji računi izvezeni naknadno** (datum
  pre početka slanja, fajl nastao kasnije — npr. račun koji je nedostajao):
  ne šalju se sami. Spisak fajlova: komanda `… rucno` iz upozorenja.
  Proveriti u portalu i po potrebi otpremiti na **Uvoz** (`/portal/importi`),
  izdavalac `CSRM`. Portal sam povezuje potpuno storno sa originalom ili ga
  stavlja na pregled.
- **Folder nove godine** (npr. „Fakture 2027") — konektor ga ne uključuje sam.
  U januaru: korak 1 sa `-IzvorniFolder '...\Fakture 2027'`.

Ručno pokretanje odmah (bez čekanja sledećeg sata):
`& 'C:\Program Files\CarsystemConnector\windows\task.ps1' -Action run -Mode Production`,
pa `provera.ps1`. (Ne `Start-ScheduledTask`/`Get-ScheduledTask`: na kancelarijskom
računaru ti cmdleti idu kroz WMI i vraćaju 0x80070002; skripte koriste Task
Scheduler COM i `schtasks.exe`. Ručna provera: `schtasks /Query /TN \Carsystem\CarsystemConnector /V /FO LIST`.)

## 4. Povratak na prethodnu verziju — kao Administrator

```powershell
& 'C:\Program Files\CarsystemConnector\windows\vrati-prethodnu.ps1' -RunAsAccount 'RACUNAR\nalog'
```

Ključ, red i podešavanja se ne diraju. Potpuno uklanjanje zadatka:
`task.ps1 -Action uninstall -Mode Production -Apply` (fajlovi faktura se nikad ne diraju).
