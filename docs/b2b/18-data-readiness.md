# 18 — Spremnost podataka: šta se meri, a šta se ne sme zaključiti

Oznake: 🟢 dokazano nad podacima · 🔵 samo dokumentovan ugovor · 🔴 nedostaje dokaz

Nastavak na [17 — PDF i ledger](17-biznisoft-pdf-ledger.md). Taj dokument opisuje
**kako promet ulazi u sistem**; ovaj opisuje **šta se o već unetom prometu sme
tvrditi**.

Ekran: `/portal/importi/spremnost`, sposobnost `view:importi`.

**Ovo nije recommendation engine i ne priprema ga.** Nema predloga kupovine,
očekivane sledeće porudžbine, predviđene količine ni rejtinga kupca. Nema praga
„N faktura = spremno“ i nema zbirnog zelenog svetla.

---

## 1. Zašto ekran uopšte postoji

Pitanje „da li imamo dovoljno podataka“ se do sada odgovaralo procenom. Procena
je uvek zvučala kao broj — „pokrivenost je oko 80%“ — a niko nije mogao da kaže
nad čime je taj procenat računat.

Ekran ne odgovara na to pitanje. On prikazuje **šta se stvarno može izmeriti** i
**koji dokaz nedostaje**, pa odluku donosi čovek nad imenovanim brojevima umesto
nad utiskom.

Podela odgovornosti je namerna:

| Sloj | Fajl | Šta radi |
|---|---|---|
| Značenje | `lib/readiness/dataReadiness.mjs` | Šta brojevi znače. Bez baze, bez I/O. |
| Izvor | `lib/readiness/data-readiness.ts` | Odakle dolaze. Samo SQL, samo čitanje. |
| Prikaz | `app/portal/importi/spremnost/page.tsx` | Ništa ne računa. |

Razlog za razdvajanje nije stil. Tvrdnja „nula uvezenih povrata nije isto što i
povrata nije bilo“ je poslovna, ne tehnička — dok je živela u upitu, jedini
način da se proveri bio bi pun prolaz kroz bazu. Sada je pokrivena jediničnim
testom koji traje milisekundu.

---

## 2. Jedna istina o prometu

Promet se čita **isključivo** kroz `effective_sales_ledger`. Nema druge tabele,
paralelnog ledgera ni novog puta knjiženja — pravilo iz [17 §1](17-biznisoft-pdf-ledger.md)
važi i ovde.

Efektivna prodaja je red kome pogled kaže `enters_net`. Pogled je **već** izbacio
duplikat, zamenjenu reviziju i sporni dokument, pa se ta pravila ovde **ne
ponavljaju**: ponovljeno pravilo je pravilo koje se sledeći put razidje.

### Grupisanje po identitetu fakture 🟢

Ovo je mesto gde se promet najlakše prebroji dvaput, pa je zapisano izričito:

| Situacija | Dokumenata | Ponovljena kupovina? |
|---|---|---|
| Tri reda **istog** artikla na **jednoj** fakturi | 1 | **ne** |
| Isti artikal na **dve** fakture **istog** dana | 2 | po fakturi **da**, po datumu **ne** |
| Isti artikal na **dve** fakture **različitih** datuma | 2 | **da**, u oba merila |
| Ponovljen uvoz istog fajla | 1 | ne (duplikat je no-op) |
| Sudar dve verzije | 0 | ne (obe ispadaju iz pogleda) |
| Posle izbora verzije B | 1 | samo B |

`count(DISTINCT invoice_id)` je zato suština, ne stil. Bez njega bi dokument sa
trinaest stavki izgledao kao trinaest kupovina, i **svaki** kasniji brojač bi
nasledio istu grešku.

Razlika između „≥2 fakture“ i „≥2 datuma“ postoji zato što su dva računa istog
dana najčešće jedna isporuka razbijena na dva dokumenta. Da su brojani zajedno,
to bi izgledalo kao da kupac dolazi dvaput.

### Problemi se čitaju odvojeno od prometa

