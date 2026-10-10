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

**Šta je potrebno za uvoz šifarnika (još ne postoji uzorak).** Format izvoza se ne izmišlja: potreban je jedan stvarni izvoz šifarnika iz BizniSofta (bilo koji format koji BizniSoft daje — XLSX, CSV ili PDF izveštaj). Obavezna polja po stavci: šifra (tekst, kao u BizniSoftu), naziv, jedinica mere (KOM, LIT, KT…). Poželjno: grupa artikla, stopa PDV-a, količina u pakovanju ako je BizniSoft vodi. Uvoznik se piše tek prema tom uzorku; do tada nepovezane šifre ostaju bez cene, a nejasni nazivi (ista šifra, drugi naziv) ostaju na pregledu.

## Obračun: osnovna cena → rabat → neto → PDV → ukupno

Obračun je u `lib/pricing/money.mjs` i ponavlja BizniSoft fakturu (provereno na svim fakturama 2021–2026):

- iznos stavke = količina × osnovna cena × (1 − rabat/100), tačno decimalno, zaokruženo na paru; **tačna polovina pare naniže** (kao BizniSoft);
- PDV se računa po stavci (iznos stavke × stopa, polovina naviše) i sabira; ukupno = neto + PDV;
- „Vaša cena“ po jedinici = isti obračun za količinu 1.

Rabat se uzima po kupcu i artiklu: isti artikal ima različitu cenu za različite kupce. Upit cene uvek traži kupca (`customerPrices` odbija upit bez `customer_id`), pa kupac ne može dobiti tuđi rabat. Nabavna cena, zaliha i marža se ne čuvaju i ne prikazuju nigde.

## Pakovanje: cena po jedinici mere nije cena pakovanja

Osnovna cena važi za BizniSoft jedinicu mere. Primer: lak „… 4L“ sa JM = LIT ima cenu **po litru**; faktura obračunava 4 (ili 12) litara. Cena litra se ne prikazuje kao cena limenke.

Cena pakovanja (`lib/pricing/packPrice.mjs`) se računa samo kada je:

| Uslov | Zašto |
|---|---|
| veza artikla sa katalogom potvrđena | tek tada se zna koje pakovanje kupac kupuje |
| JM = KOM/KT i na fakturama nema necelih količina | pakovanje = 1 komad |
| JM = LIT (ili druga mera) i postoji **potvrđena** količina pakovanja | mera u nazivu („4L“) je samo trag, ne potvrda |

Inače je obračun pakovanja blokiran i ekran kaže šta nedostaje. Dok veze sa katalogom ne budu potvrđene, kupac vidi cenu po jedinici mere sa jasnom oznakom jedinice.

## Pokrivenost rabata i grupni predlozi (`/portal/cene/rabati-iz-faktura/predlozi`)

Model `rabati-v2` (`lib/pricing/rebateCoverage.mjs`) gleda CELU istoriju kupca. Merenje na fakturama: na 88 % faktura jedan brend dobija isti rabat na celom računu, a 82 % ponovljenih parova kupac–artikal ima uvek isti rabat. Zato par ne pada samo zato što taj artikal nema tri kupovine — ako ga drugi, nezavisni dokazi istog kupca pouzdano potvrđuju.

| Ishod | Kada |
|---|---|
| odobreno | postoji odobreno pravilo — ne prepisuje se |
| direktno | poslednje dve kupovine TOG artikla (u 2 godine, poslednja u 12 meseci) sa istim rabatom |
| izvedeno | porodica kupca dokazana DRUGIM artiklima (bez samog para) |
| nejasno | sve ostalo, sa razlogom — ručni pregled |
| van programa | artikal nije u ponudi; istorija ostaje |

**Porodica** — naziv daje samo kandidata (brend, ili brend + linija); važi tek kada je kupac dokaže: ≥ 3 različita artikla, ≥ 3 dana kupovine, ≥ 90 % stavki sa istim rabatom u poslednjih 6 (najviše 12) meseci, bez promene uslova u toku i bez većine odobrenih pravila protiv. **Akcija** (više artikala porodice na jednoj fakturi sa drugim rabatom) ne menja uslov, ako je retka. **Izuzetak** artikla važi samo kada je istovremen sa uslovom porodice; starije odstupanje je stari uslov. Prva reč naziva ili jedan opšti rabat kupca sami nikad nisu dokaz.

**Podela:** aktuelno (kupac sa fakturom u 12 meseci, artikal u programu i prodavan u 12 meseci, par kupljen u 12 meseci), retko (isto, ali par kupljen ranije), istorijsko (sve ostalo). Grupe se prave samo za aktuelno i retko.

**Grupno odobravanje:** jedan potez po grupi kupac × porodica (ili sve grupe kupca). Server ponovo računa dokaz i prihvata samo artikle koji su i dalje u grupi sa istim procentom. Vlasnik dobija odobrena pravila sa oznakom serije `rabati-v2-…` (opoziv kao serija); predlagač šalje predloge na odobrenje. Komercijalista vidi samo svoje kupce.

