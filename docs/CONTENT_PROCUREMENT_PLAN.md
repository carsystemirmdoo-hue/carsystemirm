# CONTENT PROCUREMENT PLAN

**Izvor istine:** [`docs/CONTENT_ASSET_GAP_AUDIT.md`](CONTENT_ASSET_GAP_AUDIT.md)
**Datum:** 2026-08-08
**Svrha:** izvršna lista po kojoj se sadržaj pribavlja stavku po stavku. Bez izmena koda, bez pomeranja fajlova, bez ponovnog audita.

> **Jedna ispravka iz audita.** Audit navodi 44 marke automobila u `rmCompatibleBrands`. Preciznim prebrojavanjem unosa niza `rmCompatibleBrandNames` dobija se **43**. Spisak u §6 je tačan i konačan.

---

## 0. PRAVILO KOJE VAŽI ZA CEO DOKUMENT

Ništa nije premešteno u `public/`. Nijedan `published: false` nije menjan. Ovo je **inventory i plan**, ne izvršenje.

U repozitorijumu **ne postoji nijedan licencni, rights ni copyright fajl** — proveravano na svim nivoima do dubine 3, van `node_modules`. Zato svaki staged asset u §2 nosi status:

> `REQUIRES RIGHTS CONFIRMATION`

To nije formalnost. `assets/manufacturer/` sadrži materijal preuzet sa `carsystem.org`, `carfitrepair.com` i `cosmoslac.com`. Pravo na javno objavljivanje **ne može se potvrditi iz repozitorijuma** i mora doći od Vosschemie GmbH, August Handel GmbH i Cosmos Lac S.A. Dok to ne postoji, nijedan staged fajl ne sme na sajt.

---

# 1. P0 — NEW PHOTOGRAPHY / APPLICATION

Fotografije koje **stvarno nemamo nigde** — ni u `public/`, ni u stagingu. Staging sadrži isključivo packshotove, pa se nijedna od ovih potreba ne može zatvoriti postojećim materijalom.

Ukupno **P0 novih fotografija: 12 fajlova** (od kojih 3 zahtevaju zaseban mobilni fajl, već uračunato).

---

## 1.1 — CARSYSTEM WORKFLOW SERIJA (4 fajla)

| | |
| --- | --- |
| **Brand** | Carsystem |
| **Stranica** | `/brendovi/carsystem` |
| **Sekcija** | Workflow story |
| **Filename** | `carsystem-workflow-damage.webp`, `-prepared.webp`, `-painted.webp`, `-finished.webp` |
| **Desktop ratio** | 4:3 |
| **Mobile** | `SAME ASSET OK` |
| **Min rezolucija** | 1200×900 |
| **Idealna** | 1800×1350 |

**TAČAN SADRŽAJ — sva četiri kadra su ISTI PANEL ISTOG VOZILA:**

1. **damage** — zadnja leva vrata tamnog vozila sa jasnom udubinom i oštećenim lakom. Ivice oštećenja moraju hvatati svetlo da se deformacija čita.
2. **prepared** — isti panel, obrušen i kitovan. Vidi se sivo-zelena zona gita i stepenasti prelaz brušenja ka originalnom laku.
3. **painted** — isti panel sa nanetim slojem, površina još mat, maskirna traka i dalje na ivicama panela.
4. **finished** — isti panel, maska skinuta, pun sjaj, čist linijski odsjaj rasvete radionice u laku.

**KADAR I KOMPOZICIJA:** panel popunjava centralnih 70% kadra, identično uokviren u sva četiri kadra.

**MORA BITI VIDLJIVO:** ista referentna tačka u sva 4 kadra (ivica vrata, ručica, ili spoj sa blatobranom) — bez nje sekvenca ne čita kao isti panel.

**NE TREBA DA BUDE VIDLJIVO:** alat, ruke, ljudi, brendirana pakovanja. Ovo je dokaz procesa, ne reklama.

**PROSTOR ZA COPY:** nije potreban — tekst ide ispod slike u kartici.

---

## 1.2 — CARSYSTEM HERO: PREPARATION (2 fajla)

| | |
| --- | --- |
| **Brand** | Carsystem |
| **Sekcija** | Hero, varijanta `prepare` |
| **Filename** | `carsystem-hero-preparation.webp` + `carsystem-hero-preparation-mobile.webp` |
| **Desktop ratio** | 3:2 · min 1800×1200 · ideal 2600×1734 |
| **Mobile** | `SEPARATE MOBILE IMAGE REQUIRED` — 900×1125, portret 4:5 |

**TAČAN SADRŽAJ:** profesionalni autolakirer brusi ekscentričnom brusilicom prednji blatobran tamnog vozila. Površina je delimično obrušena — vidi se prelaz između originalnog laka i pripremljene zone sa jasnim tragom brušenja. Ruke i podlaktice u radnom odelu u kadru, lice nije potrebno. Brusni disk vidljiv u kontaktu sa površinom.

**KOMPOZICIJA:** subjekt (ruka + brusilica + panel) u desnoj polovini, od ~50% do ~90% širine. Horizont brušene površine u donjoj trećini.

**MORA BITI VIDLJIVO:** trag brušenja i prelaz zona — to je ono što blok tvrdi.

**NE TREBA DA BUDE VIDLJIVO:** lice, konkurentska pakovanja, nered.

**PROSTOR ZA COPY:** **leva trećina ostaje mirna i tamna**, bez detalja. Tu idu eyebrow i naslov. Na mobilnom: gornja polovina prazna.

---

## 1.3 — CARSYSTEM HERO: PAINTING (2 fajla)

| | |
| --- | --- |
| **Filename** | `carsystem-hero-painting.webp` + `-mobile.webp` |
| **Ratio / rez.** | 3:2 · min 1800×1200 · ideal 2600×1734 · mobile 900×1125 |

**TAČAN SADRŽAJ:** maskirano vozilo u lakirnoj kabini, lakirer u belom zaštitnom odelu i maski nanosi sloj pištoljem. Vidi se oštra linija maskirne trake i folija preko susednih panela. Ravnomerno kabinsko osvetljenje odozgo.

**KOMPOZICIJA:** lakirer i pištolj desno od centra, vozilo se pruža ka levoj ivici.

**MORA BITI VIDLJIVO:** čista granica maskiranja, kontrolisan mlaz.

**NE TREBA DA BUDE VIDLJIVO:** oblak prekomernog raspršivanja koji zamagljuje kadar, konkurentski logotipi na opremi.

**PROSTOR ZA COPY:** leva trećina.

---

## 1.4 — CARSYSTEM HERO: FINISHING (2 fajla)

| | |
| --- | --- |
| **Filename** | `carsystem-hero-finishing.webp` + `-mobile.webp` |
| **Ratio / rez.** | 3:2 · min 1800×1200 · ideal 2600×1734 · mobile 900×1125 |

**TAČAN SADRŽAJ:** ruka u rukavici vodi rotacionu polirku po tamnom, već lakiranom panelu. U laku se ogleda linijska rasveta radionice. Polirni pad vidljiv u kontaktu sa površinom, blagi trag paste na ivici zone.

**KOMPOZICIJA:** polirka i ruka desno, odsjaj rasvete se pruža dijagonalno ka gornjem levom uglu.

**MORA BITI VIDLJIVO:** dubina sjaja i čist odsjaj — to je poenta faze.

**NE TREBA DA BUDE VIDLJIVO:** holograma i tragova korekcije u laku, lice.

**PROSTOR ZA COPY:** leva trećina.

---

## 1.5 — CARSYSTEM PROCESS (3 fajla)

| | |
| --- | --- |
| **Filename** | `carsystem-process-preparation.webp`, `-application.webp`, `-finish.webp` |
| **Ratio / rez.** | 32:21 · min 1600×1050 · ideal 2400×1575 |
| **Mobile** | `SAME ASSET OK` |

**TAČAN SADRŽAJ — tri šira, kontekstualna kadra istih faza kao hero, ali NE isti kadar:**

- **preparation:** radni sto sa brusnim diskovima u lepezi, kutijom gita i špahtlom; u dubini van fokusa vozilo u pripremi.
- **application:** deo kabine sa maskiranim vozilom, pištolj odložen na stalak, folija i traka u prednjem planu.
- **finish:** polirni padovi i mikrofiber krpe na stolu, iza njih završen panel sa odsjajem.

**MORA BITI VIDLJIVO:** materijal i alat koji odgovaraju fazi.

