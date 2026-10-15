---
id: SV-0018
slug: popravka-na-suncu-izgleda-drugacije
naslov: Zašto popravka na suncu izgleda drugačije nego u radionici
metaNaslov: "Zašto popravka na suncu izgleda drugačije: metamerija"
opis: "Zašto se popravljeni deo pod suncem razlikuje od ostatka vozila iako je u radionici izgledao dobro: metamerija, ugao gledanja i kako se nijansa proverava."
kategorija: osnove
podtema: osvetljenje i percepcija boje
tip: osnovni-vodic
publika:
  - hobista
  - profesionalac
glavnoPitanje: Zašto se popravljeni deo pod suncem razlikuje od ostatka automobila iako je u radionici izgledao dobro?
namera: informativna
dodatnaPitanja:
  - Šta je metamerija?
  - Kako se nijansa proverava pod različitim svetlom?
poreklopitanja:
  tip: urednicka-procena
  napomena: "Urednički predlog q139 u questions.json; javno postavljeno pitanje sa ovom formulacijom nije pronađeno."
brendovi:
  - rm
  - baslac
proizvodi: []
povezani:
  - SV-0083
  - SV-0128
  - SV-0089
  - SV-0084
  - SV-0096
izvori:
  - id: cie-metamerija
    naziv: "CIE, International Lighting Vocabulary (e-ILV), 17-23-006 metamerism"
    url: https://cie.co.at/eilvterm/17-23-006
    pristupljeno: 2026-10-08
    tip: strucni-izvor
  - id: cie-080-1989
    naziv: "CIE 080-1989, Special Metamerism Index: Change in Observer (opis publikacije)"
    url: https://cie.co.at/node/1206
    pristupljeno: 2026-10-08
    tip: strucni-izvor
  - id: rm-lightassist
    naziv: "R-M, Refinish Mastery with Digital Color Matching: New LightAssist functionality in Refinity"
    url: https://www.rmpaint.com/en-int/news/refinish-mastery-digital-color-matching-new-lightassist-functionality-refinity
    datumIzvora: 2026-09-10
    pristupljeno: 2026-10-08
    tip: vest-proizvodjaca
  - id: rm-digital-color-search
    naziv: "R-M, Digital color search (Colortronic 12/6, Mix & Scan u Refinity)"
    url: https://www.rmpaint.com/en-int/digital-color-search
    pristupljeno: 2026-10-08
    tip: sajt-proizvodjaca
  - id: baslac-color-finder
    naziv: "baslac, Effective Color Finder"
    url: https://www.baslac.com/en-emea/baslac-effective-color-finder
    pristupljeno: 2026-10-08
    tip: sajt-proizvodjaca
prioritet: 810
razlogPrioriteta: Dopunjuje osnovni vodič teme konkretnim pitanjem; raspoređeno naizmenično sa drugim temama.
status:
  istrazivanje: zavrseno
  pisanje: napisano
  tehnickaProvera: provereno
  jezickaProvera: provereno
napomenaProvere: "urednička provera (AI-asistirana) 2026-10-08: otvoreni CIE e-ILV 17-23-006, opis CIE 080-1989, R-M stranica Digital color search, R-M vest LightAssist (10. 9. 2026) i baslac Effective Color Finder (više od 4.500 uzoraka); tvrdnje se poklapaju; ispravljeno: definicija metamerije približena izvoru (tristimulusne vrednosti), dve rečenice o pigmentima preformulisane, pravopis „nijedan“."
strucnaPotvrda:
  potrebna: false
  status: nije-potrebno
poslednjaProvera: 2026-10-08
ponovniPregled: 2027-10-08
---
Dve boje mogu izgledati isto pod jednim svetlom, a različito pod drugim, jer se razlikuju po tome kako odbijaju pojedine delove spektra. Ta pojava se zove metamerija[^cie-metamerija]. Svetlo u radionici i sunčevo svetlo nemaju isti sastav, pa se razlika koja se pod lampom nije videla može pojaviti napolju. Kod metalik i biserne boje tome se dodaje i ugao gledanja: sunce stvara jake odsjaje i senke, pa se vidi razlika koja se pod raspršenim svetlom gubi.

## Šta je metamerija

Međunarodna komisija za osvetljenje (CIE) definiše metameriju kao svojstvo boja koje se spektralno razlikuju, a imaju iste tristimulusne vrednosti u određenom kolorimetrijskom sistemu[^cie-metamerija]. Jednostavnije: dve površine mogu „dati isti utisak“ oku pod jednim svetlom, iako ne odbijaju svetlost na isti način.

Kod popravke to se dešava ovako. Fabrička boja i reparaturna mešavina nastaju u različitim uslovima i ne moraju imati iste pigmente. Mešavina može biti podešena tako da pod jednim svetlom izgleda isto kao original. Pod svetlom drugačijeg sastava različiti pigmenti drugačije odbijaju svetlost, pa se razlika pojavi.

