---
id: SV-0122
slug: ubrzavanje-susenja-vodene-baze
naslov: "Ubrzavanje sušenja vodene baze strujom vazduha: postupak i greške"
metaNaslov: "Sušenje vodene bazne boje strujom vazduha"
opis: "Kako se strujom vazduha ubrzava odzračivanje vodene bazne boje, šta navode R-M, baslac i SATA i kada duvalica može da napravi grešku na sloju."
kategorija: uslovi-i-susenje
podtema: sušenje vodenih baza
tip: postupak
publika:
  - profesionalac
glavnoPitanje: Kako se ubrzava isparavanje vode iz vodene bazne boje?
namera: postupak
dodatnaPitanja:
  - Kada duvalica može da napravi grešku?
  - Može li se umesto duvalice koristiti toplota?
poreklopitanja:
  tip: pronadjeno-u-izvoru
  napomena: "Pitanje kako bezbedno ubrzati sušenje između slojeva postavlja se u odeljku pitanja i odgovora prodavca boja (q114 u questions.json); odgovor odatle nije korišćen kao izvor."
  izvori:
    - https://www.limelinepaintsupply.com/a/answers/6498413/4-How-long-should-I-wait-between-coats-and-how-can-I-safely-speed-up-drying-without-causing-defects
brendovi:
  - rm
  - baslac
  - sata
proizvodi:
  - sata-dry-jet-2
  - sata-dry-jet-stativ
  - rm-onyx-hd
  - rm-agilis
  - grupa:baslac-line-45
povezani:
  - SV-0013
  - SV-0087
  - SV-0116
  - SV-0120
  - SV-0167
izvori:
  - id: rm-onyx-hd-tds
    naziv: "R-M, Technical Information ONYX HD, Waterborne basecoat line"
    url: https://techinfo.rmpaint.com/unicorn/en/ONYX%20HD-ONYX%20HD%20Waterborne%20basecoat%20line.pdf
    verzija: "07/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: rm-agilis-tds
    naziv: "R-M, Technical Information AGILIS, Waterborne basecoat"
    url: https://techinfo.rmpaint.com/unicorn/en/AGILIS-Waterborne%20basecoat.pdf
    verzija: "07/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: baslac-45-line-tds
    naziv: "baslac, Technical Information 45 Line, 45- Basecoat"
    dokument: /documents/products/baslac/45_Line.pdf
    verzija: "03/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: baslac-mazda-51k
    naziv: "baslac, Technical Information Mazda Rhodium White Met, Color 51K for Basecoat (blend in repair process)"
    dokument: /documents/products/baslac/Mazda51K_chart_blend_in_process_2.pdf
    verzija: "03/2025"
    pristupljeno: 2026-10-08
    tip: uputstvo-proizvodjaca
  - id: sata-dry-jet-2-bal
    naziv: "SATA, Operating instructions SATA dry jet 2"
    url: https://www.sata.com/media/84/06/70/1790259017/BAL-SATA-DRY-JET-2.PDF.PDF?ts=1790259017
    verzija: "3456-201106-1"
    napomena: "Oznaka dokumenta na poslednjoj strani; datum izmene PDF fajla 2022-03-07."
    pristupljeno: 2026-10-08
    tip: uputstvo-proizvodjaca
  - id: sata-dry-jet-2-stranica
    naziv: "SATA, SATA dry jet 2 (stranica proizvoda)"
    url: https://www.sata.com/en-amn/products/additional-products/drying-equipment/sata-dry-jet-2
    pristupljeno: 2026-10-08
    tip: sajt-proizvodjaca
prioritet: 618
razlogPrioriteta: Dopunjuje osnovni vodič teme konkretnim pitanjem; raspoređeno naizmenično sa drugim temama.
status:
  istrazivanje: zavrseno
  pisanje: napisano
  tehnickaProvera: provereno
  jezickaProvera: provereno
napomenaProvere: "urednička provera (AI-asistirana) 2026-10-08: otvoreni ONYX HD, AGILIS 07/2026, 45 Line 03/2026, Mazda 51K blend 2 03/2025, uputstvo SATA dry jet 2 i stranica proizvoda; ispravljeno: tri navoda pripisana SATA uputstvu kojih u njemu nema (nečistoće na sloju, nepravilan protok, čestice bez sita) preformulisana prema uputstvu, datum izvora uputstva zamenjen oznakom dokumenta 3456-201106-1."
strucnaPotvrda:
  potrebna: false
  status: nije-potrebno
