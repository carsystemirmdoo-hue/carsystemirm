# 17 — BizniSoft PDF: uvoz i jedan kanonski ledger

Oznake: 🟢 dokazano realnim uzorkom · 🔵 samo dokumentovan ugovor · 🔴 nedostaje uzorak

Nastavak na [16 — revizija dokaza](16-biznisoft-pdf-evidence-audit.md). Taj
dokument utvrđuje **šta stvarni uzorci dokazuju**; ovaj opisuje **šta je od toga
izgrađeno** i gde su granice povučene.

**Nijedan stvarni podatak nije u ovom dokumentu, u testovima, u fixtures-ima ni
u logovima.** Vidi §7.

---

## 1. Zašto pogled, a ne druga tabela

Prodaja se čita isključivo kroz `effective_sales_ledger` — **pogled** nad
postojećim `invoices` i `invoice_lines`, ne nova tabela.

Druga tabela bi značila drugu istinu. Prvo neslaganje sa knjigovodstvom bi se
otkrilo tek kada neko ručno uporedi dva izveštaja, i tada bi pitanje bilo „koja
vrednost važi", na koje niko ne bi imao odgovor. Pogled ne može da se raziđe sa
izvorom jer izvora nema drugog.

Sve buduće funkcije koje čitaju promet — preporuke, prognoza, analitika,
„poslednja fakturisana cena" — moraju ići kroz `lib/ledger/effective-sales.ts`.
Drugi upit nad `invoices` je defekt, ne optimizacija.

### Kofe i neto

| Kofa | `document_kind` | Ulazi u neto |
|---|---|---|
| `gross_sales` | `faktura` | **da** |
| `returns` | `povrat_robe` | ne |
| `cancellations` | `storno` | ne |
| `corrections` | `knjizno_odobrenje`, `korekcija_cene`, `korekcija_popusta` | ne |
| `unclassified` | `nepoznato` | ne |

`net_effective_sales` **nije zbir svih kofa**. Sabira samo redove kojima pogled
kaže `enters_net`. Povrat, storno i korekcija se prikazuju u svojoj kofi, ali ne
umanjuju neto dok se veza sa originalom ne dokaže. 🔵

Alternativa bi bila da se predznak pogađa iz tipa dokumenta. Tada bi jedan
pogrešno prepoznat dokument oduzeo promet koji nikad nije oduzet, a greška bi se
videla tek pri poređenju sa knjigovodstvom. Kolona `sign` postoji da bi ugovor
bio zapisan, ali se **ne primenjuje** dok `enters_net` ne bude tačan i za
korektivne dokumente.

Red korektivnih dokumenata bez dokazane veze vidi se na
`/portal/importi/dokumenti`. Bez tog reda bi razlika između bruto i neto bila
nevidljiva, i neko bi je pripisao grešci u računu.

---

## 2. Čitanje dokumenta

`lib/pdf/biznisoftLayout.mjs` je čista logika (bez baze, bez I/O),
`lib/pdf/extract.ts` je čitanje fajla. `unpdf` je jedina nova zavisnost, MIT,
radi **potpuno lokalno** — bez mrežnog poziva i bez cloud OCR-a.

Kolone se čitaju **po koordinatama**, ne iz toka teksta: brojevi u susednim
kolonama se u toku teksta slepe, pa bi „rabat 10,00" i poreska stopa postali
jedan broj. 🟢

**OCR nije ugrađen.** Svih 11 stvarnih uzoraka ima ugrađen tekst. Dodavanje OCR-a
„za svaki slučaj" značilo bi granu koju nijedan dokument ne izvršava, a koja bi
pri prvom skeniranom dokumentu radila neproverena.

### Granice obima

| | |
|---|---|
| Veličina fajla | 20 MB |
| Dokumenata po prolazu | 200 |
| Strana po dokumentu | **40** |
| Stavki po dokumentu | **500** |
| Decimala u količini | **3** (`invoice_lines.quantity` je `numeric(14,3)`) |
| Budžet prolaza | 200 MB / 90 s |

Brojevi su daleko iznad svega što stvarni uzorci pokazuju (najviše 2 strane i
13 stavki), pa granica ne može zaustaviti stvaran dokument a da to ne bude vest
sama po sebi. Prekoračenje **nije greška fajla** nego oblik bez potvrđenog
uzorka. Broj strana se proverava pre nego što se ijedna pročita — trošak je
upravo u čitanju.

