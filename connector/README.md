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

## Autostart

```powershell
.\windows\task.ps1 -Action status
.\windows\task.ps1 -Action install -Apply      # bez -Apply je dry-run
.\windows\harden-state-dir.ps1 -Apply          # ACL foldera stanja
.\windows\task.ps1 -Action uninstall -Apply    # ne briše PDF-ove, ključ ni red
```

Autostart i ručno pokretanje **moraju ići pod istim nalogom** — DPAPI
`CurrentUser` ključ otključava samo taj nalog.

## Runtime

Node **24** (Active LTS), testirano. Traži `node:sqlite` (Node 22+).

## Testovi

```bash
npm run connector:test      # čista logika + skener/red, iz paketa
npm run connector:e2e       # pun tok preko HTTP-a do QA Postgresa (Node 24)
```

Windows smoke test (`test/windows-smoke.test.mjs`) se van Windows-a **izričito
preskače**; macOS/Linux prolaz nije zamena.