CIE razlikuje i dva uzroka takve razlike: promenu izvora svetla i promenu posmatrača[^cie-080-1989]. Drugim rečima, nije samo svetlo u pitanju: dva čoveka sa normalnim vidom boja mogu malo drugačije da vide isti par boja.

## Ugao gledanja kod efektnih boja

Metalik i biserne boje menjaju izgled sa uglom gledanja. Zbog toga R-M u alatu za digitalnu pretragu boje prikazuje boju i spreda i iskosa (engl. *face* i *flop*), na krivoj merenoj iz više uglova[^rm-digital-color-search]. Pod suncem se ti uglovi jasno vide na zaobljenim delovima karoserije, pa se razlika u poravnanju čestica efekta lakše uočava nego pod ravnomernim svetlom u radionici. Detaljnije o tome piše vodič [Metalik boje: zašto izgledaju drugačije iz svakog ugla](/vodici/metalik-boje-kako-rade).

R-M i za digitalnu proveru navodi da su razlike u boji, teksturi i efektu ponekad suptilne i teško se procenjuju, posebno kod crnih i tamnih efektnih boja[^rm-lightassist].

## Drugi mogući uzroci razlike

Metamerija nije jedini razlog. Mogući uzroci koje vredi proveriti:

- **Varijanta nijanse.** Ista šifra boje može imati više varijanti. Vidi [Varijante nijanse iste šifre boje](/vodici/varijante-nijanse-iste-sifre).
- **Izbledeo stari lak.** Okolni delovi su godinama bili na suncu, a nova boja nije. Vidi [Nijansa na izbledelom vozilu](/vodici/nijansa-i-izbledeli-lak).
- **Tehnika nanošenja.** Kod metalika vlažnost i debljina sloja menjaju svetlinu nijanse.
- **Sjaj i struktura laka.** Drugačiji sjaj ili narandžina kora menjaju utisak boje i kada je nijansa ista.

Koji je uzrok u konkretnom slučaju, ne može se zaključiti bez provere na samom vozilu.

## Kako se nijansa proverava pod različitim svetlom

1. **Probni lim pre lakiranja.** Mešavina se nanese na probni lim istim postupkom kao na vozilo, osuši i uporedi sa vozilom. Postupak opisuje vodič [Probni lim: zašto se radi pre lakiranja](/vodici/probni-lim-pre-lakiranja).
2. **Poređenje pod više izvora svetla.** Probni lim se gleda uz vozilo pod svetlom u radionici, pod dnevnim svetlom i, ako postoji, pod lampom za kontrolu boje. Kakvo osvetljenje pomaže, objašnjava tekst [Osvetljenje za kontrolu boje i brušenja](/vodici/osvetljenje-za-kontrolu-boje).
3. **Poređenje iz više uglova.** Kod metalika se gleda spreda i iskosa, ne samo pravo.
4. **Pomoć alata za boju.** Proizvođači iz našeg programa imaju alate za izbor boje: baslac nudi kartu sa više od 4.500 originalno nalakiranih uzoraka boje[^baslac-color-finder], a R-M sistem za digitalno merenje i pretragu, uz rangiranje varijanti nijanse[^rm-digital-color-search]. Šta takav uređaj može, a šta ne, piše u vodiču [Digitalno merenje boje](/vodici/digitalno-merenje-boje).

## Ograničenja

Nijedan postupak ne garantuje da će razlika biti nula pod svakim svetlom, jer reparaturna mešavina i fabrička boja ne moraju biti isti materijal. Cilj je da razlika pod uobičajenim uslovima gledanja ne bude primetna. Zato se u praksi koristi i utapanje u susedni deo, o čemu piše tekst [Lokalna popravka ili lakiranje celog dela](/vodici/lokalna-popravka-ili-ceo-deo).

## Pitanja i odgovori

### Da li je razlika na suncu znak loše popravke?

Ne nužno. Može biti posledica metamerije, varijante nijanse ili starosti okolnog laka. Ipak, ako je razlika jasno vidljiva, vredi zajedno sa radionicom proveriti pod kojim svetlom i iz kog ugla se vidi.

### Zašto je u radionici izgledalo dobro?

Svetlo u radionici je po pravilu ravnomerno i dolazi iz više pravaca, pa umanjuje razlike u uglu i odsjaju. Sunce je jedan jak izvor svetla drugačijeg sastava, pa ističe obe vrste razlika.

### Može li se metamerija potpuno izbeći?

Ne može se garantovati, jer reparaturna mešavina i fabrička boja ne moraju imati iste pigmente. Može se smanjiti dobrom formulom, probnim limom i proverom pod više izvora svetla.
