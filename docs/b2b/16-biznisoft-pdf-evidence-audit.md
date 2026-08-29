# 16 — BizniSoft PDF: revizija dokaza

Oznake: 🟢 dokazano realnim uzorkom · 🔵 samo dokumentovan ugovor · 🔴 nedostaje uzorak

**Ovaj dokument ne sadrži nijedan stvarni podatak.** Uzorci se vode anonimnim
oznakama `U01`–`U11`; brojevi dokumenata, nazivi, PIB-ovi, adrese, šifre i
iznosi su izostavljeni. Sami PDF-ovi ostaju u privatnom lokalnom folderu, van
Gita, i obrađeni su isključivo lokalno (`pypdf` iz sistemskog Pythona).
Nijedan bajt nije poslat cloud, OCR ni SaaS servisu.

---

## 1. Inventar

| | |
|---|---|
| Pronađeno fajlova | **11** |
| Sa ugrađenim tekstom | **11 / 11** — OCR nije potreban |
| Skenirano (bez teksta) | 0 |
| Stranica po dokumentu | 9 × jedna, 2 × dve |
| Duplikata po bajtovima | **0** |
| Različitih poslovnih brojeva | **11 od 11** |
| Poreklo | potvrđeno — footer nosi `www.biznisoft.com` |

Svaki fajl je identifikovan SHA-256 otiskom; otisci se vode lokalno i ne ulaze
u repozitorijum.

> **Napomena o očekivanom spisku.** Zadatak je pomenuo devet imenovanih fajlova
> i „ponovljenu kopiju, ako je priložena". Stvarno je nađeno jedanaest fajlova,
> i **nijedan par nije bajt-identičan**. Ponovljena kopija dakle nije priložena;
> duplicate test se izvodi ponovnim uvozom istog fajla, što je isti dokaz.

---

## 2. Osobine formata 🟢

| Osobina | Nalaz |
|---|---|
| Tip dokumenta | `Račun-otpremnica` — **svih 11** |
| Broj dokumenta | oblik `NN-RN#########` |
| Šifra partnera | **5 znakova, sa vodećom nulom** |
| Šifra artikla | 6 cifara, bez vodeće nule u ovom uzorku |
| Decimalni razdvajač | zarez; hiljade tačkom (`9.999,99`) |
| Decimalne količine | da (`9,999`) |
| Rabat | da — zastupljeni 10% i 20% |
| Poreske stope | 10% i 20%, uz rekapitulaciju po stopama |
| Zbirne vrednosti | „Ukupan iznos sa PDV", „Iznos PDV", osnovica po stopi |
| Oznaka strane | `Strana N od M` |
| Negativne vrednosti | **nijedna** |
| Referenca na original | **nijedna** |

**Vodeća nula u šifri partnera je potvrđena stvarnim dokumentom.** To praktično
dokazuje pravilo koje je osnova već postavila: šifra mora ostati `text`.

### Struktura strane

Zaglavlje izdavaoca → blok kupca (naziv, adresa, PIB, matični broj) → datumi →
`Šifra partnera` → tabela stavki (`Rb`, šifra, naziv, JM, količina, cena bez
PDV, rabat %, iznos) → rekapitulacija poreza → ukupno → potpisni blok → footer.

### Dvostrani dokumenti 🟢 / 🔴

U oba dvostrana uzorka (`U05`, `U07`) **sve stavke su na prvoj strani**; druga
strana je **ponovljeno zaglavlje i potpisni blok, bez ijedne stavke i bez
rekapitulacije**.

- Ponovljeno zaglavlje/footer: 🟢 **dokazano**
- **Nastavak tabele na sledećoj strani: 🔴 nije dokazan nijednim uzorkom.**

Parser zato ne sme da spaja tabele preko strana na osnovu pretpostavke.
Dokument u kome bi se tabela nastavila mora završiti u
`unsupported_requires_sample`.

---

## 3. Coverage matrica

