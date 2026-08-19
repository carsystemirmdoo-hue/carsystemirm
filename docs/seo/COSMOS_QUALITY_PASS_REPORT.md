# COSMOS LAC — IZVEŠTAJ O KONTROLI KVALITETA

Datum: 2026-08-08
Grana: `recovery/pre-claude-2026-08-07`

Ispravka sistemskih grešaka pre nego što se isti pipeline primeni na Carsystem.

---

## Glavna greška koja je ispravljena

Prethodni prolaz je izjednačio „nema TDS PDF-a" sa „nema tehničkih podataka" i u expert paketu ispisivao:

> PODLOGE: nije navedeno

To je bilo netačno. Zvanični Cosmos opisi eksplicitno navode podloge, temperaturnu otpornost, zaštitu od korozije, prekrivanje i drugo — samo u proznom obliku, a ne u tabeli.

**Rezultat ispravke: 3.323 tvrdnje sa sajta proizvođača, od kojih 867 o podlogama, na 221 proizvodu.**

Sve nose `sourceType: manufacturer-website` i strogo su odvojene od `manufacturer-technical-document` tvrdnji. Tvrdnja iz opisa je slabiji dokaz od tabele u tehničkom listu i nigde se ne predstavlja kao TDS podatak.

---

## PRE vs POSLE

| Metrika | PRE | POSLE |
| --- | ---: | ---: |
| Pouzdana poklapanja | 630 | **637** |
| — `exact-code` | 555 | 631 |
| — `exact-name` | 6 | 6 |
| — `normalized-code` | 69 | 0 |
| `probable` | 6 | **6** |
| `unmatched` | 106 | **99** |
| Traži pregled ukupno | 112 | **105** |
| Kandidati kod proizvođača | 56 | **54** |
| **Tvrdnje sa sajta proizvođača** | **0** | **3.323** |
| **Tvrdnje o podlogama** | **0** | **867** |
| — od toga „NIJE dozvoljeno" | 0 | **2** |
| Proizvoda sa podacima o podlozi | 0 | **221** |
| Tvrdnje na nivou porodice | 0¹ | **130** |
| Tvrdnje specifične za varijantu | 0¹ | **193** |
| Grupa sa samo jednim opisom | — | **29 od 68** |
| Poklapanja preko granice porodice | 0 | **2** |
| Neslaganja šifre/naziva kod proizvođača | 0² | **2** |
| Narušenih invarijanti | — | **0** |

¹ Prethodno je jedan „reprezentativni" opis pripisivan celoj porodici, bez provere da li stvarno važi za sve varijante.
² Nije se ni proveravalo.

---

## 1. Tvrdnje sa sajta proizvođača

Izvučeno konzervativno, samo eksplicitno navedeno, uz čuvanje izvorne rečenice.

| Tip tvrdnje | Broj |
| --- | ---: |
| Namena (applicationArea) | 903 |
| **Podloge** | **867** |
| Završnica | 738 |
| Trajnost / otpornost | 428 |
| Sušenje | 172 |
| Pokrivnost | 81 |
| Unutrašnja / spoljna upotreba | 52 |
| Zaštita od korozije | 35 |
| Temperaturna otpornost | 16 |
| Prekrivanje / prefarbavanje | 15 |
| Potreba za temeljnim slojem | 8 |
| Upozorenja | 8 |
| **UKUPNO** | **3.323** |

### Negativne izjave se čuvaju

Dve izjave su negativne i zabeležene su kao takve, ne kao podrška:

> „This top-quality primer is ideal for use on all surfaces **except plastic**."
> — Acrylic Primer & Filler 342 i 343

Čitanje samo reči „plastic" obrnulo bi značenje proizvođača. Ovo je jedina greška koja bi bila stvarno opasna.

### Dve lažno pozitivne ekstrakcije uhvaćene i uklonjene

1. **Naziv boje čitan kao podloga.** „Fast Acrylic Ral 7011 – **Iron Grey**" je davao tvrdnju da je proizvod za gvožđe. Rešeno tako što rečenica mora sadržati indikator podloge („suitable for", „surfaces", „application on") i što se naziv proizvoda uklanja iz rečenice pre poređenja. „all iron **surfaces**" kod High Heat i dalje prolazi.