poslednjaProvera: 2026-10-08
ponovniPregled: 2027-04-08
---
Isparavanje vode iz vodene bazne boje ubrzava se ravnomernom strujom čistog vazduha preko sveže nanetog sloja, dok površina ne postane mat. Proizvođači to predviđaju u tehničkim listovima: R-M za ONYX HD navodi sušenje od 15 min na 20 °C, uz mogućnost ubrzanja dodatnim strujanjem vazduha[^rm-onyx-hd-tds], a za AGILIS i baslac za 45 Line navode da odgovarajuća oprema za duvanje vazduha znatno skraćuje odzračivanje[^rm-agilis-tds][^baslac-45-line-tds]. Kako se oprema postavlja i drži, opisuje uputstvo proizvođača opreme.

## Čime se duva

Za ovu namenu koriste se duvalice koje rade na Venturi principu. SATA za dry jet 2 objašnjava da uređaj, pored komprimovanog vazduha koji dobija, usisava i višestruko veću količinu vazduha iz okoline i usmerava ga kao širok, ravnomeran mlaz na površinu[^sata-dry-jet-2-stranica]. Prema uputstvu, optimalni radni pritisak je 2,5 bara, a potrošnja vazduha 270 Nl/min pri tom pritisku[^sata-dry-jet-2-bal].

Isto uputstvo navodi namenu: forsirano sušenje vodenih boja. Manje površine, kao vrata ili blatobran, suše se jednom duvalicom u ruci, a za veće površine koristi se stalak sa više duvalica[^sata-dry-jet-2-bal]. Sušenje rastvaračkih materijala SATA navodi kao nepravilnu upotrebu[^sata-dry-jet-2-bal].

## Postupak

1. **Obezbedite čist vazduh.** SATA traži čist komprimovani vazduh, na primer uz odgovarajući filter za vazduh[^sata-dry-jet-2-bal]. O pripremi vazduha piše vodič [Kompresor i vazduh za lakiranje](/vodici/kompresor-i-vazduh-za-lakiranje).
2. **Proverite sito na usisu.** Uputstvo traži da se sito redovno menja, jer ga čestice iz usisanog vazduha zapušavaju, a zapušeno sito umanjuje rad duvalice[^sata-dry-jet-2-bal].
3. **Usmerite mlaz pravilno.** Za dry jet 2 SATA kao optimalno navodi rastojanje od 30–50 cm do površine i ugao od 20–40°[^sata-dry-jet-2-bal].
4. **Ne duvajte prema podu.** Uzvitlana prašina može da padne na sveži sloj[^sata-dry-jet-2-bal].
5. **Duvajte do mat površine.** Za ONYX HD R-M traži odzračivanje dok sloj ne postane mat posle svakog sloja[^rm-onyx-hd-tds], a za AGILIS dok površina ne postane potpuno mat posle završnog sloja[^rm-agilis-tds]. Tek tada se nanosi sledeći sloj ili bezbojni lak.

Koliko se čeka između slojeva i od čega to zavisi, objašnjava vodič [Vreme između slojeva bazne boje](/vodici/vreme-izmedju-slojeva-baze).

## Pitanja i odgovori

### Kada duvalica može da napravi grešku?

SATA u uputstvu za dry jet 2 navodi tri situacije[^sata-dry-jet-2-bal]:

- **premalo rastojanje** između duvalice i površine može da pomeri boju;
- **mlaz usmeren ka podu** diže prašinu koja pada na sloj;
- **zapušeno sito** umanjuje rad duvalice, pa se sito redovno menja.

Ako se posle sušenja vide čestice u sloju, mogući uzroci i provera opisani su u tekstu [Prašina i trunje u laku](/vodici/prasina-i-trunje-u-laku).

### Može li se umesto duvalice koristiti toplota?

Može, ako to predviđa dokument za Vaš sistem. baslac u uputstvu za utapanje jedne nijanse u 45 Line sistemu navodi da se pre bezbojnog laka koristi oprema za duvanje (Venturi) ili kratko povećanje temperature do 50 °C, uz hlađenje[^baslac-mazda-51k]. R-M za ONYX HD navodi sušenje od 10 min na 40 °C[^rm-onyx-hd-tds], a za AGILIS kratkotalasno IR sušenje do mat površine, uz granicu temperature površine[^rm-agilis-tds]. O IR sušenju piše vodič [Infracrveno sušenje](/vodici/infracrveno-susenje).

### Da li vlažnost utiče na sušenje strujom vazduha?

Da, jer voda iz sloja sporije isparava u vlažnom vazduhu. Opšta pravila o vlažnosti i izboru komponenti su u vodiču [Temperatura i vlažnost pri lakiranju](/vodici/temperatura-i-vlaznost-pri-lakiranju).
