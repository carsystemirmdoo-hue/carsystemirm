# Kopije na kancelarijskom računaru — uputstvo

Paket radi dve stvari:
1. preuzima poslednju **šifrovanu** kopiju baze sa privatnog GitHub repoa, proverava otisak i čuva je u fascikli druge kopije (Google Drive firme);
2. pravi **inkrementalnu šifrovanu** kopiju izvornih PDF-ova u istu fasciklu. Izvorni PDF-ovi se samo čitaju; obrisan ili izmenjen original nikad ne briše sačuvanu kopiju.

Posle svakog uspešnog koraka **konektor** šalje portalu potpisanu potvrdu (`prijavi-kopiju`), ključem ovog uređaja. Ovaj računar **nema lozinku baze**. Portal prihvata „kopija sačuvana van GitHub-a“ samo ako se otisak poklapa sa kopijom koju je GitHub proverio.

Privatni ključ za dešifrovanje **ne ide na ovaj računar**. Ovde je samo javni ključ (`age1…`).

## Pre početka
- Konektor **0.3.12 ili noviji** je instaliran i radi (komanda `prijavi-kopiju`).
- Google Drive for desktop je instaliran i prijavljen **firminim** nalogom; postoji fascikla, npr. `G:\My Drive\Carsystem kopije`.
- Javni ključ firme u fajlu `age-primaoci.txt`.
- Fine-grained token: samo repo `carsystemirmdoo-hue/carsystem-backup`, „Actions: Read-only“, rok najviše 1 godina.

## Podešavanje (PowerShell, ISTI nalog pod kojim radi konektor — NE kao administrator)
1. Preuzmite zvanični `age-v1.3.2-windows-amd64.zip` sa github.com/FiloSottile/age/releases (skripta proverava SHA-256).
2. Raspakujte ovaj paket u kratku putanju (npr. `C:\CarsystemKopije-paket`), otvorite PowerShell u toj fascikli:
   ```powershell
   Get-ChildItem -Recurse | Unblock-File
   .\windows\podesi-kopije.ps1 -AgeZip "<putanja>\age-v1.3.2-windows-amd64.zip" -JavniKljucFajl "<putanja>\age-primaoci.txt"
   ```
   Fascikla PDF-ova: Enter prihvata fasciklu koju već čita konektor.
3. Provera bez mreže: `.\windows\kopije.ps1 -Akcija Provera`

## Prvi ručni prolaz
```powershell
.\windows\kopije.ps1 -Akcija Sve
```
Očekivano u logu: `"kod": "backup_recorded"` (ili `backup_already_recorded`) za kopiju baze i za PDF.
Portal → Sinhronizacija → Rezervne kopije: „Šifrovana kopija preuzeta i sačuvana van GitHub-a“ i „Kopija izvornih PDF-ova“ postaju zelene.

## Svaki dan automatski
```powershell
.\windows\zakazi-kopije.ps1
```
Zadatak `\Carsystem\Kopije` svaki dan u 09:15 (dok je nalog prijavljen) pokreće `kopije.ps1 -Akcija Sve`. Uklanjanje: `.\windows\zakazi-kopije.ps1 -Ukloni`.

## Gde su podaci
`%LOCALAPPDATA%\CarsystemKopije`: podešavanja, javni ključ, `age.exe`, token zaštićen DPAPI-jem (samo ovaj nalog), stanje PDF kopije i dnevni log (bez tajni).
