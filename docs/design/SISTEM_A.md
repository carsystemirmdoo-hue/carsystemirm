# Sistem A — zajednički dizajnerski sistem

Odluka vlasnika 2026-10-14: pravac A („Precizni sistem”) za ceo sajt, uključujući
ranije zaključane površine u meri potrebnoj za primenu sistema. Ovaj dokument je
pravilo primene; tokeni su u `app/globals.css` (blok „SISTEM A”).

## Opseg

- `data-ds="a"` je na `<html>` (`app/layout.tsx`), pa pravila važe na svim stranicama.
- Moduli prevode svoje lokalne promenljive na zajedničke tokene i menjaju samo
  tipografiju, kontrole, linije, uglove i razmake. Raspored, fotografije, kompozicije
  i animacije ostaju, osim kada su navedeni kao ispravka.
- Pravila se pišu kao `[data-ds="a"]`-scope blok na kraju modula ili kao izmena
  postojećeg pravila; u oba slučaja tokeni, nikad nove literalne boje.

## Tokeni (sažetak)

| Uloga | Token | Svetla | Tamna |
|---|---|---|---|
| Pozadina | `--ds-c-bg` | #F6F7F8 | #0D1013 |
| Površina | `--ds-c-surface` | #FFFFFF | #15191E |
| Površina 2 | `--ds-c-surface-2` | #EEF0F2 | #1C2128 |
| Scena proizvoda | `--ds-c-scene-a/-b` | #F3F4F6→#E7EAED | #232830→#1A1E24 |
| Tekst | `--ds-c-text` | #0E1114 | #EEF0F3 |
| Tekst 2 | `--ds-c-text-2` | #4A505A | #B4BAC2 |
| Tekst 3 (najsvetliji dozvoljen) | `--ds-c-text-3` | #626873 | #8F96A0 |
| Linija / jača / polje | `--ds-c-line`, `-line-strong`, `-field` | #DCDFE3 / #B4B9C1 / #80868F | #2A3038 / #434A54 / #6E7682 |
| Akcija (ispuna) | `--ds-c-accent` (+`-hover`, `-press`) | #C8102E | #D21A33 |
| Crveni tekst | `--ds-c-accent-text` | #B20E29 | #FF6B66 |
| Izabrano | `--ds-c-accent-soft` | #FBEAED | #3A1A1F |
| Fokus | `--ds-c-focus` | #C8102E | #FF958A |

Brend akcenti (samo crtica, aktivno stanje, primarno dugme, marker):

| Brend | Identitet | Ispuna (beli tekst) | Tekst svetla | Tekst tamna |
|---|---|---|---|---|
| R-M | #E3000F | #E3000F | #D1000E | #FF6B66 |
| Carsystem | #E30613 | #E30613 | #D10512 | #FF6B66 |
| SATA | #E2001A | #E2001A | #D10018 | #FF6B66 |
| C.A.R.FIT | #E20613 | #E20613 | #D10512 | #FF6B66 |
| Baslac | #21A0D2 | #1A78A0 | #1A78A0 | #4CB8E6 |
| Norbin | #0082BB | #0076A9 | #0076A9 | #3AA6DC |
| Cosmos Lac, Befar, Yachtcare | #20242C | #20242C | #20242C | #EEF0F3 |

## Tipografija

| Uloga | Token / vrednost |
|---|---|
| H1 stranice | Archivo 800, `--ds-font-h1` (48/40/32), razmak `--ds-tracking-h` (−0,02 em), prored 1,05 |
| H2 sekcije | Archivo 700, `--ds-font-h2` (36/30/26), −0,01 em, prored 1,1 |
| H3 bloka | Plex Sans 600 ili Archivo 700, `--ds-font-h3` (22/20/19) |
| Uvod | Plex Sans 400, `--ds-font-lead` (19/18/17), prored 1,55 |
| Tekst | Plex Sans 400, 16 px, prored 1,6 |
| Sporedni | 14 px (`--ds-font-small`) |
| Napomena / pravno | 13 px (`--ds-font-legal`) |
| Oznaka (nadnaslov, meta) | Plex Mono 500, 12 px (`--ds-font-label`), `--ds-tracking-label` (0,08 em), velika slova samo do 4 reči |
| Šifra | Plex Mono 500, 14 px (`--ds-font-code`) |
| Naziv u kartici | Plex Sans 600, `--ds-font-card-title` (17/16/15) |