**NE TREBA DA BUDE VIDLJIVO:** ljudi u prvom planu — ovo su kadrovi o materijalu, hero kadrovi su o radu. Ta razlika sprečava da stranica deluje kao ponavljanje.

**PROSTOR ZA COPY:** nije kritičan, blok ima zaseban tekstualni deo.

---

## 1.6 — BASLAC HERO #1: SISTEM (2 fajla)

| | |
| --- | --- |
| **Brand** | baslac |
| **Sekcija** | Hero 1 |
| **Filename** | `baslac-system-desktop.webp` + `baslac-system-mobile.webp` |
| **Ratio / rez.** | 40:27 · min 1600×1080 · ideal 2400×1620 · mobile 900×1080 |

**TAČAN SADRŽAJ:** organizovana kompozicija baslac sistema na tamnoj radnoj površini — 5–7 limenki i kanti različitih veličina (bazna boja, bezbojni lak, prajmer, učvršćivač, razređivač) raspoređenih u blagom luku, kao sistem a ne kao gomila. Etikete okrenute ka kameri i čitljive.

**MORA BITI VIDLJIVO:** baslac etikete — one su glavni sadržaj kadra.

**NE TREBA DA BUDE VIDLJIVO:** ljudi, vozila. Ovo je hero o sistemu, ne o radu.

**PROSTOR ZA COPY:** gornja leva trećina tamna i prazna. Na mobilnom: gornja polovina.

> **BLOKADA — pročitati pre zakazivanja:** lokalno imamo **4 baslac proizvoda**, od kojih dva dele istu sliku (§4.3). Kompozicija od 5–7 limenki **fizički se ne može snimiti** iz onoga što je potvrđeno u katalogu. Ovaj asset treba tražiti kao **zvanični baslac materijal**, ne kao lokalno snimanje — osim ako se prethodno ne potvrdi da fizički raspolažemo sa 5+ artikala.

---

## 1.7 — BASLAC REPAIR RHYTHM (2 fajla)

| | |
| --- | --- |
| **Sekcija** | Repair rhythm — u kodu `priority: "highest"` |
| **Filename** | `baslac-repair-rhythm-desktop.webp` + `-mobile.webp` |
| **Ratio / rez.** | 8:5 · min 1600×1000 · ideal 2400×1500 · mobile 900×1125 |

**TAČAN SADRŽAJ:** široki kadar profesionalne lakirnice u kome se istovremeno vide dve-tri faze rada na različitim vozilima: u prednjem planu maskirano vozilo spremno za lakiranje, u srednjem planu lakirer u zaštitnom odelu, u dubini otvorena kabina sa osvetljenjem.

**MORA BITI VIDLJIVO:** više faza u jednom kadru — to je ono što "ritam popravke" znači.

**NE TREBA DA BUDE VIDLJIVO:** brendirana pakovanja bilo kog konkurenta; prostor ne sme delovati pretrpano.

**PROSTOR ZA COPY:** gornja četvrtina (plafon/rasveta) mirna.

> Ovaj kadar je **brand-neutralan** — može se snimiti u bilo kojoj partnerskoj radionici i ne zahteva baslac proizvode. Zato je izvodljiv odmah, za razliku od 1.6.

---

## 1.8 — C.A.R.FIT HERO: RADNI STO (1 fajl + mobile crop)

| | |
| --- | --- |
| **Brand** | C.A.R.FIT |
| **Sekcija** | Hero |
| **Filename** | `carfit-hero-workbench` |
| **Ratio / rez.** | 3:2 · min 2000×1333 · ideal 2400×1600 |
| **Mobile** | `SEPARATE MOBILE CROP` |

**TAČAN SADRŽAJ:** pogled odozgo pod uglom ~30° na uredan radni sto. Car Fit materijali raspoređeni prema pet faza: brusni diskovi u lepezi, kutija kita sa špahtlom, rolna maskirne trake i folije, limenka bezbojnog laka, polirni pad. Radna površina siva/betonska ili čelična, **ne drvena**.

**MORA BITI VIDLJIVO:** Car Fit pakovanja i etikete.

**NE TREBA DA BUDE VIDLJIVO:** ruke, ljudi, drugi brendovi.

**PROSTOR ZA COPY:** **kritično** — hero nosi 5 markera faze koji se pozicioniraju preko slike. Raspored mora biti prozračan, sa vidljivim praznim zonama između grupa predmeta. Leva trećina slobodnija (naslov + wordmark).

> **Zavisnost:** traži fizičke Car Fit artikle. Lokalno imamo **1** (maskirna folija). Ili se prethodno nabave uzorci, ili se traži zvanični August Handel materijal.

---

## 1.9 — TABELA SVIH P0 FOTOGRAFIJA

| # | Brand | Sekcija | Filename | Tip | Ratio | Min | Mobile | Izvodljivo lokalno? |
| - | ----- | ------- | -------- | --- | ----- | --- | ------ | ------------------- |
| 1 | Carsystem | Workflow | `carsystem-workflow-damage` | WORKFLOW | 4:3 | 1200×900 | SAME | DA |
| 2 | Carsystem | Workflow | `carsystem-workflow-prepared` | WORKFLOW | 4:3 | 1200×900 | SAME | DA |
| 3 | Carsystem | Workflow | `carsystem-workflow-painted` | WORKFLOW | 4:3 | 1200×900 | SAME | DA |
| 4 | Carsystem | Workflow | `carsystem-workflow-finished` | WORKFLOW | 4:3 | 1200×900 | SAME | DA |
| 5 | Carsystem | Hero | `carsystem-hero-preparation` | HERO | 3:2 | 1800×1200 | SEPARATE | DA |
| 6 | Carsystem | Hero | `carsystem-hero-preparation-mobile` | HERO | 4:5 | 900×1125 | — | DA |
| 7 | baslac | Repair rhythm | `baslac-repair-rhythm-desktop` | AMBIENT | 8:5 | 1600×1000 | SEPARATE | DA |
| 8 | baslac | Repair rhythm | `baslac-repair-rhythm-mobile` | AMBIENT | 4:5 | 900×1125 | — | DA |
| 9 | baslac | Hero 1 | `baslac-system-desktop` | PRODUCT FAMILY | 40:27 | 1600×1080 | SEPARATE | **NE — nema proizvoda** |
| 10 | baslac | Hero 1 | `baslac-system-mobile` | PRODUCT FAMILY | 5:6 | 900×1080 | — | **NE — nema proizvoda** |
| 11 | C.A.R.FIT | Hero | `carfit-hero-workbench` | PRODUCT FAMILY | 3:2 | 2000×1333 | CROP | **NE — 1 artikal lokalno** |
| 12 | Carsystem | Hero | `carsystem-hero-painting` (+mobile) | HERO | 3:2 | 1800×1200 | SEPARATE | DA |

**8 od 12 je izvodljivo lokalno odmah.** Preostala 4 zavise od fizičke dostupnosti proizvoda ili zvaničnog materijala proizvođača.

---

# 2. EXISTING STAGED ASSETS — INVENTORY

Ništa nije premešteno. Ovo je samo popis šta već imamo i koji gap bi zatvorilo.

## 2.1 CARSYSTEM — `assets/manufacturer/carsystem/images` (441 fajl, 177 MB)

| Staged source fajl | Rešava gap | Gde bi se koristio | Rezolucija | Alfa | Cleanup? | Dovoljno kvalitetan? | RIGHTS / PUBLISHING STATUS |
| ------------------ | ---------- | ------------------ | ---------- | ---- | -------- | -------------------- | -------------------------- |
| `csm_146.706-cs-multi-green-inkl-haerter-kg-1_6-3D_*.png` | **P07 / A09 — Multi Green bez alfe** | Families blok, Use cases, Final CTA | **660×406** | **DA** | Ne | **Za alfu DA, za rezoluciju NE** | `REQUIRES RIGHTS CONFIRMATION` |
| `csm_152.357-cs-multi-green-plus-inkl-haerter-kg-1_0-3D_*.png` | varijanta Multi Green Plus | Proširenje porodice | 660×406 | DA | Ne | Isto | `REQUIRES RIGHTS CONFIRMATION` |
| `csm_156.543-cs-multi-green-sf-inkl-haerter-3D_*.png` | varijanta Multi Green SF | Proširenje porodice | 660×406 | DA | Ne | Isto | `REQUIRES RIGHTS CONFIRMATION` |
| `csm_137.206-cs-multi-soft-inkl-haerter-3D_*.png` | **P05 — `carsystem-soft-plus-git`** (kandidat) | Product listing, Families | 660×406 | DA | Provera da li je isti artikal | Verovatno | `REQUIRES RIGHTS CONFIRMATION` |
| `csm_127.972-cs-soft-beige-inkl-haerter-3D_*.png` | alternativni kandidat za soft git | Product listing | 660×406 | DA | Provera artikla | Verovatno | `REQUIRES RIGHTS CONFIRMATION` |
| ~430 preostalih packshotova | **P15 — prekid 13× reciklaže** | Use cases, Families, Product listing | **sve 660px širine** | većinom DA | Ne | **Za broj artikala DA, za rezoluciju NE** | `REQUIRES RIGHTS CONFIRMATION` |

