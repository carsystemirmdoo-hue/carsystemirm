# Mobilni i desktop raspored — organizacija fajlova (2026-10-22)

Cilj je da se raspored na telefonu može uređivati nezavisno od desktopa. Zajednička ostaje logika: podaci, poslovna pravila, cene, izbor artikla, prijava i korpa. Nema dve kopije pravila ni dve grane sajta.

## Pravilo

1. **Jedna komponenta i jedan DOM.** Logika i struktura ostaju u jednoj komponenti. Ne renderuju se dve verzije strane, pa se teške slike, video i interaktivni elementi ne učitavaju dvaput.
2. **Raspored u odvojenim fajlovima:**
   - `<ime>.module.css`: zajednički izgled (boje, tipografija, kartice, stanja);
   - `<ime>.desktop.module.css`: samo `min-width` upiti, iznad granice komponente;
   - `<ime>.mobile.module.css`: samo `max-width` upiti, do granice. Ovde se uređuje telefon.
3. **Jedna ulazna tačka.** Komponente uvoze `<ime>.styles.ts` (`mergeResponsiveStyles`), koji spaja klase sva tri fajla pod istim imenom. Direktan uvoz delova je zabranjen (`lib/ui/responsiveStyles.test.mjs`): Next ne garantuje redosled CSS delova, pa je takav uvoz već jednom pokvario mobilni prikaz.
4. **Raspored ne zavisi od redosleda učitavanja.** Pravila u `.desktop`/`.mobile` imaju udvostručenu prvu klasu (`scripts/css/bump-responsive.py`). Zatim `scripts/css/winner-check.py <original> <zajednički> <mobilni> <desktop> --fix` ponavljaj dok ne prijavi 0 promena. Za svaki par pravila na istom elementu i svojstvu on poredi ko je pobeđivao u originalu (specifičnost, pa redosled) sa onim ko pobeđuje sada. Strana koja je ranije pobeđivala dobija još jedan stepen.
5. **Elementi koji postoje samo na telefonu** (npr. mobilni meni) su zasebne komponente sa svojim stilovima (`HeaderMobileMenu.tsx`). Montiraju se samo kada su potrebni.
6. **Podela postojećeg CSS-a** se radi skriptom `scripts/css/split-responsive.py <fajl> --breakpoint <px>`. Posle nje obavezno se pokreću `bump-responsive.py` i `winner-check.py --fix` (do 0 promena), zatim poređenje snimaka pre/posle na više širina i u obe teme. Upozorenje iz prakse: ovaj korak je otkrio 4 promene na stranici proizvoda koje snimci na prvi pogled nisu pokazali kao grešku (ivice parnih stavki, razmak harmonike).

## Pregled

| Stranica / komponenta | Sadašnja organizacija | Mobilni fajl | Desktop fajl | Zajednička logika | Status |
|---|---|---|---|---|---|
| Header — mobilni meni | ranije u `Header.tsx` (1.836 linija) i `Header.module.css` | `components/layout/HeaderMobileMenu.tsx` + `.module.css` | `Header.tsx` + `Header.module.css` (traka, padajući meniji) | stanje, fokus, istorija, pretraga u `Header.tsx`; podaci u `navigation-data.ts`; delovi u `HeaderParts.tsx` | ✅ izdvojeno (`274cbc66`) |
| Header — traka i desktop padajući meniji | `Header.module.css` (14 media upita) | — | `Header.module.css` | isto | ⏳ sledeći korak: podela trake po širini |
| Katalog i filteri | `CatalogPage.module.css` (2.182 linije, 20 upita) za 15 komponenti; fioka i bočni filteri su isti DOM | `components/catalog/CatalogPage.mobile.module.css` (do 900 px) | `CatalogPage.desktop.module.css` (od 901 px) | `CatalogExplorer.tsx` (filteri, redosled, pretraga, povratak), `CatalogFilters.tsx` | ✅ izdvojeno (`84bf37a9`) |
| Stranica proizvoda | `ProductDetailExperience.module.css` (3.405 linija, 9 upita) za 17 komponenti | `components/product/ProductDetailExperience.mobile.module.css` (do 1023 px) | `ProductDetailExperience.desktop.module.css` (od 1024 px) | `ProductDetailPage.tsx`, kontekst varijante, panel kupovine | ✅ izdvojeno (`b779458e`) |
| R-M/Baslac izbor baza i pakovanja | `FamilyBasePdp.module.css` | `components/product/family/FamilyBasePdp.mobile.module.css` (do 60rem) | `FamilyBasePdp.desktop.module.css` | `FamilyBasePdp.tsx` (izbor baze, zapremina, adresa), `rm-family-bases.ts`, Baslac adapter, korpa | ✅ izdvojeno (`b06d3751`, `84bf37a9`) |
| Široke tehničke tabele | Norbin (`NorbinTechTable.tsx` + `NorbinBrandPage.module.css`, lepljivo zaglavlje), saveti (`SavetiBody.tsx`) | — | — | podaci tabela | ⏳ planirano |
| Složeni blokovi brend stranica | jedan CSS po brendu: R-M 4.741 linija, Carsystem 3.521, Baslac 3.329, C.A.R.FIT 2.248, Befar 2.115, Norbin 1.604 | — | — | podaci brendova (`*BrandData.ts`) | ⏳ planirano, istim alatom |

## Prelazak između širina i orijentacije

Provera prolazi 23/23, u obe teme, na nizu uspravno → položeno → tablet → desktop → telefon:
- izabrana baza, zapremina, fotografija i adresa ostaju iste;
- filter kataloga i broj rezultata ostaju isti, bez horizontalnog prelivanja;
- mobilni meni otvoren pa desktop širina: meni se zatvara i skrol se otključava (commit „fix(header): mobilni meni se zatvara pri prelasku na desktop širinu“);
- korpa: artikal dodat na telefonu (položeno) vidi se na desktopu kao tačan artikal i pakovanje.

## Provera posle svakog izdvajanja

- **Poređenje snimaka piksel po piksel, pre i posle**, više širina oko granice, obe teme:
  - katalog: 10 širina, filteri otvoreni i skupljeni;
  - stranica proizvoda: 5 tipova × 10 širina;
  - izbor baza: 9 širina;
  - header: traka, padajući meni, mobilni meni i sekcija, uspravno i položeno.
- Šum se odvaja tako što se nova verzija snimi dvaput: razlika koja postoji i između dva snimka iste verzije je šum (animacije, skeleton).
- **Ponašanje:**
  - izbor baze, zapremina i istorija;
  - jedan „Nazad“ do kataloga;
  - korpa (BC 101 → 1 L, BC 100 → 4 L);
  - mobilni meni (fokus, Escape, „Nazad“, link).
