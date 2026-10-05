# 23 — Registar partnera, potvrda ovlašćene osobe i pregled komercijaliste

Oznake: 🟢 dokazano kodom i testom · 🔵 samo dokumentovan postupak · 🔴 blokirano podacima ili infrastrukturom

Grana `feat/customer-accounts-partner-verification` (iz `main` 96bf57f). Migracija `0028`.

---

## 1. Šta je zatečeno (pre ove grane)

| Deo | Gde | Stanje |
|---|---|---|
| Kupac kao firma (PIB jedinstven) | `db/schema/permissions.ts` `customers` | 🟢 |
| Više naloga po firmi, odvojen identitet kupca | `db/schema/customer-accounts.ts` `customer_users` | 🟢 |
| Jednokratni poziv (HMAC otisak, 48 h), outbox bez slanja | `lib/customers/invitation-service.ts` | 🟢 |
| BizniSoft šifra partnera ↔ kupac, sukob umesto izbora | `customer_external_identifiers`, `lib/commercial/identity-service.ts` | 🟢 |
| Šifra komercijaliste iz faktura | `salespeople.source_code` → `user_id` | 🟢 tabela; veza se nije mogla uneti |
| Dodela kupac → komercijalista | `customer_assignments` | 🟢 tabela; **nije bilo servisa ni traga** |
| Provera opsega na serveru | `requireCustomerAccess`, `canAccessCustomer`, `loadAssignedCustomerIds` | 🟢 |
| Preporuke po ritmu kupca i artikla | `cadence_v1`, `/portal/preporuke` | 🟢 kod; 🔴 nema stvarnih podataka |
| Uvoz faktura (PDF, kanonski ugovor, Windows konektor) | `docs/b2b/17`–`22` | 🟢 kod |

**Nađene praznine koje ova grana zatvara:**

1. `issueInvitation` nije tražio **nikakvu** potvrdu firme ni osobe — e-mail sa kartice partnera je mogao dobiti poziv bez provere.
2. `activateWithInvitation` nije proveravao stanje naloga: nalog **isključen posle izdavanja poziva** mogao je da se aktivira neiskorišćenim tokenom (isključenje nije poništavalo otvorene tokene). Ispravljeno na dva mesta — isključenje poništava tokene, a aktivacija ponovo proverava kapiju i stanje `approved` u samom `UPDATE`-u.
3. Dodela komercijalisti nije imala servis, trag revizije ni vezu sa BizniSoft šifrom komercijaliste.
4. Nije postojao uvoz matičnih podataka partnera.

---

## 2. Baza na Vercelu 🔴

- Burina ne dozvoljava pristup svom PostgreSQL-u sa Vercela. Ovaj kod **ne pretpostavlja** da postoji produkcijska baza.
- Potrebno: zasebna upravljana PostgreSQL baza (≥ 15; lokalna provera je na 17), po mogućstvu u EU regionu. Besplatni nivoi (Neon, Supabase) su pomenuti u `docs/portal/SETUP.md`, ali **svaki plaćeni plan traži odobrenje** (`COST_CONTROL.md`).
- Aplikacija traži dve adrese: `DATABASE_URL` (runtime rola bez DDL-a, sme kroz pooler) i `MIGRATION_DATABASE_URL` (vlasnik šeme, **direktna** veza, bez poolera) — `docs/b2b/10-db-roles-runbook.md`.
- Otvorene odluke vlasnika: provajder i region, ko drži backup i ključeve, RPO (P14 u `09`).

---

## 3. Mapa podataka

```
BizniSoft kartica partnera ─┐
  šifra, naziv, PIB, mesto,  │  uvoz snimka (0028)
  e-mail, tel, šifra kom.    ▼
                      partner_imports ──< partner_records   (snimak po uvozu; nije spisak kupaca)
                                               │ odluka čoveka: „otvori kupca" / „pripoji"
                                               ▼
customers (PIB) ──< customer_external_identifiers (biznisoft, izdavalac, šifra) = mapped
   │                                   ▲
   │                                   │ ista šifra na dokumentu
   │                 source_documents.external_partner_code (0020) → invoices → invoice_lines
   │                                                                   │
   │                                            recommendation_input_lines (0026) → cadence_v1
   ├──< customer_users (e-mail, stanje) ──< customer_contact_verifications (0028)
   └──< customer_assignments (basis) >── users (komercijalista) ── salespeople.source_code
```

