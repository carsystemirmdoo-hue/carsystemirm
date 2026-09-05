# Carsystem konektor

Lokalni konektor koji čita podržane BizniSoft PDF fakture, pravi canonical
dokument **postojećim** parserom i ugovorom, čuva ga u trajnom lokalnom redu i
šalje potpisan postojećem device API-ju.

**PDF i sirovi izdvojeni tekst ostaju na računaru.** Kroz mrežu ide isključivo
canonical payload.

Puna dokumentacija: [`docs/b2b/21-windows-connector.md`](../docs/b2b/21-windows-connector.md).

## Pakovanje

```bash
npm run connector:build     # -> connector/dist/
```

`dist/` je samostalan: ne traži repozitorijum, Next aplikaciju, `DATABASE_URL`
ni mrežu pri pokretanju. Kopira se na kancelarijski računar kao folder.

## Komande

```bat
connector.cmd doctor        :: konfiguracija, runtime, izvor, key-store, kalendar
connector.cmd init          :: lokalni Ed25519 par; ispisuje SAMO javni ključ + otisak
connector.cmd export-key    :: ponovni ispis javnog ključa i otiska
connector.cmd dry-run       :: scan/parse/validate, BEZ mreže
connector.cmd run-once      :: izričito ručni ciklus
connector.cmd auto          :: poštuje raspored; ovo zove Task Scheduler
connector.cmd status        :: red, poslednji ishodi, sledeći termin
connector.cmd heartbeat     :: potpisano javljanje
```

## Konfiguracija

`%LOCALAPPDATA%\CarsystemConnector\config.json` (ili `CS_CONNECTOR_CONFIG`):

```json
{
  "serverOrigin": "https://portal.primer.rs",
  "deviceCode": "office-pc-01",
  "keyId": "k1",
  "sourceSystem": "biznisoft",
  "issuerCode": "QA01",
  "izvorniFolder": "C:\\BizniSoft\\Izvoz\\Fakture",
  "dodatnaZatvaranja": ["2026-08-14"]
}
```

Nijedno polje nema podrazumevanu vrednost. Pogrešna putanja je **greška**, ne
uspešan prazan uvoz — izvorni folder se nikada ne pravi automatski.

**Kancelarijska produkciona instalacija** (`task.ps1 -Mode Production`) config.json
postavlja u INSTALACIONI (package) folder, ne u folder stanja — taj folder je
admin-write-only posle `harden-install-dir.ps1 -Apply`, pa `serverOrigin` i
`izvorniFolder` nisu upisivi nalogu koji svakodnevno pokreće konektor. Vidi
[`windows/OFFICE-INSTALL.md`](windows/OFFICE-INSTALL.md) §4.

## Autostart

Dva odvojena toka — koristi pravi za kontekst:

- **Kućni/smoke test** (paket na Desktop-u, lični nalog): pogledaj
  [`smoke/START-HERE.md`](smoke/START-HERE.md) i koristi `-Mode Smoke`.
  Provere ispod su tu SAMO upozorenja (`[WARN]`), ne blokiraju.
- **Kancelarijska produkciona instalacija** (Program Files, poseban
  least-privilege nalog, prave fakture): **prati redom**
  [`windows/OFFICE-INSTALL.md`](windows/OFFICE-INSTALL.md) i koristi
  `-Mode Production` — uključuje `harden-install-dir.ps1`,
  `harden-state-dir.ps1`, proveru integriteta prenosa i proveru BizniSoft
  foldera kao BLOKIRAJUĆE preduslove PRE registracije zadatka.

`-Mode` (`Smoke` ili `Production`) je OBAVEZAN za `install`/`uninstall` — bez
njega se skripta odbija pre bilo koje provere. Dva režima registruju
**različita imena zadatka** (`CarsystemConnectorSMOKE` naspram
`CarsystemConnector`) — jedan ne može zameniti drugi.

```powershell
.\windows\task.ps1 -Action status
.\windows\task.ps1 -Action install -Mode Production -RunAsAccount 'RACUNAR\nalog' -Apply   # bez -Apply je dry-run
.\windows\harden-state-dir.ps1 -Apply                                                        # ACL foldera stanja
.\windows\task.ps1 -Action uninstall -Mode Production -Apply                                 # ne briše PDF-ove, ključ ni red
```

Akcija zadatka poziva proverenu, apsolutnu `node.exe` putanju DIREKTNO — nema
posrednog `.cmd`/`.ps1` launchera u folderu stanja (taj folder mora biti
upisiv za `RunAsAccount`, pa bi bilo koji izvršni fajl tamo bio deo lanca koji
isti nalog može sam izmeniti).

`-RunAsAccount` podrazumevano koristi trenutni nalog ($env:USERNAME) — isto
ponašanje kao ranije, sada eksplicitno imenovano. Autostart i ručno
pokretanje **moraju ići pod istim nalogom** — DPAPI `CurrentUser` ključ
otključava samo taj nalog.

## Runtime

Node **24** (Active LTS), testirano. Traži `node:sqlite` (Node 22+).

## Testovi

```bash
npm run connector:test      # čista logika + skener/red, iz paketa
npm run connector:e2e       # pun tok preko HTTP-a do QA Postgresa (Node 24)
```

Windows smoke test (`test/windows-smoke.test.mjs`) se van Windows-a **izričito
preskače**; macOS/Linux prolaz nije zamena.
