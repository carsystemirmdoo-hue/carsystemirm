# 49 — Windows konektor 0.3.0: kancelarijska instalacija i HTTPS odredište

**Status (2026-10-06): paket napravljen i proveren na Mac-u; Windows deo nije
izvršen; HTTPS odredište za pilot ne postoji (odluka ispod).**
Grana `release/windows-konektor-2026-10`. Prethodno: [21](21-windows-connector.md),
[42](42-uvoz-sa-maca-i-windows-konektor.md), [48](48-naknadno-storno.md).

## 1. Šta je spojeno

| Linija | Šta donosi |
|---|---|
| 82be66e (kancelarijski smoke PASS 16/16, Windows 10 Pro, Node 24.20) | DPAPI kanal (`-EncodedCommand`, ključ samo kroz stdin), pravilo imena `fak`/`faktura`, zadržavanje blokiranih dokumenata u redu, UTF-8 BOM za PS 5.1 |
| integraciona grana | oporavak od 429 (Retry-After, postepeno čekanje), parser v2, uvoz sa Mac-a, naknadno storno (48) |
| novo | `posaljiOdDatuma`; storno → `storno_rucni_upload` + komanda `storna`; upozorenje za folder nove godine; opciona zaštita pristupa `x-vercel-protection-bypass`; skripte `instaliraj`/`podesi`/`provera`/`vrati-prethodnu` |

Ograničenje nepoznatih uređaja: obe linije su ga nezavisno ispravile; zadržan
je `blockedForSeconds` (tačan `Retry-After`) i pretvaranje ponovljenih
neuspeha u 429.

## 2. Provere

- Konektor: 227 prošlo, 40 Windows testova preskočeno na Mac-u.
- Integracioni (uređaj, konektor, sinhronizacija, storno, canonical): 97/97.
- Smoke paket: lokalna provera 10/10; **Windows izvršenje nije urađeno**.
- Sintaksa svih `.ps1`: 0 grešaka parserom zvaničnog PowerShell 7.6.6
  (macOS). Izvršenje na Windows PowerShell 5.1 NIJE provereno — to je
  kancelarijski test.

## 3. Ponašanje u kancelariji

- Izvor: folder jedne godine (`…\Fakture\Fakture 2026`). Folder sledeće
  godine se **ne** uključuje sam (prvi prolaz kroz koren bi parsirao celu
  arhivu); `provera.ps1` i izlaz ciklusa upozoravaju kada se pojavi. U
  januaru: `instaliraj.ps1 -IzvorniFolder '…\Fakture 2027'`.
- `posaljiOdDatuma` (podrazumevano dan instalacije): starije fakture se samo
  beleže i nikad ne šalju — instalacija ne može da pošalje arhivu, uključujući
  namerno izostavljena storna i revizije.
- Storno se ne šalje sa uređaja; vidi se kao upozorenje, komanda `storna`
  daje fajlove, ručni upload na `/portal/importi` (48).
- Raspored (`ciklus` u konfiguraciji): radnim danima svakog sata 08:00–19:00
  (okidač 08:02–19:02, najviše 55 min po pokretanju); posle 19:00 najviše
  jedan naknadni ciklus; preklapanje sprečavaju brava reda i
  `MultipleInstances IgnoreNew`. Radi dok je nalog prijavljen (zaključan ekran
  ne smeta, pregledač nije potreban); bez mreže red čeka.
- Jedan Windows nalog koji je administrator: `-JedanNalogSaUAC` — isti nalog
  instalira iz „Run as administrator" prozora, UAC mora biti uključen, zadatak
  radi sa ograničenim tokenom (RunLevel Limited). Nov nalog nije potreban.
- Stariji račun čiji je fajl nastao posle `posaljiOdDatuma` (naknadni izvoz)
  se ne šalje sam, nego izdvaja za ručnu proveru (komanda `rucno`).
- Ažuriranje čuva `config.json`, DPAPI ključ i `queue.db`; prethodna verzija
  ostaje kao `CarsystemConnector.prethodna-*` (`vrati-prethodnu.ps1`).

## 4. HTTPS odredište — stanje i odluka

- Firmin tim `carsystem1`, projekat `carsystemirm` (repo
  `carsystemirmdoo-hue/carsystemirm`): Production = `main`; Preview
  `preview/portal-test` je sintetički test portal na zasebnoj test bazi.
  Pilot dobija sopstveni Preview (`pilot/istorija`) sa promenljivim samo za
  tu granu; tajna zaštite projekta važi i za njega. (Ranija beleška o ličnom
  timu ispod je zastarela.)
- Projekat `carsystemirm` je u ličnom Vercel timu na **Hobby** planu; Preview
  deploymenti su iza Vercel Authentication; za Preview ne postoji nijedna
  promenljiva baze ni autentifikacije. Pilot je danas dostupan samo preko
  lokalnog servera na Mac-u (`127.0.0.1`), a spakovan konektor prima samo HTTPS.
- **Najkraći put:** Preview deployment ove grane u postojećem projektu, sa
  promenljivim iz pilot podešavanja ograničenim na Preview i tu granu
  (`DATABASE_URL`/`DATABASE_DIRECT_URL` kao `carsystem_app`, `AUTH_SECRET`,
  `PORTAL_MFA_MASTER_KEY_V1`, `AUTH_RATE_LIMIT_HMAC_KEY`, `AUTH_URL` = adresa
  grane, `PORTAL_MFA_MODE=enforced`, `CUSTOMER_ORDERING=off`,
  `FEATURE_SYNC_DEVICE_INGEST=1`, `FEATURE_RECOMMENDATIONS=0`,
  `RECOMMENDATIONS_AUTO_RECOMPUTE=0`, ostale kao lokalno), Vercel
  Authentication ostaje, a konektor prolazi tajnom „Protection Bypass for
  Automation" (`vercelZastita`). Tehnički ne traži nov projekat.
- **Odluka vlasnika:** Hobby je po uslovima Vercel-a za nekomercijalnu
  upotrebu; pilot firme sa stvarnim podacima je poslovna upotreba (raniji
  zaključak u 41 §6: Pro). Uz odluku i odobrenje: promenljive + jedan Preview
  deployment (bez produkcije).

## 5. Redosled kada je odredište spremno

Vlasnik prijavljen na Preview (drugi faktor) → `instaliraj.ps1` (admin) →
`podesi.ps1` (otisak) → registracija i aktivacija `KANC-01` u portalu →
`podesi.ps1` (test veze, prvi prolaz, zadatak) → `Start-ScheduledTask` →
`provera.ps1` → ponovno pokretanje bez novih slanja.