2. **Preuska lista podloga.** Zahtev za rečju „surfaces" je propuštao legitimne nabrajanja tipa „Suitable for application on metal, wood, ceramics, stone, clay, glass, paper, and plastics". Rečnik je proširen tek pošto je kontekstna provera učinila to bezbednim.

---

## 2. Tvrdnje porodice vs varijante

Prethodno je opis jedne „reprezentativne" varijante pripisivan celoj grupi. Provera je pokazala da to ne stoji:

**Nijedna od 29 zvaničnih porodica nema identičan opis kroz sve varijante.**

Novo pravilo: tvrdnja je na nivou porodice samo ako je navode **sve** opisane varijante te grupe, i ako ih ima više od jedne.

| Rezultat | Broj |
| --- | ---: |
| Tvrdnje na nivou porodice | 130 |
| Tvrdnje specifične za varijantu | 193 |
| Grupa gde postoji samo jedan opis | 29 od 68 |

Za tih 29 grupa nijedna tvrdnja se ne pripisuje porodici; sve su označene kao `representativeOnly` i prikazane kao specifične za varijantu.

Primer razlike koju ovo hvata — Flame Orange (134 varijante):

- **na nivou porodice:** završnica „matte", otpornost na vremenske uslove, namena za umetnost i modele — navodi svih 134
- **specifično za varijantu:** „fast-paced graffiti action…" — navodi 133 od 134

Jedna varijanta odstupa, i to se sada vidi umesto da se izgubi.

---

## 3. Lažno negativni u matcheru

Uzrok: prvi prolaz je pretraživao samo porodicu koju implicira naša linija proizvoda, pa je neslaganje porodice blokiralo tačno poklapanje šifre.

| Slučaj | PRE | POSLE |
| --- | --- | --- |
| Brake Cleaner 750 | `unmatched` | **`exact-code`** → „Brake Cleaner - 750" |
| Carburetor Cleaner 751 | `unmatched` | **`exact-code`** → „Carburetor Cleaner - 751" |

Oba su kod proizvođača u porodici `automotive`, a kod nas u `Cleaners`.

### Međukorak koji je odbačen

Prvo rešenje je pretraživalo ceo katalog bez prioriteta porodice. To je popravilo Brake/Carburetor, ali je **uvelo lažno pozitivna poklapanja**: „Antichip 250 White" se vezao za Spray.Bike proizvod koji samo sadrži „250", a „Radiator Lacquer 403" za Flame Orange.

Konačno rešenje je dvostepeno: prvo očekivana porodica, pa tek ako tu nema upotrebljivog rezultata — ceo katalog. Gola brojčana šifra van očekivane porodice traži i jako poklapanje naziva.

Rezultat: 2 legitimna cross-family poklapanja, 0 lažno pozitivnih.

### Nerešeni slučajevi

| Grupa | Broj | Stanje |
| --- | ---: | --- |
| Molotow Premium | 66 | Ne postoje u zvaničnom Cosmos katalogu |
| Spray.Bike | 10 | Nije pronađen odgovarajući zapis |
| Molotow Burner | 7 | Ne postoje u zvaničnom katalogu |
| W Wood Care | 6 | Naši nazivi „Wood Care Varnish" vs zvanični „W Wood Impregnating Varnish" — bez šifre, naziv se previše razlikuje |
| Putties | 3 | Naši „Filler Iron Filler" vs zvanični „Metal Polyester Putty" |
| Ostalo | 7 | — |

W Wood Care i Putties ostaju za stručnjaka: poklapanje je verovatno, ali bez šifre ga sistem ne sme sam prihvatiti.

---

## 4. Neslaganje šifre i naziva kod proizvođača

Dva slučaja, oba proverena na živoj stranici:

| URL (šifra) | Naslov i H1 na stranici |
| --- | --- |
| `ral-9003-signal-white` | **Ral 9002 – Grey White** |
| `fast-acrylic-ral-8017-chocolate-brown` | **Fast Acrylic Ral 8011 – Nut Brown** |

