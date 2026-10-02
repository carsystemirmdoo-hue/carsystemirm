# 36 — Provera stvarnih faktura bez upisa i okruženje za stvarne podatke

**Status (2026-10-02): provera bez upisa izvršena nad stvarnim fakturama;
rezultati su samo u privatnom lokalnom izveštaju (javni repozitorijum ne nosi
brojke o poslovanju); parser podignut na `biznisoft-pdf-2`, konektor na 0.2.0;
okruženje za stvarne podatke čeka odluku.** Ništa stvarno nije upisano. Nastavak na
[34](34-prelazak-na-stvarne-podatke.md) i [35](35-zahtev-za-izvoze-biznisoft.md).

## 1. Koje fakture postoje

Revizija [16](16-biznisoft-pdf-evidence-audit.md) radila je nad 11 stvarnih
PDF-ova u privatnom folderu. Pretraga razvojnog računara 2026-10-02 (imena
fajlova se ne ispisuju; lični folderi se ne otvaraju):

- fajlova `Fak*.pdf` nema nigde u početnom folderu ni u kanti;
- PDF-ovi u projektnom `_incoming/` (8) nisu BizniSoft fakture.

Posle toga fakture su dostavljene u privatni folder van repozitorijuma i
proverene bez upisa (§2, `BIZNISOFT_RECURSIVE=1`). Rezultat i spisak za ljudski
pregled po kategorijama: `~/.carsystem-private/` (prava 600/700).

**Nalazi provere i ispravke parsera (2026-10-02).** Svaka ispravka je
izmerena nad celim skupom, proverena ručnim poređenjem sa PDF-om, pokrivena
sintetičkim regresionim testom, i nijedna ne menja ranije ispravno pročitan
dokument (osim polja koja su bila pogrešna). Provere iznosa nisu oslabljene:
tolerancija ostaje jedna para.

| Greška | Uzrok | Ispravka |
|---|---|---|
| svi kupci dobijaju istu šifru partnera | posle oznake „Šifra partnera:" sledi druga oznaka, a vrednost stoji ispred | reč koja se završava dvotačkom nije šifra; šifra se poklapa sa šifarnikom za svaki dokument |
| faktura bez ijedne stavke | drugi raspored (bez kolone barkoda): redni broj na x≈22 | kolona rednog broja od x=15 |
| rabat i PDV u jednom elementu | isti raspored štampa „10,00 20%" | deli se samo taj oblik i samo kada je kolona PDV-a prazna; podelu potvrđuje aritmetika |
| ukupan iznos nije pronađen | isti raspored koristi „Vrednost sa PDV:" | rezerva samo kada glavne oznake nema i oznaka je jedinstvena |
| prva reč naziva zalepljena uz šifru artikla | isti raspored: naziv počinje na x≈78 | granica šifre i naziva na x=65 (šifra ≤ 50, naziv ≥ 78) |
| odstupanje do 5 para na stavci | BizniSoft zaokružuje osnovicu, pa rabat zasebno | ista formula za portal i konektor; tačna za sve stavke |
| polovina pare zaokružena nadole | binarni zapis (1,005 × 100 = 100,4999…) | zaokruživanje preko `toPrecision(15)` |
| tabela na više strana odbijena | parser nije spajao strane | spaja se samo kada je numeracija 1…N neprekidna; zbir svih strana mora odgovarati |
| drugi red naziva izgubljen | naziv se prelama 10 tačaka ispod stavke | red sa samo nazivom neposredno ispod stavke dopunjuje opis — nikad iznose |
| negativne stavke pod naslovom fakture | storno dokumenti | `unsupported_requires_sample`, nikad u promet |

Šifra partnera u PDF-u ima 5 cifara sa vodećim nulama, a pripremljeni
šifarnik (`Kupci_BizniSoft_priprema.xlsx`) istu šifru bez nula. Poređenje u
kodu je tačno po tekstu, pa se dokumenti ne bi povezali sa kupcima iz tog
šifarnika — **otvoreno pitanje za kancelariju** (koji oblik je pravi, i da li
sirov izvoz čuva nule), ne tiha normalizacija.

Dokumenti koji nisu prodajne fakture razvrstani su po sadržaju (zbirni
izveštaji, nivelacije, kalkulacije, kartice, reklamacije, samostalna
otpremnica) i ostaju van uvoza; spisak je u privatnom izveštaju.

