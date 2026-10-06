# Krug popune slika i pregled pozadina — 2026-10-06

Grana `fix/image-gaps-2026-10` (od `main` 2e67921). Ništa nije objavljeno na produkciju niti pushovano.

## 1. Brojke

| | Broj |
|---|---|
| Pregledanih stranica u browseru (sitemap + 10 dodatnih ruta) | **1226** (1167 PDP, 25 strana kataloga + 5 filtera po brendu, 10 brend stranica, 4 kategorije, 6 programa, ostale) |
| Pregledanih URL-ova varijanti (`?varijanta=`), koje sitemap ne sadrži | **774** |
| Kartica proizvoda u katalogu (pun infinite scroll `/katalog`) | **1167** |
| Identiteta slika proizvoda (runtime katalog) | **1806** (1801 pre kruga; +5 jer su grupe GHD THINNER i GHD HARDENER dobile sliku po članu) |
| Zatečeno nedostataka slika proizvoda (placeholder) | **246** identiteta |
| Zatečeno ostalih nedostataka | 7 baslac slotova po zapremini (136 nijansi), 17 fotografija na brend stranicama u 6 grupa (Carsystem 13 fajlova, Norbin 2, R-M 2), 3 slučaja generičke/tuđe slike, 1 planiran slot |
| **Popunjeno** | **62 slike** → 57 zatečenih identiteta + 5 članova GHD grupa (R-M 26, baslac 30, Norbin 6) |
| **Nerešeno (spisak)** | **206 unosa**: 189 slika proizvoda (SATA 153, R-M 17, Cosmos Lac 11, baslac 4, Norbin 4), 7 slotova po zapremini, 6 grupa fotografija brend stranica, 3 generičke slike, 1 planiran slot |
| Pokvarene slike / neuspela učitavanja / reference na nepostojeći fajl | **0** u browseru; 17 referenci na nepostojeće fajlove u kodu, sve obrađene fallback-om (Carsystem 13 → u spisku; baslac `primer-process` se više ne čita; 3 su šabloni putanja) |

Posle uvoza, ponovljeni pregled celog sajta: pojave „Vizuel u pripremi” pale su sa 729 → 546 na stranama kataloga i 595 → 321 na PDP-ovima.

## 2. Fajlovi

- `ADDED_IMAGES.md` / `.csv` — evidencija svake dodate slike: proizvod, stranica, lokalni fajl, izvor (portal asset / URL originala), osnov potvrde identiteta, obrada, SHA originala.
- `UNRESOLVED_IMAGES.md` / `.csv` — jedan red po resursu, sa svim stranicama gde nedostaje, razlogom, proverenim izvorima i predlogom pretrage.
- `browser-placeholder-pages.json` — gde je placeholder stvarno viđen u browseru (ulaz za kolonu „Stranice”).
- `background-proposal/` — predlog pozadine iza slika (CSS + uporedni snimci).
- Skripte: `scripts/catalog/build-image-gap-imports.py` (uvoz, `--check` za proveru), `scripts/catalog/build-image-gap-report.py` (izveštaj).

## 3. Izvori i pravila

- **R-M i baslac — Surventis Brand Portal** (hub 51 / hub 54), originali preko istog API-ja kao dugme „Download original” (veličina fajla = zapis asseta, ne CDN pregled). Dozvola dobavljača za upotrebu na sajtu je od ranije u evidenciji (2026-09-28). R-M: pored pretrage po nazivu, vizuelno je pregledano svih 808 neimenovanih „composite” packshotova — tako je nađeno 20 od 26 slika.
- **Norbin — renderi proizvođača sa sajta distributera Väritikka Oy** (varitikka.fi), jer norbin-paint.com nema slike, a portal nema Norbin biblioteku. Sajt distributera nema zabranu upotrebe; render je delo proizvođača, pa je `rightsBasis: OWNER_CONFIRMATION_REQUIRED` — **pre objave na produkciju vlasnik potvrđuje pravo**.
- Slika je dodata samo ako etiketa na originalu nosi tačnu šifru i naziv zapisa (i pakovanje kada je zapis vezan za pakovanje). Odbijeni su, između ostalog: „A 2540 BLENDING FLASH” (druga linija od AGILIS A 2540), A 2P35 limenka (zapis je AM 2P35 sprej), DIAMONT BC 105 za „DIAMONT bezbojni lak”, H 2P84 za H 2P80, GHD HARDENER H 5450 za H 700, HB 10S sa kineskom etiketom.
- Obrada: samo obrezivanje praznog ruba (providnog ili belog) + skaliranje na ≤1600 px, WebP q90, sRGB profil zadržan. Pozadina sa belih originala (baslac, Norbin N75-021, N15-V20, N75-V21) **nije** uklanjana — izdvajanje alfe bi probušilo belu etiketu; u tamnoj temi se vide kao bela pločica, isto kao postojeći baslac packshotovi.
- Molotow, 3M i sia nisu vraćeni. Identitet, šifre, cene, opisi, URL-ovi i asortiman nisu menjani. Postojeće ispravne slike nisu dirane.
- SATA (sva prava zadržana, bez javne dozvole) i Cosmos Lac (uslovi zabranjuju komercijalnu upotrebu bez pisane dozvole) — ništa nije preuzeto; u spisku su sa razlogom. Napomena: URL-ovi SATA slika u manifestu su od 2026-09-24 zastareli (404).