Pravila:

- Najmanji tekst je 12 px. Ništa ispod `--ds-font-label`.
- Razmak slova naslova nikad ispod −0,02 em; prored naslova ≥ 1,0.
- Plex Sans samo 400/500/600/700; Archivo 700/800 (900 samo u izuzecima ispod).
- Rečenice i nazivi nikad velikim slovima.

## Kontrole

| Element | Vrednost |
|---|---|
| Dugme | visina L 52 / M 44 / S 36, ugao 2 px, Plex Sans 600 15 px, bez podizanja i senke |
| Primarno | ispuna `--ds-c-accent`, beli tekst; miš `-hover`, pritisak `-press` |
| Sekundarno | okvir 1 px boje teksta, providno; miš `--ds-c-surface-2` |
| Na fotografiji / boji | belo dugme sa tamnim tekstom ili beli okvir |
| Tekstualna veza | podvlaka 1 px (`--ds-c-line-strong`), na miš 2 px boje teksta; strelica → za unutrašnje stranice, ↗ samo spoljni sajt i PDF |
| Polje | visina 48, okvir 1 px `--ds-c-field`, ugao 2 px, oznaka iznad (Plex Sans 600 14 px) |
| Čip / izabrano | okvir 1 px `--ds-c-line-strong`; izabrano 2 px `--ds-c-accent` + `--ds-c-accent-soft` |
| Fokus | `outline: 2px solid var(--ds-c-focus); outline-offset: 2px` |
| Nedostupno | `--ds-c-surface-2`, tekst `--ds-c-text-3`, bez prelaza |
| Dijalog, meni, plutajući sloj | ugao 4 px (`--ds-overlay-radius`) |
| Kartica, panel | ugao 2 px, linija `--ds-c-line`, bez senke; miš: `--ds-c-line-strong` |

Okrugli elementi koji su krug po značenju (tačka statusa, uzorak boje, indikator
karusela, avatar) ostaju krugovi.

## Izuzeci (karakter brendova)

- **Kampanjski naslov** (hero početne i brendova): do 88 px, Archivo 800/900,
  velika slova dozvoljena (Cosmos, nazivi sistema R-M), razmak −0,03 do +0,04 em,
  prored ≥ 0,95; slova se ne dodiruju.
- **Kompozicija brenda**: raspored, ilustracija, ton fotografije, ritam sekcija.
- **Atmosfera teme**: sekcija može biti uvek tamna ili uvek svetla; u drugoj temi
  ne sme ostati nečitljiva ili „pokvarena” (npr. krem blok R-M u tamnoj temi).
- Ne izuzimaju se: polja, dugmad, čipovi, kartice proizvoda, tabele, putanja,
  napomene o cenama i veličine teksta za čitanje.

## Zabrane

- Bez mrežaste (grid) pozadine — ni CSS linija u obliku mreže, ni slika mreže.
- Bez tvrdnji bez izvora („Na stanju”, „Proverio tehnički tim”, „zvanični distributer”).
- Bez novih literalnih boja u modulima; samo tokeni.

## Širine po nameni

- Tekst: `--ds-w-measure` (68ch).
- Kampanja: fotografija do ivice ekrana, tekst poravnat sa kičmom (`--ds-container-max`).
- Katalog i liste: kičma; kolone se dodaju na velikim ekranima (kartica 260–340 px).
- Stranica proizvoda: kičma; naslov ≤ 18ch, opis ≤ 68ch.
- Poslovne tabele (nalog kupca, portal): puna širina umanjena za margine, najviše 1920 px.

## Provera

Svaka izmenjena stranica: 390 / 768 / 1024 / 1440 / 2560 px, svetla i tamna tema,
bez vodoravnog prelivanja, bez preklapanja teksta i kontrola, axe bez nalaza
kontrasta, fokus vidljiv.
