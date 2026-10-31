---
id: SV-0128
slug: osvetljenje-za-kontrolu-boje
naslov: Osvetljenje za kontrolu boje i brušenja
metaNaslov: "Osvetljenje za kontrolu nijanse, brušenja i laka"
opis: "Koje svetlo traži kontrola nijanse, a koje kontrola brušenja i grešaka u laku, šta znače kelvini, CRI, lumeni i luksi i kako se lampe koriste bezbedno."
kategorija: uslovi-i-susenje
podtema: osvetljenje
tip: osnovni-vodic
publika:
  - profesionalac
  - vlasnik-radionice
glavnoPitanje: Kakvo osvetljenje je potrebno za kontrolu nijanse, brušenja i grešaka u laku?
namera: informativna
dodatnaPitanja:
  - Čemu služi ručna lampa sa dnevnim svetlom?
  - Zašto popravka na suncu izgleda drugačije nego u radionici?
  - Sme li lampa u kabinu dok se lakira?
poreklopitanja:
  tip: urednicka-procena
  napomena: "Pitanje kakvo osvetljenje treba za kontrolu boje i brušenja je urednički predlog q220, a pitanje zašto popravka na suncu izgleda drugačije q139 u questions.json."
brendovi:
  - carsystem
  - sata
  - baslac
  - rm
  - carfit
proizvodi:
  - carsystem-colour-match-lamp
  - sata-truesun
  - carsystem-led-lamp
  - carsystem-booth-mask-stick
povezani:
  - SV-0082
  - SV-0083
  - SV-0068
  - SV-0089
  - SV-0005
izvori:
  - id: baslac-color-chips
    naziv: "baslac, Color Chips (baslac Effective Color Finder i postupak provere nijanse)"
    url: https://www.baslac.com/en-emea/color-chips
    pristupljeno: 2026-10-08
    tip: sajt-proizvodjaca
  - id: inform-metamerism
    naziv: "Info R-M, Help Centre: Metamerism"
    url: https://info.rmpaint.com/help/metamerism
    pristupljeno: 2026-10-08
    tip: edukacija-proizvodjaca
  - id: cs-colour-match-lamp-tds
    naziv: "Carsystem, Technical Data Sheet CS Colour Match Lamp V03"
    url: https://www.carsystem.org/fileadmin/products/datasheets/tds-colour-match-lamp-v03.pdf
    verzija: "V03, 07/2021"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: cs-led-lamp-tds
    naziv: "Carsystem, Technical Data Sheet CS LED Lamp"
    url: https://www.carsystem.org/fileadmin/products/datasheets/tds-led-lampe.pdf
    verzija: "V02, 01/2019"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: sata-truesun-stranica
    naziv: "SATA, SATA trueSun (stranica proizvoda)"
    url: https://www.sata.com/en/sata-truesun/CF1931309
    pristupljeno: 2026-10-08
    tip: sajt-proizvodjaca
  - id: sata-truesun-bal
    naziv: "SATA, Operating Instructions SATA trueSun"
    url: https://www.sata.com/media/13/6b/6e/1793362240/BETRIEBSANLEITUNG-SATA-TRUESUN.PDF.PDF?ts=1793362240
    datumIzvora: 2025-11-27
    pristupljeno: 2026-10-08
    tip: uputstvo-proizvodjaca
  - id: cs-booth-mask-stick-tds
    naziv: "Carsystem, Booth Mask Stick, paint booth protection mask"
    url: https://www.carsystem.org/fileadmin/products/datasheets/tds-booth-mask-stick.pdf
    verzija: "v.04, 03/2021"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: carfit-tack-coating-tds
    naziv: "C.A.R.FIT, Technical data sheet Tack Coating for Spray Booth"
    url: https://carfitrepair.com/wp-content/uploads/2023/05/car-fit-tack-coating-for-spray-booth-technical-data-sheet.pdf
    pristupljeno: 2026-10-08
    tip: tehnicki-list