## 2. Provera bez upisa

`scripts/local/biznisoft-readonly-check.mts` — isti parser kao portal i
konektor; ne dira bazu, mrežu ni originale. Na ekran idu samo oznake
(`U01`…), statusi i brojevi.

```bash
BIZNISOFT_SAMPLES=/privatni/folder \
BIZNISOFT_PRIVATE_REPORT=~/.carsystem-private/provera.json \
  npx tsx --tsconfig db/integration/tsconfig.test.json \
  scripts/local/biznisoft-readonly-check.mts
```

| Proverava | Kako |
|---|---|
| stavke | broj stavki; aritmetika svake (količina × cena − rabat, PDV, bruto) |
| iznosi | zbir stavki prema odštampanom ukupnom iznosu |
| PDV | raspodela stavki po stopi |
| rabati | broj stavki sa rabatom |
| identitet kupca | šifra partnera postoji; PIB: kontrolna cifra (vrednost se ne ispisuje) |
| duplikati | isti bajtovi; isti poslovni broj u različitim fajlovima |

Veza oznaka → fajl ide samo u privatni izveštaj (prava 600); alat odbija
putanju unutar repozitorijuma.

**Proba nad sintetičkim fajlovima** (`fixtures/dev/biznisoft`, plus kopija
jednog fajla): 5 ispravnih, 1 bez ukupnog zbira (tabela se nastavlja), 1
nečitljiv, 1 sa namerno pogrešnim zbirom; stope 20 % i 10 %; stavke sa rabatom
prepoznate; kopija prijavljena kao duplikat po bajtovima. Sintetički PIB-ovi
namerno nemaju ispravnu kontrolnu cifru.

**Šta provera ne može:** da kaže da li šifra partnera odgovara pravom kupcu.
Za to treba šifarnik partnera ([35 §1](35-zahtev-za-izvoze-biznisoft.md)).

## 3. Izolacija od sintetičkog demoa (iz koda)

| Zaštita | Gde |
|---|---|
| Baza nosi oznaku porekla: red `dataset.kind = demo` znači demo; bez reda baza je radna | `lib/data-state/dataset.ts` |
| Demo poručivanje radi samo nad demo oznakom | `lib/ordering/ordering-service.ts` |
| Sintetički seed odbija bazu sa kupcima van opsega `000000…` | `scripts/ops/seed-synthetic-preview.mts` |

**Praznina:** uvoz PDF-a ne proverava oznaku. Stvarna faktura uvezena u
testnu bazu bila bi prikazana kao „demo". Zato je pravilo organizaciono:
**stvarni podaci nikad ne ulaze u `carsystem-preview-test`.** Za stvarne
podatke: zaseban Neon projekat, zasebna Vercel grana i promenljive, novi ključevi
(`AUTH_SECRET`, `PORTAL_MFA_MASTER_KEY_V1`, `AUTH_RATE_LIMIT_HMAC_KEY`, lozinka
`carsystem_app`), bez reda `dataset.kind`, bez sintetičkih naloga,
`CUSTOMER_ORDERING` i `PORTAL_COMMERCE` isključeni.

## 4. Rezervna kopija i oporavak

**Dokazano 2026-10-02 nad sintetičkom Neon bazom:** `pg_dump -Fc` (Postgres 17,
direktna adresa) → lokalni fajl 256 KB za 73 s → `pg_restore` u praznu lokalnu
bazu → broj redova jednak u `users`, `customers`, `invoices`, `invoice_lines`,
`audit_log` i 33 migracije. Probni fajl je zatim obrisan.

Postupak za stvarne podatke:

1. **Pre svakog talasa uvoza:** Neon grana `pre-import-<datum>` (trenutna, bez
   kopiranja podataka).
2. **Posle svakog talasa i dnevno tokom pilota:** `pg_dump -Fc` sa direktne
   adrese u **šifrovanu** lokaciju (npr. šifrovana macOS slika diska); dump
   sadrži heševe lozinki i šifrovane MFA tajne.
3. **Oporavak:** greška u talasu → vraćanje na granu iz koraka 1; gubitak
   projekta → `pg_restore` u nov projekat, zatim `carsystem_app` i
   `runtime-role.sql` iz [33 §4](33-test-baza-runbook.md) (dump se pravi bez
   vlasnika i prava).
