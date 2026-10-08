---
id: SV-0171
slug: sitne-pukotine-u-laku
naslov: "Sitne pukotine u laku: uzroci i sanacija"
metaNaslov: "Sitne pukotine u laku: uzroci i sanacija"
opis: "Mogući uzroci sitnih pukotina u laku i boji, uloga debljine slojeva i podloge, kako se uzrok proverava i zašto se preko pukotina ne lakira."
kategorija: greske-pri-lakiranju
podtema: pucanje laka
tip: resavanje-problema
publika:
  - hobista
  - profesionalac
glavnoPitanje: Zašto se u laku pojavljuju sitne pukotine i može li se preko njih lakirati?
namera: rešavanje problema
dodatnaPitanja:
  - Utiče li debljina slojeva?
  - Zašto boja puca baš na plastičnom delu?
poreklopitanja:
  tip: urednicka-procena
  napomena: "Pitanje o pukotinama u laku nije pronađeno kao posebno pitanje u questions.json; tema je urednička procena, dopunjuje grupu grešaka pri lakiranju."
brendovi:
  - baslac
  - rm
  - carsystem
proizvodi:
  - c-2a40-airtop
  - baslac-40-440-2k-voc-clear
  - baslac-80-10-additive-flex
povezani:
  - SV-0152
  - SV-0210
  - SV-0115
  - SV-0158
  - SV-0165
izvori:
  - id: baslac-cracking
    naziv: "baslac, Paint Defects: Cracking"
    url: https://www.baslac.com/en-emea/cracking
    pristupljeno: 2026-10-08
    tip: edukacija-proizvodjaca
  - id: inform-cracking
    naziv: "Info R-M, Help Centre: Cracking (javni opis greške)"
    url: https://info.rmpaint.com/help/cracking
    pristupljeno: 2026-10-08
    tip: edukacija-proizvodjaca
  - id: inform-plastics-cracking
    naziv: "Info R-M, Help Centre: Faults in painting plastics – Cracking"
    url: https://info.rmpaint.com/help/faults-painting-plastics-cracking
    pristupljeno: 2026-10-08
    tip: edukacija-proizvodjaca
  - id: ppg-cracking
    naziv: "PPG Refinish, Common Paint Defects Guide: Cracking (proizvođač koji nije u našem programu)"
    url: https://www.ppg.com/en-AE/automotive-refinish/common-paint-defects-guide/cracking
    pristupljeno: 2026-10-08
    tip: strucni-izvor
  - id: rm-c2a40-tds
    naziv: "R-M, Technical Information C 2A40 AirTOP, Clear coat, air drying"
    dokument: /documents/products/rm/c-2a40-airtop/rm-c-2a40-airtop-technical-data-sheet.pdf
    verzija: "07/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: baslac-40-440-tds
    naziv: "baslac, Technical Information 40-440 2K VOC Clear"
    dokument: /documents/products/baslac/40-440.pdf
    verzija: "12/2025"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: cs-speed-plus-tds
    naziv: "Carsystem, Technical Data Sheet 2K Clear VOC Speed Plus, 2K clear coat"
    url: https://www.carsystem.org/fileadmin/products/datasheets/tds-2k-clear-voc-speed-plus-v06.pdf
    verzija: "V06, 01/2025"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: baslac-80-10-tds
    naziv: "baslac, Technical Information 80-10 Additive FLEX"
    dokument: /documents/products/baslac/80-10.pdf
    verzija: "06/2023"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
prioritet: 1921
razlogPrioriteta: Rešava konkretan problem iz prakse; raspoređeno naizmenično sa drugim temama.
status:
  istrazivanje: zavrseno
  pisanje: napisano
  tehnickaProvera: provereno
  jezickaProvera: provereno
strucnaPotvrda:
  potrebna: false
  status: nije-potrebno
napomenaProvere: "urednička provera (AI-asistirana) 2026-10-08: otvoreni baslac Cracking, R-M Cracking (javni opis) i Plastics cracking (javna stranica), PPG Cracking (keš, potvrđen), C 2A40, 40-440, Speed Plus i 80-10; vrednosti se poklapaju. Ispravljeno: uvodni mehanizam označen kao opšte objašnjenje, „proizvođači predviđaju“ → baslac, odzračivanje vezano za mokro-na-mokro kako piše baslac."
poslednjaProvera: 2026-10-08
ponovniPregled: 2027-04-08
---
Opšte objašnjenje: sitne pukotine u laku mogu da znače da je sistem slojeva pod naponom koji ne može da izdrži, a uzrok može biti i u slojevima ispod laka. baslac kao moguće uzroke navodi neodgovarajući sistem na termoplastičnoj podlozi i prekratko odzračivanje između slojeva kod nanošenja mokro na mokro[^baslac-cracking]. Preko pukotina se ne lakira: baslac kao popravku navodi brušenje do zdrave podloge i novo nanošenje[^baslac-cracking].

Opšti redosled provere greške opisan je u vodiču [Greške pri lakiranju: kako se proverava uzrok pre sanacije](/vodici/greske-pri-lakiranju-kako-se-proverava-uzrok).

