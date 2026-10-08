---
id: SV-0021
slug: koliko-materijala-za-lakiranje
naslov: Koliko materijala treba za lakiranje dela ili celog automobila
metaNaslov: "Koliko boje i laka treba za deo ili ceo automobil"
opis: "Kako se procenjuje potrebna količina bazne boje i bezbojnog laka: površina, debljina sloja, izdašnost iz tehničkog lista i gubici pri nanošenju."
kategorija: osnove
podtema: procena potrošnje
tip: postupak
publika:
  - hobista
  - profesionalac
glavnoPitanje: Kako se procenjuje koliko bazne boje i bezbojnog laka treba za jedan deo ili ceo automobil?
namera: informativna
dodatnaPitanja:
  - Od čega zavisi potrošnja?
  - Gde proizvođač navodi izdašnost?
poreklopitanja:
  tip: pronadjeno-u-izvoru
  napomena: "Pitanje koliko boje i laka treba za ceo automobil postavlja se na forumu samsvojmajstor.com (q007), a za jedan branik na forumu micra.org.uk (q103)."
  izvori:
    - https://www.samsvojmajstor.com/portal/forums/uradi-sam/popravka-automobila/farbanje-auta
    - https://micra.org.uk/threads/how-much-paint-required-for-rear-bumper.71165/post-774483
brendovi:
  - rm
  - baslac
  - sata
proizvodi:
  - c-5450-ghd-clear
  - ghd-topcoat
  - c-2a40-airtop
  - baslac-40-100-high-speed-2k-clear-voc
povezani:
  - SV-0210
  - SV-0085
  - SV-0195
  - SV-0196
  - SV-0223
izvori:
  - id: rm-c5450-tds
    naziv: "R-M, Technical Information C 5450 GRAPHITE HD CLEAR"
    dokument: /documents/products/rm/c-5450-ghd-clear/rm-c-5450-ghd-clear-technical-data-sheet.pdf
    verzija: "07/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: rm-ghd-topcoat-tds
    naziv: "R-M, Technical Information GHD TOPCOAT"
    dokument: /documents/products/rm/ghd-topcoat/rm-ghd-topcoat-technical-data-sheet.pdf
    verzija: "07/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: rm-c2a40-tds
    naziv: "R-M, Technical Information C 2A40 AirTOP, Clear coat, air drying"
    dokument: /documents/products/rm/c-2a40-airtop/rm-c-2a40-airtop-technical-data-sheet.pdf
    verzija: "07/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: baslac-40-100-tds
    naziv: "baslac, Technical Information 40-100 High Speed 2K Clear VOC"
    url: https://techinfo.baslac.com/en/40-100.pdf
    dokument: /documents/products/baslac/40-100.pdf
    verzija: "06/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: sata-faq
    naziv: "SATA, Professional knowledge: FAQ"
    url: https://www.sata.com/en/service/professional-knowledge/faq/
    pristupljeno: 2026-10-08
    tip: sajt-proizvodjaca
  - id: rm-digital-color-search
    naziv: "R-M, Digital color search (Colortronic 12/6, Mix & Scan u Refinity)"
    url: https://www.rmpaint.com/en-int/digital-color-search
    pristupljeno: 2026-10-08
    tip: sajt-proizvodjaca
prioritet: 1110
razlogPrioriteta: Dopunjuje osnovni vodič teme konkretnim pitanjem; raspoređeno naizmenično sa drugim temama.
status:
  istrazivanje: zavrseno
  pisanje: napisano
  tehnickaProvera: nije-provereno
  jezickaProvera: nije-provereno
strucnaPotvrda:
  potrebna: true
  razlog: "Za praktičnu potrošnju po delu ili celom automobilu (litri bazne boje i laka) nije pronađen izvor proizvođača iz našeg programa; tekst daje samo postupak procene i teoretsku računicu iz tehničkih listova R-M GHD linije, koja je namenjena komercijalnim vozilima. Potrebna je potvrda stručne osobe da li i kakve orijentacione količine navesti."
  status: potrebno
poslednjaProvera: 2026-10-08
ponovniPregled: 2027-04-08
---
Potrebna količina se procenjuje iz tri podatka: površine koja se lakira, debljine sloja koju propisuje tehnički list i izdašnosti materijala, uz dodatak za gubitke pri nanošenju. Tačan broj litara za „jedan automobil“ ne postoji, jer zavisi od veličine vozila, broja delova, vrste boje, pokrivnosti nijanse i pištolja. Zato je najpouzdanije da procenu napravite za konkretan posao, a količinu proverite u prodavnici ili sa alatom proizvođača boje.

## Korak 1: površina

Izmerite ili procenite površinu delova koji se lakiraju, sa obe strane ako se lakira i unutrašnja strana (na primer ivice vrata ili haube). Ako se boja utapa u susedni deo, dodajte i zonu utapanja.

## Korak 2: debljina sloja iz tehničkog lista

