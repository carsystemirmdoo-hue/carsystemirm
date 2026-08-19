# CARSYSTEM — IZVEŠTAJ O PRIKUPLJANJU PODATAKA OD PROIZVOĐAČA

Datum: 2026-08-08
Grana: `recovery/pre-claude-2026-08-07`

**Status brenda: COMPLETE** za sve što zvanični izvor omogućava. Obrazloženje u §24.

---

## 1. Zvanični izvori

**Carsystem je brend kompanije Vosschemie GmbH** (`info@vosschemie.de`, Esinger Steinweg 50, Uetersen) — ne August Handel, kako je stajalo u ranijem izveštaju. Ispravljeno.

| Izvor | Vlasnik | Tip | Jezik | Pristup | Pokrivenost | Pouzdanost |
| --- | --- | --- | --- | --- | --- | --- |
| `carsystem.org` | Vosschemie | veb-sajt | DE (+EN/FR/NL/IT/ES) | HTTP | ceo katalog | visoka |
| `sitemap.xml?sitemap=products` | Vosschemie | XML sitemap | DE | HTTP | **465 URL-ova** | visoka — zvanični indeks |
| `sitemap.xml?sitemap=pages` | Vosschemie | XML sitemap | DE | HTTP | 9 stranica | visoka |
| `/produkte/detail/{kat}/{proizvod}` | Vosschemie | stranica proizvoda | DE | HTTP | 462 | visoka |
| `/fileadmin/products/datasheets/*.pdf` | Vosschemie | TDS | DE | direktan link | 243 | visoka |
| `/produkte/.../safetydatasheets/{art}/{LANG}` | Vosschemie | SDS endpoint | DE | AJAX + cHash | 264 | visoka |
| `/fileadmin/_processed_/*` | Vosschemie | slike | — | HTTP | 937 | visoka |
| `/kataloge` | Vosschemie | katalog PDF | više | HTTP | katalog 2025 | nije obrađen |

**Nije pronađeno:** API/JSON endpoint za proizvode, media/download centar, strukturirani podaci (JSON-LD) na stranicama proizvoda.

**Nije korišćeno:** nijedan distributerski ili prodajni izvor.

---

## 2–3. Katalog proizvođača

| Metrika | Vrednost |
| --- | ---: |
| Stranica proizvoda u sitemapu | 465 |
| — obrađeno | **462** |
| — izostavljeno | 3 (query-string unos bez slug-a, 2 duplikata) |
| Grešaka pri parsiranju | **0** |
| **Brojeva artikala (SKU)** | **1.066** |
| Kategorija | **10** |

| Kategorija | Proizvoda |
| --- | ---: |
| schleifen (brušenje) | 92 |
| lackieren (lakiranje) | 76 |
| finish (finiš/poliranje) | 59 |
| spachteln (kitovi) | 57 |
| lackierbedarf (lakirerski pribor) | 39 |
| kleben-beschichten (lepljenje) | 36 |
| abdecken (maskiranje) | 33 |
| arbeitsschutz (zaštita na radu) | 27 |
| reinigen (čišćenje) | 24 |
| werbemittel (reklamni materijal) | 19 |

Proizvođač na sajtu navodi „preko 2.000 proizvoda". Zvanični sitemap nabraja 462 stranice sa ukupno 1.066 brojeva artikala. Razlika je verovatno u tome što marketinška tvrdnja broji i varijante koje nemaju zasebnu stranicu.

---

## 4. Naši proizvodi i poklapanje

Naših **9** Carsystem zapisa.

| Pouzdanost | Broj |
| --- | ---: |
| `exact-code` (broj artikla) | 1 |
| `normalized-code` (F23 ↔ F.23) | 1 |
| `probable` | 1 |
| **`ambiguous`** | **6** |
| `unmatched` | **0** |
| **Primenjeno** | **2** |
| Traži pregled | **7** |

### Zašto je toliko višeznačno

Oblik problema je **obrnut u odnosu na Cosmos**. Tamo su naši zapisi bili pojedinačne nijanse, otprilike 1:1 sa zvaničnim. Ovde su naši zapisi **generički**:

| Naš zapis | Zvaničnih kandidata |
| --- | ---: |
| Carsystem F19 brusni diskovi | **5** (Finish 152 mm, Finish 77 mm, obični 150 mm, obični 77 mm, Soft) |
| Carsystem Git Multi Green | **3** |
| Carsystem zaštitno odelo | 7 zaštitnih odela u kategoriji |
| Carsystem Finish serija | 59 proizvoda u kategoriji |

