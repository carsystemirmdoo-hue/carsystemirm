# Page Lock Status

Evidencija zaključanih javnih površina. Površina se zaključava tek kada je
dizajn i UX proveren na svim minimalnim viewport-ima, kada su interakcije
odigrane i kada nema nerešenog objektivnog blokera.

Zaključana površina **nije zamrznuta**. Sadržaj, podaci i asseti se i dalje
menjaju; menja se sve osim same dizajn/UX arhitekture.

## Šta lock dozvoljava, a šta ne

Za svaku površinu sa statusom `🔒 DESIGN + UX LOCKED` važi isto pravilo.

**Dozvoljeno bez reopen-a:**

- content update — tekst, naslovi, opisi, prevodi;
- data update — novi ili izmenjeni proizvodi, dokumenti, cene, taksonomija;
- asset replacement — zamena slika, packshot-ova, cover-a, video materijala;
- konkretan bug fix — dokazana greška u ponašanju, linku, pristupačnosti ili
  responsive prelomu, sa opisom šta je bilo pogrešno.

**Zabranjeno bez eksplicitnog reopen-a:**

- redesign — novi layout, nova tipografska skala, nova paleta, novi koncept;
- promena UX arhitekture — drugačiji redosled sekcija, drugačiji model
  navigacije, filtera, varijanti ili accordion-a;
- usputna vizuelna „poboljšanja" — pomeranje razmaka, promena senki, radijusa,
  animacija ili veličina bez prijavljene greške.

Reopen se traži eksplicitno, po površini, i upisuje se u ovaj dokument.

---

## PASS 02 — 2026-09-10

Obim: početna strana u svetloj temi, vizuelni sistem svetle teme, zajednički
header i footer.

### Početna strana (svetla tema) — 🔒 DESIGN + UX LOCKED

| | |
| --- | --- |
| Datum | 2026-09-10 |
| Status | `DESIGN + UX LOCKED` |
| Viewport-i | 1440, 768, 390 |

Odobreni izgled početne u svetloj temi je referenca: sadržaj, raspored,
tipografija, boje, razmaci, dimenzije, pozadine i ponašanje na svim širinama.
Zaključan je i vizuelni sistem svetle teme (tokeni, paleta, tipografska skala)
koji početna koristi. Mehanizam izbora teme i postojeće funkcionalnosti ostaju
aktivni — lock čuva izgled, ne zamrzava kod.

Komponente koje početna deli sa katalogom ili PDP-om smeju da dobiju nove
izmene samo u kontekstu koji ih traži (opt-in prop, data atribut, CSS scope),
tako da se početna ne promeni.

### Header i footer — 🔒 DESIGN + UX LOCKED

| | |
| --- | --- |
| Datum | 2026-09-10 |
| Status | `DESIGN + UX LOCKED` |
| Viewport-i | 1440, 768, 390 |

`components/layout/Header.tsx` i `components/layout/Footer.tsx` su zajednička
vizuelna referenca za sve javne stranice: logotip i oznaka „Carsystem i R-M",
dimenzije, poravnanja, razmaci, tipografija, boje, navigacija, pretraga,
prekidač teme i ponašanje na desktopu i mobilnom. Header se montira jednom,
kroz `PublicSiteChrome`; stranice montiraju `Footer` jednom, na kraju svog
sadržaja. Novi layout ne sme da doda drugi header ili footer.

**Buduće vizuelne izmene bilo koje od ovih površina zahtevaju izričit zahtev
korisnika (reopen), po površini.** Bez njega su dozvoljeni samo content,
data, asset i dokazani bug fix, kao i za svaku drugu zaključanu površinu.

Vezana pravila uvedena istog dana (nisu redesign, ne otvaraju lock):

- grafit iza proizvoda na PDP-u prikazuje se samo za boje (farbe, mešni
  tonovi, sprejevi za farbanje) po centralnom pravilu
  `lib/productPaintRule.mjs`; ostali proizvodi, uključujući aerosole koji nisu
  farba, nemaju grafit, a položaj i veličina slike ostaju isti;
- kartica na `/katalog` boji obojenu površinu stvarnom nijansom proizvoda ili
  prikazane varijante, a bez nijanse bojom brenda po `lib/brand-card-colors.ts`
  (Carsystem crvena, Baslac plava…); brend bez prepoznatljive boje zadržava
  neutralan prikaz. Boja brenda je samo vizuelna — nije nijansa proizvoda i ne
  ulazi u filter;