## Kako izgleda greška

R-M grešku opisuje kao pukotine različite dužine i dubine[^inform-cracking]. PPG (proizvođač koji nije u našem programu) dodaje da se često javljaju uz kitovane spojeve i ivice delova, da često imaju oblik trokrake zvezde i da fine pukotine mogu da se pojave i na prelazu lokalne popravke ubrzo posle završnog sloja[^ppg-cracking].

Za proveru je važno gde pukotine prestaju:

- samo u bezbojnom laku;
- kroz lak i baznu boju, do punioca;
- do same podloge (lima ili plastike).

To se vidi pod lupom ili tek pri brušenju, i od toga zavisi obim sanacije.

## Mogući uzroci i kako se proveravaju

Konačan uzrok zavisi od podloge, materijala i uslova rada.

| Mogući uzrok | Šta proveriti |
| --- | --- |
| Osetljiva stara podloga | Da li je ispod fabrička termoplastična boja. baslac navodi da direktno nanošenje poliesterskog kita ili punioca, reaktivnog prajmera ili materijala na bazi sintetičke smole na takvu podlogu može da izazove pucanje[^baslac-cracking]. Vidi [Priprema starog laka za novo lakiranje](/vodici/priprema-starog-laka). |
| Prekratko odzračivanje | Da li su poštovana vremena između slojeva; baslac to navodi za nanošenje mokro na mokro[^baslac-cracking]. |
| Predebeli slojevi | Ukupna debljina i broj slojeva u odnosu na tehnički list (primeri ispod). |
| Loša priprema | PPG navodi pregrube abrazive, loše čišćenje i loše popunjene spojeve[^ppg-cracking]. |
| Voda ili ulje u vazduhu | PPG navodi i nečistoću iz vazdušnog voda[^ppg-cracking]. |
| Temperatura podloge | PPG navodi i podlogu prehladnu ili pretoplu za nanošenje[^ppg-cracking]. |
| Meka plastika bez elastifikatora | Da li je deo savitljiv i da li je u materijal dodat elastifikator (vidi pitanje ispod). |

## Sanacija

baslac za ovu grešku navodi da se sloj izbrusi do zdrave podloge i ponovo nanese odgovarajućim podlogama i završnim materijalima[^baslac-cracking]. PPG razlikuje dva slučaja: ako je zahvaćen samo završni sloj, brusi se do zdravog sloja i lakira ponovo; ako pukotine idu kroz punilac, boja se na tom mestu uklanja do podloge, ispravlja se uzrok u podlozi i radi ceo sistem ponovo[^ppg-cracking].

Opšte objašnjenje: novi lak preko pukotina ne zatvara uzrok. Napon koji je izazvao pucanje ostaje u slojevima ispod, pa pukotine mogu ponovo da se pojave kroz novi sloj.

## Ograničenja

Ako stara boja reaguje na rastvarače (nabira se ili omekša), pre rada je treba proveriti; vidi [Podizanje i nabiranje boje preko stare podloge](/vodici/podizanje-i-nabiranje-boje). Vrednosti debljine iz teksta važe samo za navedene proizvode i verzije tehničkih listova.

## Pitanja i odgovori

### Utiče li debljina slojeva?

Da. PPG navodi preveliku debljinu i premalo vremena sušenja između slojeva među faktorima koji povećavaju napon u sloju[^ppg-cracking], a R-M za plastične delove navodi predebeo ukupni sloj kao mogući uzrok pucanja[^inform-plastics-cracking]. Preporučena debljina razlikuje se od laka do laka: za R-M C 2A40 tehnički list navodi 40–50 µm[^rm-c2a40-tds], za baslac 40-440 40–60 µm u dva sloja[^baslac-40-440-tds], a za Carsystem 2K Clear VOC Speed Plus 50–60 µm[^cs-speed-plus-tds]. Kako se debljina meri, objašnjava vodič [Debljina suvog sloja](/vodici/debljina-suvog-sloja).

### Zašto boja puca baš na plastičnom delu?

Na mekoj, savitljivoj plastici boja mora da prati savijanje dela. R-M za takve delove navodi da pucanje posle mehaničkog opterećenja može da izazove izostavljen elastifikator u boji ili predebeo ukupni sloj, i da punilac, boja sa direktnim sjajem i bezbojni lak treba da dobiju elastifikator, a bazna boja u dvoslojnom sistemu ne[^inform-plastics-cracking]. baslac za to ima aditiv 80-10, namenjen 2K puniocu, bezbojnim lakovima i bojama sa direktnim sjajem u postupcima za plastiku[^baslac-80-10-tds]. Kao sanaciju R-M navodi mehaničko uklanjanje slojeva i ponovno lakiranje, bez hemijskih skidača, jer mogu da oštete plastiku[^inform-plastics-cracking]. Više o elastifikatorima piše u vodiču [Aditivi: ubrzivači i elastifikatori](/vodici/aditivi-ubrzivaci-i-elastifikatori).
