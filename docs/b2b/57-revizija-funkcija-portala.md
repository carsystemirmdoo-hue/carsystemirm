# 57 — Revizija funkcija portala (zajednička lista)

Početak: 11. 10. 2026. Provereno stanje: `company/main` = Production **0fe253e**; grana spojena sa **d81267f** (PR #22, Production od 11. 10. 12:16) i ponovo proverena
(lokalna grana `fix/revizija-portala-2026-10-11`). Lista se ažurira posle svake
završene stavke; stari izveštaji (27, 47, 53) su samo orijentir.

## Kako je provereno

| Provera | Rezultat |
|---|---|
| `npm run lint` · `typecheck` · `build:check` | prolaze |
| `npm test` (jedinični) | 2.237 / 2.237 |
| `test:integration` nad praznom sintetičkom bazom (55436, `carsystem_revizija_qa_test`) | 560 / 560 (jedan test ponovljen posle sudara dva paralelna pokretanja koja su pravila `connector/dist`) |
| Statičko praćenje toka: radnja → server → tabela → dozvola → prikaz | sve rute pod `/prijava`, `/kupac`, `/portal`, `/api` |
| Production baza, samo čitanje (`SET … READ ONLY`, potvrđeno `transaction_read_only = on`) | brojevi ispod; ništa nije upisano |
| Pregledač | projektni `qa:pg:browser`: 22 / 22 (prijava, MFA, reset, dozvole, deaktivacija, telefon, korpa, spremnost, sinhronizacija, preporuke); kupčev tok i zahtevi: **sledeći korak** |

„Ne proveren u pregledaču“ znači: tok je praćen kroz kod i testove, ali nije
kliknut na sintetičkim podacima u ovoj reviziji.

## Stanje Production podataka

Brojevi sa Production-a (samo čitanje, 11. 10.) su u privatnoj belešci
`~/.carsystem-private/revizija-2026-10-11/stanje-production.md` — repo je javan.
Za nalaze su bitni: konektor se javljao do petka posle podne; veze artikala sa
katalogom i obračuni preporuka su prazni; jedan zapis ručnog uvoza od 06. 10.
stoji „u toku“ (potvrđuje B2).

## Popis funkcija

Statusi: ✅ radi · 🟡 delimično · ❌ ne radi · ⬜ nije implementirano · ❔ neprovereno.
Oznake: **[UI]** samo interfejs bez obrade · **[DEMO]** radi samo nad demo podacima · **[ČEKA]** čeka izvor podataka.

### A. Prijava, sesija, dozvole

| # | Funkcija | Uloga · putanja | Status | Dokaz | Nedostaje | Zavisi od | Sledeći korak |
|---|---|---|---|---|---|---|---|
| A1 | Prijava zaposlenih (lozinka + TOTP/rezervni kod), zaključavanje posle 8 pokušaja | svi · `/prijava` | ✅ | `auth.ts:163-389`; testovi credentialsLogin, authFlow; QA tokovi 1–7 | — | `AUTH_*`, MFA ključevi | — |
| A2 | Vezivanje MFA, rezervni kodovi | svi · `/portal/bezbednost/mfa` | 🟡 | `mfa/actions.ts:27-183` | ponovno vezivanje traži samo lozinku; bez ograničenja pokušaja | — | B9 |
| A3 | Odjava zaposlenih | svi | 🟡 | `app/portal/actions.ts:13` briše samo kolačić | JWT ostaje važeći do isteka | — | B8 |
| A4 | Istek sesije | svi | ❔ | `auth.config.ts:52` maxAge 8 h, verovatno klizno | proveriti apsolutni rok | — | B8 |
| A5 | Reset lozinke zaposlenog (kod od vlasnika, 30 min) | vlasnik → svi · `/prijava/reset`, `/portal/bezbednost/nalozi` | ✅ | `password-reset.ts:126-230`; QA 9–10 | ne skida zaključavanje naloga; bez e-pošte (ručna predaja) | — | B9 |
| A6 | Uloge i paketi, zaštita poslednjeg vlasnika | vlasnik · `/portal/dozvole` | ✅ | `dozvole/actions.ts`; ownerGuard testovi; QA 8, 11 | nov nalog prima lozinku od 10 znakova (svuda 12) | — | B9 |
| A7 | Prijava kupca | kupac · `/prijava/kupac` | ✅ | `auth.ts:403-482` | — | — | provera u pregledaču (C-tok) |
| A8 | „Zapamti me“ kupca | kupac | ✅ iza zastavice | `rememberRules.mjs`; integracija customerRememberMe | isključeno (`CUSTOMER_REMEMBER_ME=0`) | odluka | uključiti posle pilota |
| A9 | Odjava kupca / odjava svuda | kupac · `/kupac/bezbednost` | 🟡 | `prijava/kupac/actions.ts:88` | obična odjava ne opoziva JWT | — | B8 |
| A10 | Zaboravljena lozinka kupca | kupac · `/prijava/kupac/lozinka` | ⬜ **[UI]** | statičan tekst; `requestPasswordReset` bez pozivaoca | samouslužni reset; danas: kancelarija ponovo izdaje poziv | e-pošta (trošak) | odluka; za pilot dovoljna ručna obnova |
| A11 | Poziv i aktivacija kupčevog naloga | vlasnik · `/portal/kupci/nalozi` → `/prijava/kupac/aktivacija` | 🟡 | `invitation-service.ts:168-360`; link se prikazuje jednom | e-pošta ne postoji; `outbox` se ne čita; dugme „predato“ bez UI | — | B10 |
| A12 | Radnje nad kupčevim nalozima poštuju opseg komercijaliste | `kupacki_nalozi` · `/portal/kupci/nalozi` | ❌ | `kupci/nalozi/actions.ts:100,167,222,293,333` bez `requireCustomerAccess` | provera opsega | — | **B1** |
| A13 | Održavanje sajta / kod za otključavanje | javno · `/site-u-pripremi` | 🟡 | `access/route.ts:36` | bez ograničenja pokušaja; poređenje nije konstantno-vremensko | — | B9 |
| A14 | Meni magacionera: Lozinka / Drugi faktor | magacioner | 🟡 | `permissions.mjs:626` vezano za `view:home` | stavka se ne vidi (strana radi) | — | B9 |

### B. Kupčev panel

| # | Funkcija | Putanja | Status | Dokaz | Nedostaje | Zavisi od | Sledeći korak |
|---|---|---|---|---|---|---|---|
| C1 | Početna, izolacija kupca | `/kupac` | ✅ | `customer-session.ts:52-90`; integracija customerIsolation | — | — | pregledač |
| C2 | Fakture: lista, pretraga, filter datuma | `/kupac/fakture` | 🟡 | `customer-queries.ts:117-141` | nemoguć datum (31. 2.) → 500; „od > do“ se ne proverava | — | B7 |
| C3 | Detalj fakture | `/kupac/fakture/[id]` | ✅ | tuđa faktura = 404 | — | — | pregledač |
| C4 | Preuzimanje / štampa fakture | — | ⬜ | nema rute ni dugmeta | prikaz za štampu (original PDF se ne čuva u oblaku) | odluka o obliku | B6 |
| C5 | Izbor artikala (pretraga + ranije kupljeno) sa cenom po opciji plaćanja | `/kupac/naruci` | ✅ iza probe | `request-service.ts:221-238` | najviše 60 redova, bez stranica | osnovne cene, rabati, `ordering.trial` | pregledač |
| C6 | Korpa: količina, uklanjanje, opcija plaćanja | `/kupac/korpa` | 🟡 | `request-service.ts:271-290` | ne proverava da li je poručivanje i dalje uključeno; loš ID → 500 | — | B7 |
| C7 | Slanje zahteva za porudžbinu | `/kupac/korpa` | ✅ | `request-service.ts:340-412` (idempotentno, preračun cene, otisak) | komercijalni status se proverava tek na kraju | — | pregledač |
| C8 | Zahtevi: lista, detalj, osvežavanje, otkaz, odgovor na izmenu kancelarije | `/kupac/porudzbine` | ✅ | `ordering-service.ts:783-1000` | loš ID u `answerOrderRevision` → 500 | — | B7 |
| C9 | Cena kupca u katalogu, „u korpu“ iz kataloga | katalog, `/api/kupac/ponude` | ❌ za stvarne podatke **[DEMO]** | `ordering-service.ts:82-95` koristi stari model (`price_lists`, samo `CUSTOMER_ORDERING=demo`) | povezati katalog sa novim obračunom (`customerPrices`) | `article_catalog_mappings` (0) | posle pilota (P-2) |
| C10 | „Poručite ponovo“ | katalog | 🟡 **[DEMO]** | `reorder.ts:100-163` iz stvarnih faktura, ali „može se poručiti“ samo iz starog modela | isto kao C9 | C9 | P-2 |
| C11 | Upit za cenu | katalog → `/kupac/upiti` | ✅ | `price-request-service.ts:38-120` | dostupno samo sa strana kataloga, koje su iza održavanja | `MAINTENANCE_MODE` | odluka |
| C12 | Bezbednost (lozinka, odjava svuda, zaboravi uređaj) | `/kupac/bezbednost` | ✅ | `bezbednost/actions.ts:28-62` | bez ograničenja pokušaja kod trenutne lozinke | — | B9 |
| C13 | Saglasnosti | `/kupac/saglasnosti` | ✅ (samo zapis) | integracija consent 16/16 | nijedan kanal ih ne koristi | — | — |
| C14 | Zalihe / dostupnost | — | ⬜ namerno | `CustomerBuyPanel.tsx:156` | — | lager **[ČEKA]** | posle izvoza lagera |
| C15 | Stanje duga / plaćanja | — | ⬜ | — | — | uplate **[ČEKA]** | posle izvoza uplata |
| C16 | Javna `/korpa` | `/korpa` | 🟡 | vodi na `/portal/korpa` (interna prijava) | kupca šalje na prijavu zaposlenih | — | B7 |

### C. Komercijalista i kancelarija

| # | Funkcija | Uloga · putanja | Status | Dokaz | Nedostaje | Zavisi od | Sledeći korak |
|---|---|---|---|---|---|---|---|
| S1 | Početna | svi osim magacina · `/portal` | ✅ | `portal/page.tsx` | dug nije dostupan | uplate | pregledač |
| S2 | Lista kupaca | `/portal/kupci` | 🟡 | samo filter aktivan/neaktivan | **filter po komercijalisti i pretraga** | — | B5 |
| S3 | Kartica kupca | `/portal/kupci/[id]` | 🟡 | profil traži `view:preporuke` | kancelarija dobija skoro praznu karticu | — | B4 |
| S4 | Dodela komercijaliste (pojedinačno, grupno iz šifre) | vlasnik | ✅ | `assignment-service.ts` | grupna dodela nikad ne uklanja staru | — | kasnije |
| S5 | Bez dodele | vlasnik, kancelarija | ✅ (čitanje) | `bez-dodele/page.tsx` | — | — | — |
| S6 | Šifre partnera (mapiranja) | `view:mapiranja` | 🟡 | izbor kupca ograničen na 1.000 | danas 260 kupaca — nije problem | — | kasnije |
| S7 | Registar partnera, grupne veze, kontakti | vlasnik | ✅ iza zastavice | `FEATURE_PARTNER_REGISTRY` | — | — | — |
| S8 | „Za razgovor“ + filter po komercijalisti | vlasnik, komercijalista | ✅ kod / ❔ Production | `za-razgovor/page.tsx:149-198` | na Production-u `recommendation_runs = 0`; obračun iza `FEATURE_RECOMMENDATIONS` | odluka o zastavicama | proveriti sadržaj na Production-u |
| S9 | Preporuke + ponovni obračun | vlasnik | ✅ kod / ❔ Production | `preporuke/actions.ts:42-75` | automatski obračun bez rezervnog okidača | `FEATURE_RECOMMENDATIONS`, `RECOMMENDATIONS_AUTO_RECOMPUTE` | odluka |
| S10 | Prodaja, detalj fakture, analitika, izvoz | `view:prodaja` | ✅ | `lib/sales/queries.ts` | ne-UUID ID i loš datum izvoza → 500 | — | B7 |
| S11 | Zahtevi kupaca: lista, osvežavanje 15 s | `/portal/zahtevi` | 🟡 | `ordering-service.ts:641` LIMIT 200 | brojači i „Otvoreni“ samo nad 200 najnovijih | — | B3 |
| S12 | Obrada zahteva: pregled, izmena, potvrda sa BizniSoft brojem, odbijanje, A4 štampa | kancelarija, vlasnik | ✅ | `ordering-service.ts:874-934`; integracija | upis u BizniSoft je ručni (namerno) | — | pregledač |
| S13 | Obaveštenje kancelariji o novom zahtevu / upitu | — | ⬜ | nema `notify()` za zahteve ni upite | — | — | B3 |
| S14 | Upiti za cenu/uslove (obrada) | `/portal/zahtevi/uslovi` | ✅ | `price-request-service.ts:195-235` | bez automatskog osvežavanja | — | B3 |
| S15 | Kontrolisana proba (nalog test kupca) | vlasnik | ✅ | `trial-service.ts:26-41` | link se predaje ručno | — | — |
| S16 | Obaveštenja | `/portal/obavestenja` | 🟡 | „pročitano“ važi za sve korisnike | — | — | kasnije |
| S17 | Aktivnosti (audit) | vlasnik | 🟡 | poslednjih 100, bez filtera | — | — | kasnije |
| S18 | Izveštaji | `/portal/izvestaji` | ⬜ **[UI]** | zastareo tekst | — | — | ukloniti iz menija ili uputiti na Prodaju |
| S19 | Interna korpa | vlasnik · `/portal/korpa` | ⬜ **[UI]** | link ka `/kontakt`, ništa se ne čuva | — | — | ostaje isključeno |
| S20 | Porudžbine dobavljaču, Odobrenja, Komercijalisti, Podešavanja | `/portal/porudzbine`, … | ⬜ **[UI]** / preusmerenja | — | — | lager | kasnije |
| S21 | Dugovanja, Limiti | `/portal/dugovanja`, `/limiti` | ⬜ **[ČEKA]** | samo obaveštenje | — | uplate/dospeća | posle izvoza |
| S22 | Zalihe, Nabavka | `/portal/zalihe`, `/nabavka` | ⬜ **[ČEKA]** | samo obaveštenje | — | lager | posle izvoza |
| S23 | Otprema, Adresnice, BEX | magacin | ⬜ **[ČEKA]** | nema BEX koda | — | BEX ugovor | kasnije |
| S24 | Povrati | `view:povrati` | ✅ | `povrati/page.tsx` | filter grupe prazan | grupe | — |

### D. Podaci, uvoz, konektor, cene

| # | Funkcija | Putanja | Status | Dokaz | Nedostaje | Zavisi od | Sledeći korak |
|---|---|---|---|---|---|---|---|
| D1 | Ručni upload PDF faktura / storna | `/portal/importi` | 🟡 | `lib/pdf/ingest.ts:975-991` | istorija ostaje „u toku“ 0/0/0 (potvrđeno na Production-u) | — | **B2** |
| D2 | Istorija uvoza sadrži i fakture sa konektora | `/importi`, `/importi/sinhronizacija` | ❌ | `api/sync/ingest/route.ts:49-69` ne pravi `import_runs` | — | — | B2 |
| D3 | CSV uvoz faktura | `/portal/importi` | ⬜ (isključeno u kodu) | `csv-gate.mjs:13` | — | uzorak izvoza | ne treba (PDF radi) |
| D4 | Dokumenti i revizije, spremnost podataka | `/importi/dokumenti`, `/spremnost` | ✅ | QA tok 19 | — | — | — |
| D5 | Sinhronizacija: uređaji, javljanje, ciklusi, upozorenje na izostanak | `/importi/sinhronizacija` | ✅ | QA tok 20; Production ciklusi | — | `FEATURE_SYNC_*` | proveriti KANC-01 u ponedeljak |
| D6 | Konektor KANC-01 (prijem potpisanih faktura) | Windows | ✅ 0.3.12 | Production: prijem bez duplikata (brojevi u privatnoj belešci) | 0.3.13 (bez prozora) nije instaliran; zavisi od ručnog PDF izvoza iz BizniSofta | prijavljen Windows nalog | kancelarija |
| D7 | Kopije baze + panel | `/importi/sinhronizacija` | ✅ | `backup_runs` dnevno | `/api/sync/backup` bez obrade greške | — | kasnije |
| D8 | Cenovnik: upload, pregled, potvrda vlasnika (MFA), verzije | `/portal/cene/cenovnik` | ✅ | `price-list-service.ts:71-386` | šifre bez fakture ne dobijaju cenu (351) | šifarnik **[ČEKA]** | izvoz šifarnika |
| D9 | Pravila rabata, odobravanje, istorija | `/portal/cene/*` | ✅ | testovi pricing | „potvrđeno“ samo kroz ručno pokrenuto usklađivanje; tekst strane tvrdi drugačije | — | kasnije |
| D10 | Rabati iz faktura, predlozi, grupe artikala | `/portal/cene/rabati-iz-faktura/*` | 🟡 | `predlozi/actions.ts:58-64` | grupni upis nije atomičan; sirova poruka greške | grupe iz BizniSofta | B7 |
| D11 | Povezivanje artikala BizniSoft ↔ katalog | `/portal/proizvodi/mapiranja` | ✅ kod, 0 veza na Production-u | `mapiranja/actions.ts:41-125` | posao nije urađen | — | posle pilota (C9) |
| D12 | Automatski obračun preporuka posle uvoza | — | 🟡 iza zastavice | `auto-recompute.ts:181-188` | nema cron rezerve | odluka | kasnije |
| D13 | Admin pragovi | `/portal/admin` | 🟡 | `admin/page.tsx:15` proverava paket umesto sposobnosti; vrednost se nigde ne koristi | — | — | kasnije |

## Redosled završavanja i statusi

Tri statusa se vode odvojeno: **lokalno** (kod + automatski testovi na grani
`fix/revizija-portala-2026-10-11`), **pregledač** (stvaran tok kliknut nad
sintetičkom bazom, `scripts/qa/synthetic-portal-flow.mjs`), **objavljeno**
(spojeno u `main` i na Production-u — samo uz Vašu potvrdu). Stavka je
završena tek kada ima sva tri.

Redosled (dogovor 11. 10.): B8 i bezbednosni deo B9 **pre uključivanja stvarnih
pilot kupaca**; kupčev tok i obrada zahteva provereni odmah nad sintetičkom bazom.

| # | Stavka | Uslov završetka | Lokalno | Pregledač | Objavljeno |
|---|---|---|---|---|---|
| B1 | Opseg komercijaliste u radnjama nad kupčevim nalozima | komercijalista sa `kupacki_nalozi` dobija 403 za tuđi nalog; vlasnik i kancelarija rade | ✅ ba21bae (izvor 8/8, integracija 25/25, authz 179/179) | ✅ 6/6: Jovan ne vidi nalog firme A; podmetnut ID → POST 403, nalog i trag netaknuti; vlasnik vidi oba | ⬜ |
| B0 | **Nov nalaz:** slanje zahteva zaglavljuje server sa malim pool-om | slanje, promena cene, izmenjen predlog i potvrda kupca prolaze sa `DATABASE_POOL_MAX=1` | ✅ 8116c45 (regresija: pre ispravke staje, posle prolazi; srodni testovi 105/105) | ✅ ceo tok nad pool-om 1 | ⬜ — vrednost `DATABASE_POOL_MAX` na Production-u nepoznata (Vercel pristup); Preview po dok. 28 = 1 |
| K | Kupčev tok + obrada u kancelariji (provera, ne izmena) | ceo tok prolazi nad sintetičkom bazom | — | ✅ 31/33 (2 pada su poznati nalazi B7 i B3) | — |
| B8 | Odjava opoziva sesiju; apsolutni rok 8 h od prijave | kopiran kolačić posle odjave ne otvara portal ni kupčev nalog | ✅ cc891b2 (0045 `auth_revoked_sessions`; jedinični 286/286, integracija sesija 72/72) | ✅ 7/7: zaposleni i kupac — kopija kolačića radi pre, posle odjave vodi na prijavu, i druga otvorena kartica gubi pristup; projektna provera zaposlenih 23/23 | ⬜ — pri objavi: migracija 0045; **svi se jednom ponovo prijave** (stari tokeni nemaju `sid`) |
| B9 | Bezbednosni deo: brojači iza sesije, kod održavanja, reset otključava, 12 znakova, meni magacionera | testovi + pregledač | ✅ 49c2eb6 (jedinični 2.244; integracija reseta 12/12 sa proverom otključavanja) | ✅ 6/6: kod sajta (tačan radi, posle 21 pogrešnog blokiran), promena uređaja traži kod sa trenutnog uređaja i odbija samo lozinku, rezervni kodovi „Previše pokušaja“ posle 5, lozinka kupca posle 11 | ⬜ |
| B7 | Neispravan unos ne daje 500 (datumi, ID-jevi) | svaka putanja sa lošim datumom/ID-jem daje 200/400/404 | ✅ 96b58c6 (filterInput 3/3, jedinični 2.248, integracija 95/95) | ✅ 23 putanje: nijedna 500 (pre: 3× 500 — fakture kupca, detalj fakture, kartica kupca); izvoz sa nemogućim datumom 400; ceo tok 41/42 (preostaje B3) | ⬜ |
| B3 | Kancelarija saznaje za nov zahtev/upit; brojači bez granice 200 | nov zahtev i upit prave obaveštenje; brojači nad celim skupom | ✅ c3e3c66 (0046; integracija — obaveštenje za kancelariju, ne za komercijalistu, bez duplikata) | ✅ zahtev: obaveštenje, brojači; ✅ upit 9/9: kupac sa kodom sajta traži cenu na strani proizvoda → U-broj → kancelarija vidi „Upit za cenu“, preuzima i odgovara → kupac vidi odgovor; komercijalista ne dobija obaveštenje | ⬜ — migracija 0046 |
| B2 | Istorija uvoza: zatvaranje PDF uvoza + prijem sa konektora | upload daje ishod sa brojevima; prijem uređaja vidljiv | ✅ a26b855 (biznisoftIngest 9/9 sa novim testom zatvaranja; deviceIngest sa proverom prikaza) | ✅ 3/3: dva sintetička PDF-a → „uspešno uz upozorenja“ (čeka kupca, 7 stavki) i „greška“ (sačuvano, na pregledu), nijedan „u toku“; odeljak prijema sa praznim stanjem | ⬜ — pri objavi: zaostali red od 06. 10. na Production-u ostaje „u toku“ dok se jednokratno ne zatvori (traži Vašu potvrdu) |
| B6 | Faktura za štampu u kupčevom panelu | kupac otvara A4 pregled svoje fakture; tuđa = 404 | ✅ 6dcdce8 — pregled podataka, original se ne čuva (vidi niže) | ✅ 4/4: oznaka „nije original“ (naslov, dno, margina svake strane), stavke sa JM i iznosima, u štampi bez navigacije; tuđa i neispravna = 404; PDF proveren | ⬜ |
| B4 | Kartica kupca za kancelariju | kancelarija vidi istoriju kupca | ✅ bffb971 (istorija uz `view:prodaja`; predlozi i dalje uz `view:preporuke`) | ✅ 5/5: kancelarija vidi sažetak, 7 artikala i veze na prodaju/zahteve, bez predloga za razgovor; komercijalista i dalje vidi predlog | ⬜ |
| B5 | Lista kupaca: pretraga + filter po komercijalisti | GET filter radi i posle osvežavanja | ✅ a59022a (pravila 3/3) | ✅ 8/8: Petar → A, „bez komercijaliste“ → C, pretraga po nazivu i PIB-u, osvežavanje čuva filter, loš unos = 200, komercijalista bez filtera i samo svoje | ⬜ |
| B10 | Pregled pošte za ručnu predaju (`outbox`) | kancelarija vidi i označava predate pozive | ✅ c9ae597 (opseg: integracija 26/26) | ✅ 4/4: poruka „Za ručnu predaju (1)“ sa firmom, kontaktom i vrstom → „Označite predatim“ (status i ko upisani) → prazno posle osvežavanja; Jovan ne vidi poruku firme A | ⬜ |
| B11 | Isti obrazac kao B0 u drugim servisima | statička provera svih transakcija + test sa pool-om 1 za kritične tokove | ✅ 90ceea6 — **nov nalaz**: aktivacija kupčevog naloga stajala je sa pool-om 1 (isTrialCustomer mimo tx); i demo loadOrderingMode; stalna provera `transactionPoolSafety` (3/3); integracija 565/565 | ✅ 2/2: vlasnik pravi probni nalog, kupac ga aktivira nad pool-om 1 | ⬜ |

### Provereno u pregledaču 11. 10. (sintetička baza, pool 1)

Kupac: prijava; fakture (spisak, detalj, pretraga, tuđa = 404); izbor robe (5
artikala, van programa skriven, „na upit“ označen); KOM odbija 1,5; korpa: avans
3.560,00 / odloženo 3.760,00 (ručno izračunato), osvežavanje čuva stavke i
opciju; promena rabata posle prikaza → poruka i bez zahteva; slanje
Z-2026-00001, korpa prazna; telefon bez horizontalnog skrola na 4 strane;
odjava vodi na prijavu. Kancelarija: zahtev na spisku; potvrda blokirana dok
postoji stavka na upit; izmenjen predlog (provera cena 3.560,00) → kupac
potvrđuje → potvrda P-2026-00001 → broj iz BizniSofta → A4 štampa (PDF).
Opseg: Petar (dodeljen A) vidi zahtev, Jovan (B) ne vidi; kartica tuđeg kupca 403.

### B6 — original PDF

Original se **ne čuva** u oblaku: konektor šalje samo kanonske podatke
fakture, ručni upload čuva samo otisak (`source_documents.file_hash`). Original
postoji na KANC-01 (`Desktop\Fakture`) i u arhivi na Mac-u. Da bi kupac
preuzimao original potrebno je: konektor koji šalje i PDF, skladište fajlova
(cela arhiva PDF-ova ≈ 0,6–1,2 GB — više od besplatnog plana baze, verovatno trošak) i
provera da PDF pripada kupcu (otisak se već čuva, pa se može dokazati da je to
isti fajl). Do odluke: **prikaz za štampu označen „Pregled podataka iz
fakture — nije original dokumenta“**, samo sa podacima koje portal stvarno ima
(broj, datum, stavke, cene, rabat, iznosi, PDV); bez datuma dospeća (nije uvezen).

### Procena i stvarno vreme

Početna procena za pilot: **3–5 radnih dana programiranja** (obim posla, ne
kalendar). Kolona „obim“ je deo te procene koji je pokriven; „stvarno vreme“
je koliko je rad zaista trajao.

| Deo | Obim (od procene) | Stvarno vreme (11. 10.) |
|---|---|---|
| revizija, B1, B0, sintetička priprema | ~1 dan | ~10:15–11:25 |
| B8, B9, B7 | ~0,7 dana | ~11:25–12:00 |
| B3, B2, B6, B4, B5 | ~0,8 dana | ~12:00–12:30 |
| B10, B11 | ~0,3 dana | ~12:30–12:45 |
| spajanje sa #22, upit u pregledaču, kopija Production-a, postupak objave | — | ~13:00–13:30 |

Ukupno: obim ≈ 2,8 dana od procenjenih 3–5 je pokriven za ≈ 3,5 sata stvarnog
rada. Procena je bila u jedinicama posla čoveka-programera; ovde je posao
urađen brže, ali vreme čekanja (Vaše odluke, kancelarija, Vercel) nije
uračunato ni u jedno.

## Šta ostaje za pilot (posle ove serije)

1. **Objava** (Vaša potvrda): grana `fix/revizija-portala-2026-10-11` → PR ka firminom `main` → sveža proverena kopija baze → migracije 0045 (opozvane sesije) i 0046 (vrste obaveštenja) na Production → spajanje. Posle objave svi se jednom ponovo prijave (B8). Jednokratno zatvaranje zaglavljenog reda uvoza od 06. 10. (B2) — samo uz Vašu potvrdu.
2. **Vercel pristup**: sačuvani token je nevažeći; za proveru `DATABASE_POOL_MAX` i zastavica na Production-u potrebna je Vaša prijava (B0 je ispravljen u kodu bez obzira na vrednost).
3. **Odluke**: koje stvarne kupce uključiti u `ordering.trial`; da li uključiti `FEATURE_RECOMMENDATIONS` (na Production-u nema nijednog obračuna).
4. **Podaci iz kancelarije** (dok. 58): KANC-01 ručni ciklus, fakture od 09. 10., šifarnik, zalihe, otvorene stavke.

Pre produkcije (nije za pilot): jedinstven obračun cena u katalogu (C9/C10), e-pošta (trošak), uvoz šifarnika/zaliha/uplata posle uzoraka.
