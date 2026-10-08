---
id: SV-0223
slug: koliko-sprejeva-za-deo
naslov: Koliko sprejeva treba za jedan deo
metaNaslov: "Koliko sprejeva treba za jedan deo: računica"
opis: "Kako se iz površine dela i izdašnosti iz tehničkog lista procenjuje broj limenki boje, prajmera i laka, gde proizvođač navodi izdašnost i zašto treba rezerva."
kategorija: sprejevi
podtema: potrošnja spreja
tip: postupak
publika:
  - pocetnik
  - hobista
glavnoPitanje: Kako se procenjuje koliko sprejeva boje i laka treba za jedan deo?
namera: postupak
dodatnaPitanja:
  - Gde proizvođač navodi izdašnost?
  - Da li se isto računa za prajmer i lak?
poreklopitanja:
  tip: pronadjeno-u-izvoru
  napomena: "Pitanje koliko boje u spreju treba za zadnji branik postavlja se na forumu micra.org.uk (q103); forum služi samo kao dokaz pitanja."
  izvori:
    - https://micra.org.uk/threads/how-much-paint-required-for-rear-bumper.71165/post-774483
brendovi:
  - cosmos-lac
  - carsystem
  - carfit
proizvodi:
  - grupa:cosmos-lac-ral
  - carsystem-rallye-spray-gloss
  - carsystem-clear-coat-spray
  - carfit-black-paint-spray
  - carfit-2k-clearcoat-spray
povezani:
  - SV-0021
  - SV-0211
  - SV-0213
  - SV-0217
izvori:
  - id: cosmos-ral-tds
    naziv: "Cosmos Lac, TDS RAL Line"
    url: https://cosmoslac.com/pdfs/products/en/ral.pdf
    verzija: "04, 9/7/2026"
    datumIzvora: 2026-07-09
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: cosmos-acrylic-primer-tds
    naziv: "Cosmos Lac, TDS Acrylic Primer & Filler"
    url: https://cosmoslac.com/pdfs/products/en/acrylic-primer.pdf
    verzija: "02, 16/06/2026"
    datumIzvora: 2026-06-16
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: cosmos-acrylic-varnish-tds
    naziv: "Cosmos Lac, TDS Acrylic Varnish"
    url: https://cosmoslac.com/pdfs/products/en/acrylic-varnish.pdf
    verzija: "02, 17/06/2026"
    datumIzvora: 2026-06-17
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: cs-rallye-tds
    naziv: "Carsystem, Technical Data Sheet Rallye-Spray glänzend (paint spray – glossy)"
    url: https://www.carsystem.org/fileadmin/products/datasheets/tds-rallye-spray-glaenzend-glossy.pdf
    verzija: "v.03, 03/2021"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: cs-clear-coat-spray-tds
    naziv: "Carsystem, Technical Data Sheet Klarlack-Spray (clear-coat spray)"
    url: https://www.carsystem.org/fileadmin/products/datasheets/tds-klarlack-spray-clear-coat-spray.pdf
    verzija: "v.02, 03/2021"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: cs-2k-hs-spray-tds
    naziv: "Carsystem, Technical Datasheet 2K High-Speed Clearcoat Spray"
    url: https://www.carsystem.org/fileadmin/products/datasheets/tds-2k-high-speed-klarlack-spray.pdf
    verzija: "V02, 26.11.2012"
    datumIzvora: 2012-11-26
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: cf-black-paint-tds
    naziv: "C.A.R.FIT, Technical Data Sheet Black Paint Spray"
    url: https://carfitrepair.com/wp-content/uploads/2023/05/car-fit-black-paint-spray-technical-data-sheet.pdf
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: cf-2k-clear-tds
    naziv: "C.A.R.FIT, Technical information 2K Clear Coat Spray"
    url: https://carfitrepair.com/wp-content/uploads/2024/07/car-fit-2k-clearcoat-spray-technical-data-sheet.pdf
    verzija: "17. 2. 2020. (štampano 21. 6. 2024.)"
    datumIzvora: 2020-02-17
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: cf-hi-build-tds
    naziv: "C.A.R.FIT, Technical Data Sheet 1K Hi-Build Primer Filler Spray"
    url: https://carfitrepair.com/wp-content/uploads/2023/05/car-fit-1k-hi-build-primer-filler-spray-technical-data-sheet.pdf
    pristupljeno: 2026-10-08
    tip: tehnicki-list
prioritet: 1226
razlogPrioriteta: Dopunjuje osnovni vodič teme konkretnim pitanjem; raspoređeno naizmenično sa drugim temama.
status:
  istrazivanje: zavrseno
  pisanje: napisano
  tehnickaProvera: nije-provereno
  jezickaProvera: nije-provereno
strucnaPotvrda:
  potrebna: false
  status: nije-potrebno
