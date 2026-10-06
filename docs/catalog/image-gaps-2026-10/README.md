# Krug popune slika i pozadine iza slika — 2026-10-06

Grana `fix/image-gaps-2026-10` (od `main` 2e67921). Ništa nije pushovano ni objavljeno na produkciju.

## 1. Konačne brojke (jedan izvor: runtime inventar + pregled u browseru)

Inventar = `npm run catalog:image-supply:generate` (`.cache/image-audit/IMAGE_IDENTITY_INVENTORY.csv`, isti generator kao canonical manifesti). Browser = tri kruga pregleda celog sajta na lokalnom `next start` buildu ove grane.

| | Broj |
|---|---|
| Pregledane stranice (sitemap + 10 dodatnih ruta) | **1226** (1167 PDP, 25 strana kataloga + 5 filtera po brendu, 10 brend stranica, 4 kategorije, 6 programa, ostalo) |
| Pregledani URL-ovi varijanti (`?varijanta=`, nisu u sitemap-u) | **774** |
| Kartice u katalogu (pun infinite scroll `/katalog`) | **1167** |
| Identiteti slika proizvoda | 1801 na početku → **1806** sada |
| Nedostajuće slike proizvoda (placeholder), u repou | **246 → 189** |
| Isto, kako bi izgledalo na Vercel Production | **195** (6 Norbin slika čeka potvrdu prava i tamo ostaje na placeholderu) |
| Pokvarene slike / neuspela učitavanja u browseru | **0** u sva tri kruga |

### Zašto 62 dodate slike, a manjak pao samo za 57

- 246 − 189 = **57 zatečenih identiteta je rešeno**: R-M 21, baslac 30, Norbin 6.
- Među tih 21 R-M su i dve **grupe** koje su se brojale kao po JEDAN identitet: GHD THINNER (GV 100/200/300/400) i GHD HARDENER (H 700/750/770). Za svaku oznaku postoji poseban packshot, pa je dodato 7 fajlova umesto 2. Grupe su zato prešle u 7 zasebnih identiteta.
- Odatle **+5** identiteta (1801 → 1806) i **62 = 57 + 5** dodate slike na mesto placeholdera.
- Uz to je zamenjena **1 postojeća pogrešna slika**: sistem ONYX HD je prikazivao kanister komponente HB 002, a sada prikazuje generičku ONYX HD limenku. Ukupno je u evidenciji 63 slike (`ADDED_IMAGES`).
- Bez novih fajlova, kroz Befar sync, ispravljene su **3 dodele** (jastučić za farove, jastučić za felne, M14 adapter).

### baslac nijanse: 136 (ranije su se pojavili i 135 i 136)

- Izvor je isti spisak baza koji koristi birač na sistemskoj stranici (`baslacPublicBases`). 136 baza nema sliku tačne zapremine:
  - Line 30: 1 L (17)
  - Line 35: 1 L (17) i 0,5 L (32)
  - Line 45: 5 L (2), 1 L (7), 0,5 L (49) i 0,1 L (12)
- Broj 135 je bio broj **URL-ova** na kojima je crawl video poruku: 134 baze preko svoje `?varijanta=` adrese i 1 adresa lica porodice (`?varijanta=baslac-basecoat-45`, koja otvara prvu bazu).
- Dve baze (45-R45, 45-W10) imaju sopstvene kartice proizvoda sa tačnom slikom. Na sistemskoj stranici se biraju samo klikom, pa ih crawl po adresama ne vidi. Konačan broj je **136**.

## 2. Šta je urađeno u ovom krugu

1. **Pozadine (odobreno):** CSS mreža i pruge iza slika zamenjene su mirnom „studio” površinom sa veoma blagim prelazom. Tokeni su u `app/globals.css`, usklađeni sa površinom kartice u katalogu (`--surface-muted`). Primena:
   - Carsystem kartice proizvoda;
   - RUPES/brend logo pločica (uvek taman blok);
   - R-M prazan slot (mreža uklonjena);
   - Norbin kartica bez fotografije (uvek svetla stranica);
   - Carfit prazan media slot (u uvek-tamnom hero bloku taman).
   Dekor sekcija (Carfit hero, R-M Refinity) nije diran — proizvod tamo stoji na punoj ćeliji, ne na mreži. Snimci: `zavrsni-snimci/01-pozadine-iza-slika.jpg`.
2. **ONYX HD:** generička ONYX HD limenka sa portala (asset 30819, bez šifre nijanse), po istom principu kao odobreni UNO HD.
3. **Befar:** Befar-ov zvanični katalog (str. 31, natpisi i šifre) pokazuje da je konusni jastučić onaj za **felne** (97200), ravan cilindrični za **farove** (83424), a M14 adapter je zasebna fotografija (97400). Ranije su sva tri proizvoda imala konusni jastučić i istu galeriju. Ispravljeno kroz izvor istine `data/befar-sync/manual-decisions.json` → `images` i `befar:sync:apply`. Sync provera daje 0 promena.
4. **baslac Line 30/35/45:**
   - Kada za zapreminu izabrane baze nema slike, sistemska stranica prikazuje **primer ambalaže linije**: generičku limenku linije bez šifre nijanse („45-W Basecoat”, „35-M Basecoat”, „Line 30 Topcoat”).
   - Uz sliku stoji natpis „Primer ambalaže linije — ne prikazuje izabranu nijansu ni zapreminu”, a alt tekst kaže isto.
   - Line 45 je usklađen: umesto limenke konkretne nijanse 45-W1010 sada stoji generička „45-W” limenka koju je vlasnik dostavio (pravo potvrđeno), sa natpisom „Primer ambalaže”.
   - Gde slika tačne zapremine postoji (Line 30/35, 3,5 L), ostaje ona.