**Najvažniji nalaz ove sekcije:** staged Multi Green **ima alfu** (PNG), dok objavljeni `carsystem-git-multi-green.jpg` nema (600×600 JPG). Staging dakle rešava **problem transparentnosti**, ali ne i rezolucije — i staged je 660px.

> **Potvrda audita:** svi provereni staged Carsystem packshotovi su 660px širine. Objavljivanje **neće** popraviti `NEEDS HIGHER RES` stavke. Za to su potrebni master fajlovi od Vosschemie GmbH.

## 2.2 CARSYSTEM — `assets/manufacturer/carsystem/documents` (506 PDF)

| Sadržaj | Rešava gap | Gde bi se koristio | Cleanup? | RIGHTS / PUBLISHING STATUS |
| ------- | ---------- | ------------------ | -------- | -------------------------- |
| 506 TDS PDF-ova, format `{artikal}-DE-0.pdf` | Documentation blok; trenutno 6 lokalnih TDS za 9 proizvoda | Product stranice | **DA — svi su DE (nemački)**, treba EN/SR verzija ili prevod | `REQUIRES RIGHTS CONFIRMATION` |

## 2.3 C.A.R.FIT — `assets/manufacturer/carfit/images` (123 fajla, 15.9 MB)

| Staged source fajl (primeri) | Rešava gap | Gde bi se koristio | Rezolucija | Alfa | Cleanup? | Kvalitet | RIGHTS / PUBLISHING STATUS |
| ---------------------------- | ---------- | ------------------ | ---------- | ---- | -------- | -------- | -------------------------- |
| `carfitrepair-gold-paper-discs.jpg`, `carfitrepair-netzschleifscheiben.jpg`, `carfitrepair-nass-schleifpapier.jpg` | **P08 + slot `carfit-abrasives`** | Porodice, Product showcase | 1000×1000 / do 2560px | **NE** | **DA — treba izdvajanje (cutout) za kompozicije** | **DA, visok** | `REQUIRES RIGHTS CONFIRMATION` |
| `carfitrepair-multi-spachtel.jpg`, `-alu-soft-spachtel.jpg`, `-carbon-spachtel.jpg`, `-glas-plus-spachtel.jpg` | **P09 + slot `carfit-putties`** | Porodice, Product showcase | 1000×1000+ | NE | DA — cutout | DA | `REQUIRES RIGHTS CONFIRMATION` |
| `carfitrepair-abdeckklebeband-*.jpg`, `-abdeckfolie-*.jpg`, `9-120-00__-CF-Masking-waterproof-tape-all.jpg` | slot `carfit-masking` | Porodice | 1000×1000 | NE | DA — cutout | DA | `REQUIRES RIGHTS CONFIRMATION` |
| `carfitrepair-2k-ultra-hs-klarlack.jpg`, `-2k-hs-perfekt-klarlack.jpg`, `-2k-klarlack-spray.jpg` | **P10 + slot `carfit-clearcoat`** | Porodice, Product showcase | 1000×1000+ | NE | DA — cutout | DA | `REQUIRES RIGHTS CONFIRMATION` |
| `carfitrepair-polierschwamm-konisch.jpg`, `-lammfell-polierscheiben-velcro.jpg`, `-polishing-disc-velcro.jpg` | **P11 + slot `carfit-polishing`** | Porodice, Product showcase | 1000×1000+ | NE | DA — cutout | DA | `REQUIRES RIGHTS CONFIRMATION` |
| `6-901-0001-02-scaled.jpeg`, `9-160-5010-1-scaled.jpeg`, `8-801-0035-4-scaled.jpeg` | opšti product showcase | Product showcase | **2247×2560 do 2560×2135** | NE | DA — cutout | **DA, najviši u projektu** | `REQUIRES RIGHTS CONFIRMATION` |

**Ključna razlika u odnosu na Carsystem:** Carfit staged packshotovi idu **do 2560px** — to je jedini staging koji rešava i broj artikala **i** rezoluciju. Ali su **JPG bez alfe**, pa za kompozicije porodica traže izdvajanje sa pozadine.

## 2.4 C.A.R.FIT — `assets/manufacturer/carfit/documents` (300 PDF)

| Sadržaj | Rešava gap | Cleanup? | RIGHTS / PUBLISHING STATUS |
| ------- | ---------- | -------- | -------------------------- |
| 300 TDS PDF, format `C.A.R.FIT-{proizvod}_{DE_de\|GB_en}.pdf` | **C06 — 4 kartice dokumentacije bez ijednog linka** | **Postoje EN verzije** — bolja pozicija nego Carsystem (samo DE) | `REQUIRES RIGHTS CONFIRMATION` |

## 2.5 COSMOS LAC — `assets/manufacturer/cosmos-lac/images` (670 fajlova, 102 MB)

| Sadržaj | Rešava gap | Gde bi se koristio | Rezolucija | Alfa | Kvalitet | RIGHTS / PUBLISHING STATUS |
| ------- | ---------- | ------------------ | ---------- | ---- | -------- | -------------------------- |
| ~667 packshotova | **Ništa — product rail je već 742/742 pokriven** | — | 800×800 | — | Isto kao objavljeno | `REQUIRES RIGHTS CONFIRMATION` |
| **3 fajla u 2560×2560** | **A16 — hi-res hero limenka** | Hero arc, vodeća limenka | **2560×2560** | — | **DA — jedino što Cosmos-u treba iz staginga** | `REQUIRES RIGHTS CONFIRMATION` |

**Zaključak za Cosmos:** od 670 staged slika, praktičnu vrednost ima **3**. Ostatak duplira ono što je već objavljeno. Cosmos staging **nije prioritet.**

## 2.6 SAŽETAK — POTENCIJALNO UPOTREBLJIVO NAKON POTVRDE PRAVA

| Brend | Slike | Dokumenti | Stvarno korisno | Napomena |
| ----- | ----- | --------- | --------------- | -------- |
| Carsystem | 441 | 506 | **~435 slika** (broj artikala, ne rezolucija) + 506 docs uz prevod | 660px ograničenje ostaje |
| C.A.R.FIT | 123 | 300 | **123 slike** (i broj i rezolucija) + 300 docs | traži cutout |
| Cosmos Lac | 670 | 0 | **3 slike** | ostatak duplikat |
| **UKUPNO** | **1234** | **806** | **~561 slika + 806 dokumenata** | sve `REQUIRES RIGHTS CONFIRMATION` |

---

# 3. CARSYSTEM — PROCUREMENT PLAN

Najviši prioritet. Stranici nedostaje **13 slika** i sve su blokirajuće za reprezentativni release.

## 3.1 CARSYSTEM — NEW PHOTOS (13 fajlova)

| # | Filename | Tip | Ratio | Min rez. |
| - | -------- | --- | ----- | -------- |
| 1–4 | `carsystem-workflow-{damage,prepared,painted,finished}` | WORKFLOW | 4:3 | 1200×900 |
| 5–6 | `carsystem-hero-preparation` + `-mobile` | HERO | 3:2 / 4:5 | 1800×1200 / 900×1125 |
| 7–8 | `carsystem-hero-painting` + `-mobile` | HERO | 3:2 / 4:5 | 1800×1200 / 900×1125 |
| 9–10 | `carsystem-hero-finishing` + `-mobile` | HERO | 3:2 / 4:5 | 1800×1200 / 900×1125 |
| 11–13 | `carsystem-process-{preparation,application,finish}` | WORKFLOW | 32:21 | 1600×1050 |

## 3.2 WORKFLOW SERIJA — FIZIČKA UPUTSTVA ZA SNIMANJE

Ovo je **jedan foto-termin**, ne četiri. Serija radi kao scroll sekvenca samo ako je kamera fiksirana.

### Šta mora ostati IDENTIČNO u sva 4 kadra

