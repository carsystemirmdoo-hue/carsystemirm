# 52 — Cenovnik: osnovne cene iz BizniSofta

Uputstvo za vlasnika (gazda). Ovaj dokument ne sadrži cene.

## Tri različite stvari

| Pojam | Gde se vodi | Ko menja |
|---|---|---|
| **Osnovna cena** (VP cena bez PDV-a) | Cene → **Cenovnik** | samo gazda: otpremanje cenovnika ili pojedinačna izmena |
| **Rabat kupca** | Cene i rabati (pravila) | postojeći tok predloga i odobrenja |
| **Konačna cena** | izračunava se: osnovna × (1 − rabat), ili fiksna neto cena iz pravila | ne unosi se ručno |

Novi cenovnik **ne menja** izdate fakture ni dogovorene rabate.

## Novi cenovnik — tri koraka

1. **Otpremanje.** U BizniSoftu odštampajte u PDF izveštaj **„Stanje zaliha – nabavna i VP cena“** (isti kao 09.10.2026). Portal → Finansije → **Cenovnik** → „Otpremite na pregled“.
   - Čita se samo šifra, naziv, PDV i VP cena. Nabavna cena, stanje i marža se **ne čuvaju**.
   - Drugačiji PDF (drugi izveštaj, nedostaje strana, drugačije kolone) se **odbija sa porukom** i ništa se ne upisuje.
   - Isti fajl otpremljen ponovo samo otvara postojeći pregled — nema duplikata.
2. **Pregled.** Pre bilo kakve izmene vidite:
   - šta PDF sadrži (izveštaj, datum stanja, broj strana i stavki, PDV) i da li se **zbir VP vrednosti slaže** — ako se ne slaže, primena je zaključana;
   - **promene**: važeća → nova osnovna cena, sa označenim velikim promenama (> 30 %);
   - **nejasno**: ista šifra, a bitno drugačiji naziv — podrazumevano se **ne primenjuje**; označite pojedinačno samo ono za šta ste sigurni da je ista roba;
   - **nepovezano**: šifra ne postoji u portalu (artikal još nije fakturisan) — ne primenjuje se;
   - **duplikati i greške** — ne primenjuju se;
   - **probni obračun**: osnovna cena + odobreni rabati za kupce i artikle iz poslednjih 6 meseci, upoređeno sa poslednjom fakturom.
3. **Potvrda.** Izaberite **„Važi od“** i potvrdite. Datum u nazivu fajla i „Na dan“ iz izveštaja su datum **stanja**, ne početak važenja — datum birate vi (ne ranije od datuma stanja). Upis traži prijavu sa drugim faktorom u poslednjih 10 minuta.

**PDV i valuta.** VP cena je **bez PDV-a** — potvrđeno na izdatim fakturama (jedinična cena na fakturi = VP cena, PDV 20 % se obračunava posebno). **Valuta nije navedena** ni u cenovniku ni na fakturama (reč „valuta“ na fakturi je datum dospeća); portal podrazumeva RSD, a potvrda je deo vaše potvrde pri primeni.

Ili **Odbacite** cenovnik uz razlog — ostaje u istoriji, cene se ne menjaju.

## Pojedinačna izmena osnovne cene

Cenovnik → „Pojedinačna izmena osnovne cene“: šifra, nova cena, „važi od“ i **obrazloženje** (obavezno). Prethodna cena ostaje u istoriji; „Istorija osnovne cene artikla“ prikazuje sve verzije, izvor i ko ih je uneo.

## Šta sistem garantuje

- Samo gazda (`pricelist:manage`); provera je na serveru za svaku radnju, ne samo skriveno dugme.
- Svaka verzija cenovnika ostaje: fajl (otisak), šta je pročitano, ko je otpremio, ko je i od kada primenio, ili zašto je odbačen. Podaci otpremanja i istorija cena se ne mogu menjati ni brisati (zaštita u bazi).
- Važeća osnovna cena na dan D = poslednja verzija koja važi od datuma ≤ D. Ranija verzija važi do početka sledeće.
- Trag svake radnje je u Aktivnostima.

## Cena kupcu: potvrđen rabat ≠ nepoznat rabat

Konačna cena se kupcu prikazuje SAMO kada postoji potvrđen uslov:

| Stanje | Šta kupac vidi |
|---|---|
| odobren rabat X % (i izričito **0 %**) ili fiksna neto cena | cenu: osnovna × (1 − X) ili fiksnu cenu, sa osnovom („ugovoreni rabat 0 %“) |
| nema odobrenog pravila za kupca i artikal | **„Cena na upit“** — zahtev ide komercijalisti dodeljenom kupcu |
| pravila u sukobu | „Cena na upit“ dok ih čovek ne razreši |
| rabat postoji, ali artikal nema važeću osnovnu cenu | „Cena na upit“ |

Puna osnovna (VP) cena se nikad ne prikazuje kao dogovorena cena kupca samo zato što rabat nije pronađen. Pravilo je u `lib/pricing/customerPrice.mjs` (stvarni model) i u `orderabilityProblem` (`rebate_unknown`) za poručivanje.

## Nove šifre (nepovezane) — dodavanje artikla iz potvrđenog izvora

Šifra iz cenovnika koja ne postoji u portalu NE dobija cenu i NE pravi se ručno iz naziva u cenovniku (cenovnik nema jedinicu mere, a naziv nije poslovni identitet). Artikal nastaje samo iz potvrđenog BizniSoft izvora:

1. **Automatski, prvom fakturom.** Kada BizniSoft izda prvu fakturu za šifru, konektor je donosi sa šifrom, nazivom i jedinicom mere; artikal tada postoji u portalu. Sledeći cenovnik ga povezuje sam (ili se pojedinačna osnovna cena unese ručno, sa obrazloženjem).
2. **Ranije, kada artikal treba kupcima pre prve fakture.** Kancelarija iz BizniSofta izveze **šifarnik artikala** (šifra, naziv, jedinica mere, grupa). Uvoz šifarnika ide istim putem kao cenovnik: otpremanje → pregled (nove šifre, promene naziva, bez jedinice mere = greška) → potvrda gazde. Do tada nepovezane šifre ostaju na spisku u pregledu cenovnika.
3. Osnovna cena za novu šifru upisuje se tek kada artikal postoji: primenom sledećeg cenovnika ili pojedinačnom izmenom.