Svođenje na jednog pobednika vezalo bi brojeve artikala i dokumente jedne varijante za zapis koji znači nešto šire.

### Jezička barijera — zabeležena, ne prećutana

Naši nazivi su na srpskom („zaštitno odelo"), proizvođačevi na nemačkom („Schutzanzug"). Poređenje po tokenima to ne može premostiti.

Prvi prolaz je takve zapise označio `unmatched`, što **tvrdi odsustvo** — a proizvođač ima 7 zaštitnih odela. Ispravljeno: takvi zapisi dobijaju kandidate iz odgovarajuće kategorije i status `ambiguous`, uz eksplicitnu napomenu da to nije dokaz odsustva.

**0 nepoklopljenih zapisa deli šifru sa kandidatom** (invarijanta prolazi).

---

## 5–8. Kandidati kod proizvođača

**460 zvaničnih Carsystem proizvoda nije u našoj ponudi.**

Svi nose `catalogStatus: manufacturer-catalog-candidate`. Nijedan nije označen kao dostupan, prodavan ili objavljen.

---

## 9–12. Dokumenti i slike

| Vrsta | Broj | Napomena |
| --- | ---: | --- |
| **TDS** (Technisches Merkblatt) | **243** | po proizvodu, direktan link |
| **SDS** (Sicherheitsdatenblatt) | **264** | po broju artikla, kroz endpoint |
| **UKUPNO dokumenata** | **507** | 207 MB |
| Nerazrešenih SDS endpointa | **0** | |
| **Zvaničnih slika** | **441** | 177 MB, sve sa dimenzijama |
| Duplikata slika po sadržaju | 0 | |
| Proizvoda bez sopstvene slike | 21 | |

### Throttling — i zašto brojevi nisu bili tačni iz prvog puta

SDS endpoint agresivno ograničava brzinu. Rezultati po pokušaju:

| Način | Razrešeno od 264 |
| --- | ---: |
| 3 paralelna radnika | 70 |
| 4 procesa istovremeno | 11 |
| serijski + backoff, prvi prolaz | 178 |
| **serijski + backoff, drugi prolaz** | **264** |

Prva verzija skripte je nerazrešene endpointe **tiho izbacivala** iz manifesta, zbog čega je 194 nedostajućih SDS izgledalo identično kao „SDS ne postoji". Ispravljeno: svaka neuspela stavka se beleži kao rupa sa razlogom.

Da sam stao na prvom rezultatu, izveštaj bi tvrdio 70 SDS umesto stvarnih 264.

### Klasifikacija dokumenata

TDS i SDS se vode odvojeno i nikada se ne mešaju. Klasifikacija dolazi iz mesta na zvaničnoj stranici gde je link pronađen, ne iz imena fajla. Svaki dokument nosi: proizvođač, izvorni URL, vreme preuzimanja, tip, jezik, reviziju (`v01` iz imena fajla), povezani proizvod/artikal i SHA256.

Preuzimanje odbija sve što nije PDF — soft-404 stranica zavedena kao TDS bila bi gora od dokumenta koji nedostaje.

---

## 13–17. Tvrdnje sa sajta proizvođača

**1.909 tvrdnji sa 426 od 462 proizvoda.**

Gramatika stranice je istražena **pre** pisanja parsera. Sekcije: `BESCHREIBUNG`, `EINSATZGEBIET`, `VORTEILE`, `ANWENDUNGSHINWEIS`.

| Polje | Broj | Kategorije |
| --- | ---: | --- |
| Namena (applicationArea) | 638 | sve |
| Prednost | 890 | sve |
| **Podloge** | **89** | sve |
| Boja | 99 | sve |
| Temperaturna otpornost | 42 | sve |
| Brušenje mokro/suvo | 34 | schleifen, spachteln, lackieren |
| Prelakiranje | 23 | lackieren, spachteln, kleben |
| **Broj obrtaja** | 23 | **finish, schleifen** |
| **Vrsta zrna** | 23 | **schleifen** |
| Sušenje | 20 | sve |
| **Hod (Hub)** | 18 | **finish, schleifen** |
| **PSA kategorija** | 5 | **arbeitsschutz** |
| Bez hromata/silikona | 3 | lackieren, spachteln |
| Upozorenja | 2 | sve |

### Kategorijske sheme — a ne nametanje lakirerskih polja