| Parametar | Zahtev |
| --------- | ------ |
| **Automobil** | Isti automobil, tamna boja (crna, tamnosiva ili tamnoplava) — sjaj se na tamnom čita jasno |
| **Panel** | Isti panel. Preporuka: **zadnja leva vrata** — ravna površina, jasne ivice, dovoljno velika |
| **Ugao** | Isti ugao. Preporuka: **3/4 bočno, ~35–40° od ravni panela** — čist front daje ravnu, dosadnu sliku; preoštar ugao skraćuje površinu |
| **Stativ** | **Stativ se NE pomera između faza.** Označiti nogare lepljivom trakom na podu. Ako se termin prekida, pozicija mora ostati obeležena |
| **Visina kamere** | Fiksna, na ~1.2 m — visina ručice vrata |
| **Udaljenost** | **~2.0–2.5 m** od panela. Panel popunjava centralnih 70% kadra |
| **Objektiv i zum** | Isti objektiv, **fiksna žižna daljina** (preporuka 35 mm ili 50 mm na full-frame). Ne dirati zum |
| **Fokus** | Prebaciti na **manuelni fokus posle prvog kadra** — autofokus će se između faza uhvatiti za različite detalje i promeniti kadriranje |
| **Blenda / ISO / brzina** | Manuelno, identično u sva 4 kadra. Preporuka f/8 za dubinsku oštrinu celog panela |
| **Balans belog** | Manuelno, isti Kelvin. **Ne auto** — inače će četiri kadra imati četiri različite temperature |
| **Svetlo** | **Isti raspored, ne pomerati.** Meko bočno svetlo pod ~45°, veliki difuzor ili linijska rasveta radionice. Cilj: da se u fazi `finished` pojavi **čist linijski odsjaj** — to je jedini vizuelni dokaz sjaja |
| **Referentna tačka** | Ista ivica/ručica/spoj vidljiv u sva 4 kadra — bez toga sekvenca ne čita kao isti panel |

### Šta se MENJA između faza

| Faza | Stanje panela | Šta ukloniti iz kadra |
| ---- | ------------- | --------------------- |
| 1 · damage | Udubina i oštećen lak | Sav alat, ruke, materijal |
| 2 · prepared | Obrušeno i kitovano, vidljiv prelaz brušenja | Brusilica, prašina sa poda u kadru |
| 3 · painted | Nanet sloj, površina mat, **maskirna traka OSTAJE** | Pištolj, lakirer |
| 4 · finished | Maska skinuta, pun sjaj, čist odsjaj | Sve — samo panel |

### Praktična napomena o redosledu

Faze se moraju snimati **hronološki tokom stvarne popravke**, jer se panel fizički menja i ne može se vratiti unazad. To znači da termin traje koliko i popravka — planirati **snimanje u 4 navrata tokom 1–2 dana**, sa stativom obeleženim na podu i identičnim postavkama zabeleženim na papiru.

> Ako se stativ mora skloniti između faza: fotografisati postavku, izmeriti rastojanja, i zabeležiti sve parametre. Bolje je izgubiti pola sata na dokumentovanje postavke nego dobiti četiri kadra koji ne slažu.

## 3.3 RACIONALAN SHOOT PLAN — 5 SETUPOVA ZA 15 FAJLOVA

Cilj je maksimum iz minimuma termina. Pet setupova pokriva **svih 13 Carsystem fajlova + 2 homepage fajla**.

| Setup | Gde / šta | Fajlovi koje daje | Broj |
| ----- | --------- | ----------------- | ---- |
| **S1 — Fiksni panel (stativ obeležen)** | Jedna stvarna popravka, 4 navrata | `workflow-damage`, `-prepared`, `-painted`, `-finished` | 4 |
| **S2 — Priprema / brušenje** | Ista radionica, druga pozicija, tokom faze 2 iz S1 | `hero-preparation` + `-mobile` + `process-preparation` | 3 |
| **S3 — Kabina / maskiranje** | Lakirna kabina, tokom faze 3 iz S1 | `hero-painting` + `-mobile` + `process-application` | 3 |
| **S4 — Poliranje / završna** | Radionica, tokom faze 4 iz S1 | `hero-finishing` + `-mobile` + `process-finish` | 3 |
| **S5 — Mikser boja / vaga** | Prostorija za mešanje boja | homepage `carsystem-mixing-support` + homepage `home-final-cta` ambient | 2 |
| | | **UKUPNO** | **15** |

**S1–S4 se odvijaju oko iste popravke i istog vozila** — to nije četiri odvojena termina nego jedna popravka praćena kamerom, sa dodatnim setupovima u trenucima kada je faza ionako u toku. S5 je nezavisan i može se snimiti bilo kada.

**5 setupova → 15 fajlova.** Alternativa od 15 odvojenih termina daje isti rezultat uz višestruko veći trošak i rizik od nedoslednog svetla.

### Kritično upozorenje za S2–S4

Hero i process kadar iste faze **ne smeju biti isti kadar iz dva ugla**. Hero je o **radu** (čovek, pokret, alat u kontaktu). Process je o **materijalu** (sto, pakovanja, alat u mirovanju, vozilo van fokusa). Ako se to ne razdvoji, stranica će izgledati kao da ponavlja istu sliku — što je tačno problem koji već ima sa 13× recikliranim brusnim diskom.

## 3.4 CARSYSTEM — PACKSHOT PROBLEMI (ne fotografišu se, rešavaju se drugačije)

| Problem | Rešenje | Zavisnost |
| ------- | ------- | --------- |
| `carsystem-git-multi-green.jpg` nema alfu | Staged `csm_146.706-cs-multi-green-inkl-haerter-*.png` **ima alfu** | `REQUIRES RIGHTS CONFIRMATION` |
| `carsystem-soft-plus-git` bez slike | Kandidat: staged `csm_137.206-cs-multi-soft-*` ili `csm_127.972-cs-soft-beige-*` — **potvrditi da je isti artikal** | Rights + potvrda artikla |
| `carsystem-p23-brusni-diskovi` bez slike | Tražiti u 441 staged fajlu ili od Vosschemie | Rights |
| 7 packshotova ≤660px | **Staging ne pomaže — i on je 660px.** Tražiti master fajlove od Vosschemie GmbH | Odvojen zahtev proizvođaču |
| Ista slika 13× | Objaviti 6–8 dodatnih staged artikala | Rights |

---

# 4. BASLAC — PROCUREMENT PLAN

15 nedostajućih referenciranih slika. Ali **ne treba 15 foto-termina.**

## 4.1 ANALIZA SVIH 15 SLOTOVA

| # | Filename | Šta dizajn zapravo zahteva | Neophodna? | Grupisanje | Zvanični asset ili lokalna fotografija? |
| - | -------- | -------------------------- | ---------- | ---------- | --------------------------------------- |
| 1 | `baslac-system-desktop.webp` | Kompozicija 5–7 baslac limenki kao sistem | **DA — P0** | **Grupa A** | **ZVANIČNI** — nemamo proizvode |
| 2 | `baslac-system-mobile.webp` | Ista kompozicija, portret | **DA — P0** | **Grupa A** | **ZVANIČNI** |
| 3 | `baslac-repair-rhythm-desktop.webp` | Široki kadar radionice, 2–3 faze istovremeno | **DA — P0**, `priority: highest` | **Grupa B** | **LOKALNA** — brand-neutralno |
| 4 | `baslac-repair-rhythm-mobile.webp` | Isti kadar, portret | **DA — P0** | **Grupa B** | **LOKALNA** |
| 5 | `baslac-45-line-desktop.webp` | 45 Line vodeni sistem u primeni | DA — P1 | **Grupa C** | ZVANIČNI (traži 45 Line proizvode) |
| 6 | `baslac-45-line-mobile.webp` | Isto, portret | DA — P1 | **Grupa C** | ZVANIČNI |
| 7 | `baslac-color-tools-desktop.webp` | Digitalni koloristički alati i mešanje | DA — P1 | **Grupa D** | **LOKALNA** — mikser je naš |
| 8 | `baslac-color-tools-mobile.webp` | Isto, portret | DA — P1 | **Grupa D** | **LOKALNA** |
| 9 | `baslac-fast-process-desktop.webp` | Kontrolisano sušenje u radionici | DA — P1 | **Grupa B** | **LOKALNA** — brand-neutralno |
| 10 | `baslac-fast-process-mobile.webp` | Isto, portret | DA — P1 | **Grupa B** | **LOKALNA** |
| 11 | `baslac-45-line-system.webp` | Mixing sistem + aplikacija vodene baze | DA — P2 | **Grupa C** | ZVANIČNI |
| 12 | `baslac-clearcoat-range.webp` | Grupa bezbojnih lakova po procesu | DA — P2 | **Grupa A** | **ZVANIČNI** — 0 clearcoat artikala lokalno |
| 13 | `baslac-primer-process.webp` | Priprema podloge + nanošenje primera | DA — P2 | **Grupa C** | Može LOKALNA ako se nabave primeri |
| 14 | `baslac-color-workflow.webp` | e-finder, formula, vaga, mixing stanica | DA — P2 | **Grupa D** | **LOKALNA** |
| 15 | `baslac-commercial-vehicles.webp` | Komercijalno vozilo u lakirnici | **Uslovno** — P2 | **Grupa E** | **LOKALNA** — traži kamion/autobus |