- roletna (obojeni sloj + otkrivanje) na `/katalog` postoji na SVAKOJ kartici,
  i za proizvode koji nisu boje: kartica uvek traži `visualMode:
  "color-on-hover"` (`CatalogProductCard`, samo uz `catalogSystem`). Van
  kataloga `neutral` i dalje gasi obojeni sloj. Kartica bez slike propušta
  roletnu kroz pločicu „Vizuel u pripremi". Roletna ostaje ISPOD proizvoda:
  nijedan blend/filter ne sme da prebojava neprovidne delove proizvoda
  (ranije multiply rešenje je uklonjeno). Sedam packshot-ova bez alfa kanala
  zamenjeno je cut-out assetima (`public/products/**.webp`; originalni JPEG
  fajlovi su sačuvani): B 2E11 i Multi Green iz zvaničnih transparentnih
  izvora, ostalih pet preciznom maskom spoljne pozadine (etikete i beli
  delovi ambalaže sačuvani). Metrike su regenerisane (`npm run images:metrics`).
  Regresija: `components/catalog/catalogCardReveal.test.mjs`; vizuelni
  kriterijum meri odvojeno pozadinu i neprovidnu unutrašnjost proizvoda;
- nijansa kartice bira se redom: merena/izvedena (`visual`), orijentacioni
  uzorak varijante (`visualIdentity.swatch`, samo završnice tona), kurirani
  preset, imenovana boja iz zvaničnog naziva/TDS-a (`lib/productNamedColors.mjs`,
  `precision: "orientation"` — nije kolorimetrijski podatak), pa tek boja brenda.
  Boje brendova su proverene iz izvora (tabela u `lib/brand-card-colors.ts`);
  R-M crvena je ispravljena na zvaničnu `#E3000F` (rmpaint.com);
- (2026-09-11) boja kartice NIJE ograničena na farbe: potvrđena boja proizvoda
  ili serije od proizvođača ima prednost nad starim `visual`/preset podacima
  (`getProductShadeSource`: blokada → `lib/productNamedColors.mjs` → visual →
  swatch → preset → brend). Carsystem abrazivi nose boju serije (P.19 „Color:
  Yellow” + zvanični packshot; F.19, F.23 Ceramic, F.19 Finish uzorak sa
  zvaničnog packshot-a); P.23 nema izvor. R-M „Pasta 190 1 L” je po šifri
  DIAMONT BC 190 „Dense white” toner (kategorija ispravljena u basecoat); 5 L
  ima sukob naziv/fotografija (BC 605) i ostaje na brendu; BC 100 je bezbojni
  Adjust Varnish (preset blokiran). Baslac swatch-evi Line 30/35/45 upoređeni
  sa zvaničnim tinting chart-ovima (topcoat 30, basecoat 35 2024, basecoat 45
  2019): hue-familija piktograma grupe boje; 24 tona zamenjeno grupom boje;
  `BASLAC_SWATCH_VERIFICATION` nosi status po kodu;
- (2026-09-11) `/katalog` je jedna lista koja se dopunjava skrolovanjem
  (IntersectionObserver, 48 po grupi). Navigacija „Strana N od M” je uklonjena
  iz interaktivnog kataloga (vodila je na `/katalog/strana/N` koja zamenjuje
  listu); ostaje u Suspense fallback-u i na crawl stranicama.

---

### Dopuna PASS 02 — 2026-09-15 (katalog: boje serija i beskonačni skrol)

- Kataloška boja nije ograničena na farbe: redosled je potvrđena boja
  PROIZVODA/varijante → potvrđena boja SERIJE (`series` u
  `lib/productNamedColors.mjs`, npr. Carsystem Sanding Disc P.19 „Color:
  Yellow”, F.19 / F.23 Ceramic / F.19 Finish po zvaničnom packshot-u) → boja
  brenda. Potvrđen podatak proizvođača ima prednost nad starim `visual`
  tokenom i kuriranim presetom; `PRODUCT_SHADE_BLOCKLIST` gasi pogrešne stare
  vrednosti uz razlog (BC 100 = Adjust Varnish, „Pasta 190” 5 L = sukob
  fotografije BC 605, „P23” ne postoji na carsystem.org — postoji P.25 Ceramic).
