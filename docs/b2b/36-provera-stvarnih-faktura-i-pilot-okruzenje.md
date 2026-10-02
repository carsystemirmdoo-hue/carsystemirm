# 36 — Provera stvarnih faktura bez upisa i okruženje za stvarne podatke

**Status (2026-10-02): alat spreman i probran nad sintetičkim fajlovima;
stvarne fakture nisu dostupne na razvojnom računaru; okruženje za stvarne
podatke čeka odluku.** Ništa stvarno nije upisano. Nastavak na
[34](34-prelazak-na-stvarne-podatke.md) i [35](35-zahtev-za-izvoze-biznisoft.md).

## 1. Koje fakture postoje

Revizija [16](16-biznisoft-pdf-evidence-audit.md) radila je nad 11 stvarnih
PDF-ova u privatnom folderu. Pretraga razvojnog računara 2026-10-02 (imena
fajlova se ne ispisuju; lični folderi se ne otvaraju):

- fajlova `Fak*.pdf` nema nigde u početnom folderu ni u kanti;
- PDF-ovi u projektnom `_incoming/` (8) nisu BizniSoft fakture.

**Zaključak: stvarnih faktura na ovom računaru nema.** Treba ih ponovo
dostaviti u privatni folder van repozitorijuma (§5).

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

1. **Stvarni PDF-ovi** u privatnom folderu (§1), pa provera iz §2 bez greške u
   aritmetici i zbiru.
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
