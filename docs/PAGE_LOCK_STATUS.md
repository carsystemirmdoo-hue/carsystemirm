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