- Baslac swatch-evi su ponovo provereni uzorkovanjem piktograma iz zvaničnih
  tinting chart-ova 45/35/30 (`BASLAC_SWATCH_VERIFICATION`: 126 potvrđenih,
  11 zamenjenih, 2 nejasna uzorka, 1 nije u chart-u); tonirani providni toneri
  se prikazuju, bezbojni ne. „R-M Pasta 190” je po šifri DIAMONT mešna baza
  (BC 190), pa oba pakovanja nose taksonomiju basecoat.
- Beskonačno skrolovanje: pored okidač-kartice, mreža ima sentinel ispod
  poslednje kartice; observer tretira i element iznad viewporta kao presečen
  (skok na dno preko End/skrol-trake) i ponovo se naoružava posle svake grupe.
  Nov upit/filter vraća pogled na vrh rezultata i resetuje skup; Back sa `?q=`
  ponavlja restauraciju skrola kada lenjo učitane kartice stignu. Regresija:
  `components/catalog/catalogInfiniteScroll.test.mjs`.

---

## PASS 01 — 2026-08-16

Obim: PDP template, Cosmos LAC brand stranica, Befar brand stranica,
`/katalozi`.

Metod: ciljana provera na pokrenutom dev serveru (jedan proces, port 3100),
bez novog širokog audita. Evidencija:
`docs/audit-screenshots/page-lock-01/`, generisano sa
`node scripts/capture-page-lock-evidence.mjs`.

### PDP template — 🔒 DESIGN + UX LOCKED

| | |
| --- | --- |
| Datum | 2026-08-16 |
| Status | `DESIGN + UX LOCKED` |
| Viewport-i | 1440, 1024, 768, 390, 360 |

Reprezentativni slučajevi: R-M sa PI + TDS (`2210-onyx-activator`), baslac sa
novim TDS linkom (`baslac-60-20-razredjivac`), Cosmos sprej 400 ml
(`cosmos-lac-automotive-250-400-ml-antichip-250-white`), 1 L
(`rm-pasta-190-1l`), 3,5 L (`baslac-35-m214`), 5 L bez slike
(`norbin-n15-020-5l`), family sa varijantama
(`/proizvodi/grupa/cosmos-lac-automotive-antichip`).

Odigrane interakcije:

- product scale — hero vizual ostaje različit po pakovanju (1 L → 301 px,
  3,5 L → 367 px) i čitljiv;
- quantity/package badge — „1 L", „3,5 L", „5 L", „400 ml" prikazani tačno;
- dokumentacioni accordion — `aria-expanded` se menja u oba smera, PDF link je
  hit-testabilan, `target="_blank" rel="noopener noreferrer"`, fajl vraća
  `200 application/pdf`;
- technical accordion — otvaranje i zatvaranje;
- CTA — „Pošalji upit" i „Pronađi prodavnicu", uključujući sticky quick-inquiry;
- variant navigacija — trenutna varijanta je `button[aria-pressed="true"]`,
  ostale su pravi `<a href>` linkovi na svoj PDP;
- related sekcija — prikazuje se samo sa potvrđenim zapisima;
- mobile stacking na 390 i 360;
- Catalog → PDP → Back — scroll pozicija 1800 px vraćena tačno.

Honest fallback potvrđen: proizvod bez slike prikazuje „Vizuel u pripremi",
proizvod bez dokumenta prikazuje „U pripremi" umesto praznog ili lažnog stanja.

Blokeri: nema.

### Cosmos LAC — 🔒 DESIGN + UX LOCKED

| | |
| --- | --- |
| Datum | 2026-08-16 |
| Status | `DESIGN + UX LOCKED` |
| Viewport-i | 1440, 1024, 768, 390, 360 |

Odigrane interakcije:

- hero i immersive crno okruženje — kompozicija i rotacija konzervi;
- product-family interakcija — 7 family kartica vodi u filtriran katalog;
- application discovery — Auto / Metal / Drvo / Bicikl / Dekor / Art / Radionica;
- linkovi ka katalogu, PDP-u i `/katalozi` — `?brend=cosmos-lac&q=…` stvarno
  filtrira (provereno: Flame → 96 proizvoda, search polje popunjeno);
- range brojač — završava na 669, isto što hero tvrdi;
- product scale i desktop/tablet/mobile kompozicija;
- reduced-motion — `useScrollProgress` i `CounterUp` imaju eksplicitne
  reduced grane koje postavljaju konačnu vrednost umesto da sadržaj ostave
  skriven; nijedan tekstualni čvor nije zatečen sa `opacity: 0` ili
  `visibility: hidden` posle settle-a.