## Program artikla (0040)

Prisustvo šifre u lageru, cenovniku ili staroj fakturi NIJE odluka da je artikal u ponudi. Odluka „van programa“ (`article_programme_decisions`, samo dodavanje, važi poslednja; samo vlasnik) znači: istorija (fakture, osnovne cene, pravila) ostaje, ali artikal nema cenu kupca (`van_ponude`), ne poručuje se (`not_in_programme`), ne preporučuje se i ne ulazi u predloge rabata. 3M, sia i Molotow nisu u aktuelnom programu.

## Promena rabata kupca (0041)

Na strani kupca (`/portal/cene/rabati-iz-faktura/kupci/[id]`, panel „Promena rabata“): **jedan artikal**, **potvrđena grupa** (porodica koju fakture tog kupca dokazuju — jasno označena kao izvedena, sa pregledom članstva) ili **više izabranih artikala**.

1. **Pregled** pre slanja: svaki obuhvaćeni artikal, šta sada važi (procenat, poreklo, od kada), poslednja faktura, novi rabat i radnja (novo / zamena / bez promene / izuzetak / čeka odluku).
2. **Izuzeci:** pravilo artikla koje odstupa od dosadašnjeg uslova grupe je pojedinačni dogovor — grupna promena ga NE menja, osim ako se izričito uključi. Već zakazana promena i predlog na čekanju se ne preklapaju.
3. **Slanje:** obrazloženje (10–800 znakova) i datum početka (ne u prošlosti). Server ponovo računa pregled i odbija ako se stanje promenilo.
4. **Zamena bez sukoba:** predlog nosi `replaces_rule_id`; do odobrenja važi staro pravilo, a odobrenje zatvara staro dan pre početka novog (u istoj transakciji, sa tragom). Za isti par najviše jedan predlog čeka odluku (jedinstveni indeks) — ponovljeno slanje se odbija.
5. **Odobravanje:** komercijalistin predlog ne menja cenu dok vlasnik ne odobri; vlasnik može odobriti odmah, a pakete predloga odobrava ili odbija jednim potezom u „Odobravanju cena“.

Dozvole (provera na serveru): predlaže `prices:propose` (paket `cene_predlog`) samo za kupce u opsegu — dodeljene, ili sve uz `analitika`; odobrava `prices:approve` (vlasnik); kancelarija vidi, ne predlaže. Fakture i BizniSoft se ne menjaju.

## Poseban poslovni status kupca (0042)

Vlasnik na strani kupca označava status (samo dodavanje, važi poslednji; istorija i ranija pravila ostaju):

| Status | Posledica |
|---|---|
| van pripreme za portal | nema naloga (provera na serveru pri predlogu kontakta, grupnom uvozu i pozivu), nema automatskog formiranja cena — npr. kupac preko koga se fakturišu tuđe kupovine |
| kompenzacija | uslovi zavise od međusobnog prebijanja — samo ručni pregled |
| retka saradnja | novi uslovi ostaju prazni, nalog se ne priprema |
| uslovi plaćanja | rabat zavisi od roka plaćanja — uslovi odvojeno, za potvrdu |
| poseban dogovor | individualni dogovor — ručni pregled |

Za sve posebne statuse: nema direktnih/izvedenih predloga ni izvedenih grupa; ranije odobrena pravila se prikazuju kao „poseban slučaj za odluku“ i ne brišu se. Iz uslova posebnih kupaca ništa se ne izvodi ni za njih ni za druge kupce. Pokrivenost se prikazuje odvojeno: svi kupci · kupci koje pripremamo za portal · posebni računi — izdvajanje menja osnovicu procenta, nije novootkriven rabat.

## Rabat uslovljen rokom plaćanja (0042)

`price_rules.payment_condition`: prazno = podrazumevani rabat; `kratak_rok` = važi SAMO kada kupac izabere i ispuni kratak rok (do 7 dana). Uslov je deo opsega, pa uslovno i bezuslovno pravilo istog artikla nisu sukob; zamena i „jedan predlog na čekanju“ važe posebno po uslovu. Bez izabranog uslova uslovno pravilo se ne primenjuje — jači rabat nikad nije podrazumevan; uži opseg (artikal) i dalje pobeđuje širi.

Rok sa fakture (dospeće − datum prometa) je UGOVORENI rok, ne dokaz avansa ni naplate; uslov izveden iz roka je „za potvrdu“. Model (`paymentTermSplit`) izdvaja fakture sa kratkim rokom iz dokaza podrazumevanog rabata kada kod istog brenda dosledno daju drugi rabat. Datum dospeća portal još ne čuva (nalazi se samo u PDF-u fakture): za automatsku primenu treba ga čitati pri uvozu (konektor/parser) i dopuniti istoriju — posebna odluka.
