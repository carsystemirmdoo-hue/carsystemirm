# R-M: vizuali sa Surventis Brand Portala (hub 51)

Datum pregleda i preuzimanja: 2026-09-28
Izvor: **Surventis Brand Portal**, `https://brand.surventiscoatings.com/hub/51`
(R-M hub). Media Library `/document/392`, Document Library `/document/393`,
Logo Library `/document/394`. Dozvola: dobavljač je odobrio upotrebu
zvaničnih R-M materijala na našem sajtu.

## Originali nisu deo repozitorijuma

- Originali su u `assets/manufacturer/rm/portal/<ID>__<originalni naziv>`.
  Folder je u `.gitignore` i van je `public/`, pa ne ulazi ni u Git, ni u
  bundle, ni u function trace.
- Produkcione WebP varijante su u `public/` i praćene su u Gitu. Sajt radi
  samo sa njima.
- `python3 scripts/build-rm-portal-assets.py` ponovo izvodi WebP fajlove i
  **zahteva lokalno preuzete originale**. Zajednička logika je u
  `scripts/brand_portal_assets.py`, istom modulu koji koristi i baslac skripta.
- Preuzimanje ide isključivo preko **Download → Download original** na
  portalu. CDN previewi su ponovo kompresovani i nisu originali.

## Obim pregleda

| Biblioteka | Asseta | Napomena |
|---|---:|---|
| Media Library (392) | 1993 | 12 kolekcija, najveća „All R-M Packshots“ (1287 u kolekciji, 789 u ovoj biblioteci). Godine: 2023: 1020, 2024: 532, 2025: 353, 2026: 88 |
| Document Library (393) | 10 | |
| Logo Library (394) | 90 | |

Vizuelno je pregledano oko 250 kandidata (kontakt-listovi u portalu). Svi
nazivi packshotova i ključne reči iz zadatka pretraženi su kroz API
biblioteke. Preuzeto je 6 originala, a 6 je upotrebljeno.

## Korišćeni asseti

Portal ni za jedan od ovih asseta ne navodi autora, copyright, licencu ni rok
(polja su prazna). Tržište i jezik nisu navedeni; slike nemaju ugrađen tekst,
osim zvaničnih natpisa na ambalaži i opremi.

| Portal ID | Naziv na portalu | Originalni fajl | Format, dimenzije, veličina | Na portalu od | Kolekcija / kontekst | Mesto na sajtu | Produkcioni fajl |
|---|---|---|---|---|---|---|---|
| 63938 | Xpeng | `Xpeng.jpeg` | JPEG 3060×4080 (EXIF rotacija, Samsung Galaxy A35), 3,3 MB | 2026-06-17 | bez kolekcije, serija 2026-06 | Refinity tok, korak 01 „Vozilo“ | `public/images/brands/rm/refinity/rm-refinity-step-01-vehicle.webp` (900×1125) |
| 76316 | ScanR_2 | `ScanR_2.jpeg` | JPEG 1200×1600, 122 KB | 2026-09-11 | bez kolekcije, serija 2026-09 | Refinity tok, korak 02 „ScanR“ | `…/rm-refinity-step-02-scanr.webp` |
| 50792 | Refinity_IMAGEPlus | `Refinity_IMAGEPlus.jpeg` | MPO/JPEG 4284×5712 (EXIF rotacija, iPhone 15 Plus), 4,2 MB | 2025-04-11 | bez kolekcije | Refinity tok, korak 03 „Refinity formula“ | `…/rm-refinity-step-03-formula.webp` |
| 41774 | R-M_AMM_picture_mixing machine (2) | `R-M_AMM_picture_mixing machine (2).jpeg` | JPEG 2480×1677, 194 KB | 2024-07-12 | „Automechanika 2024 RM“ | Refinity tok, korak 04 „Automatsko mešanje“ | `…/rm-refinity-step-04-mixing.webp` |
| 76311 | Finished-result | `Finished-result.jpeg` | JPEG 1200×1600, 484 KB | 2026-09-11 | bez kolekcije, serija 2026-09 | Refinity tok, korak 05 „Spremna boja“ | `…/rm-refinity-step-05-result.webp` |
| 30820 | R-M_1L_UNO HD | `R-M_1L_UNO HD.png` | PNG 1800×1800, RGBA (prava alfa), 1,2 MB | 2023-08-14 | „All R-M Packshots“ (duplikat: 34853) | Kataloški zapis `rm-uno-hd` (kartica, PDP, pretraga); brend stranica ga preuzima iz kataloga (pločica „UNO HD“ u „R-M sistemi“ i centralni proizvod galerije UNO HD) | `public/products/rm/supplied/rm__rm-uno-hd.webp` (1800×1800, WebP q92, alfa), upis u `data/catalog/image-supply/supplied-images.json` |

### Napomene po assetu

- **63938:** kadar je samo lakirani blatobran, retrovizor i ručka vrata.
  Točak sa znakom proizvođača vozila i natpisom gume je namerno van kadra.
- **50792:** na posteru u pozadini je sitan štampani natpis „A brand of BASF“.
  Motiv je rad na R-M Refinity stanici; natpis nije dominantan.
- **41774:** render mašine sa oznakama R-M i Refinity, sa sajma Automechanika
  2024. U 4:5 kadru se vidi središnji deo mašine; bočna ruka je van kadra.
- **76311:** prikazuje lakiran panel, ne posudu sa mešavinom. Zato je korak
  „Spremna boja“ ilustrovan rezultatom, a ne posudom.