Naslov, H1 i self-canonical se slažu međusobno, a ne slažu sa šifrom u URL-u.

**Klasifikacija: `source-site-error`** — greška na sajtu proizvođača, ne u našem parseru ni normalizaciji.

Izvorna istina je sačuvana u oba oblika. Podatak proizvođača nije „tiho ispravljen" — takva ispravka bi u naš skup unela vrednost koja kod njih nigde ne postoji.

---

## 5. Novi invarijanti u validatoru

| Invarijanta | Stanje |
| --- | ---: |
| Nepoklopljen lokalni proizvod ne sme deliti šifru sa kandidatom | **0 narušenja** |
| Neslaganje šifre/naziva mora biti klasifikovano | **0 neklasifikovanih** |
| Tvrdnja sa sajta ne sme imati sourceType tehničkog dokumenta | **0 pogrešno označenih** |
| Nijedna izvučena tvrdnja ne sme biti objavljiva | **0 objavljivih** |
| Tvrdnja na nivou porodice mora biti potvrđena na svim varijantama | **0 neispravnih** |
| Nijedan preuzeti asset u `public/` | **0** |

---

## 6. Expert paket

`EXPERT_REVIEW_COSMOS_LAC.md` je regenerisan. Po grupi sada prikazuje odvojeno:

- tabelu izvora: **PODACI SA SAJTA PROIZVOĐAČA / TDS / SDS** sa statusom svakog
- **ZVANIČNE ČINJENICE NA NIVOU PORODICE** (uz broj varijanti koje ih potvrđuju)
- **ČINJENICE SPECIFIČNE ZA VARIJANTU** (uz primere)
- **PODLOGE NAVEDENE NA ZVANIČNOJ STRANICI** — tabela sa statusom, brojem varijanti i izvornom rečenicom
- pokrivenost poklapanja i izvor

Više se nigde ne ispisuje „PODLOGE: nije navedeno" kada podaci postoje. Umesto toga stoji koliko ih ima, iz koje rečenice i koliko varijanti ih potvrđuje.

---

## 7. Validacija

| Provera | Rezultat |
| --- | --- |
| `npm run typecheck` | ✓ |
| `npm run lint` | ✓ |
| `npm run build` | ✓ 954/954 |
| `npm run knowledge:validate` | ✓ sve prolazi |
| `npm run seo:validate` | ✓ 0 grešaka |

Zaštita od curenja:

| Provera | Rezultat |
| --- | ---: |
| Cosmos tvrdnji (3.653) sa `expert-verified` | **0** |
| Cosmos opisa × stranica | 544 × 832 → **0 curenja** |
| baslac vrednosti × stranica | 19 × 832 → **0 curenja** |
| R-M markera × stranica | 12 × 832 → **0 curenja** |
| Preuzetih slika u `public/` | **0** |
| JSON-LD propusta | **0** |

Sitemap 198 URL-ova, ProductGroup konsolidacija netaknuta, PDP tekstovi i SEO metapodaci nepromenjeni.

---

## 8. Odluke koje čekaju stručnjaka

| Stavka | Broj |
| --- | ---: |
| Grupa proizvoda za potvrdu | 68 |
| Proizvoda sa nepouzdanim poklapanjem | 105 |
| — Molotow (verovatno pogrešan brend) | 73 |
| — ostalo | 32 |
| Kandidata kod proizvođača | 54 |
| Tvrdnji sa sajta za potvrdu | 3.323 |
| — od toga o podlogama | 867 |
| Neslaganja kod proizvođača za tumačenje | 2 |

---

## Šta ovo menja za Carsystem

Tri pravila koja se prenose na sledeći brend:

1. **Prvo pročitati opise, pa tek onda zaključiti da nema tehničkih podataka.** Odsustvo TDS-a nije odsustvo podataka.
2. **Ne pripisivati opis jedne varijante celoj porodici** bez provere da važi za sve.
3. **Poklapanje po šifri ima prednost nad porodicom, ali uz dvostepenu pretragu** — inače gola brojčana šifra pravi lažno pozitivna poklapanja kroz porodice.
