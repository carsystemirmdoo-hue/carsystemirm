# 27 — Objedinjeni status (2026-10-01)

Jedna lista umesto rasutih statusa u `08`, `09`, `01` i `15` (ti dokumenti su
delom zastareli: npr. `08` 1B-c/d kaže „nije", a MFA i lozinka postoje).
Sve F-faze su **lokalne grane**, nisu u `main` i nisu na produkciji.

Legenda: ✅ završeno · 🟡 delimično · ⬜ nedostaje (ne zavisi od podataka) · ⏳ čeka BizniSoft/spoljne podatke

## Završeno

| Stavka | Gde | Sledeći korak |
|---|---|---|
| ✅ Nalozi kupaca, potvrda kontakta, izolacija | PR #2 (draft, pushovan) | vaše odobrenje redosleda spajanja (§ Vercel, `28-…`) |
| ✅ Ispravka pool-a baze (produkcioni blokator) | PR #3 (draft, pushovan) | spaja se PRVI |
| ✅ F1–F3 izgled, stanje podataka, kartica kupca | `feat/portal-review-f1-f3` | ide u isti lanac spajanja |
| ✅ F4 „Za razgovor" + zastareo obračun | `feat/portal-review-f4` | isto |
| ✅ F5 kupčev nalog na sajtu | `feat/portal-review-f5` | isto |
| ✅ F6 „Poručite ponovo" | `feat/portal-review-f6` | isto |
| ✅ F7 korpa, zahtev, prijem u kancelariji (demo) | `feat/portal-f7-cart` | stvarni režim tek posle ⏳ cenovnika |
| ✅ F8 kupovina iz kataloga, upiti za cenu, rabati iz faktura (demo) | `feat/portal-f8-catalog-buy` | provera sa stvarnim podacima posle uvoza |
| ✅ Zaštita poslednjeg gazda naloga, MFA, rate limit, audit | `main` + testovi (`ownerGuard`, `mfa*`) | ažurirati `08` (piše da nije) |
| ✅ „Zapamti me" za kupce + promena lozinke u nalogu | `feat/portal-f9-remaining` (0031) | pilot sa nekoliko kupaca, pa `CUSTOMER_REMEMBER_ME=1` |
| ✅ Interni nazivi artikala (BizniSoft ↔ katalog po publici) | `feat/portal-f9-remaining` | provera sa stvarnim šifarnikom |
| ✅ Predlozi dodatnih proizvoda + upiti u „Za razgovor" | `feat/portal-f9-remaining` | pouzdanost raste sa brojem firmi sa uvezenim fakturama |
| ✅ Spisak za firmin Vercel | `28-vercel-firma-spremnost.md` | odluke P14 i spajanje grana |
| ✅ Automatski obračun preporuka posle uvoza (0032) | `feat/portal-f10-release-prep` | uključiti kada dnevni uvoz radi |
| ✅ Provera `Cache-Control` + ispravke | `29-cache-control-provera.md` | — |
| ✅ Lokalna grana za izdanje | `release/portal-2026-10` | vaše odobrenje za PR ka `main` |

## Delimično

| Stavka | Šta postoji | Šta nedostaje | Sledeći korak |
|---|---|---|---|
| 🟡 Preporuke | ritam, predlozi dodatnih proizvoda, automatski obračun posle uvoza (iza prekidača) | provera sa stvarnim uvozom | uključiti `RECOMMENDATIONS_AUTO_RECOMPUTE` kada konektor radi |
| 🟡 Kupčevi sopstveni nazivi (prvobitni F9) — OTVORENO | BizniSoft ↔ katalog za zaposlene i kupce | sopstveni nazivi i pretraga po njima | `30-kupcevi-nazivi-artikala.md` |
| 🟡 Mapiranje šifara | ekran, provera tačnog proizvoda i varijante, kolona „Za poručivanje" | uvoz šifarnika i predlozi po šifri | ⏳ šifarnik (A) |
| 🟡 Razdvajanje DB privilegija | skripta + runbook `10-…` | nije primenjeno ni na jednoj bazi | pri podizanju firmine baze (`28-…`) |
| 🟡 Dokumenti `08`, `09`, `01` | — | ne odražavaju F1–F8 | ovaj dokument ih zamenjuje kao pregled; ažurirati posle spajanja |

## Nedostaje (ne zavisi od podataka)

| Stavka | Sledeći korak |
|---|---|
| ⬜ Slanje e-pošte (pozivi, reset, obaveštenja) | izbor provajdera = trošak → vaša odluka; do tada izlazna pošta čeka u `customer_message_outbox` |
| ⬜ Komercijalista poručuje u ime kupca (P17) | poslovna odluka; tehnički: korpa firme već postoji |
| ⬜ Automatski obračun preporuka posle dnevnog uvoza | migracija + odobrenje |
| ⬜ Izvoz izveštaja (`/portal/izvestaji`) | posle stvarnih podataka ima smisla birati kolone |

## Čeka BizniSoft / spoljne podatke

| Stavka | Blokira | Sledeći korak |
|---|---|---|
| ⏳ Šifarnik artikala (A) | grupe za rabate, pakovanja, šifra proizvođača, predlozi veza | uzorak izvoza, pa ugovor `article-master` (`26-…` §5) |
| ⏳ Važeći cenovnik (B) | stvarno poručivanje | uzorak, uvoz u `price_lists` vrste `biznisoft`, ljudska aktivacija |
| ⏳ Rabati po kupcu (C) | tačne cene kupaca | uzorak + kontrolne fakture (D) |
| ⏳ Lager (P3) | dostupnost, `/portal/zalihe`, nabavka, porudžbine dobavljaču | pitanja `26-…` §6 (6, 8) |
| ⏳ Upis porudžbine u BizniSoft (P5) | automatski prenos | pilot = ručni unos (već u demou) |
| ⏳ Zakazani izvoz (P6), istorija (P7) | redovno osvežavanje, pouzdanost preporuka | pitanja `26-…` §6 (1–3) |
| ⏳ Uplate | `/portal/dugovanja`, `/portal/limiti` | izvor uplata iz BizniSofta |
| ⏳ BEX ugovor (P9), rad magacina (P10) | otprema, adresnice | pristupni podaci BEX-a |
| ⏳ Zamenski artikli (P13) | predlog zamene | polje u šifarniku? |
| ⏳ Hosting baze i backup (P14) | firmin Vercel | `28-…` |