**Ključ povezivanja je `(source_system, izdavalac, šifra partnera)`**, kao tekst sa vodećim nulama. PIB je atribut pravnog lica i pomoć pri pregledu — `pibIsAutoMergeEvidence()` ostaje `false`. Prodajni dokumenti se vezuju za kupca **preko šifre partnera sa dokumenta**, ne preko naziva.

### Posebni slučajevi

| Slučaj | Kako se prepoznaje | Šta sistem radi |
|---|---|---|
| Više poslovnica istog pravnog lica | isti PIB, više šifara | `pib_shared_by_codes`; „otvori kupca" za drugu šifru se odbija (`pib_exists`), čovek bira „pripoji" |
| Poslovnice sa različitim komercijalistima | plan dodela | `customer_rep_conflict` — nikome se ne dodeljuje automatski |
| Promenjen naziv | ista šifra, drugi naziv između dva uvoza | `name_changed` (info), veza ostaje |
| **Promenjen PIB pod istom šifrom** | razlika snimaka | `pib_changed` **kritično** — prikazuje se na vrhu ekrana registra |
| PR → DOO, nova firma na istoj adresi | ista adresa, drugi PIB | `address_shared_across_legal_entities` — samo napomena |
| Sličan naziv | normalizovan naziv | `similar_name` — samo napomena, nikad spajanje |
| Ista e-pošta kod dve firme | isti e-mail, različit PIB | `email_shared_across_legal_entities`; baza ionako ne dozvoljava jedan nalog za dve firme |
| Bez PIB-a / strani PDV broj | `pib_status` | ne može se otvoriti kao kupac automatski |
| Pomoćna lista (ID nije BizniSoft šifra) | tačan e-mail ili telefon (≥ 8 cifara) | predlog za ručnu potvrdu; naziv = samo napomena; ništa se ne upisuje u bazu |

### Stvarni fajl `Kupci_BizniSoft_priprema.xlsx` (zbirno)

Izvedeno iz podataka, ne prepisano iz priprema — i poklapa se sa pripremom:

| | Broj |
|---|---|
| Partnera | 594 |
| Sa šifrom komercijaliste (kandidat, **ne** dokaz kupovine) | 366 (kom. 1: 113 · kom. 2: 180 · kom. 3: 73) |
| — sa e-poštom iz izvora / bez | 177 / 189 |
| Za dodatnu proveru / od toga sa e-poštom | 228 / 18 |
| PIB ispravan / bez PIB-a / nestandardan (strani) / pogrešna kontrolna cifra | 562 / 25 / 6 / 1 |
| Isti PIB pod više šifara | 0 |
| Ista e-pošta kod dva različita pravna lica | 6 parova |
| Ista adresa, različit PIB | 16 grupa |
| Pomoćna lista: jaka veza / samo napomena po nazivu / bez veze | 1 (telefon) / 41 / 58 |

Radne liste sa imenima i adresama: `npm run partners:report -- --file <xlsx>` → `_incoming/partners/<datum>/` (van Gita).

---

## 4. Tačan zahtev za sledeći BizniSoft izvoz 🔴

Pre izrade uvoznika treba **uzorak od 20–50 redova u stvarnoj strukturi** (anonimizovan sadržaj, očuvane kolone, separator, kodni raspored, format datuma i brojeva), sa bar jednim stornom i jednim povraćajem. Struktura se profiliše isto kao ova radna sveska, pa se tek onda piše profil uvoza.

### A. Matični podaci partnera (sirov izvoz, ne priprema)

`šifra partnera` · `naziv` · `PIB` · `matični broj` · `mesto` · `adresa` · `šifra komercijaliste` · `aktivan` · **`tip partnera` (kupac/dobavljač), ako polje postoji** · **`šifra sedišta / nadređenog partnera` za poslovnice, ako postoji** · `datum otvaranja` i `datum poslednje izmene` · `e-mail` · `telefon`.

### B. Prodajni dokumenti — jedan red po stavci (najvažnije)

| Polje | Zašto |
|---|---|
| izdavalac (firma u BizniSoftu) | opseg šifara |
| **tip dokumenta** (faktura, povraćaj robe, knjižno odobrenje, storno, korekcija) | promet vs. umanjenje |
| **broj dokumenta** i poslovna godina | identitet dokumenta |
| **status** (proknjižen / storniran / nacrt) | nacrt i storniran ne ulaze u istoriju |
| datum dokumenta i datum prometa | osnov ritma kupovine |
| **šifra partnera** (i PIB sa dokumenta) | veza sa kupcem |
| šifra komercijaliste na dokumentu | kontrola dodela |
| **broj originalnog dokumenta** za storno/povraćaj/odobrenje | uparivanje umanjenja |
| redni broj stavke | identitet stavke |
| **šifra artikla**, naziv, jedinica mere | proizvodi koje kupac uzima |
| **količina** (sa predznakom kako stoji) | ritam i povraćaji |
| cena bez PDV-a, rabat %, **vrednost bez PDV-a**, stopa PDV-a, vrednost sa PDV-om, valuta | vrednost |