prioritet: 1218
razlogPrioriteta: Dopunjuje osnovni vodič teme konkretnim pitanjem; raspoređeno naizmenično sa drugim temama.
status:
  istrazivanje: zavrseno
  pisanje: napisano
  tehnickaProvera: provereno
  jezickaProvera: provereno
napomenaProvere: "urednička provera (AI-asistirana) 2026-10-08: otvoreni baslac Color Chips, Info R-M Metamerism, TDS Colour Match Lamp V03, CS LED Lamp V02, SATA trueSun stranica i uputstvo, Booth Mask Stick, C.A.R.FIT Tack Coating; sve vrednosti (K, CRI, lm, lx, radne temperature) i bezbednosne napomene se poklapaju; bez ispravki."
strucnaPotvrda:
  potrebna: false
  status: nije-potrebno
poslednjaProvera: 2026-10-08
ponovniPregled: 2027-04-08
---
Za kontrolu nijanse potrebno je dnevno svetlo ili lampa dnevnog svetla, uz proveru i pod drugim izvorom svetla. baslac za poređenje karte nijanse sa vozilom traži dnevno svetlo ili lampu dnevnog svetla[^baslac-color-chips], a R-M upozorava da dve boje mogu izgledati isto na dnevnom, a različito na veštačkom svetlu[^inform-metamerism]. Za kontrolu brušenja i grešaka u laku važnije je jako, ravnomerno svetlo koje se može pomerati i usmeriti na površinu. Zato se opšte osvetljenje prostora po potrebi dopunjuje ručnim lampama.

## Tri podatka koja se čitaju na lampi

| Podatak | Šta znači | Primer iz programa |
| --- | --- | --- |
| temperatura boje (K, kelvini) | da li je svetlo toplije, žućkasto, ili hladnije, plavičasto | Carsystem Colour Match Lamp ima tri stepena: 2.700 K, 4.500 K i 6.500 K[^cs-colour-match-lamp-tds]; SATA trueSun 5.600 K[^sata-truesun-stranica] |
| indeks uzvraćanja boje (CRI) | koliko verno svetlo prikazuje boje u poređenju sa referentnim svetlom | za Colour Match Lamp Carsystem navodi CRI veći od 96[^cs-colour-match-lamp-tds] |
| jačina: lumen (lm) i luks (lx) | lumen je ukupna svetlost koju lampa daje, a luks osvetljenost površine na koju svetlo pada | Colour Match Lamp 500 lm[^cs-colour-match-lamp-tds]; Carsystem LED Lamp 500, 1.000 ili 2.000 lm[^cs-led-lamp-tds]; SATA trueSun 22.000 lx[^sata-truesun-stranica] |

Opšte objašnjenje: lumeni i luksi nisu ista mera i ne porede se direktno. Visoka jačina pomaže pri pregledu površine, ali za procenu nijanse važniji su temperatura boje i CRI.

## Kontrola nijanse

Nijansa se ne procenjuje pod jednim izvorom svetla. R-M objašnjava metamerizam kao pojavu da dve boje koje se poklapaju na dnevnom svetlu izgledaju različito pod veštačkim, posebno pod natrijumskom uličnom rasvetom[^inform-metamerism]. Zato je korisna lampa sa više temperatura boje, kao Colour Match Lamp, za koju Carsystem navodi da se stepen bira prema vrsti posla[^cs-colour-match-lamp-tds].

Ceo postupak, od šifre boje do probnog lima, opisuju vodiči [Utvrđivanje nijanse](/vodici/utvrdjivanje-nijanse) i [Probni lim: zašto se radi pre lakiranja](/vodici/probni-lim-pre-lakiranja). Kod metalik i bisernih boja nijansa zavisi i od ugla gledanja; zašto, objašnjava vodič [Metalik boje: zašto izgledaju drugačije iz svakog ugla](/vodici/metalik-boje-kako-rade). Digitalnu pomoć pri izboru recepture opisuje vest [R-M LightAssist u Refinity](/vodici/rm-lightassist-u-refinity).

