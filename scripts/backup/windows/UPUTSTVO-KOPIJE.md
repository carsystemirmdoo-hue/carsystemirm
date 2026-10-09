# Kopije na kancelarijskom računaru — uputstvo

Paket preuzima poslednju **šifrovanu** kopiju baze sa privatnog GitHub repoa, proverava otisak i čuva je
**lokalno** na ovom računaru, uz ograničeno čuvanje (podrazumevano 7 dnevnih, 4 nedeljne, 3 mesečne —
najviše ~14 kopija, ~14 MB svaka). Posle uspešnog čuvanja **konektor** šalje portalu potpisanu potvrdu
(`prijavi-kopiju`) ključem ovog uređaja. Ovaj računar **nema lozinku baze**. Portal prihvata potvrdu samo
ako se otisak poklapa sa kopijom koju je GitHub proverio.

Portal to prikazuje kao „Šifrovana kopija na firminom računaru“. **Google Drive se otprema ručno i portal
ga NE potvrđuje.** PDF kopija je opciona (`podesi-kopije.ps1 -SaPdf`) i podrazumevano isključena.

Privatni ključ za dešifrovanje **ne ide na ovaj računar**. Ovde je samo javni ključ (`age1…`).

## Pre početka
- Konektor **0.3.12 ili noviji** radi (komanda `prijavi-kopiju`).
- `age-v1.3.2-windows-amd64.zip` sa github.com/FiloSottile/age/releases/tag/v1.3.2
  (SHA-256 `f48d8f8f9ebe903ab5027ed067652f2cc1db94bc206976430133b905dcd8e8c7`; skripta ga proverava).
- Javni ključ firme: `age-primaoci.txt`.
- Fine-grained token: samo repo `carsystemirmdoo-hue/carsystem-backup`, „Actions: Read-only“, rok najviše 1 godina.

## Podešavanje (PowerShell, ISTI nalog pod kojim radi konektor — NE kao administrator)
Paket raspakovati u kratku putanju (npr. `C:\CarsystemKopije-paket`), PowerShell u toj fascikli:
```powershell
Get-ChildItem -Recurse | Unblock-File
.\windows\podesi-kopije.ps1 -AgeZip "$env:USERPROFILE\Downloads\age-v1.3.2-windows-amd64.zip" -JavniKljucFajl "$env:USERPROFILE\Downloads\age-primaoci.txt"
```
Lokalna fascikla: Enter prihvata `Documents\Carsystem kopije`. Token se unosi skriveno (DPAPI).

Provera bez mreže: `.\windows\kopije.ps1 -Akcija Provera`

## Prvi ručni prolaz
```powershell
.\windows\kopije.ps1 -Akcija Preuzmi
```
Očekivano u logu: `"kod": "backup_recorded"` (ili `backup_already_recorded`).

## Svaki dan automatski (samo kopija baze)
```powershell
.\windows\zakazi-kopije.ps1
```
Zadatak `\Carsystem\Kopije` svaki dan u 09:15 (dok je nalog prijavljen) pokreće `kopije.ps1 -Akcija Preuzmi`.
Uklanjanje: `.\windows\zakazi-kopije.ps1 -Ukloni`.

## Ručno otpremanje na Google Drive (jednom nedeljno)
U `Documents\Carsystem kopije\baza` je po jedna fascikla za svaku kopiju (`20261012T011700Z` …).
Jednom nedeljno najnoviju fasciklu otpremiti na drive.google.com u „Carsystem kopije“. Na Drive-u držati
**najviše 4** (≈ 56 MB); najstariju obrisati pri otpremanju nove. Otpremaju se samo `.age` fajlovi i
`status.json` — sve je već šifrovano.

## Gde su podaci
`%LOCALAPPDATA%\CarsystemKopije`: podešavanja, javni ključ, `age.exe`, token zaštićen DPAPI-jem (samo ovaj
nalog) i dnevni log (bez tajni).