| Slučaj | Status | Napomena |
|---|---|---|
| Obična faktura | 🟢 | svih 11 |
| Faktura sa više stavki | 🟢 | 1–13 stavki; `U05`, `U07` po 13 |
| Višestrana faktura | 🟢 | `U05`, `U07` — ali bez nastavka tabele |
| Ponovljeno zaglavlje/footer | 🟢 | strana 2 |
| Vodeće nule (partner) | 🟢 | 5-znakovna šifra sa vodećom nulom |
| Decimalna količina | 🟢 | |
| Decimalni zarez / hiljade tačkom | 🟢 | |
| Rabat | 🟢 | 10%, 20% |
| Više poreskih stopa | 🟢 | 10%, 20% |
| Zbirne vrednosti i rekapitulacija | 🟢 | |
| Ponovljeni PDF iste fakture | 🔵 | nema bajt-duplikata; dokazuje se ponovnim uvozom istog fajla |
| Isti broj dokumenta, različit sadržaj | 🔴 | 11/11 različitih brojeva |
| Izmenjena/revidirana faktura | 🔴 | nijedan uzorak |
| Puni storno | 🔴 | nijedan uzorak |
| Delimični storno | 🔴 | nijedan uzorak |
| Povrat | 🔴 | nijedan uzorak |
| Korekcija / knjižno odobrenje | 🔴 | nijedan uzorak |
| Negativna količina/vrednost | 🔴 | nijedna |
| Referenca na original | 🔴 | nijedna |
| Isti kupac kroz više faktura | 🔴 | **11 dokumenata → 11 različitih kupaca** |
| Isti artikal kroz više faktura | 🟡 | samo **1** artikal se javlja u 2 dokumenta |
| Promena cene/rabata za isti par | 🔴 | nemoguće dokazati — kupac se ne ponavlja |
| Nepoznata šifra kupca | 🟢 | baza nema nijednog kupca — svih 11 je `unmapped` |
| Nepoznata šifra artikla | 🟢 | isto — svi artikli `unmapped` |

---

## 4. Šta se sme graditi, a šta ne

### 🟢 Sme, jer je dokazano
- Ekstrakcija ugrađenog teksta (bez OCR-a).
- Zaglavlje, broj, datumi, šifra partnera (kao `text`), PIB kao pomoćni podatak.
- Tabela stavki na jednoj strani, sa rabatom i više poreskih stopa.
- Validacija zbira: izračunato vs. odštampano.
- Idempotentnost po SHA-256 otisku fajla.
- Exact mapiranje kupca `(source_system, issuer_code, external_partner_code)` i
  artikla po šifri; sve nemapirano ide u red za ručno razrešavanje.

### 🔵 Sme samo kao ugovor + manual-review stanje
- Revizija dokumenta — model čuva obe verzije i **ne bira** poslednju.
- Storno, povrat, korekcija — prepoznaju se **samo** ako dokument sam kaže tip;
  bez uzorka ne postoji pravilo prepoznavanja.
- Pricing reconciliation — nema para (kupac, artikal) sa dve fakture, pa se
  ponašanje ne može dokazati. Implementira se ugovor i `manual-review`, bez
  heuristike.

### 🔴 Ne sme se graditi
- Nastavak tabele preko strana.
- Bilo kakvo prepoznavanje storna/povrata/korekcije po iznosu, kupcu ili datumu.
- Izbor „poslednje" verzije po vremenu izmene fajla.
- Automatsko povezivanje originala i korektivnog dokumenta bez izričite
  reference u samom dokumentu.

---

## 5. Nedostajući realni uzorci

Da bi se odgovarajući deo sistema izvukao iz `unsupported_requires_sample`,
potreban je bar po jedan stvaran dokument:

1. **Storno** (pun i delimičan)
2. **Povrat robe**
3. **Knjižno odobrenje / korekcija**
4. **Revidirana faktura** — isti poslovni broj, izmenjen sadržaj
5. **Faktura sa nastavkom tabele na drugoj strani** (više stavki nego što stane)
6. **Dve fakture istom kupcu za isti artikal** — jedini način da se dokaže
   reconciliation i promena cene/rabata
7. **Dokument sa negativnom količinom ili vrednošću**
8. **Dokument koji referiše original** — da se vidi tačan oblik reference

---

## 6. Privatnost

- PDF-ovi ostaju u privatnom lokalnom folderu; **nisu** kopirani u repozitorijum.
- Nijedan stvarni naziv, PIB, adresa, e-pošta, šifra, iznos ni broj dokumenta
  nije ušao u ovaj dokument, u test fixtures ni u kod.
- Test fixtures su **sintetički** i strukturno prate format, sa izmišljenim
  vrednostima.
- Obrada je lokalna; nijedan spoljni servis nije korišćen.