Iscrpljen budžet prolaza takođe nije greška: sve obrađeno je proknjiženo i
prijavljeno, ostatak ide u sledeći prolaz.

### Redosled provera

Namerno od najgrublje ka najfinijoj:

0. fajl ne počinje sa `%PDF-` → `unparsable` (polyglot se odbija, iako ga
   čitači tolerišu);
0b. čitač baca (oštećen, skraćen, zaštićen lozinkom) → `unparsable`, bez
   prenošenja poruke čitača — ona ume da sadrži deo teksta dokumenta;
1. nije BizniSoft → `unparsable`;
2. naslov nije prepoznat → `unsupported_requires_sample`;
3. tabela se nastavlja na sledeću stranu → `unsupported_requires_sample` 🔴;
4. nijedna stavka pročitana → `unparsable`;
5. neka stavka ne prolazi aritmetiku, ili se odštampan zbir ne poklapa →
   `totals_mismatch`;
6. nedostaje broj, datum ili šifra partnera → `unparsable`;
7. inače `valid`.

Zbir se poredi sa **odštampanim** iznosima stavki, ne sa ponovo izračunatim iz
količine i cene. Ponovno računanje daje drugi zaokruženi zbir na dužim
dokumentima i lažno obara ispravne fakture. 🟢

Šifra artikla je **prvi token ćelije**, ne cela ćelija: PDF ekstraktori spajaju
bliske tekstualne blokove, pa ćelija šifre ume da povuče i početak naziva.
Ostatak se vraća nazivu da se podatak ne izgubi.

### Šta se NE nagađa 🔴

Storno, povrat, knjižno odobrenje, korekcija cene i korekcija popusta **nemaju
stvaran uzorak**. Njihov naslov se ne prepoznaje i dokument završava u
`unsupported_requires_sample` uz ručni pregled. Nagađanje tipa je jedini način
da storno tiho uđe u promet kao prodaja.

---

## 3. Idempotentnost i revizije

Identitet fajla je **SHA-256 sadržaja**, ne ime. Ime se preimenuje i ne znači
ništa. Provera stoji na dva mesta: u servisu, da odgovor bude čist „duplikat", i
kao `UNIQUE` u bazi, da dva paralelna uploada ne prođu oba.

Četiri različita ishoda:

| Ishod | Kada |
|---|---|
| `duplicate_file` | isti otisak sadržaja — no-op |
| `business_key_conflict` | drugi fajl tvrdi da je isti poslovni dokument |
| `quarantined` | nije prošao proveru; vidljiv, bez prometa |
| `awaiting_customer_mapping` | prošao, ali šifra partnera nije povezana |
| `ingested` | prošao i proknjižen |

Poslovni ključ `(izdavalac, tip, broj)` ima **ne-jedinstven** indeks. To je
namerno: dve verzije istog dokumenta moraju moći da postoje istovremeno da bi
čovek video obe i rekao koja važi.

**Sistem nikada ne bira „poslednju".** Ni po datumu fajla, ni po redosledu
uvoza. Datum fajla se menja kopiranjem i ne kaže ništa o dokumentu. Kada se
sudar otkrije, **obe** verzije u istoj transakciji dobijaju `conflict` i
`pending`, pa nijedna ne ulazi u ledger dok se spor ne razreši — uključujući i
onu koja je već bila proknjižena. Njena faktura se ne briše, samo prestaje da
se računa.

Razrešenje je **aditivno**: ranija verzija dobija `superseded`, novija ostaje
`original`. Nijedan izvorni dokument i nijedna njegova pročitana stavka se ne
brišu; `superseded_by_id` vodi na naslednika, pa se lanac čita unazad.

Pobednička verzija se **knjiži tačno jednom**. Faktura je jedan poslovni
dokument i njen identitet je jedinstven u bazi, pa se ne pravi nova nego
postojeća **prelazi** na verziju koja važi: prepisuju se samo stavke i zbirovi,
izvedeni podaci. Ponovljeno razrešenje je no-op.

Na nivou baze, jedna faktura sme imati **najviše jedan** izvorni dokument
(`source_documents_invoice_key`). Bez tog ograničenja bi dva dokumenta na istu
fakturu udvostručila svaki njen red u pogledu — tiho, kao veći promet.