- **30820:** generička sistemska limenka „UNO HD“, bez šifre nijanse.
  Štampani natpis „A brand of BASF – We create chemistry“ je deo ambalaže i
  ne menja se. Slika pripada sistemskom zapisu `rm-uno-hd`, ne nijednoj
  pojedinačnoj UNO HD stavci (SC T2A203 i dr. imaju svoje slike). Brend
  stranica nema svoju kopiju: ranija izvedenica
  `public/images/brands/rm/products/uno-hd/rm-uno-hd-1l-system.webp` se više
  ne pravi (`scripts/build-rm-portal-assets.py` izvodi samo Refinity korake).

## Odbačeno posle pregleda

| Portal ID | Naziv | Razlog |
|---|---|---|
| 76315 | ScanR | Tehničarka nosi kombinezon sa velikim crvenim **3M** logom; 3M nije u našem programu. Za ScanR korak je izabran 76316 |
| 34853 | R-M_1L_UNO HD | Duplikat asseta 30820 (isti fajl, druga evidencija portala) |
| 76310, 76312, 76324 | Prep_paint, Products_used, Refinity | Ista serija iz septembra 2026, ali 50792 bolje prikazuje Refinity stanicu. 76312 prikazuje otvorene limenke i pištolj, a ne korak toka |
| 39129–39143, 39754–39758 | AGILIS VPU key visuals / Teams BG | Kvalitetni (8000–8858 px), ali to su druge kompozicije od sadašnjih hero slajdova. Zamena hero dizajna nije bila tražena. Originali sadašnjih hero slika na portalu nisu pronađeni |
| 46981–46983, 47221–47226 | RM New Imagery 2025 | Konceptualni vizuali (automobil u šumi, u kanjonu), bez veze sa sekcijama stranice |
| 48461–48492 | Serlap DIAMONT (Meksiko) | Događaj sa 3M i BASF banerima u kadru |
| 52901–52917 | CESVI sajam | Velike stare BASF korporativne oznake |
| 37679–37765 | serije \_D0A / \_DSF (2023) | Detalji restomod automobila i kamioneta sa Ford oznakama; nisu R-M proces |
| 38xxx–59xxx | F1 (Sauber) i DTM (Emil Frey) | Motorsport. Partnerski blok već ima sliku Emil Frey Racing |
| 34850, 36807 | CRYSTAL BASE packshotovi | CRYSTAL BASE **nije u aktivnom R-M programu** (vidi Kontradikcije) |

## Sezonski R-M materijal (evidentirano, nije pripremljeno)

Sve je vezano za jednu kampanju ili godinu, pa bi kao generički mogao da se
koristi tek uz izričitu potvrdu dobavljača (`campaign-only`, vidi
`docs/SEASONAL_CAMPAIGNS.md`). Produkcija ostaje neutralna.

| Portal ID | Naziv | Sezona / dokaz |
|---|---|---|
| 59701–59703 | Happy New Year 2026 | Nova godina 2025/26; godina je u nazivu |
| 45555–45565 | R-M_SoMe_2024-12_Happy_Holidays / 2025-01_New_Year (No_Copy varijante) | Praznici 2024/25 |
| 45073–45075 | R-M_Key_Visual_Christmas_2024_A5_01–03 | Božić 2024; godina je u nazivu |
| 45085–45089 | R-M_SoMe_2024_Christmas / Happy_holidays | Božić 2024 |
| 36355–36358 | R-M_Press_Advertisement_Christmas_2023 | Božić 2023 |
| 62364, 62739 | R-M Happy Easter 4:5, TEAMS BACKGROUND RM EASTER | Uskrs 2026 |
| 38900 | R-M_SoMe_2024-03_Easter | Uskrs 2024 |

R-M sezonski slajd trenutno ne postoji. Zajednički sezonski sistem
(`lib/seasonal`) se po potrebi proširuje, ne pravi se drugi.

## Kontradikcije i ograničenja (evidentirano, ništa nije menjano)

1. **CRYSTAL BASE:** brend stranica ga prikazuje kao sistem („R-M sistemi“,
   galerija) i kao grupu „Specijalni efektni proizvodi“. U aktivnom R-M
   katalogu na `main` (`data/rm-catalog-products.generated.json`, 159 stavki)
   nema nijedne CRYSTAL BASE stavke. Portal ima zvanične CRYSTAL BASE
   packshotove, ali ih prema pravilu aktivnog programa ne koristimo. Treba
   odlučiti da li CRYSTAL BASE ostaje na stranici.
2. **Katalog pipeline:** UNO HD 30820 je uvezen kroz katalog pipeline
   (`supplied-images.json`, `sourceBasis: SUPPLIER_BRAND_PORTAL`). Brend stranica
   grupiše zapise R-M sinhronizacije kroz namensku klasifikaciju
   (`lib/rmBrandClassification.mjs`, `lib/rm-brand-classification.ts`) koja ne
   menja kataloški zapis: `rmMetadata` sync zapisa, SEO, breadcrumb, pravilo boje
   i pretraga ostaju kakvi su na `main`. Globalna migracija čeka posebno odobrenje.
3. **Hero mobilni kadrovi** (`docs/RM_IMAGE_REQUIREMENTS.md`, RM-HERO-01M do
   04M, „NEEDS MOBILE CROP“): originali sadašnjih hero slika nisu na portalu,
   pa namenski 4:5 kadrovi nisu mogli da se izvedu.