## 4. Mreža iza slika („kockice”) — nalaz po slučaju

Proverena su oba moguća izvora:

1. **Ugrađeno u fajl** — dva nezavisna detektora nad svih 2274 slika u `public/` i `assets/`: nijedna slika koja se servira nema ugrađenu šahovnicu. Jedini pogodak je `assets/cikica-spray/source/frame-01.png` (izvorni kadar, ne koristi se na sajtu). Najbliži „lažni” pogodak (`carsystem-2k-clear-voc-hs-sr.webp`) je mreža odštampana na samoj etiketi limenke. Ranije dostavljeni baslac PNG-ovi sa ugrađenom šahovnicom (content register) nikad nisu objavljeni.
2. **CSS** — svi vidljivi slučajevi su CSS pozadine (linijska mreža / pruge), nijedan nije pomoćni prikaz providnosti:

| Mesto | CSS | Vidljivost iza slike |
|---|---|---|
| `/brendovi/carsystem` — kartice proizvoda | `CarsystemBrandPage.module.css` `.productCardVisual` (mreža 48 px) | **jasno**, obe teme — najverovatniji uzrok utiska „transparentnosti” |
| `/brendovi/rupes` (i druge strane na `BrandProgramPage`) — logo pločica | `BrandProgramPage.module.css` `.logoStage` (24 px) | vidljivo u tamnom hero bloku |
| `/brendovi/rm` — slotovi bez fotografije, Refinity sekcija | `RmBrandPage.module.css` `.productSlotGrid`, `.refinitySection` (80 px) | slot: blago; Refinity: dekor sekcije iza fotografija |
| `/brendovi/norbin` — kartice bez fotografije | `NorbinBrandPage.module.css` `.stockedNoImage` (dijagonalne pruge) | jasno (placeholder) |
| `/brendovi/carfit` — hero | `CarfitBrandPage.module.css` `.hero` / `.gridSkin` (56 px) | dekor celog hero bloka, prolazi i iza packshota |
| `/`, `/prodavnice` — učitavanje mape | `CarsystemMap.module.css` `.mapLoading` | samo dok se mapa učitava |
| Katalog i PDP (`ProductVisualSurface`) | `.baseLayer` (10/34 px) | **nije vidljivo** — sloj je nulte veličine; ovo je već mirna površina i uzor za predlog |

## 5. Predlog pozadine (nije primenjen na sajt)

„Studio” površina: jedna mirna boja sa vrlo blagim vertikalnim prelazom i slabim svetlim jezgrom iza proizvoda, usklađena sa postojećom površinom kartice u katalogu (svetla ≈ `oklch(0.945 0.004 255)`, tamna `oklch(0.182 0.01 255)` → predlog `0.968→0.935` i `0.235→0.19`). Tamna varijanta je za nijansu svetlija od kataloga da crne i tamnoplave ambalaže ne utonu (vidi disk F.23 na snimku). Posebne boje se ne uvode: „roletna” boje proizvoda/serije u katalogu ostaje kako jeste (potvrđeni izvori boje). Površine koje stoje u uvek-tamnom (RUPES logo pločica) ili uvek-svetlom (Norbin) bloku zadržavaju svoju temu.

Snimci (pre / posle, svetla / tamna): `background-proposal/predlog-desktop.jpg`, `predlog-telefon.jpg`; uzor: `referenca-katalog-pdp.jpg`. CSS predloga: `background-proposal/studio-surface-proposal.css` (ubacivan samo u snimke).

**Preporuka:** primeniti studio površinu na `.productCardVisual` (Carsystem), `.logoStage`, `.productSlotGrid` i `.stockedNoImage`; Carfit i R-M Refinity mrežu zadržati kao dekor sekcije, ali iza samog packshota (Carfit hero kartica) staviti mirnu površinu. Primena čeka Vašu potvrdu.

## 6. Provere i ograničenja

Rezultati provera su u završnom izveštaju sesije. Ograničenja pregleda:
- Pretraga (dijalog) nije posebno snimana — koristi istu karticu i isti izvor slike kao katalog, a sve kartice su pregledane kroz pun infinite scroll.
- Snimci za dokaz su pravljeni na lokalnom `next start` buildu ove grane; produkcija je iza maintenance režima.
- Redovi tabele šifara (ARTICLE, 38 identiteta) provereni su statički (fajl postoji, slika pripada redu), ne klikom na svaki red.
- Norbin slike čekaju potvrdu prava vlasnika pre produkcije (`OWNER_CONFIRMATION_REQUIRED`).
- Odluke vlasnika ostaju netaknute u `shared-image-groups.json` (GHD grupe su i dalje označene kao „odloženo”); inventar ih sada prepoznaje kao rešene jer svaki član ima sopstvenu sliku.