Istovremeni uvoz istog fajla: jedinstveni indeks propušta tačno jedan, a
gubitnik dobija isti uredan `duplicate_file` koji bi dobio i sekundu kasnije.

---

## 4. Mapiranje

Kupac se razrešava **exact**, po `(source_system, issuer_code,
external_partner_code)`. Šifra je tekst — vodeća nula je deo šifre, `00042` nije
`42`. 🟢 Ista šifra kod drugog izdavaoca **nije** isti kupac.

Nemapirana šifra ne otvara kupca i ne pravi fakturu. Automatsko otvaranje kupca
po šifri sa fakture značilo bi da promet ulazi u ledger pre nego što je iko
potvrdio čiji je — a to se ispravlja teže nego što se čeka.

Kada čovek poveže šifru, dokumenti koji su čekali knjiže se odmah, iz **sačuvanih
stavki**, ne iz PDF-a. Zahvaljujući tome se original posle uvoza više nikad ne
otvara i fajl ne mora da se čuva.

Artikal se vezuje exact po šifri. Nepoznata šifra **ne blokira** fakturu, ali se
ni ne proguta: artikal se upisuje u postojeći registar `articles`, pa ga zatiče
postojeći red za mapiranje na katalog. Postojeći artikal se ne duplira i katalog
naziv se ne prepisuje.

Nema fuzzy poklapanja — ni po nazivu, ni po sličnosti šifre, ni po PIB-u.

---

## 5. Usaglašavanje cene

`confirmed` je dostižan **isključivo** kroz `lib/pricing/reconciliation-service.ts`.
Tri nezavisne prepreke brane to stanje:

1. tok (`SYSTEM_ONLY_STATUSES`) odbija ljudskog aktera;
2. `price_rules_confirmed_needs_invoice_ck` traži referencu na fakturu;
3. strani ključ `price_rules_reconciled_invoice_fk` traži da ta faktura zaista
   postoji — ranije je nasumičan UUID prolazio kao dokaz.

Dokaziv je samo par **(jedan kupac, jedan artikal)**. Pravilo na grupi kupaca ili
na brendu nije dokazano time što je jedna njegova stavka fakturisana po tom
uslovu — ostatak opsega ostaje neproveren. Takvo pravilo ostaje na ručnom
pregledu i **ne proglašava se neuspehom**: šire od dokazivog nije isto što i
„uslov nije primenjen".

| Nalaz | Značenje |
|---|---|
| `confirmed` | uslov nađen na fakturisanoj stavci; upisan dokaz |
| `failed` | stavke postoje, nijedna ne nosi uslov |
| `no_evidence_yet` | u periodu važenja nema nijedne fakturisane stavke |
| `not_applicable` | opseg širi od onoga što jedna stavka dokazuje |
| `not_eligible` | pravilo nije u `office_recorded` |

Dokaz je **najstarija** stavka koja se poklapa — trenutak kada je uslov prvi put
stvarno primenjen, ne poslednji put kada je slučajno ispao isti.

Dokaz se čita kroz ledger, pa zamenjen ili sporan dokument ne može potvrditi
nijedno pravilo, a povrat ne ulazi u promet i ne potvrđuje ništa.

`confirmed_by` ostaje prazan: potvrdu nije dao čovek, i trag to razlikuje.

**Valuta.** `invoices` i `invoice_lines` nemaju kolonu valute — svaki iznos je
implicitno dinar. Pravilo u bilo kojoj drugoj valuti vraća `not_applicable`:
sto evra i sto dinara su isti broj, pa poređenje ne bi bilo pogrešno za dlaku
nego potpuno. Valuta se proverava pre opsega, da poruka bude tačna.

> **Granica dokaza.** 🔴 Nijedan stvaran uzorak nema ponovljen par (kupac,
> artikal), pa nad realnim podacima ovaj servis danas ne može vratiti ništa osim
> `no_evidence_yet`. Logika je dokazana sintetičkim fixture-ima; prvo stvarno
> potvrđivanje treba proveriti ručno.

---

## 6. Ovlašćenje

`/portal/importi` i `/portal/importi/dokumenti` traže `view:importi`.
Komercijalista, magacioner i kupački nalog je bez paketa nemaju.

