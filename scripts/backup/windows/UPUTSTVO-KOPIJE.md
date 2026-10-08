# Kopije na kancelarijskom računaru — uputstvo

Paket radi dve stvari, **ručno**, dok vlasnik ne odobri zakazane zadatke:
1. preuzima poslednju **šifrovanu** kopiju baze sa privatnog GitHub repoa, proverava otisak i čuva je u fascikli druge kopije (oblak firme);
2. pravi **inkrementalnu šifrovanu** kopiju izvornih PDF-ova u istu fasciklu. Izvorni PDF-ovi se samo čitaju; obrisan ili izmenjen original nikad ne briše sačuvanu kopiju.

Privatni ključ za dešifrovanje **ne ide na ovaj računar**. Ovde je samo javni ključ (`age1…`).

## Pre početka (vlasnik)
- Privatni repo kopija je napravljen i prošao je bar jedan uspešan ručni prolaz.
- Javni ključ firme je u fajlu (npr. `age-primaoci.txt`).
- Fascikla druge kopije postoji i sinhronizuje je oblak firme.
- Fine-grained token: samo repo kopija, „Actions: Read-only“, rok najviše 1 godina.
- Adresa uloge `carsystem_backup_status` (sme samo da doda red u evidenciju kopija).

## Podešavanje (PowerShell, običan nalog — NE kao administrator)
1. Preuzmite zvanični `age-v1.3.2-windows-amd64.zip` sa github.com/FiloSottile/age/releases (skripta proverava SHA-256).
2. Raspakujte ovaj paket, otvorite PowerShell u njegovoj fascikli:
   ```powershell
   Get-ChildItem -Recurse | Unblock-File
   .\windows\podesi-kopije.ps1 -AgeZip "<putanja>\age-v1.3.2-windows-amd64.zip" -JavniKljucFajl "<putanja>\age-primaoci.txt"
   ```
3. Provera bez mreže: `.\windows\kopije.ps1 -Akcija Provera`

## Ručni prolaz
```powershell
.\windows\kopije.ps1 -Akcija Preuzmi
.\windows\kopije.ps1 -Akcija Pdf
```
Posle svakog prolaza portal (Sinhronizacija → Rezervne kopije) pokazuje novo vreme — kada je automatika te vrste uključena.

## Gde su podaci
`%LOCALAPPDATA%\CarsystemKopije`: podešavanja, javni ključ, `age.exe`, tajne zaštićene DPAPI-jem (samo ovaj nalog), stanje PDF kopije i dnevni log (bez tajni).

Zakazani zadaci se dodaju tek posle odluke vlasnika (trajni ključ i mesto druge kopije).