poslednjaProvera: 2026-10-08
ponovniPregled: 2027-04-08
---
Broj limenki se procenjuje tako što se površina dela podeli izdašnošću jedne limenke iz tehničkog lista, pa se doda rezerva za probu, preprašivanje i dodatni sloj. Izdašnost se razlikuje od proizvoda do proizvoda: za Carsystem Rallye-Spray list navodi 1,3 m² po limenci od 400 ml[^cs-rallye-tds], za C.A.R.FIT Black Paint Spray oko 1–1,5 m² po limenci[^cf-black-paint-tds], a za Cosmos Lac RAL 4 m² po litru[^cosmos-ral-tds]. Boja, prajmer i lak računaju se odvojeno, svaki prema svom listu.

## Korak 1: površina dela

Izmerite deo i izračunajte površinu (dužina puta širina) u kvadratnim metrima. Zakrivljen deo, kao što je branik, ima veću stvarnu površinu od pravougaonika koji ga obuhvata, pa merite po obliku ili dodajte rezervu. Ako se lakiraju i ivice ili unutrašnja strana, računajte i njih.

## Korak 2: izdašnost iz lista

| Proizvod | Izdašnost prema listu |
| --- | --- |
| Cosmos Lac RAL | 4 m² po litru; limenke od 400 ml i, za neke nijanse, 500 ml[^cosmos-ral-tds] |
| Cosmos Lac Acrylic Primer & Filler | 2 m² po limenci od 400 ml[^cosmos-acrylic-primer-tds] |
| Cosmos Lac Acrylic Varnish | 5 m² po litru[^cosmos-acrylic-varnish-tds] |
| Carsystem Rallye-Spray | 1,3 m² po limenci od 400 ml (teorijska izdašnost)[^cs-rallye-tds] |
| Carsystem Klarlack-Spray | 1–2 m² po limenci od 400 ml (teorijska izdašnost)[^cs-clear-coat-spray-tds] |
| Carsystem 2K High-Speed Clearcoat Spray | 0,5–0,75 m² po limenci, za suv sloj od oko 30 µm[^cs-2k-hs-spray-tds] |
| C.A.R.FIT Black Paint Spray | oko 1–1,5 m² po limenci[^cf-black-paint-tds] |
| C.A.R.FIT 2K Clear Coat Spray | 200 ml za oko 0,3–0,4 m², 500 ml za oko 0,8–1,0 m²[^cf-2k-clear-tds] |

Kada list daje izdašnost po litru, preračunajte je na limenku: za Cosmos Lac RAL to je 4 m² po litru puta 0,4 litra, odnosno oko 1,6 m² po limenci od 400 ml. To je računica iz podatka u listu[^cosmos-ral-tds], ne podatak proizvođača po limenci.

## Korak 3: uslovi pod kojima važi izdašnost

Izdašnost iz lista je teorijska vrednost, za određenu debljinu sloja i dobro pripremljenu podlogu. Carsystem je za svoj 2K lak daje za suv sloj od oko 30 µm[^cs-2k-hs-spray-tds], što odgovara dva prolaza iz istog lista. C.A.R.FIT navodi da izdašnost 2K laka zavisi od konzistencije i boje podloge[^cf-2k-clear-tds]. Većina listova ne kaže da li se izdašnost odnosi na jedan sloj ili na ceo preporučeni broj slojeva, pa vrednost tretirajte kao gornju granicu.

## Korak 4: rezerva

Opšte objašnjenje: deo boje iz spreja ode u preprašivanje i nikad ne stigne na deo, deo se potroši na probno prskanje, a nijanse koje slabije pokrivaju traže dodatni sloj. Zato kupite bar jednu limenku više nego što pokazuje računica. Za boju u nijansi vozila to je posebno važno, jer kasnije dopunjena limenka može da se malo razlikuje.

## Primer računice

Urednički primer, ne izmerena vrednost: deo površine oko 0,6 m², boja Carsystem Rallye-Spray sa izdašnošću od 1,3 m² po limenci[^cs-rallye-tds]. Računica daje manje od pola limenke, ali uz više slojeva, probu i preprašivanje realno je računati na jednu limenku i jednu u rezervi. Lak se računa posebno, prema svom listu.

## Pitanja i odgovori

### Gde proizvođač navodi izdašnost?

U tehničkom listu, obično u odeljku sa podacima o proizvodu. Na engleskom se podatak zove *coverage*, *theoretical coverage*, *consumption* ili *efficiency*, a navodi se po litru, po kilogramu ili po limenci. Kako se čita ostatak lista, objašnjava vodič [Kako se čita tehnički list](/vodici/kako-procitati-tehnicki-list).

### Da li se isto računa za prajmer i lak?

Da, ali svaki prema svom listu, jer se vrednosti dosta razlikuju. Za prajmer-punilac utiče i namena: C.A.R.FIT 1K Hi-Build nanosi se u jednom sloju od 15 µm kao prajmer, a u 2–3 sloja od 30–60 µm kao punilac, uz potrošnju od oko 1 m² po limenci[^cf-hi-build-tds]. Za veće poslove i materijale za pištolj vidi vodič [Koliko materijala treba za lakiranje](/vodici/koliko-materijala-za-lakiranje).