Period: od najranijeg upotrebljivog datuma, **najmanje 24 meseca** (P7). Format: XLSX ili CSV u UTF-8, jedan list, jedan red zaglavlja, bez spojenih ćelija i međuzbirova. Polja se poklapaju sa postojećim ugovorom `contracts/invoice-ingest/v1/schema.json` (kind, number, issued_on, trade_date, partner.external_code, lines[]), pa izvoz može ići kroz isti kanonski unos.

### C. (Poželjno) Artikli

`šifra` · `naziv` · `JM` · `grupa/brend` · `barkod` · `aktivan` — za vezu sa katalogom (P4).

---

## 5. Postupak za nedostajuće i nepotvrđene e-mailove 🔵

Radna lista `radna-lista-kontakata.csv` ima jedan red po partneru. Generator popunjava samo podatke iz izvora; kolone od „Predložen kontakt" nadalje popunjava čovek, i **generator nikad ne upisuje nagađanu adresu**.

1. **Prvi izvor je firma sama**: komercijalista zove firmu na broj poznat od ranije i traži ime, funkciju i adresu osobe koja treba pristup.
2. Javno dostupan poslovni kontakt (sajt firme, zvanični registar, poslovni imenik) sme se upisati **samo kao predlog**, sa URL-om izvora i nivoom pouzdanosti:
   - **A** — zvanični sajt firme ili registar, adresa na domenu firme;
   - **B** — poslovni imenik/profil koji firma sama održava;
   - **C** — posredan izvor, zastareo ili nejasno čiji.
3. Ne nagađa se adresa po obrascu imena ili domena (`ime.prezime@…`, `info@…`).
4. **Nijedan predlog i nijedan e-mail sa kartice ne otvara nalog.** Nalog prolazi: predlog kontakta → potvrda osobe (§6) → poziv.
5. Šest adresa deljenih između dve firme: potvrditi sa **obe** firme za koju važi; jedna adresa sme biti nalog samo jedne firme.

---

## 6. Nalozi i ovlašćenja 🟢

**Uloge:** `gazda` (administrator), `komercijalista`, `kancelarija`, `magacioner`; kupac je **odvojen identitet** (`customer_users`), ne interna uloga.

**Tok:**

1. Registar → „otvori kupca" / „pripoji" (`mappings:manage`) — firma dobija `mapped` šifru partnera.
2. Komercijalista (za dodeljenog kupca) ili kancelarija predlaže kontakt — nalog `requested`, bez lozinke.
3. Kancelarija/gazda (`customer_accounts:manage`) beleži **potvrdu osobe**: šifra partnera kojom je firma identifikovana, način (povratni poziv na poznat broj / potpisano ovlašćenje / lično), izvor adrese, funkcija osobe, beleška o dokazu (≥ 15 znakova).
4. Poziv se izdaje tek kada kapija (`lib/customers/contactVerification.mjs`) prođe: nalog `requested|approved`, kupac aktivan, bar jedna `mapped` šifra, živa potvrda za **tu adresu** i **tu firmu**, na osnovu šifre koja je i dalje `mapped`, ne starija od 90 dana.
5. Kupac postavlja lozinku; aktivacija ponovo proverava kapiju (opoziv posle poziva zatvara i poslat link).
6. **Opoziv / promena kontakta**: „Opozovi pristup" u jednoj transakciji opoziva potvrdu, poništava otvorene pozive i resete, isključuje nalog i obara sesije. Nova osoba ide kroz korake 2–5.

**Baza sprovodi:** potvrda pripada nalogu I firmi naloga (složeni strani ključ), adresa u malim slovima, beleška ≥ 15, URL za javni izvor, najviše jedna živa potvrda po nalogu, potvrda se ne briše i ne prepravlja — samo opoziva (okidač).

**Dodele:** gazda (`assignments:manage`) povezuje BizniSoft šifru komercijaliste sa korisnikom, pregleda plan i primenjuje ga; plan je aditivan i svaka dodela ima trag. Ručna dodela/oduzimanje na stranici kupca. Opseg se čita iz baze pri svakom zahtevu, pa oduzimanje deluje odmah.