## 4.2 GRUPISANJE — 15 SLOTOVA IZ 5 SETOVA

| Grupa | Setovi | Pokriva | Broj fajlova | Tip izvora | Izvodljivo sada? |
| ----- | ------ | ------- | ------------ | ---------- | ---------------- |
| **A** | Studijska kompozicija baslac proizvoda | 1, 2, 12 | 3 | **ZVANIČNI** | **NE** — 4 proizvoda lokalno |
| **B** | Radionica, ambijent i ritam rada | 3, 4, 9, 10 | 4 | **LOKALNA** | **DA — odmah** |
| **C** | 45 Line / primer aplikacija | 5, 6, 11, 13 | 4 | ZVANIČNI ili lokalna uz nabavku | Delimično |
| **D** | Prostorija za mešanje boja | 7, 8, 14 | 3 | **LOKALNA** | **DA — odmah** |
| **E** | Komercijalno vozilo | 15 | 1 | **LOKALNA** | Uslovno — traži veliko vozilo |

**Zaključak:** 15 slotova → **5 setova**. Od toga **7 fajlova (grupe B + D) izvodljivo je odmah**, bez ijednog baslac proizvoda, u našoj ili partnerskoj radionici.

**Grupe A i C su blokirane nedostatkom proizvoda** i treba ih tražiti kao zvanični baslac materijal, ne planirati kao snimanje.

## 4.3 IZOLOVAN PROBLEM: `baslac-35-m214.jpg` vs `baslac-60-20-razredjivac.jpg`

**Ne popravljam ga — samo dokumentujem.**

### Činjenično stanje

Oba fajla imaju **identičan MD5** `ee80e16608b277b9a3db603dc7cf7ef3`, dimenzije 724×724, bez alfe.

| | `baslac-35-m214` | `baslac-60-20-razredjivac` |
| --- | --- | --- |
| **Naziv** | Baslac 35-M214 | Baslac 60-20 razređivač |
| **SKU** | `BASLAC-35-M214` | `BASLAC-60-20-5L` |
| **Pakovanje** | **3.5 L** | **5 L** |
| **Faza** | `lak` — završni sloj | `boja` |
| **Tip** | Boje i lakovi | **Razređivač** |
| **Slika** | `/products/baslac/baslac-35-m214.jpg` | `/products/baslac/baslac-60-20-razredjivac.jpg` |
| **Alt tekst** | "Baslac proizvod iz programa boja i lakova" | "Baslac proizvod iz programa boja i lakova" — **identičan** |

### Gde se svaki koristi

Oba se pojavljuju u:
- **baslac brand stranica** → `CatalogPreview` blok (prikazuje 4 proizvoda sa slikom — a imamo tačno 4, pa se **oba prikazuju jedan pored drugog**, sa istom slikom)
- **`/proizvodi/[slug]`** → pojedinačne product stranice
- **`/katalog`** → listing
- Uzajamno u `relatedProductSlugs` — 35-M214 preporučuje 60-20 i obrnuto, **pa se ista slika pojavljuje dvaput i u "srodni proizvodi" bloku**

> Ovo je najvidljiviji oblik greške: u katalog gridu stoje dva različita artikla, različitog pakovanja i različite namene, sa **bajt-identičnom fotografijom**.

### Šta bi svaki TREBALO da prikazuje

| Proizvod | Šta bi slika trebalo da prikazuje |
| -------- | --------------------------------- |
| **Baslac 35-M214** | Limenka/kanta **3.5 L** iz programa boja i lakova, faza završnog sloja. Etiketa sa oznakom `35-M214` čitljiva |
| **Baslac 60-20 razređivač** | Kanta **5 L** razređivača. Etiketa sa oznakom `60-20` čitljiva. Vizuelno se mora razlikovati od 3.5 L pakovanja — **razlika u zapremini mora biti očigledna** |

### Koji originalni asset nam nedostaje

**Nedostaje nam najmanje jedan, verovatno oba.** Iz repozitorijuma se **ne može utvrditi koji je od dva proizvoda originalno fotografisan** — jedan fajl je kopiran preko drugog, a metapodaci to ne razrešavaju.

Zato:
> Tretirati **oba** kao `NEEDS NEW PACKSHOT` dok se fizički ne uporede sa artiklom na zalihama.

### Dodatni nalaz — podaci su takođe placeholder-grade

Uz sliku, i tekst je generisan a ne napisan:

> "Baslac 35-M214 je proizvod iz programa boja i lakova sa **naglašenim pakovanjem 3.5 L i upitom za potvrdu tehničke namene**."

To je opis koji priznaje da ne zna čemu proizvod služi. Isto važi za 60-20. Oba nose i **identičan alt tekst**. Ovo prijavljujem kao **C13** u §9 — nije image problem nego kredibilitet.

---

# 5. C.A.R.FIT — MATRICA 17 SLOTOVA

## 5.1 Svih 17 slotova

| # | Slot ID | Sekcija | Tip koji dizajn traži | Može packshot iz staginga? | Mora application? |
| - | ------- | ------- | --------------------- | -------------------------- | ----------------- |
| 1 | `carfit-hero-workbench` | Hero | PRODUCT FAMILY | Delimično — kompozicija od staged cutouts | Poželjno pravo snimanje |
| 2 | `carfit-task-preparation` | Poslovi | APPLICATION | NE | **DA** |
| 3 | `carfit-task-masking` | Poslovi | APPLICATION | NE | **DA** |
| 4 | `carfit-task-body-repair` | Poslovi | APPLICATION | NE | **DA** |
| 5 | `carfit-task-priming` | Poslovi | APPLICATION | NE | **DA** |
| 6 | `carfit-task-painting` | Poslovi | APPLICATION | NE | **DA** |
| 7 | `carfit-task-spot-repair` | Poslovi | APPLICATION | NE | **DA** |
| 8 | `carfit-task-finishing` | Poslovi | APPLICATION | NE | **DA** |
| 9 | `carfit-task-polishing` | Poslovi | APPLICATION | NE | **DA** |
| 10 | `carfit-abrasives` | Porodice | PRODUCT FAMILY | **DA** — `gold-paper-discs`, `netzschleifscheiben`, `nass-schleifpapier` | NE |
| 11 | `carfit-putties` | Porodice | PRODUCT PACKSHOT | **DA** — `multi-spachtel`, `alu-soft-spachtel`, `carbon-spachtel` | NE |
| 12 | `carfit-masking` | Porodice | PRODUCT PACKSHOT | **DA** — `abdeckklebeband-*`, `abdeckfolie-*` | NE |
| 13 | `carfit-clearcoat` | Porodice | PRODUCT PACKSHOT | **DA** — `2k-ultra-hs-klarlack`, `2k-hs-perfekt-klarlack` | NE |
| 14 | `carfit-polishing` | Porodice | PRODUCT FAMILY | **DA** — `polierschwamm-konisch`, `lammfell-polierscheiben` | NE |
| 15 | `carfit-abrasive-disc` | Detalj | DETAIL / MACRO | Ne baš — traži macro teksture | **DA** |
| 16 | `carfit-masking-scene` | Scena | APPLICATION | NE | **DA** |
| 17 | `carfit-finish-scene` | Scena | APPLICATION | NE | **DA** |

## 5.2 Grupisanje

### Grupa 1 — Radionička sekvenca popravke (1 termin)
Slotovi **2–9, 16, 17** = 10 fajlova.

Osam "poslova" (priprema → maskiranje → reparacija → prajmer → lakiranje → spot popravka → završna obrada → poliranje) je **doslovno hronološki tok jedne popravke.** Jedan termin koji prati jednu popravku daje svih osam kao zasebne kadrove, plus `masking-scene` i `finish-scene` kao šire kadrove iste popravke.