Trajne odluke nad dokumentima — biranje koja verzija važi i zatvaranje ručnog
pregleda — traže **`documents:resolve`**, ne `view:importi`. Pregled uvoza je
svakodnevni posao i ima ga cela kancelarija; odluka menja ono što ulazi u
promet i ne poništava se. Sposobnost nosi gazda bazno i paket „Mapiranja", uz
razrešavanje šifri partnera — iste su vrste, oboje menjaju čija je i koja je
istorija.

Usaglašavanje traži `prices:apply` — istu dozvolu koja sme da evidentira upis u
BizniSoft. To **nije** dozvola da se pravilo potvrdi: ishod određuje faktura, i
pozivalac ne može uticati na njega.

Svaki pogled na promet ide kroz opseg. Prazan `assignment` daje **prazan**
ledger, nikad ceo promet firme — `customerIds: []` i `null` nisu isto.

---

## 7. Privatnost

Pravila koja se sprovode kodom i testovima:

- **PDF fajl se ne snima na server.** Čita se u memoriji; posle uvoza sve što
  sistemu treba stoji u `source_documents` i `source_document_lines`. Otisak
  ostaje, pa se ponovni uvoz i dalje prepoznaje.
- **Nijedna kolona ne čuva binarni sadržaj dokumenta.** Test to proverava nad
  `information_schema`, pa pada pre nego što prvi stvaran PDF uđe u bazu.
- **Trag revizije je redigovan.** Oznaka je `sd:<12 hex otiska>[/…3 znaka broja]`.
  U tragu nema naziva kupca, PIB-a, adrese, e-pošte, celog broja dokumenta,
  imena fajla ni sirovog teksta PDF-a.
- **Poruke o neuspehu ne sadrže iznose.** Idu u obaveštenje i u trag; razlika se
  vidi na ekranu, uz proveru dozvola.
- **Ekran radi sa otiskom, ne sa sadržajem.** Ime fajla i broj računa se ne
  prenose na klijent — spisak se gleda i sa ekrana koji nije nasamo.
- **Fixtures su potpuno izmišljeni.** `fixtures/dev/biznisoft/` sadrži sedam
  generisanih dokumenata; nijedno ime, PIB, adresa, šifra, e-pošta, iznos ni broj
  fakture nije stvaran. Generiše ih `npm run fixtures:biznisoft`.
- **Stvarni PDF-ovi ostaju van Gita.** Provera nad njima se pokreće lokalno
  (§8) i ispisuje samo anonimne oznake, statuse i brojeve.
- **Poruke o neuspelom čitanju ne nose ni tekst dokumenta ni tehnički trag.**
  Poruka čitača ume da sadrži deo sadržaja, a stack trace odaje putanje servera.
- **Ništa se ne šalje cloud, OCR ni SaaS servisu.**

---

## 8. Rad

```bash
# Regeneracija sintetičkih fixture-a
npm run fixtures:biznisoft

# Čista logika parsera
npm run test:pdf

# Lokalna provera nad privatnim PDF-ovima (van Gita)
BIZNISOFT_SAMPLES=/putanja/do/foldera \
  npx tsx --tsconfig db/integration/tsconfig.test.json \
  scripts/local/biznisoft-acceptance.mjs
```

Skripta ispisuje isključivo anonimne oznake, statuse i zbirove. **Putanja je
obavezna** — podrazumevane nema. Ranije se podrazumevao `~/Downloads`, pa bi
skripta pokrenuta bez promenljive prošla kroz lični folder i čitala tuđe
PDF-ove.

---

## 9. Šta NIJE započeto

Namerno, i van opsega ove faze:

- preporuke i prognoza potražnje,
- prognoza nabavke za vlasnika,
- automatsko poručivanje,
- upis nazad u BizniSoft,
- stvarni obračun marže.

Ledger je pripremljen kao jedini ulaz za sve navedeno.

---

## 10. Otvoreno 🔴

Traže **stvaran uzorak** pre nego što se implementiraju:

1. storno,
2. povrat robe,
3. knjižno odobrenje,
4. korekcija cene i korekcija popusta,
5. dokument sa tabelom koja se nastavlja na sledeću stranu,
6. dokument sa izričitom referencom na original,
7. revizija istog poslovnog broja (dve verzije istog dokumenta),
8. dokument sa decimalnom količinom većom od dve decimale.

Do tada svaki od njih završava u `unsupported_requires_sample` ili na ručnom
pregledu. To nije nedostatak implementacije nego odbijanje da se format izmisli.