5. **Norbin — čeka potvrdu prava:** 6 slika ima `rightsBasis: OWNER_CONFIRMATION_REQUIRED`.
   - `lib/supplied-image-rights.mjs` ih izostavlja kada je `VERCEL_ENV=production`, pa zapis tamo zadržava placeholder. Lokalno i na Preview-u se vide radi pregleda.
   - Test: `lib/supplied-image-rights.test.mjs`, deo `npm test`.
   - Kada potvrdite pravo, dovoljno je promeniti `rightsBasis` u `OWNER_CONFIRMED`.
   - Napomena: fajlovi postoje u `public/` i dostupni su po direktnoj adresi, ali ih nijedna stranica na Production ne koristi.
6. **GHD grupe:** u `shared-image-groups.json` status je sada `RESOLVED_PER_MEMBER_PACKSHOT`. Ranija odluka je sačuvana u `previousDecision`. Drugih odloženih grupa nema; odluke van ovog fajla nisu dirane.
7. **SATA i Cosmos Lac:** nastavljena potraga, ništa nije preuzeto.
   - SATA: za svih 153 artikla utvrđena je aktuelna stranica artikla na sata.com (`sata-current-official-urls.csv`). Za 133 postoji slika baš tog artikla, 7 ima samo sliku srodnog artikla, a 13 nema sliku. Prepreka je pravo upotrebe: SATA zadržava sva prava, a press/media dozvole nema.
   - Cosmos Lac: uslovi korišćenja zabranjuju komercijalnu upotrebu bez pisane dozvole, a Brand Kit je zaštićen lozinkom. Lokalni folder `assets/manufacturer/cosmos-lac/images` je preuzet sa sajta i vodi se kao „REQUIRES RIGHTS CONFIRMATION”. Kandidati iz njega navedeni su po proizvodu, ali nisu upotrebljeni.

## 3. Provere u browseru

- **Dijalog pretrage** (`/`, upiti 50-415, MatTOP, N55-V20, ONYX HD, M14, satajet; svetla/tamna × desktop/telefon): rezultati prikazuju tačne nove slike, a nerešeni (SATA, ONYX HD TROPICAL, HB 10S) pošten placeholder. Snimak: `zavrsni-snimci/04-dijalog-pretrage.jpg`.
- **Redovi tabele šifara** (`[data-variant-option]`): na Befar velcro i waffle jastučićima svaki klik menja `?varijanta=` i sliku u sliku tog reda, uključujući redove sa dostavljenim slikama (44805, 448031). SATA X 5500 (44 reda) ostaje na placeholderu. Snimak: `zavrsni-snimci/05-redovi-tabele-sifara.jpg`.
- Snimci izmena u obe teme, na telefonu i desktopu: `zavrsni-snimci/01–03`.

## 4. Fajlovi

- `ADDED_IMAGES.md` / `.csv` — svaka dodata slika: proizvod, stranica, lokalni fajl, izvor, potvrda identiteta, obrada i kolona **Production** (da / ne — čeka potvrdu prava). Poseban odeljak navodi slike koje čekaju potvrdu prava i ispravljene dodele.
- `UNRESOLVED_IMAGES.md` / `.csv` — 204 unosa, po jedan resurs: sve stranice, šta nedostaje, konkretan razlog, provereni izvori (za SATA tačna stranica i URL slike artikla) i predlog pretrage.
- `browser-placeholder-pages.json` — gde je placeholder viđen u browseru (treći krug).
- `sata-current-official-urls.csv` — aktuelne SATA stranice i slike po artiklu, bez cena.
- `background-proposal/` — prvobitni predlog (pre/posle), `zavrsni-snimci/` — stanje posle primene.
- Skripte: `scripts/catalog/build-image-gap-imports.py` (`--check`), `scripts/catalog/build-image-gap-report.py`.

## 5. Ograničenja

- Snimci i pregled su urađeni na lokalnom `next start` buildu ove grane. Produkcija je iza maintenance režima.
- U trećem krugu je lokalni optimizator slika posle velikog opterećenja zastao na AVIF kodiranju 12 slika (WebP je radio). Posle restarta servera iste slike se kodiraju za oko 1 s, a svih 1226 stranica je ponovo prošlo. Te slike nisu menjane u ovoj grani.
- Redovi tabele šifara provereni su klikom na po prvih 9 redova kartica Befar velcro (od 15), Befar waffle (od 11) i SATA X 5500 (od 44), u obe teme i na oba ekrana. Ostale kartice sa redovima koriste istu komponentu i iste podatke, a statički su proverene (slika postoji i pripada redu).
- Norbin slike čekaju potvrdu prava. SATA i Cosmos čekaju pisanu dozvolu proizvođača.