> Ovo je isti princip kao Carsystem workflow serija — ali ovde kamera **nije** fiksirana, jer svaki kadar treba da izgleda drugačije.

### Grupa 2 — Macro detalj (isti dan, sto-top setup)
Slot **15** = 1 fajl. Macro abrazivne površine pod oštrim bočnim svetlom.

### Grupa 3 — Kompozicije porodica iz staginga (bez snimanja)
Slotovi **10–14** = 5 fajlova. Sastavljaju se od već postojećih staged packshotova nakon cutout-a.

### Grupa 4 — Hero
Slot **1** = 1 fajl. Idealno pravo snimanje; nužda: kompozicija od staged cutouts.

## 5.3 Zaključak

> **17 slots can be covered by 17 unique final assets produced from 4 production runs — of which only 12 require photography, and 5 require zero new shooting.**

Obrazloženje grupisanja:

| Run | Šta | Fajlova | Zahteva snimanje? |
| --- | --- | ------- | ----------------- |
| Run A | Radionička sekvenca popravke | 10 | DA — 1 termin |
| Run B | Macro detalj abraziva | 1 | DA — isti dan |
| Run C | Kompozicije porodica iz staginga | 5 | **NE** |
| Run D | Hero radni sto | 1 | DA — 1 kratak setup |
| | **UKUPNO** | **17** | **3 termina, od kojih 2 istog dana** |

**Minimalna verzija za release: 3 fajla** — hero (1) + `masking-scene` (16) + `finish-scene` (17). Razlog: osam task slotova ima **namerno dizajniran fallback** (`CarfitMedia.tsx` renderuje modul radioničke mreže, ne vidljivi placeholder), pa stranica bez njih ne izgleda pokvareno. Kod baslac-a to nije slučaj — tamo fallback prikazuje sivu kutiju sa imenom fajla.

**Zavisnost za Grupu 3:** staged Carfit packshotovi su JPG bez alfe. Za kompozicije porodica traže izdvajanje sa pozadine. Rezolucija (do 2560px) je dovoljna.

---

# 6. R-M — SAMO STVARNI GAPOVI

R-M je asset-rich. **Ne tražimo nove fotografije.** Sva 4 hero slajda, 4 editorial kadra i 59 packshotova postoje i validni su.

## 6.1 Stvarno nedostajuće / privremeno

| Stavka | Tip | Prioritet | Napomena |
| ------ | --- | --------- | -------- |
| **43 logotipa marki automobila** | `MISSING IMAGE` | P1 | Vidi 6.2 |
| AGILIS "tehnički slotovi" | `PLACEHOLDER` | P0 | **Nije foto problem.** AGILIS ima 7 packshotova, grid traži 4. Slotovi se pale kada `productSlugs` ne pogodi zapis — treba proveriti mapiranje slugova |
| Samopriznajući copy u AGILIS bloku | `MISSING COPY` | P0 | Vidi C04 u §9 |
| DIAMONT: clearcoat, hardener, thinner | `MISSING PRODUCT` | P1 | Mozaik traži 4 slota, imamo 1 (`rm-diamont-bazna-boja`) |
| 4 hero slajda u 2560px | `NEEDS BETTER ASSET` | P2 | Trenutno 1600×900 — prihvatljivo. Tražiti master fajlove samo ako su lako dostupni |
| SDS set | `MISSING DOCUMENT` | P2 | — |
| Color chart / formula vizual za Refinity | `MISSING DOCUMENT` | P2 | Refinity blok govori o formulama bez ijednog color asseta |

## 6.2 COLOR COVERAGE — SPISAK 43 MARKE BEZ LOGO ASSETA

`rmCompatibleBrands` mapira samo `{alt, id, name}` — polje `logo` se nikad ne popunjava, pa svih 43 renderuje kao sivi tekstualni pravougaonik. Marquee je dvoredni i dupliran, što daje **86 tekstualnih kutija u pokretu**.

**Ne skidam logotipe. Ovo je samo lista.**

| # | Marka | # | Marka | # | Marka |
| - | ----- | - | ----- | - | ----- |
| 1 | Acura | 16 | Honda | 31 | Nissan |
| 2 | Alfa Romeo | 17 | Hyundai | 32 | Porsche |
| 3 | Audi | 18 | Infiniti | 33 | Ram |
| 4 | Buick | 19 | Isuzu | 34 | Rivian |
| 5 | BMW | 20 | Jaguar | 35 | Saab |
| 6 | Cadillac | 21 | Jeep | 36 | Scion |
| 7 | Chevrolet | 22 | Kia | 37 | Stellantis |
| 8 | Chrysler | 23 | Lucid | 38 | Subaru |
| 9 | Dodge | 24 | Land Rover | 39 | Suzuki |
| 10 | Faraday Future | 25 | Lincoln | 40 | Tesla |
| 11 | Fiat | 26 | Lexus | 41 | Toyota |
| 12 | Ford | 27 | Mazda | 42 | VinFast |
| 13 | Genesis | 28 | Mercedes-Benz | 43 | Volkswagen |
| 14 | GM | 29 | Mini | | |
| 15 | GMC | 30 | Mitsubishi | | |

**Format:** monohromatski SVG, jednobojni (jedna boja koja se nasleđuje iz CSS-a), optički ujednačene visine.

> **Napomena o pravima koju treba svesno doneti:** logotipi marki automobila su zaštićeni žigovi. Njihovo prikazivanje u kontekstu "podržavamo ove marke" je uobičajena praksa u refinish industriji, ali **nije automatski dozvoljeno**. Alternativa bez pravnog rizika: zadržati tekstualni prikaz, ali ga **redizajnirati da izgleda namerno** (npr. tipografska lista umesto sivih kutija koje liče na neuspele slike). To je odluka za tebe, ne tehnička.

---

# 7. COSMOS — PACKSHOT vs BRAND PHOTOGRAPHY

## 7.1 PACKSHOTS ALREADY COVERED

| Blok | Pokrivenost | Status |
| ---- | ----------- | ------ |
| Hero arc (6 limenki) | 6/6 pravih packshotova | **POKRIVEN** — vidi rezervu u 7.3 |
| Family rail (pinned) | Svi packshotovi | **POKRIVEN** |
| Range / siluete | Svi packshotovi | **POKRIVEN** |
| Application finder — product prikaz | Svi packshotovi | **POKRIVEN** (ali vidi 7.2) |
| Commerce (6 kuriranih) | Svi packshotovi | **POKRIVEN** |
| **Ukupno katalog** | **742 / 742 sa slikom, 0 placeholdera** | **Najbolja pokrivenost u projektu** |

**Cosmos ne treba označavati kao "nedostaju slike".** Product image gap je nula.

### Šta staging od 670 slika rešava

**Gotovo ništa.** 667 od 670 su 800×800 packshotovi koji dupliraju već objavljeno. Jedina vrednost su **3 fajla u 2560×2560**, korisna za hi-res hero limenku.

> Cosmos staging **nije prioritet za rights confirmation.** Ako se pravi bira gde prvo tražiti odobrenje, Cosmos ide poslednji.

## 7.2 BRAND / APPLICATION IMAGERY STILL MISSING

Ovo je **jedini stvarni Cosmos gap** — i potpun je: nula application, nula lifestyle, nula ambient, nula brand fotografije.

| # | Asset | Sekcija | Zašto | Prioritet |
| - | ----- | ------- | ----- | --------- |
| 1 | `cosmos-application-auto` | Application finder | Blok nudi izbor po nameni (Auto / Metal / Drvo / Bicikl / Dekor / Art / Radionica) a **prikazuje limenke**. Naslov i vizual ne pričaju istu priču | **P1** |
| 2 | `cosmos-application-drvo` | Application finder | Isti razlog, druga namena | P2 |
| 3 | `cosmos-application-bicikl` | Application finder | Spray.Bike je istaknuta linija (88 packshotova) bez ijednog kadra primene | P2 |

**Brief za #1** — vidi §10.6 audita: ruka u nitrilnoj rukavici raspršuje Cosmos Lac sprej na metalnu površinu, **fini oblak spreja uhvaćen u letu**, etiketa čitljiva, ruka i limenka ulaze iz desne ivice, leva polovina ostaje za copy. 16:9, min 2000×1125.

## 7.3 COSMOS — OSTALO