4. **Proba oporavka** jednom pre pilota i posle svake promene šeme.

## 5. Predlog okruženja — odluka vlasnika

Novi servis nije potreban; trošak zavisi od izbora plana.

| | A: bez troška | B: preporuka za pilot |
|---|---|---|
| Baza | nov Neon projekat na Free planu | isti, nalog na planu Launch |
| Povratak u vremenu | 6 h | do 7 dana |
| Rezervna kopija | ručni `pg_dump` (§4) — jedina zaštita duža od 6 h | `pg_dump` kao druga linija |
| Trošak baze | 0 | po potrošnji, bez minimuma: $0,106/CU-sat, $0,35/GB-mesec |
| Vercel | Hobby — po uslovima Vercela samo za ličnu, nekomercijalnu upotrebu | Pro, $20 po razvojnom sedištu mesečno |

Procena za B, uz izričite pretpostavke: računanje 0,25 CU, aktivno 8 h × 22
dana ≈ 44 CU-sata ≈ $4,7 mesečno; prostor 0,5 GB ≈ $0,2. Stvarni trošak zavisi
od toga koliko je baza budna. Plaćeni plan Neona važi za ceo nalog, pa obuhvata
i testni projekat (danas 11 MB). Koliko košta čuvanje istorije za povratak u
vremenu nisam proverio u zvaničnim uslovima.

## 6. Šta nedostaje za prvi kontrolisani uvoz

1. **Odluka o dokumentima koji nisu prošli proveru** (privatni spisak po
   kategorijama): interni dokumenti (kalkulacije, nivelacije) se isključuju;
   neprepoznat tip, faktura bez pročitanih stavki, tabela na više strana i
   greške aritmetike traže uzorak i ljudsku proveru; prvi talas uvozi samo
   ispravne.
2. **Šifarnik partnera** (sirov izvoz, [35 §1](35-zahtev-za-izvoze-biznisoft.md))
   — bez njega fakture ostaju „čeka mapiranje".
3. **Odluka o okruženju** (§5) i pravljenje projekta i grane — rade ljudi sa
   pristupom firminim nalozima.
4. **Nalog Vlasnika sa vezanim drugim faktorom** u tom okruženju (novi ključ
   znači novo vezivanje; Aleksandrovo vezivanje na Preview-u se ne prenosi).
5. **Šifrovana lokacija za rezervne kopije** i ko je čuva.
6. Poznata ograničenja parsera ostaju: tabela koja prelazi na sledeću stranu i
   korektivni dokumenti idu na ručni pregled
   ([35 §6](35-zahtev-za-izvoze-biznisoft.md)).

## 7. Verzionisanje parsera i konektora

| Šta | Kada se menja | Sada |
|---|---|---|
| `PARSER_VERSION` (upisuje se uz svaki dokument, ide u canonical) | svaka izmena koja za iste bajtove PDF-a može dati drugačija polja, stavke ili status | `biznisoft-pdf-2` |
| `SUPPORTED_PARSER_VERSIONS` (server) | nova verzija se dodaje; stara ostaje u prelaznom periodu, **osim ako je poznato da daje pogrešan sadržaj** | samo `biznisoft-pdf-2`; v1 se odbija (`parser_version_unsupported`) |
| `CANONICALIZATION_VERSION` | samo promena pravila normalizacije/hash-a | `1`, nepromenjeno |
| verzija konektora (`connector/package.json`, ulazi u paket) | svaka izmena koda koji paket nosi, uključujući parser | `0.2.0` |

Zašto podizanje i bez uvezenih dokumenata: verzija opisuje **čitač**, ne
bazu. Isti PDF pod v1 i v2 daje različitu šifru partnera i opis, pa i različit
semantic hash (koji namerno ne sadrži verziju). Bez nove verzije, konektor sa
starim parserom bi prolazio kao ispravan, a ponovni prijem istog fajla bi se
prijavio kao sukob revizije umesto kao zastareo čitač.

Pre prvog uvoza: server i konektor se isporučuju zajedno sa v2; `dry-run`
konektora mora prijaviti `biznisoft-pdf-2`; v1 payload mora biti odbijen
(test u `lib/sync/contract/contract.test.mjs`).