Katalog obuhvata boje, abrazive, alate, lepkove i zaštitnu opremu. Polja su vezana za kategorije: obrtaji i hod samo za alate, vrsta zrna samo za abrazive, PSA kategorija samo za zaštitu na radu, temperaturni opseg za lepljive trake. Traženje odnosa mešanja na brusnom disku dalo bi samo šum.

### Sekcija koja je zamalo izgubljena

`ANWENDUNGSHINWEIS` postoji na **140 stranica** i koristi `<p>`, dok ostale sekcije koriste `<ul>`. Prvi parser je tražio samo `<ul>` i tiho preskočio svih 140 — a upravo tu žive kategorijski podaci („Max. Umdrehungszahl pro Minute: 4.000") i reference na pribor.

### Negativne izjave

**1 negativna izjava o podlozi** je zabeležena sa očuvanim polaritetom. Validator proverava da svaka negativna tvrdnja ima negaciju u izvornoj rečenici.

### Porodica vs proizvod

| Nivo | Broj |
| --- | ---: |
| Tvrdnje na nivou kategorije | **0** |
| Tvrdnje specifične za proizvod | **1.213** |

Nula tvrdnji na nivou kategorije je tačan rezultat: kategorija „schleifen" ima 92 različita proizvoda i nijedna tvrdnja ne važi za svih 92. Pravilo nije olabavljeno da bi broj izgledao bolje.

---

## 18. Veze između proizvoda

**9 veza, sve eksplicitno navedene od proizvođača.**

| Tip | Broj |
| --- | ---: |
| `recommended-accessory` | 7 |
| `referenced-article` (tip nije naveden) | 2 |

Primer: *„Wir empfehlen die Verwendung mit dem Tape Off Tool (Art. Nr. 133.172)"*.

Nijedna veza nije izvedena iz blizine u katalogu, sličnosti naziva ili iste kategorije. Validator odbija svaku vezu sa `inferred: true`.

Dva slučaja gde priroda veze nije navedena ostaju `referenced-article` sa `requiresTyping: true` — čovek odlučuje šta su.

**Uhvaćena greška:** nemački složeni pojmovi ruše `\b` granice reči. „Anwendungs**empfehlung**" nije pogađalo `\bempfehlung\b`, pa je preporuka pribora pogrešno tipizirana kao varijanta.

---

## 19–20. Konflikti i greške izvora

| Tip | Broj |
| --- | ---: |
| Narušenih invarijanti | **0** |
| Višeznačnih lokalnih zapisa | 6 |
| Nerazrešenih SDS endpointa | **0** |
| Neslaganja šifre i naziva | 0 |
| Duplikata slika | 0 |

Za razliku od Cosmos-a (gde su 2 stranice imale naslov koji ne odgovara URL-u), Carsystem izvor je konzistentan.

---

## 21. Odluke koje čekaju stručnjaka

`docs/seo/EXPERT_REVIEW_CARSYSTEM.md` — 19 sekcija, na srpskom, organizovano po kategorijama umesto 462 pojedinačna pitanja.

| Odluka | Broj |
| --- | ---: |
| Naših zapisa za povezivanje | **7** |
| Kategorija kandidata za odluku o ponudi | **10** |
| Kandidata u tim kategorijama | 460 |

Naši proizvodi i kandidati su vizuelno i semantički razdvojeni u dva dela dokumenta.

---

## 22. Kompletnost dosijea

### NAŠI CARSYSTEM PROIZVODI (9)

| Kriterijum | Broj | Udeo |
| --- | ---: | ---: |
| Zvanična slika | 2 | 22% |
| Bar jedan TDS | 2 | 22% |
| SDS | **0** | 0% |
| Tvrdnje sa sajta | 2 | 22% |
| **Kompletan dosije** | **2** | **22%** |

Nisko jer je 7 od 9 zapisa višeznačno — dok se ne potvrdi na koji zvanični proizvod se odnose, ne mogu im se vezati ni dokumenti ni slike.

### CEO KATALOG PROIZVOĐAČA (460 kandidata)

| Kriterijum | Broj | Udeo |
| --- | ---: | ---: |
| Zvanična slika | **439** | 95% |
| TDS | 241 | 52% |
| SDS | 150 | 33% |
| Tvrdnje sa sajta | **424** | 92% |
| **Kompletan dosije** (slika + TDS + tvrdnje) | **225** | **49%** |

Razlika je poučna: katalog proizvođača je gotovo potpuno pokriven, dok su **naši** zapisi slabo pokriveni — jer nisu povezani, a ne jer podaci ne postoje.

---

## 23. Validacija

| Provera | Rezultat |
| --- | --- |
| `npm run typecheck` | ✓ |
| `npm run lint` | ✓ |
| `npm run build` | ✓ 954/954 |
| `npm run knowledge:validate` | ✓ sve prolazi |
| `npm run seo:validate` | ✓ 198 URL-ova, 0 grešaka |

### Invarijante

| Invarijanta | Rezultat |
| --- | ---: |
| Nijedna machine-extracted tvrdnja objavljiva | ✓ 0 |
| Nijedna sajt-tvrdnja označena kao TDS | ✓ 0 |
| Nepoklopljen zapis ne deli šifru sa kandidatom | ✓ 0 |
| Sve tvrdnje imaju proveniens | ✓ 0 bez izvora |
| Negativne tvrdnje čuvaju polaritet | ✓ 0 narušenih |
| Nijedna izvedena veza | ✓ 0 |
| Nijedan asset u `public/` | ✓ 0 |

### Test zaštite od curenja

549 markera × 832 stranice → **0 curenja**.

Negativni test: u izgrađeni HTML ubačena sintetička tvrdnja („Technisches Merkblatt — Temperaturbeständigkeit: -40°C bis 150°C"); validator ju je prijavio kao 2 greške, a nakon uklanjanja ponovo prošao.

### Napomena o jednom lažnom padu

Tokom rada je `seo:validate` jednom prijavio 82 greške i 0 sitemap URL-ova. Uzrok je bio serijski proces preuzimanja koji je zasićivao mašinu, pa test server nije stigao da se podigne — sitemap je sve vreme bio u build-u (17 KB). Ponovljeno posle završetka akvizicije: 198 URL-ova, 0 grešaka. **Nijedan validator nije oslabljen.**

---

## 24. Preostale rupe

| Rupa | Obim | Može li se rešiti iz zvaničnog izvora |
| --- | ---: | --- |
| Povezivanje 7 naših zapisa | 7 | **Ne** — traži poslovnu odluku; jezička barijera |
| Proizvodi bez TDS-a | 219 | **Ne** — abrazivi, maskiranje i zaštita ga nemaju |
| Artikli bez SDS-a | 802 od 1.066 | **Ne** — SDS postoji samo za hemijske proizvode |
| Proizvodi bez sopstvene slike | 21 | **Ne** — nemaju sliku imenovanu po broju artikla |
| Katalog PDF 2025 | 1 | **Da** — lociran, nije parsiran |
| EN/FR/NL/IT/ES verzije | 5 jezika | **Da** — nisu u sitemapu, traže zasebno otkrivanje |
| Tehničke vrednosti iz TDS PDF-ova | 243 dokumenta | **Da** — preuzeti, sadržaj nije parsiran |

### Zašto COMPLETE

Zvanični izvor je sistematski obrađen: sitemap iscrpljen, svih 462 stranice parsirano bez greške, svi TDS i SDS linkovi razrešeni i preuzeti, slike prikupljene, tvrdnje izvučene sa kategorijskim shemama, lokalni zapisi mapirani, kandidati odvojeni, proveniens sačuvan, rupe prijavljene.

**Nije SOURCE-LIMITED** — sitemap omogućava iscrpno nabrajanje i ono je izvršeno.

Tri stavke iz tabele su izvodljive ali nisu urađene u ovoj iteraciji: parsiranje sadržaja preuzetih TDS PDF-ova, katalog 2025 i jezičke verzije. To je proširenje dubine, ne rupa u pokrivenosti zvaničnog kataloga.

---

## Lekcije prenete iz Cosmos-a

| Lekcija | Primena kod Carsystem-a |
| --- | --- |
| Nema TDS ≠ nema podataka | 1.909 tvrdnji sa sajta, uključujući 219 proizvoda bez TDS-a |
| Ne pripisuj opis jedne varijante porodici | 0 tvrdnji na nivou kategorije — pravilo nije olabavljeno |
| Šifra ima prednost, ali uz dvostepenu pretragu | `ambiguous` umesto proizvoljnog pobednika |
| Sačuvaj negativne izjave | 1 negativna tvrdnja sa proverom polariteta |
| Beleži rupe, ne prećutkuj ih | 194 „nedostajućih" SDS ispalo je throttling |