| Stavka | Tip | Prioritet |
| ------ | --- | --------- |
| Hi-res vodeća hero limenka (2560×2560) | `NEEDS REPLACEMENT` | P1 — hero je trenutno **ograničen rezolucijom, ne dizajnom** (CSS kapira upscale na ~1.4×) |
| Color chart se nigde ne prikazuje | `MISSING DOCUMENT` | P1 — podatak **već postoji** (`data/cosmos-lac-color-chart.generated.json`, 63 KB). Za brend čiji je adut boja, ovo je najveći propušteni sadržaj |
| Master Mechanic mat/sjaj dele istu sliku | `NEEDS IMAGE` | P2 — razlika u finišu je upravo ono što kupac bira |
| Flame Blue / Flame Orange duplikati (3 para) | `NEEDS IMAGE` | P2 — 0.7% kataloga, nizak prioritet |
| TDS / SDS | `MISSING DOCUMENT` | P2 |

---

# 8. HOMEPAGE

## 8.1 Education block — puna analiza

### Šta se trenutno prikazuje (5 stavki, `CarsystemHomePage.tsx`)

| # | Kategorija | Naslov | "Vreme čitanja" | Vodi na |
| - | ---------- | ------ | --------------- | ------- |
| 1 | Priprema | Priprema površine pre prajmera | **4 min** | `/kontakt?tema=tehnicka-podrska&tema-saznanja=priprema-povrsine` |
| 2 | Boje | Izbor laka za završni sloj | **5 min** | `/kontakt?...&tema-saznanja=izbor-laka` |
| 3 | Poliranje | Korekcija i završni sjaj | **4 min** | `/kontakt?...&tema-saznanja=poliranje-visoki-sjaj` |
| 4 | Problemi | Greške koje narušavaju finiš | **6 min** | `/kontakt?...&tema-saznanja=greske-u-farbanju` |
| 5 | Proces | Redosled rada kroz refinish proces | **7 min** | `/kontakt?...&tema-saznanja=redosled-refinish-procesa` |

**Nijedan od ovih pet članaka ne postoji.** Vreme čitanja je izmišljeno — ne postoji tekst koji bi se čitao 4 ili 7 minuta. Svih pet vode na kontakt formu.

### Šta stvarno postoji (`data/knowledge/guides.ts`)

| # | Slug | Naslov | Status |
| - | ---- | ------ | ------ |
| 1 | `priprema-povrsine-pre-lakiranja` | Priprema površine pre lakiranja | **`draft`** |
| 2 | `izbor-prajmera-po-podlozi` | Izbor prajmera prema podlozi | **`draft`** |
| 3 | `utvrdjivanje-nijanse` | Utvrđivanje nijanse i rad sa RAL kartom | **`draft`** |

Sva tri su draft. `/vodici` je zato `noindex` i prazna — stranica sama komentariše da je "indeks ničega" tačno ono što brief zabranjuje.

### Preporuka

> **PUBLISH REAL GUIDES** — sa privremenim smanjenjem bloka sa 5 na 3 stavke.

**Obrazloženje:**

Tri opcije i zašto ostale dve gube:

- **Temporarily remove block** — najbrže, ali gubi se cela edukativna zona sa homepage-a. To je zona koja direktno podupire SEO plan (`SEO_CONTENT_PLAN.md` predviđa edukaciju kao rast kanal) i koja daje razlog za povratak na sajt. Bacanje gotovog dizajna zbog sadržaja koji je 80% napisan je loša trampa.

- **Replace block content** — znači izmisliti drugi sadržaj koji nije članak. Ali blok je dizajniran kao indeks članaka (redni broj, kategorija, naslov, vreme čitanja, strelica). Bilo šta drugo u toj formi ponovo laže o tome šta jeste.

- **Publish real guides** — tri vodiča već postoje kao draft i **pokrivaju tri od pet trenutno prikazanih tema** (priprema površine, izbor prajmera ≈ izbor laka, utvrđivanje nijanse). Potrebno je dovršiti ih i proći expert-verifikaciju. Kad se to desi, `/vodici` se **automatski** prebacuje u indeksabilno stanje — mehanizam već postoji i ne traži nikakvu izmenu koda.

**Praktičan redosled:**
1. Dovršiti i expert-verifikovati 3 postojeća draft vodiča.
2. Blok privremeno prikazuje **3 stavke sa stvarnim vremenom čitanja**, ne 5 izmišljenih.
3. Preostale 2 teme (greške u farbanju, redosled procesa) pišu se kasnije i blok se vraća na 5.

**Do tada, minimalna intervencija koja skida rizik po kredibilitet:** ukloniti oznake "4 min / 5 min / 7 min". Naslov koji vodi na kontakt je legitiman poziv na razgovor. Naslov sa vremenom čitanja je **obećanje članka** — i to je ono što trenutno nije istinito.

## 8.2 Homepage — ostale stavke

| # | Stavka | Tip | Prioritet |
| - | ------ | --- | --------- |
| 1 | Hero 1672×941 PNG, 1.8 MB → 2560×1440 WebP | `NEEDS REPLACEMENT` | P1 |
| 2 | Blok "tehnička podrška i mikseri boja" prikazuje packshot brusnog programa | `NEEDS BETTER ASSET` | P1 — semantički promašaj; naslov govori o savetu i nijansiranju |
| 3 | Final CTA koristi **isti fajl** kao hero (`hero-dark.png`) | `NEEDS NEW ASSET` | P1 — isti kadar na vrhu i dnu stranice koja ima svega 2 fotografska asseta |
| 4 | Kontakt blok bez fotografije objekta | — | P2 — blok radi i bez nje, **ne izmišljati potrebu** |

> Stavke 2 i 3 pokriva **Setup S5** iz Carsystem shoot plana (§3.3). Nije potreban zaseban termin.

---

# 9. P0 CONTENT PROBLEMS KOJI NISU SLIKE

Odvojeno od image liste, kako je traženo. Ovo su stavke koje **narušavaju kredibilitet sajta** i ne rešavaju se fotografijom.

| ID | Stranica | Problem | Zašto je P0 | Tip |
| -- | -------- | ------- | ----------- | --- |
| **C01** | Homepage | 5 "članaka" sa izmišljenim vremenom čitanja (4/5/6/7 min) koji ne postoje | Sajt obećava sadržaj koji nema. Direktno pitanje istinitosti | FAKE SADRŽAJ |
| **C02** | baslac | 45 Line blok: *"Ovaj pregled rezerviše mesto za stvarni mixing sistem…"* | Interni radni komentar vidljiv posetiocu | PLACEHOLDER COPY |
| **C03** | baslac | CV blok: *"Ovaj blok rezerviše jasan prostor za stvarnu primenu na kamionu…"* | Isto | PLACEHOLDER COPY |
| **C04** | R-M | AGILIS: *"…ostale komponente ostaju jasni tehnički slotovi do odobrenja finalnih asseta."* | Sajt objašnjava posetiocu svoje interno stanje pripreme | PLACEHOLDER COPY |
| **C05** | Carsystem | Metrics blok prikazuje **"09"** javnih zapisa | Metrika kojom se brend hvali radi protiv njega. Brojka je tačna, ali izbor metrike nije | POGREŠAN PODATAK |
| **C13** | baslac | `35-M214` i `60-20` imaju **generisane opise** (*"…sa naglašenim pakovanjem 3.5 L i upitom za potvrdu tehničke namene"*) i **identičan alt tekst** | Opis koji priznaje da ne zna čemu proizvod služi | POGREŠNI PRODUCT PODACI |
| **C06** | C.A.R.FIT | Sekcija dokumentacije nabraja TDS/SDS/uputstvo/podršku — **bez ijednog linka** | Blok obećava dokumente kojih nema. 300 PDF-ova čeka u stagingu | NEPOSTOJEĆI DOKUMENTI |
| **C07** | Carsystem | Kartica "Video materijali / U pripremi" nema `href`, renderuje se vidljivo onemogućena | Vidljivo mrtva kartica u produkciji | BROKEN CTA |
| **C08** | Cosmos | Color chart postoji kao podatak (63 KB) ali se **nigde ne prikazuje** | Najveći propušteni sadržaj brenda čiji je adut boja | NEISKORIŠĆEN SADRŽAJ |

## Sortirano po tome šta prvo skida rizik

**Odmah, bez ikakve nabavke (samo tekst):**
1. **C01** — ukloniti izmišljena vremena čitanja
2. **C02, C03, C04** — ukloniti tri placeholder pasusa
3. **C07** — ukloniti ili povezati mrtvu video karticu