Pronađen bloker: stranica nije imala `<main>` landmark — jedina brand
stranica bez njega (Befar, Carfit, baslac, R-M, Norbin i Carsystem ga imaju).

Korekcija: `components/brand/cosmos/CosmosBrandPage.tsx` — wrapper `div`
zamenjen elementom `main`. Klasa i `data-brand-page` ostali isti, pa sticky
offset sistem i izgled nisu dirnuti. Provereno posle izmene: `main` = 1,
`data-brand-page` i dalje aktivan, isti H1, 38 slika, 71 kontrola,
`docOverflow` = 0.

Cosmos identitet nije homogenizovan sa neutralnom Carsystem platformom.

### Befar — 🔒 DESIGN + UX LOCKED

| | |
| --- | --- |
| Datum | 2026-08-16 |
| Status | `DESIGN + UX LOCKED` |
| Viewport-i | 1440, 1024, 768, 390, 360 |

Odigrane interakcije:

- skala tvrdoće — `role="listbox"` sa pet `role="option"` kontrola,
  `aria-selected` se prebacuje tačno;
- pairing pravilo — svaka tvrdoća prikazuje čime se radi („Tečna ili kremasta
  pasta", „Politura ili zaštita laka");
- perforation/open-cell identitet — sopstveno mapiranje boja za Plus i
  Opencell linije, eksplicitno objašnjeno u tekstu;
- geometrija — `aria-pressed` toggle grupa 150→125 / 180→150 / 220→170 mm;
- product variant discovery — po boji, 25 × 150 i 50 × 150 mm PDP linkovi;
- realne slike — 32 slike, sve se učitavaju, sve sa `alt`;
- CTA i linkovi — `/katalog?brend=befar`, `/prodavnice`, `/kontakt`;
- responsive i touch na 390 i 360.

Nedostatak manufacturer PDF kataloga nije tretiran kao bloker — legitiman
dokument ne postoji i nije izmišljen.

Record-level rupa prikazana pošteno: „Žuta" nema PDP jer taj artikal nema
stranicu, pa stranica umesto linka piše koje izvedbe postoje, a koje nisu deo
ponude.

Blokeri: nema.

### `/katalozi` — 🔒 DESIGN + UX LOCKED

| | |
| --- | --- |
| Datum | 2026-08-16 |
| Status | `DESIGN + UX LOCKED` |
| Viewport-i | 1440, 1024, 768, 390, 360 |

Odigrane interakcije:

- 25 javnih brand dokumenata, 25 kartica, 25 cover slika;
- brand filteri — Sve 25 / Carsystem 8 / C.A.R.FIT 1 / Cosmos 1 / baslac 15,
  zbir 25, `aria-pressed` ekskluzivan;
- URL state — `?brand=<slug>`, deep-link `/katalozi?brand=baslac` vraća 15
  kartica i tačno stanje dugmadi posle punog reload-a;
- prazan rezultat — `?brand=nepostojeci-brend` daje 0 kartica i poruku „Za
  ovaj brend trenutno nemamo javno dostupnu dokumentaciju.", bez pada i bez
  overflow-a;
- PDF href — svih 25 vraća `200 application/pdf`;
- cover putanje — svih 25 se renderuje (potvrđeno snimkom; `HEAD` na Next
  image optimizer vraća 400 jer podržava samo `GET`, što je osobina alata a ne
  greška stranice);
- keyboard/focus — `Tab` fokusira filter čip, `:focus-visible` daje vidljiv
  outline 2 px u akcentnoj boji;
- desktop/tablet/mobile kartice.

`brand` / `brend` alias ostaje **P2**, ne bloker: javni UI i svi linkovi na
sajtu koriste funkcionalni `brand` oblik na `/katalozi` i `brend` na
`/katalog`, i oba rade. Nije proširivano u novi URL-state sistem.

Blokeri: nema.

---

## Napomena o metodu merenja

Provera je rađena u automatizovanom browser panelu u kom je
`document.visibilityState === "hidden"`, pa `requestAnimationFrame` ne radi
između akcija. Posledica: rAF-vođena stanja i `loading="lazy"` slike privremeno
izgledaju „zaglavljeno" (`naturalWidth === 0`, brojač na 0). Svaki takav nalaz
je pre prijave proveren snimkom ekrana, koji pumpa frejm i pokazuje stvarno
stanje. Nijedan od tih nalaza nije bio stvarna greška stranice.