Brojevi problema idu iz `source_documents`, ne iz ledgera. Dokument koji nije
prošao proveru **nema nijedan red prometa** — da su problemi brojani iz ledgera,
upravo bi ti dokumenti, jedini koji su i problem, bili nevidljivi.

**Kategorije se preklapaju i ne smeju se sabirati.** Jedan CSV/PDF sudar je
istovremeno sudar, ručni pregled i (dok nema fakturu) čeka mapiranje — tri
kategorije, jedan dokument. Zato postoji `ukupnoRazlicitih`, i samo on se sme
pročitati kao „koliko dokumenata“.

### CSV faktura + PDF iz drugog izvora 🟢

Postojeća faktura iz ranijeg CSV uvoza i PDF koji tvrdi isti poslovni identitet:
PDF se **ne knjiži drugi put**, promet ostaje nepromenjen red za redom. Ali to
**nije potvrda da je sadržaj identičan** — CSV zapis ne čuva stavke onako kako ih
čuva izvorni dokument, pa se sadržaj ne može dokazano uporediti. Ostaje **otvoren
problem porekla** koji čeka ručno razrešenje, i tako je i prikazan.

---

## 3. Definicije metrika

Svaka je merena nad dozvoljenim opsegom i izabranim periodom.

| Metrika | Izvor | Definicija |
|---|---|---|
| Efektivnih prodajnih dokumenata | ledger, `enters_net` | `count(DISTINCT invoice_id)` |
| Stavki | ledger, `enters_net` | `count(*)` |
| Kupaca | ledger, `enters_net` | `count(DISTINCT customer_id)` |
| Artikala | ledger, `enters_net` | `count(DISTINCT article_code)` |
| Najraniji / najkasniji | ledger, `enters_net` | `min/max(issued_on)` |
| Faktura po mesecu | ledger, `enters_net` | `count(DISTINCT invoice_id)` po `to_char(issued_on,'YYYY-MM')`, najviše 120 redova |
| Parova kupac–artikal | ledger, `enters_net` | različitih `(customer_id, article_code)` |
| Parova na ≥2 fakture | ledger, `enters_net` | parova sa `count(DISTINCT invoice_id) >= 2` |
| Parova na ≥2 datuma | ledger, `enters_net` | parova sa `count(DISTINCT issued_on) >= 2` |
| Raspodela po kupcu | ledger, `enters_net` | koliko kupaca ima tačno N različitih faktura |
| Mapiranje kupaca | `customer_external_identifiers` | `status='mapped' AND customer_id IS NOT NULL` |
| Mapiranje artikala | `article_catalog_mappings` | živi red (`status NOT IN ('rejected','revoked')`) sa `status='mapped'` |
| Čeka mapiranje | `source_documents` | `invoice_id IS NULL AND validation_status='valid' AND revision_status='original'` |
| Sudar | `source_documents` | `revision_status='conflict'` |
| Ručni pregled | `source_documents` | `manual_review='pending'` |
| Oblik bez uzorka | `source_documents` | `validation_status='unsupported_requires_sample'` |
| Korektivnih dokumenata | ledger | `NOT enters_net AND bucket <> 'unclassified'`, `count(DISTINCT invoice_id)` |
| Bez dokazane veze | ledger | isto — veza sa originalom se **nigde ne čuva**, pa je to ceo skup |

### Semantika datuma

`issued_on` — **datum izdavanja dokumenta iz izvora**. Nije datum uvoza, nije
datum plaćanja, nije datum isporuke.

Granice perioda su **uključive na oba kraja**. Operater koji ukuca „od 1. do 31.“
misli ceo mesec; da je gornja granica isključiva, poslednji dan bi tiho ispadao i
mesečni zbir se ne bi poklapao sa knjigovodstvom za tačno jedan dan.

Datum se proverava kao **stvaran datum**, ne samo kao oblik: `2026-13-45` prolazi
svaki regex, a nema ga u kalendaru. Propušten bi otišao u upit i vratio se kao
sirova greška drajvera na ekranu.

### Imenitelji

Procenat se računa **isključivo nad imenovanim imeniteljem**, i imenitelj stoji
ispisan uz svaki procenat:

- kupci: **uvezene šifre partnera** (za komercijalistu: šifre **njegovih**
  kupaca) — nikad „svi kupci firme“, jer sistem taj broj ne zna;
- artikli: **artikli koji se pojavljuju u efektivnoj prodaji** u opsegu i
  periodu — ne ceo registar. Artikal koji nikada nije prodat nije nedostatak
  mapiranja nego stavka bez prometa.

**Nulti imenitelj daje „nije dostupno“, ne 0% i ne 100%.** Nula od nule nije ni
„ništa nije mapirano“ ni „sve je mapirano“; to je odsustvo pitanja. Prazna baza
bi inače prikazala 100% pokrivenosti — potpuno tačno po formuli i potpuno
pogrešno po značenju.

---

## 4. Sedam kriterijuma

Status je jedan od `potvrđeno` / `nedostaje` / `nije provereno`. Treći je
**odvojeno stanje**, ne blaža verzija drugog: „nismo našli“ i „nismo ni mogli da
gledamo“ vode različitim postupcima.

| # | Kriterijum | Osnov | Danas |
|---|---|---|---|
| 1 | Postoji istorija prodaje | baza | merljivo 🟢 |
| 2 | Postoje ponovljene kupovine | baza | merljivo 🟢, ali **ne dokazuje dovoljnost** |
| 3 | Mapiranja su potvrđena | baza | samo u **poznatom uvezenom opsegu** |
| 4 | Pokrivenost perioda i svih kupaca | spoljna evidencija | **nije provereno** 🔴 |
| 5 | Povrati/storno/korekcije i veze | baza | **nikad `potvrđeno`** 🔴 |
| 6 | Kancelarijska prihvatna provera | spoljna evidencija | **nije provereno** 🔴 |
| 7 | Aktuelne cene, valuta/PDV, lager | spoljna evidencija | **nije provereno** 🔴 |

Kriterijumi 4, 6 i 7 ostaju `nije provereno` **pri svakom mogućem ulazu**, i to
je pokriveno testom nad najbogatijim zamislivim podacima. Kada bi se izvodili iz
podataka, dovoljan uvoz bi ih pretvorio u `potvrđeno` bez ijedne stvarne provere
— a to je tačno lažna spremnost koju ovaj ekran postoji da spreči.

Zašto baš ta tri:

- **4** — da bi sistem znao šta nedostaje, morao bi znati za dokument koji nikada
  nije uvezen. Nijedan upit to ne može.
- **6** — prolazak automatizovanih testova je **ne menja**. Testovi rade nad
  sintetičkim podacima i mere kod, ne stvarne dokumente firme. Ranija prihvatna
  provera 11 uzoraka ne znači da su ti dokumenti trajno u bazi; `11/53` nigde
  nije ugrađeno kao konstanta.
- **7** — fakturisana cena je zapis prošlog posla, ne važeći cenovnik, a lager se
  iz nje ne vidi uopšte.

Kriterijum **5** nikad ne daje `potvrđeno`: nula uvezenih korektivnih dokumenata
daje `nije provereno` (format povrata nema uzorak, pa takav dokument ni ne bi bio
pročitan), a njihovo postojanje daje `nedostaje` (veza sa originalom se ne čuva).

---

## 5. Opseg i privatnost

Svaki upit ide kroz `LedgerScope` razrešen **na serveru** iz sesije. Adresa bira
**samo period**; nijedan parametar iz zahteva ne dodiruje opseg.

- `customerIds: []` i `null` **nisu isto**. Prazan assignment daje izričito
  `false` u `WHERE`, nikad izostavljen uslov — komercijalista bez ijedne dodele
  dobija nulu nad nula kupaca, nikad globalni pregled. 🟢
- Dva komercijaliste sa različitim opsegom ne vide zbir, artikle, raspodelu ni
  broj problema onog drugog. 🟢