## Kontrola brušenja i grešaka u laku

Za površinu je važno da svetlo pada na nju i pod uglom, a ne samo spreda. Opšte objašnjenje: kosa svetlost baca senke u tragovima brušenja, talasima i neravninama, pa se oni lakše vide nego pod svetlom koje pada pravo na deo. Zato se lampa pomera duž dela, a deo se gleda iz više pravaca.

SATA za lampu trueSun navodi da simulira sunčevu svetlost i da otkriva i najsitnije razlike na lakiranoj površini[^sata-truesun-bal]. Carsystem LED Lamp proizvođač namenjuje osvetljavanju mesta do kojih ne dopire obično svetlo radionice, uz tri nivoa jačine[^cs-led-lamp-tds].

Kod brušenja kita i punioca svetlo se kombinuje sa kontrolnim prahom, koji ostaje u udubljenjima i ogrebotinama. Postupak je opisan u vodiču [Kontrolni prah pri brušenju](/vodici/kontrolni-prah-pri-brusenju).

## Svetlo u kabini i radnom prostoru

Svetla i zidovi kabine prljaju se preprašivanjem, pa osvetljenost opada. Carsystem za Booth Mask Stick traži da se zidovi kabine pre nanošenja premaza očiste ili obnove, radi najboljih uslova osvetljenja, i predviđa nanošenje i na staklo i svetla[^cs-booth-mask-stick-tds]. C.A.R.FIT za svoj premaz za kabinu navodi da je namenjen i zaštiti stakla i svetala, bez uticaja na propusnost svetla i refleksiju[^carfit-tack-coating-tds]. Kako se smanjuje prašina u prostoru, opisuje vodič [Kako smanjiti prašinu u prostoru za lakiranje](/vodici/prasina-u-garazi-pre-lakiranja).

## Bezbedan rad sa lampama

- **Ne gledajte direktno u izvor svetla.** Carsystem to navodi za svoje lampe[^cs-colour-match-lamp-tds], a SATA traži da se trueSun nikada ne usmerava u oči[^sata-truesun-bal].
- **Lampa nije za prostor sa zapaljivim parama** ako proizvođač to ne navodi. SATA traži da se trueSun, baterija i punjač nikada ne koriste u prostoru sa opasnošću od eksplozije i da se drže dalje od izvora paljenja i grejača[^sata-truesun-bal]. Carsystem navodi da se njegove lampe ne koriste blizu otvorenog plamena[^cs-led-lamp-tds].
- **Poštujte radnu temperaturu.** Za trueSun SATA navodi 0–40 °C[^sata-truesun-bal], a za Colour Match Lamp Carsystem −10–40 °C[^cs-colour-match-lamp-tds].
- **Ne čistite lampu rastvaračima.** SATA to izričito zabranjuje za trueSun, bateriju i punjač[^sata-truesun-bal].

## Pitanja i odgovori

### Čemu služi ručna lampa sa dnevnim svetlom?

Da se nijansa i površina proveravaju pod svetlom sličnim dnevnom, i kada dnevnog svetla nema ili je slabo. baslac upravo lampu dnevnog svetla navodi kao zamenu za dnevno svetlo pri poređenju karte nijanse sa vozilom[^baslac-color-chips]. Lampa se prinosi delu i pomera, pa se vide i greške koje opšte svetlo prostora ne otkriva.

### Zašto popravka na suncu izgleda drugačije nego u radionici?

Mogući uzrok je metamerizam: dve boje se poklapaju pod jednim svetlom, a pod drugim ne[^inform-metamerism]. Zato se nijansa proverava pod više izvora svetla pre lakiranja, a ne tek na gotovom vozilu.

### Sme li lampa u kabinu dok se lakira?

Samo ako je proizvođač lampe za to predvideo. Za trueSun SATA navodi suprotno: lampa se ne koristi u prostoru sa opasnošću od eksplozije[^sata-truesun-bal]. Kontrola svetlom radi se pre nanošenja i posle, kada u prostoru nema para.