Ovih pet stavki ne traži nijednu fotografiju, nijedan proizvod i nijednu potvrdu prava. **To je najjeftiniji dobitak na kredibilitetu u celom planu.**

**Traži odluku:**
4. **C05** — zameniti metriku ili proširiti katalog
5. **C13** — napisati stvarne opise nakon fizičke provere artikala

**Traži potvrdu prava:**
6. **C06** — povezati Carfit TDS
7. **C08** — odlučiti gde prikazati Cosmos color chart *(ovo NE traži prava — podatak je već naš)*

---

# 10. WHAT MILE NEEDS TO COLLECT

## FIRST — BLOCKING

**Odluke (bez ovoga se ne može planirati nabavka)**
- [ ] Potvrditi prava na objavljivanje `assets/manufacturer/` materijala — Vosschemie GmbH (Carsystem), August Handel GmbH (Car Fit)
- [ ] Potvrditi koje staged artikle Carsystem i R-M DOO **stvarno drži na zalihama**
- [ ] Odlučiti o logotipima marki automobila: licencirati ili redizajnirati blok kao tipografski (§6.2)

**Tekst — bez nabavke, može odmah**
- [ ] HOMEPAGE — ukloniti izmišljena vremena čitanja sa 5 "članaka" *(C01)*
- [ ] BASLAC — ukloniti placeholder pasus u 45 Line bloku *(C02)*
- [ ] BASLAC — ukloniti placeholder pasus u CV bloku *(C03)*
- [ ] R-M — ukloniti samopriznajući copy u AGILIS bloku *(C04)*
- [ ] CARSYSTEM — ukloniti ili povezati mrtvu karticu "Video materijali" *(C07)*

**Fotografija — jedan termin, jedna popravka**
- [ ] CARSYSTEM — workflow foto set: 4 faze istog panela, fiksiran stativ *(setup S1)*
- [ ] CARSYSTEM — hero preparation + mobile + process preparation *(setup S2)*
- [ ] CARSYSTEM — hero painting + mobile + process application *(setup S3)*
- [ ] CARSYSTEM — hero finishing + mobile + process finish *(setup S4)*
- [ ] BASLAC — repair rhythm desktop + mobile *(brand-neutralno, izvodljivo odmah)*

**Packshot / proizvod**
- [ ] BASLAC — tačan packshot proizvoda **35-M214** (3.5 L, faza laka)
- [ ] BASLAC — tačan packshot **60-20 razređivača** (5 L)
- [ ] BASLAC — fizički uporediti oba artikla i utvrditi koji je originalno fotografisan *(C13)*
- [ ] CARSYSTEM — transparentni Multi Green *(staged `csm_146.706-*` ima alfu — čeka prava)*
- [ ] CARFIT — hero radni sto: nabaviti fizičke Car Fit uzorke ili tražiti zvanični asset
- [ ] BASLAC — hero #1: tražiti **zvanični** baslac sistem asset *(lokalno nemamo 5+ proizvoda)*

**Provera koda, ne nabavka**
- [ ] R-M — proveriti `productSlugs` mapiranje u AGILIS gridu da nestanu "tehnički slotovi"

---

## SECOND — IMPORTANT

**Fotografija**
- [ ] HOMEPAGE — mikser boja / vaga *(setup S5, zamenjuje packshot u bloku podrške)*
- [ ] HOMEPAGE — zaseban kadar za final CTA *(setup S5, da se hero ne ponavlja)*
- [ ] COSMOS — application kadar: sprej u letu na metalnoj površini
- [ ] CARFIT — masking scena
- [ ] CARFIT — finish scena
- [ ] BASLAC — hero #2 (45 Line) + mobile
- [ ] BASLAC — hero #3 (color tools) + mobile *(izvodljivo lokalno — mikser je naš)*
- [ ] BASLAC — hero #4 (fast process) + mobile *(brand-neutralno)*

**Assets / rezolucija**
- [ ] HOMEPAGE — hero u 2560×1440 WebP
- [ ] COSMOS — hi-res vodeća hero limenka 2560×2560 *(3 postoje u stagingu)*
- [ ] R-M — 43 logotipa marki automobila, monohromatski SVG *(spisak u §6.2)*

**Proizvodi**
- [ ] R-M — DIAMONT bezbojni lak *(PROVERITI LOKALNU DOSTUPNOST)*
- [ ] R-M — DIAMONT učvršćivač *(PROVERITI LOKALNU DOSTUPNOST)*
- [ ] R-M — DIAMONT razređivač *(PROVERITI LOKALNU DOSTUPNOST)*
- [ ] CARSYSTEM — 6–8 dodatnih artikala da se prekine 13× reciklaža
- [ ] CARFIT — potvrditi dostupnost: abrazivi, kitovi, bezbojni lak, poliranje
- [ ] BASLAC — potvrditi dostupnost: bezbojni lak, primer-filler, 45 Line bazna boja

**Sadržaj**
- [ ] Dovršiti i expert-verifikovati 3 draft vodiča *(spisak u §8.1)*
- [ ] CARFIT — povezati TDS linkove *(300 PDF-ova čeka)*
- [ ] COSMOS — odlučiti gde prikazati color chart *(podatak već postoji, ne traži prava)*
- [ ] CARSYSTEM — odlučiti o "09" metrici

---

## LATER — POLISH

- [ ] BASLAC — 5 sekcijskih slika: 45 Line sistem, clearcoat range, primer proces, color workflow, komercijalna vozila
- [ ] CARFIT — 8 task application kadrova *(imaju dizajniran fallback, nisu hitni)*
- [ ] CARFIT — 5 kompozicija porodica iz staged packshotova *(traži cutout)*
- [ ] CARFIT — macro detalj abrazivne površine
- [ ] CARSYSTEM — 7 packshotova u ≥1200px *(traži master fajlove od Vosschemie — staging je takođe 660px)*
- [ ] COSMOS — application kadrovi za drvo i bicikl
- [ ] COSMOS — razdvojiti Master Mechanic mat/sjaj *(2 slike)*
- [ ] COSMOS — razdvojiti Flame Blue / Flame Orange duplikate *(3 para)*
- [ ] R-M — hero master fajlovi u 2560px
- [ ] R-M — color chart / formula vizual za Refinity
- [ ] SVI — SDS set od proizvođača
- [ ] BASLAC — uskladiti katalog sa 102 postojeća TDS-a
- [ ] CARSYSTEM — prevod 506 staged TDS-ova sa nemačkog

---

# 11. BRAND PAGES NOT YET DESIGNED

Šta nam ostaje posle R-M, baslac, Carsystem, Car Fit i Cosmos LAC.

**Bez dizajna, bez shot liste, bez landing koncepta** — samo stanje.

| Brand | Ruta | Trenutno stanje | Proizvoda u katalogu | Sa slikom | Lokalni asseti |
| ----- | ---- | --------------- | -------------------- | --------- | -------------- |
| **Befar** | `/brendovi/befar` | Generička `BrandPage` | **8** | **8** | Logo `/brands/befar.svg` · 8 packshotova u `/products/befar/` |
| **Norbin** | `/brendovi/norbin` | Generička `BrandPage` | **2** | 1 | Logo `/brands/norbin.svg` · 1 packshot u `/products/norbin/` |
| **SATA** | `/brendovi/sata` | Generička `BrandPage` | **1** | **0** | Logo `/brands/sata.svg` · **nijedan packshot** |
| **Rupes** | `/brendovi/rupes` | Generička `BrandPage` | **0** | 0 | **Nema logo** — u `BrandLogoPlate` renderuje "Brend u najavi" |
| **A.U.T.O. Fit** | `/brendovi/autofit` | Generička `BrandPage` | **0** | 0 | **Nema logo** — renderuje "Brend u najavi" |

## Kratko čitanje stanja

- **Befar** je jedini od pet koji ima **kompletnu product pokrivenost (8/8)** i logo. Ako se ikada bude birao šesti brend za dedicated stranicu, Befar je jedini koji već ima materijal za to.
- **Norbin** ima logo i pola pokrivenosti — jedan proizvod bez slike.
- **SATA** ima logo ali **nijednu sliku proizvoda**, uprkos tome što je istaknut u homepage brand rail-u. To je nesklad koji vredi znati.
- **Rupes** i **A.U.T.O. Fit** nemaju ni proizvode ni logo. Postoje samo kao unosi u `carsystem-data.ts` i kao "Brend u najavi" pločice.

> Nijedan od ovih pet nije deo trenutnog audita ni ovog plana. Navedeni su da bi obim posle prvih pet stranica bio jasan.