**Trag revizije (nove radnje):** uvoz registra, povezivanje partnera, potvrda osobe, opoziv potvrde, opoziv pristupa, odbijena aktivacija, veza šifre komercijaliste, dodela, oduzimanje. Trag ne nosi e-mail iz registra ni belešku o dokazu.

---

## 7. Radni pregled komercijaliste (faza 3)

`/portal/kupci/[id]` (posle `requireCustomerAccess`, uz `view:preporuke`):

- **ritam kupca** — ista funkcija kao za par kupac × artikal (`evaluatePair`) nad danima sa potvrđenom kupovinom; prag „kasni/uspavan" zavisi od ritma tog kupca;
- **duže ne uzima** (`dormant`: ≥ 3 njegova razmaka i ≥ 180 dana), **prošao uobičajeni termin** (`overdue`), **redovno uzima** (≥ 3 kupovine) — svaki red sa prvom i poslednjom kupovinom, brojem kupovina, tipičnim razmakom i rečenicom „zašto";
- 1–2 kupovine se samo broje; bez dokumenata piše da ih nema.

🔴 Stvarnih prodajnih stavki još nema — ekran danas pošteno prikazuje „nema potvrđenih dokumenata".

---

## 8. Ekrani

| Ruta | Sposobnost | Šta |
|---|---|---|
| `/portal/kupci/partneri` | `view:mapiranja` (+ `mappings:manage`, `assignments:manage`) | registar, povezivanje, šifre komercijalista, plan dodela; uvoz iza `FEATURE_PARTNER_REGISTRY=1` |
| `/portal/kupci/nalozi` | `view:kupacki_nalozi` | kolona „Provera za poziv", potvrda osobe, opoziv |
| `/portal/kupci/kontakti` | `customer_accounts:manage` (+ svež drugi faktor za upis) | grupni predlog kontakata iz pregledane tabele: firma samo po `mapped` šifri, PIB kao provera; nastaju samo nalozi `requested` bez lozinke — bez potvrde osobe i bez poziva; istovetni se preskaču, neslaganja izdvajaju |
| `/portal/kupci/[id]` | `view:kupci` + opseg | komercijalisti, ritam i signali |

---

## 9. Provere

- Jedinični: `npm run test:partners` (XLSX čitač uklj. .NET prefikse, PIB, registar, kapija, plan), `lib/recommendations/customerRhythm.test.mjs`.
- Integracioni: `db/integration/partnerAccounts.integration.test.mts` (15) + izmenjen `customerLifecycle` — pun `npm run test:integration` nad lokalnim Postgresom 17.
- Migracija: up → down (`db/rollback/0028_…down.sql`) → up daje identičnu šemu (`pg_dump -s`).

---

## 10. Redosled puštanja u rad

1. Odluka o bazi (§2); napraviti bazu, role po `10-db-roles-runbook.md`.
2. `MIGRATION_DATABASE_URL=… npm run db:migrate` (0000–0028). Povratak: `db/rollback/0028_…down.sql` — važi **dok je 0028 poslednja primenjena migracija** (drizzle primenjuje samo novije od poslednje).
3. Gazda: nalozi komercijalista i kancelarije, MFA (`12-mfa-policy-closeout.md`).
4. Odluka vlasnika da registar sme u produkcionu bazu → `FEATURE_PARTNER_REGISTRY=1`, uvoz, pa ponovo `=0`.
5. Povezati šifre komercijalista 1/2/3 sa ljudima; pregledati plan; primeniti.
6. Pilot 5–10 firmi: otvaranje kupca iz registra → predlog kontakta → potvrda osobe → poziv (link predaje kancelarija) → aktivacija. Proveriti prijavom da kupac vidi samo svoju firmu.
7. Tek posle stvarnog izvoza iz §4: uvoz istorije, obračun preporuka, pregled sa komercijalistima (`recommendation-office-validation-runbook.md`).

## 11. Otvorene odluke vlasnika

- Da li potvrdu osobe sme da zabeleži isti čovek koji je predložio kontakt (danas sme, ako ima `customer_accounts:manage`).
- Rok važenja potvrde za nov poziv (danas 90 dana).
- Oznaka izdavaoca za BizniSoft (ista kao pri uvozu faktura).
- Kome pripadaju šifre komercijalista 1, 2 i 3.
- Politika za adrese deljene između firmi (knjigovođe, vlasnici više firmi).