Svaki tehnički list navodi debljinu suvog sloja za koju je proizvod predviđen. Za bezbojni lak R-M C 2A40 to je 40–50 µm[^rm-c2a40-tds], a za baslac 40-100 takođe 40–50 µm[^baslac-40-100-tds]. Za baznu boju podatak se čita iz njenog tehničkog lista, jer zavisi od linije i nijanse. Šta znači taj podatak i kako se meri, objašnjava vodič [Debljina suvog sloja](/vodici/debljina-suvog-sloja).

## Korak 3: izdašnost

Neki tehnički listovi navode teoretsku izdašnost (engl. *spreading rate*): koliko kvadratnih metara pokriva jedan litar pri sloju od 1 µm, kao kod R-M GHD proizvoda[^rm-c5450-tds]. Iz nje se računa koliko materijala treba za propisanu debljinu.

| Proizvod | Izdašnost i debljina sloja prema tehničkom listu | Teoretska računica |
| --- | --- | --- |
| R-M C 5450 GHD CLEAR (bezbojni lak) | 505 m²/l pri 1 µm; sloj 40–60 µm[^rm-c5450-tds] | oko 8,4–12,6 m² po litru |
| R-M GHD TOPCOAT (boja sa direktnim sjajem) | 536 m²/l pri 1 µm; sloj 40–60 µm[^rm-ghd-topcoat-tds] | oko 8,9–13,4 m² po litru |

Računica je jednostavna: izdašnost pri sloju od jednog mikrometra podeli se debljinom sloja. Važno je razumeti njena ograničenja:

- Tehnički list za C 5450 kao primene navodi autobuse, nadogradnje i slične namene[^rm-c5450-tds], a GHD TOPCOAT je predviđen za nanošenje preko R-M CV prajmer-punilaca i punilaca[^rm-ghd-topcoat-tds]. Primer zato služi da pokaže kako se podatak koristi, a ne kao vrednost za automobilske lakove.
- Tehnički listovi ne navode da li se izdašnost odnosi na proizvod pre ili posle mešanja sa učvršćivačem i razređivačem[^rm-c5450-tds]. Računica je zato samo orijentaciona.
- Za lakove za automobile iz našeg programa koje smo pregledali, C 2A40 i 40-100, tehnički list ne navodi izdašnost[^rm-c2a40-tds][^baslac-40-100-tds].

## Korak 4: gubici pri nanošenju

Ne završi sav materijal na površini. Deo ode u preprašivanje, a deo ostaje u čaši, pištolju i posudi za mešanje. SATA za savremene pištolje navodi prenos materijala veći od 65 %[^sata-faq], što znači da i kod takvih pištolja deo materijala ne dospe na deo. Kod starijih pištolja, pri pogrešnom podešavanju ili na delovima složenog oblika gubitak može biti veći. Zato se teoretskoj količini uvek dodaje rezerva.

## Korak 5: provera sa alatom proizvođača

Proizvođači boja imaju alate koji pomažu da se pripremi prava količina. R-M za svoj sistem za pretragu boje navodi procenu zapremine po delu, da se izbegne mešanje viška[^rm-digital-color-search]. Ako materijal kupujete u prodavnici, recite koje delove lakirate i pitajte za procenu. Prodavnice iz naše mreže nalaze se na strani [Prodavnice](/prodavnice).

## Od čega zavisi potrošnja

- **Pokrivnost nijanse.** Neke nijanse traže više slojeva bazne boje da bi prekrile podlogu. Vidi [Koliko slojeva bazne boje treba](/vodici/koliko-slojeva-bazne-boje).
- **Broj slojeva laka.** Tehnički list navodi broj slojeva; na primer, za C 2A40 to je pola sloja pa pun sloj[^rm-c2a40-tds].
- **Pištolj i podešavanje.** Utiču na prenos materijala[^sata-faq].
- **Oblik delova.** Ivice, profili i unutrašnje strane troše više nego ravna površina.
- **Mešanje u više navrata.** Smeša 2K laka ima ograničeno vreme upotrebljivosti, pa se kod većih poslova meša u delovima. Vidi [Kako smanjiti otpad pri mešanju](/vodici/manje-otpada-pri-mesanju).

## Pitanja i odgovori

### Koliko litara boje treba za ceo automobil?

Na to pitanje nema jednog tačnog odgovora koji bismo mogli da potkrepimo izvorom. Uradite procenu po koracima iz ovog teksta i proverite je u prodavnici ili sa alatom proizvođača boje.

### Gde proizvođač navodi izdašnost?

Kada je navodi, u tehničkom listu, obično uz sadržaj čvrstih materija i odnos mešanja, kao kod R-M GHD proizvoda[^rm-c5450-tds]. Ako je tehnički list ne navodi, pitajte tehničku podršku proizvođača ili prodavca.

### Koliko sprejeva treba za jedan deo?

Za sprejeve važi isti princip, ali sa drugim podacima sa ambalaže. Vidi [Koliko sprejeva treba za jedan deo](/vodici/koliko-sprejeva-za-deo).