- **Nemapiran dokument nema kupca**, pa ne pripada nijednom opsegu i
  komercijalisti se **ne prikazuje**. Prikazati ga značilo bi da nemapiranost
  sama po sebi otvara vidljivost — suprotno od onoga što mapiranje čeka da
  odluči. Vidi ga kancelarija/gazda kroz postojeću globalnu politiku, a ekran
  izričito kaže da brojevi ne obuhvataju nepripisive dokumente. 🟢
- Kupčev portal **ne dobija** ovaj ekran; ruta je pod `view:importi`, koji
  kupački nalog nema.
- Nova sposobnost se **ne uvodi**, i `view:importi` se **ne širi ni na jedan
  upis**: stranica nema nijednu server akciju.
- Bez sirovih PDF-ova, imena fajlova, PIB-a i podataka drugih kupaca — ekran
  prikazuje isključivo agregate i statuse.

Iznosi se u ovoj fazi **ne prikazuju**. Kada budu, ostaju egzaktan decimalni
tekst, po pravilu iz [17](17-biznisoft-pdf-ledger.md).

---

## 6. Šta se iz ovih brojeva NE sme zaključiti

Ove ograde stoje **u kodu** (`OGRADE`) i na ekranu, ne samo ovde — ekran nadživi
dokument koji ga objašnjava.

1. „Nema podataka“ **nije** „kupac nikada nije kupovao“.
2. „Nema uvezenih povrata“ **nije** „povrata nije bilo“.
3. Raspon između prve i poslednje fakture **ne dokazuje** potpunu istoriju za taj
   period.
4. Lista ranijih kupaca **ne dokazuje** da obuhvata sve kupce firme.
5. Procenat mapiranja važi **samo** nad imenovanim, uvezenim identitetima.
6. Nulti imenitelj daje „nije dostupno“, **ne** 0% i **ne** 100%.
7. Postojanje ponovljenih kupovina **ne dokazuje** da ih ima dovoljno za bilo
   kakav algoritam. Dovoljnost nije merena i nigde se ne tvrdi.

---

## 7. Šta vlasnik treba da pribavi

Spisak na ekranu prati **stvarne statuse** i nije statičan tekst: stavka koja se
merljivo potvrdi ispada sama.

1. **Istorija fakturisanja iz BizniSoft-a** — jedini način da se potvrdi
   pokrivenost perioda i obuhvat svih kupaca.
2. **Korektivni uzorci sa vidljivom vezom na original** — storno, povrat, knjižno
   odobrenje, korekcija cene i popusta. Bez uzorka koji pokazuje kako se
   referenca zapisuje, efekat na promet se ne sme računati.
3. **Dokument sa tabelom koja se nastavlja na narednoj strani** — danas završava
   na ručnom pregledu; nagađanje bi tiho odseklo stavke.
4. **Potvrda partner i artikal podataka** — ljudska potvrda, jer sličnost naziva
   nije dokaz identiteta.
5. **Aktuelne cene, valuta/PDV i stanje lagera, sa datumom svežine** — iz
   cenovnika i magacina, nikad iz istorijskih faktura.
6. **Fizička prihvatna provera u kancelariji** — poređenje prikazanih brojeva sa
   knjigovodstvom nad stvarnim dokumentima. **Ostaje otvorena.**

---

## 8. Provera

```bash
# Cista logika (38 testova, sinteticki ulaz)
npm run test:readiness

# Upiti nad izdvojenom test bazom (19 testova)
npm run test:integration

# Stvarni prikaz i dozvole (korak 19)
npm run qa:pg:browser
```

Svi testovi koriste **isključivo sintetičke podatke**. Nijedno ime, PIB, šifra,
iznos ni broj fakture nije stvaran.

---

## 9. Šta NIJE započeto

Namerno, i van opsega ove faze:

- preporuke, prognoza potražnje i predviđanje količine,
- automatsko poručivanje,
- konektor, scheduler i BizniSoft API,
- masovni uvoz stvarnih faktura i automatsko pretraživanje privatnih foldera,
- marža i upis nazad u BizniSoft.

Nijedan broj sa ovog ekrana ne otvara nijednu od tih stavki. Zeleno svetlo za
recommendation engine **ne postoji** i ne izvodi se iz kombinacije statusa.
