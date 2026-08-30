# 03 — Nacrt ugovora o podacima

> ## Ograda koja važi za ceo dokument
>
> **Nijedna BizniSoft izvorna kolona ovde nije potvrđena.** U repozitorijumu ne
> postoji nijedan stvarni izvoz, nijedna dokumentacija proizvođača i nijedan
> dokaz o API-ju. 🟢 (vidi `00-current-state-audit.md`, §8)
>
> Svaki model ispod razdvaja tri stvari:
>
> | Kolona | Značenje |
> |---|---|
> | **canonical field** | **Naša odluka. Važeća i stabilna.** |
> | **BizniSoft source** | `unknown until sample` — dok ne dobijemo uzorak |
> | **mapping rule** | Pravilo koje adapter primenjuje kad izvor bude poznat |
>
> Canonical shema se **može implementirati odmah** — ne zavisi od izvora.
> Adapter se **ne piše** dok P1–P4 nemaju odgovor.

> ## ⚠️ Za FAKTURE je nadmašen
>
> Kanonski ugovor za uvoz faktura je od P1 **`contracts/invoice-ingest/v1/schema.json`**,
> opisan u [19](19-canonical-ingest-contract.md). On je autoritativan i
> dokument-orijentisan; „pun dnevni snapshot“ iz ovog nacrta se na fakture **ne
> odnosi**.
>
> Ostali modeli ovde (kupci, proizvodi, zalihe, cene, korpa, porudžbine) ostaju
> nacrt i nisu dirani.

Oznake: 🟢 potvrđeno u kodu · 🔵 predloženo · 🔴 blokirano

---

## Načelo razdvajanja

```
BizniSoft izvor  →  [ADAPTER]  →  canonical model  →  portal
   nepoznato        mapiranje       naša odluka       naš UI
                     (P1–P4)         (stabilno)
```

Adapter je **jedino** mesto koje sme znati kako izvor izgleda. Promena formata menja adapter — ne shemu, ne UI, ne upite.

Obrazac već postoji: `lib/import/invoiceRow.mjs:validateInvoiceRow` vraća normalizovan objekat sa **našim** imenima (`articleCode`, `issuedOn`, `documentKind`), odvojen od ulaznih (`sifra_artikla`, `datum`, `vrsta_dokumenta`). 🟢

---

## Legenda kolona

- **Tip** — logički tip; konkretan SQL tip se bira pri migraciji
- **Ob.** — required (`R`) / optional (`O`)
- **Osetljivost** — `javno` / `interno` / `poverljivo` / `tajna`
- **SoT** — source of truth
- **Ažuriranje** — `snapshot` (pun dnevni) / `inkrement` / `portal` (nastaje kod nas)

---

## M1 — `customer` (firma)

**SoT:** BizniSoft · **Ažuriranje:** pun dnevni snapshot
**Zašto snapshot:** mali obim; propuštena izmena je opasnija od ponovljenog uvoza.

| Canonical | Tip | Ob. | Značenje | Validacija | Osetljivost |
|---|---|---|---|---|---|
| `id` | uuid | R | Interni ključ | — | interno |
| `pib` | text(9) | R | **Poslovni identitet** | tačno 9 cifara (`isValidPib` 🟢) | interno |
| `name` | text | R | Naziv firme | 1–200 | interno |
| `city` | text | O | Grad | ≤100 | interno |
| `address` | text | O | Adresa isporuke | ≤200 | poverljivo |
| `postal_code` | text | O | Poštanski broj | ≤10 | interno |
| `contact_phone` | text | O | Telefon | ≤32 | poverljivo |
| `active` | bool | R | Aktivan u katalogu | — | interno |
| `blocked` | bool | R | **Blokiran kupac ne sme slati porudžbinu** | default `false` | interno |
| `source_customer_code` | text | O | Šifra iz izvora, ako nije PIB | ≤64 | interno |
| `business_date` | date | R | Poslovni dan snapshota | — | interno |

**Postojeće:** `db/schema/permissions.ts:customers` ima `pib` (`uniqueIndex`), `name`, `city`, `active`. 🟢 Ostalo je dopuna.

| BizniSoft source | mapping rule |
|---|---|
| `unknown until sample` | 🔴 P1 — ako izvoz **ne nosi PIB**, ceo model identiteta se menja |

---

## M2 — `portal_user` (interni nalog)

**SoT:** portal · **Ažuriranje:** portal

Postoji kao `db/schema/users.ts:users`. 🟢 Dopune za produkciju:

| Canonical | Tip | Ob. | Značenje | Osetljivost |
|---|---|---|---|---|
| `session_version` | int | R | Bump = opoziv svih sesija | interno |
| `mfa_secret_enc` | text | O | TOTP tajna, šifrovana | **tajna** |
| `mfa_enabled_at` | timestamptz | O | Kada je MFA uključen | interno |
| `password_changed_at` | timestamptz | O | Za politiku rotacije | interno |

Postojeća polja koja se **ne diraju**: `email` (lowercase, `uniqueIndex`), `password_hash` (scrypt), `role`, `active`, `failed_login_attempts`, `locked_until`, `last_login_at`. 🟢

---

## M3 — `customer_user` (kupčev nalog) 🔵

**SoT:** portal · **Ažuriranje:** portal · **Ne postoji danas** 🟢

| Canonical | Tip | Ob. | Značenje | Validacija | Osetljivost |
|---|---|---|---|---|---|
| `id` | uuid | R | Ključ | — | interno |
| `customer_id` | uuid | R | **Firma. Uvek iz sesije, nikad iz zahteva** | FK → `customer` | poverljivo |
| `email` | text | R | Prijava | lowercase, `uniqueIndex` | poverljivo |
| `name` | text | R | Ime osobe | 1–120 | poverljivo |
| `password_hash` | text | O | `null` dok invite nije iskorišćen | scrypt | **tajna** |
| `status` | enum | R | `requested\|approved\|invited\|active\|suspended\|rejected` | vidi `02`, §5 | interno |
| `approved_by` | uuid | O | Ko je odobrio | FK → `users` | interno |
| `approved_at` | timestamptz | O | Kada | — | interno |
| `invite_token_hash` | text | O | **Hash**, nikad sam token | — | **tajna** |
| `invite_expires_at` | timestamptz | O | TTL 72h | — | interno |
| `session_version` | int | R | Opoziv | — | interno |

**Jedinstvenost:** `email`. **Indeks:** `customer_id`.

---

## M4 — `customer_membership` / `employee_assignment`

### `customer_membership` 🔵
Veza `customer_user` → `customer` je **1:1 u samom redu** (M3). Zaseban entitet je potreban tek ako jedan čovek radi za više firmi.

🟡 **Odluka vlasnika (P11):** da li se to dešava. Predlog: **ne** za pilot; struktura M3 dopušta 1:N naloga po firmi, što pokriva realan slučaj (vlasnik + nabavka).

### `employee_assignment` 🟢
Postoji kao `db/schema/permissions.ts:customerAssignments` — `(user_id, customer_id)`, `assigned_by`, `assigned_at`. Osnova za `sales_rep` opseg. **Ne menja se.**

---

## M5 — `product`

**SoT:** BizniSoft (šifra, naziv, status) + portal (`catalog_slug`) · **Ažuriranje:** pun dnevni snapshot

| Canonical | Tip | Ob. | Značenje | Validacija | Osetljivost |
|---|---|---|---|---|---|
| `code` | text | R | **Šifra artikla — identitet** | `uniqueIndex` 🟢 | javno |
| `name` | text | R | Naziv | 1–200 | javno |
| `product_group` | text | O | Osnova za rabat po grupi | ≤100 | javno |
| `brand` | text | O | Osnova za rabat po brendu | ≤100 | javno |
| `unit` | text | O | Jedinica mere | ≤16 | javno |
| `pack_size` | numeric | O | Ako se prodaje samo u pakovanju | > 0 | javno |
| `barcode` | text | O | Pouzdaniji most ka katalogu | EAN-8/13 | javno |
| `active` | bool | R | **Neaktivan se ne preporučuje** | — | javno |
| `blocked` | bool | R | Blokiran za prodaju | — | interno |
| `catalog_slug` | text | O | **Naše.** Veza ka javnom katalogu | postoji u `lib/products.ts` | javno |

**Postojeće:** `db/schema/sales.ts:articles` ima `code` (`uniqueIndex`), `name`, `product_group`, `brand`, `unit`. 🟢

> `catalog_slug` je most ka `lib/product-families.ts` i `app/proizvodi/[slug]`. **Popunjava se kod nas** — ne očekuje se iz BizniSofta.
> 🔴 P4: da li se šifra artikla poklapa sa šifrom u katalogu. Ako ne, treba tabela mapiranja i ručno povezivanje ~3.500 stavki.

---

## M6 — `product_variant`

🟢 **Već rešeno u kodu, van baze.** `components/product/productVariantView.ts` + `ProductVariantProvider` drže varijantu kao izvedenu iz kataloga (boja/pakovanje). Za B2B je bitno samo da **svaka varijanta ima svoju `code`** — dakle M5 je dovoljan.

**Ne uvoditi zaseban `product_variant` entitet u bazi** dok se ne dokaže da BizniSoft razlikuje artikal i varijantu drugačije od nas. 🔴 P4.

---

## M7 — `inventory_snapshot`

**SoT:** BizniSoft · **Ažuriranje:** pun dnevni snapshot · **Ne postoji danas** 🟢

| Canonical | Tip | Ob. | Značenje | Validacija | Osetljivost |
|---|---|---|---|---|---|
| `article_code` | text | R | Artikal | FK → `product.code` | javno |
| `availability` | enum | R | `dostupno\|ograniceno\|nedostupno\|nepoznato` | — | interno |
| `quantity_available` | numeric | O | Tačna količina, **ako sme u cloud** | ≥ 0 | poverljivo |
| `business_date` | date | R | Poslovni dan | — | interno |
| `as_of` | timestamptz | R | **Kada je stanje snimljeno** | — | interno |

**Jedinstvenost:** `(article_code, business_date)`

**Nepregovarljivo:** `as_of` se **prikazuje uz svaku dostupnost**. Stariji od praga → „Podatak o dostupnosti nije aktuelan", ne brojka. Zastareo lager koji izgleda svež je opasniji od odsutnog. Vidi `07-threat-model.md`, T20.

`nepoznato` je legitimna vrednost — isti obrazac kao `document_kind = "nepoznato"` (`db/schema/sales.ts`), koji nosi komentar da „nije rezerva za lenjost". 🟢

🟡 P8: sme li tačna količina napustiti kancelariju. Portal radi i bez nje.

---

## M8 — `customer_effective_price` ⚠️ najosetljiviji model

**SoT:** **BizniSoft, isključivo** · **Ažuriranje:** pun dnevni snapshot · **Ne postoji danas** 🟢

| Canonical | Tip | Ob. | Značenje | Validacija | Osetljivost |
|---|---|---|---|---|---|
| `customer_pib` | text(9) | R | Kupac | 9 cifara | poverljivo |
| `article_code` | text | R | Artikal | FK | poverljivo |
| `effective_price` | numeric(14,4) | R | **Konačna cena. Portal je ne računa** | ≥ 0 | **poverljivo** |
| `currency` | text(3) | R | Očekuje se `RSD` | ISO-4217 | poverljivo |
| `price_includes_tax` | bool | R | **Bez ovoga je cena neupotrebljiva** | — | poverljivo |
| `tax_percent` | numeric(6,3) | O | Stopa | 0–100 | poverljivo |
| `discount_percent` | numeric(6,3) | O | **Samo prikaz.** Nikad ulaz u računicu | 0–100 | poverljivo |
| `list_price` | numeric(14,4) | O | Za „vaša cena vs cenovnik" | ≥ 0 | poverljivo |
| `valid_from` / `valid_to` | date | O | Period važenja, ako izvor daje | `from ≤ to` | poverljivo |
| `business_date` | date | R | Poslovni dan | — | interno |
| `batch_id` | uuid | R | Poreklo reda | — | interno |

**Jedinstvenost:** `(customer_pib, article_code, business_date)`

### Nepregovarljivo pravilo

UI prikazuje **`effective_price`**. `discount_percent` je informacija za kupca, **nikada ulaz u računicu**. Ako ijedan ekran počne da množi `list_price × (1 − discount)`, prekršen je AD-3.

🔴 **P2 — najveća nepoznanica projekta.** Ne znamo: daje li BizniSoft cenu po paru (kupac, artikal); da li uključuje PDV; koliko redova nastaje (20 × 3.500 ≈ 70.000 je podnošljivo, 500 × 3.500 ≈ 1,75M traži drugačiji pristup).

---

## M9 — `price_rule_reference` 🔵

**SoT:** portal (opis) · **Ažuriranje:** portal · **Nikad izvor prikazane cene**

Postoji **samo** da bi se promena mogla objasniti i simulirati. Nivoi koje mora umeti da izrazi:

| Nivo | Polje |
|---|---|
| kupac | `customer_pib` |
| grupa kupaca | `customer_group` |
| proizvod | `article_code` |
| grupa proizvoda | `product_group` |
| proizvođač/brend | `brand` |
| kombinacije | više polja popunjeno istovremeno |

| Canonical | Tip | Ob. | Značenje |
|---|---|---|---|
| `scope_*` | text | O | Bar jedno mora biti popunjeno |
| `discount_percent` | numeric(6,3) | R | Predložena vrednost |
| `priority` | int | R | Razrešenje preklapanja |
| `note` | text | O | Zašto pravilo postoji |
| `is_advisory` | bool | R | **Uvek `true`** — nikad izvor prikazane cene |

**Zaštita:** izračunata vrednost se poredi sa `effective_price`; razlika ide u audit kao upozorenje. Prikazuje se **uvek preuzeta**.

---

## M10 — `sales_history_line`

**SoT:** BizniSoft · **Ažuriranje:** **inkrement** (raste bez ograničenja) · 🟢 **Već implementirano**

`db/schema/sales.ts` — `invoices` + `invoice_lines`. Identitet fakture: `(company_id, document_kind, number, year)` `uniqueIndex`. Ne dirati.

Ključni postojeći komentar (`db/schema/sales.ts:invoices`):

> „Podaci o plaćanju NAMERNO ne postoje u ovoj tabeli. Fakture ih ne sadrže, pa bi svaka kolona tipa `placeno` ili `otvoreno` bila izmišljena vrednost."

Isto važi za lager i za **cenovnik**: faktura nosi **ostvarenu** cenu na dokumentu, ne **važeću** cenu za buduću porudžbinu. Zato M8 postoji odvojeno.

Jedina dopuna: `batch_id`. `invoices.import_run_id` već služi tome. 🟢

---

## M11 — `cart` 🔵

**SoT:** portal · **Ažuriranje:** portal

| Canonical | Tip | Ob. | Značenje |
|---|---|---|---|
| `id` | uuid | R | Ključ |
| `customer_id` | uuid | R | **Iz sesije** |
| `created_by` | uuid | R | `customer_user` ili `users` (rep u ime kupca) |
| `on_behalf_of` | bool | R | Je li rep pravi u ime kupca |
| `updated_at` | timestamptz | R | Za čišćenje napuštenih korpi |

### Stavka korpe — **bez cene**

| Canonical | Tip | Ob. |
|---|---|---|
| `article_code` | text | R |
| `quantity` | numeric(14,3) | R (> 0) |
| `note` | text | O |

🟢 **Ovo je već ispravno u klijentskom modelu.** `lib/cart/cart-model.mjs` ne nosi cenu — potvrđeno testom `lib/cart/cart-model.test.mjs:64-65` (`"price" in item === false`). Serverska korpa mora zadržati isto pravilo.

**Cena se pridružuje tek pri prikazu**, čitanjem iz M8 na serveru.

---

## M12 — `order` + M13 `order_line` 🔵

**SoT:** portal do `confirmed`, zatim BizniSoft · Detaljan tok: `05-order-state-machine.md`

### `order`

| Canonical | Tip | Ob. | Značenje |
|---|---|---|---|
| `id` | uuid | R | Ključ |
| `order_number` | text | R | Čitljiv broj, `uniqueIndex` |
| `customer_id` | uuid | R | **Iz sesije** |
| `submitted_by` | uuid | R | Ko je poslao |
| `on_behalf_of` | bool | R | Rep u ime kupca |
| `status` | enum | R | Vidi `05` |
| `submitted_at` | timestamptz | O | — |
| `confirmed_by` / `confirmed_at` | uuid / ts | O | Ko i kada je potvrdio |
| `idempotency_key` | text | R | **`uniqueIndex`** — brava protiv duplog slanja |
| `biznisoft_document_id` | text | O | Popunjava se posle prenosa |
| `business_date` | date | O | Dan cena koje su primenjene |

### `order_line` — snapshot cene je obavezan

| Canonical | Tip | Ob. | Značenje |
|---|---|---|---|
| `order_id` | uuid | R | FK |
| `line_number` | int | R | `unique(order_id, line_number)` |
| `article_code` | text | R | Artikal |
| `quantity` | numeric(14,3) | R | > 0 |
| **`price_snapshot`** | numeric(14,4) | R | **Cena u trenutku slanja** |
| **`price_source`** | enum | R | `biznisoft_effective` \| `manual_office` |
| **`price_confirmed_at`** | timestamptz | R | Kada je cena očitana |
| **`price_business_date`** | date | R | Iz kog snapshota |
| `price_includes_tax` | bool | R | Prenosi se uz cenu |
| `availability_at_submit` | enum | O | Šta je kupcu prikazano |

### Nepregovarljivo

> **Pretraživač nikada nije autoritet za cenu.**
> Server presnimava `price_snapshot` iz M8 u trenutku slanja, u istoj transakciji. Sve što je stiglo iz klijenta se **odbacuje**; ako telo zahteva uopšte sadrži polje cene → audit + odbijanje. Vidi `07-threat-model.md`, T8.

---

## M14 — `order_status_event` 🔵

Append-only. Svaki prelaz stanja iz `05-order-state-machine.md`.

| Canonical | Tip | Ob. |
|---|---|---|
| `order_id` | uuid | R |
| `from_status` / `to_status` | enum | O / R |
| `actor_user_id` | uuid | O (`null` za sistem) |
| `actor_label` | text | R |
| `reason` | text | O (**R** za `rejected`, `changes_requested`, `cancelled`) |
| `created_at` | timestamptz | R |
| `correlation_id` | text | O |

---

## M15 — `recommendation` 🔵

**SoT:** portal (worker) · **Ažuriranje:** posle uspešnog importa · Detaljno: `06-recommendation-engine-v1.md`

| Canonical | Tip | Ob. | Značenje |
|---|---|---|---|
| `customer_id` | uuid | R | Kome |
| `article_code` | text | R | Šta |
| `score` | numeric(6,4) | R | Rang, 0–1 |
| `reason_code` | enum | R | **Šifra, ne slobodan tekst** |
| `confidence` | enum | R | `low\|medium\|high` |
| `suggested_quantity` | numeric(14,3) | O | `null` kad se ne može odbraniti |
| `algorithm_version` | text | R | Da se verzije mogu porediti |
| `business_date` | date | R | Iz kog snapshota |
| `computed_at` | timestamptz | R | — |

**Jedinstvenost:** `(customer_id, article_code, business_date)`

`reason_code` i `algorithm_version` postoje da bi preporuka bila **objašnjiva i merljiva**. Bez njih se ne može utvrditi zašto je nešto predloženo ni da li je nova verzija bolja.

---

## M16 — `sync_batch` 🔵

Detaljno: `04-sync-agent-contract.md`.

| Canonical | Tip | Ob. | Značenje |
|---|---|---|---|
| `batch_id` | uuid | R | Generiše agent |
| `dataset` | enum | R | `customers\|products\|prices\|inventory\|sales` |
| `schema_version` | int | R | Nepoznata → **odbij** |
| `business_date` | date | R | `Europe/Belgrade` |
| `idempotency_key` | text | R | **`uniqueIndex`** |
| `file_checksum` | text | R | SHA-256 |
| `row_count` | int | R | Neslaganje → odbij |
| `status` | enum | R | `received\|validating\|importing\|active\|failed\|skipped_duplicate\|quarantined` |
| `agent_id` | text | R | Koji agent |
| `received_at` / `activated_at` | timestamptz | R / O | — |

**Postojeći presedan:** `db/schema/imports.ts:import_runs` već ima `file_hash` sa `uniqueIndex` i status `preskoceno_duplikat`. 🟢 Ovo je proširenje dokazanog obrasca, ne nov izum.

---

## M17 — `audit_event` 🟢

**Već postoji i valjan je.** `db/schema/system.ts:auditLog` + `db/migrations/0001_audit_log_append_only.sql`.

Ima: `actor_user_id`, `actor_label` (ime i uloga **u trenutku radnje**), `action`, `entity_type`, `entity_id`, `entity_label`, `value_before`/`value_after` (`jsonb`), `reason`, `correlation_id`, `created_at`, tri indeksa.

Append-only je sprovedeno **okidačima u bazi** (`RAISE EXCEPTION … restrict_violation`), ne samo u aplikaciji.

**Ne treba nova tabela** — treba dodati `action` vrednosti u `lib/audit/record.ts:AUDIT_ACTIONS`.

---

## M18 — `margin_change_event` 🔵

Zahtev traži da svaka promena marže/rabata beleži tačno određena polja. **Sva se mogu izraziti kroz M17**, ali radi upitnosti i obaveštavanja predlaže se zaseban entitet:

| Canonical | Tip | Ob. | Traženo zahtevom |
|---|---|---|---|
| `requested_by` | uuid | R | ✔ korisnik koji je pokrenuo |
| `scope_customer_id` / `scope_customer_group` | uuid / text | O | ✔ kupac ili grupa |
| `scope_article_code` / `scope_product_group` / `scope_brand` | text | O | ✔ proizvod, grupa, proizvođač |
| `value_before` | numeric(6,3) | R | ✔ prethodna vrednost |
| `value_after` | numeric(6,3) | R | ✔ nova vrednost |
| `reason` | text | R | ✔ razlog |
| `requested_at` | timestamptz | R | ✔ vreme |
| `status` | enum | R | ✔ `pending\|approved\|rejected\|applied\|reconciliation_failed` |
| `approved_by` / `approved_at` | uuid / ts | O | ✔ odobravalac |
| `effective_price_after` | numeric(14,4) | O | ✔ **konačna efektivna cena, potvrđena sync-om** |
| `owner_notified_at` | timestamptz | O | Obaveštenje vlasniku |

**`applied` se postiže samo povratnom sinhronizacijom** — nikad klikom u portalu. Vidi `01-target-architecture.md`, AD-3.

---

## Validacije koje se ponovo koriste 🟢

Postoje i testirane su (`lib/import/invoiceRow.mjs`, 13 testova):

| Provera | Funkcija |
|---|---|
| PIB = 9 cifara | `isValidPib` |
| Srpski broj `1.234,56` i `1.200` | `parseNumber` |
| Datum `dd.mm.gggg` / ISO; odbija 31.02. | `parseDate` |
| Vrsta dokumenta bez pogađanja | `classifyDocument` |
| Znak količine i iznosa se moraju slagati | `validateInvoiceRow` |

### Dodatne validacije za nove skupove 🔵

| Skup | Provera | Ako padne |
|---|---|---|
| prices | `effective_price ≥ 0` | red neispravan |
| prices | `price_includes_tax` prisutno | **ceo batch odbijen** |
| prices | kupac i artikal postoje u istom `business_date` | red u karantin |
| prices | pad broja redova > 20% u odnosu na prethodni dan | **batch u karantin + obavesti vlasnika** |
| inventory | `as_of` nije stariji od 24h | upozorenje |
| svi | duplikat ključa u istom batch-u | red neispravan |

Pravilo o padu redova hvata tihi otkaz izvoza — polupopunjen fajl je opasniji od praznog.

### Zaštita od formula injection 🔵

Vrednost koja počinje `=`, `+`, `-`, `@`, TAB ili CR:

- **pri uvozu** — čuva se kao tekst, nikad ne izvršava;
- **pri izvozu u CSV/XLSX** — prefiksuje se apostrofom.

⚠️ Ovo se odnosi i na **postojeći** `lib/export/serializers.mjs`, koji već izvozi CSV/XLSX/PDF. To je **stvarna, postojeća rupa** — vidi `07-threat-model.md`, T14.

---

## Verzionisanje sheme 🔵

| Promena | Postupak |
|---|---|
| Novo opciono polje | `schema_version` +1, adapter puni `null` za starije |
| Novo obavezno polje | `schema_version` +1, **stara verzija se odbija** |
| Preimenovana kolona izvora | **samo adapter**, `schema_version` +1, canonical nepromenjen |
| Promena značenja polja | **Novo polje.** Nikad tiho menjati značenje postojećeg |

Server drži spisak prihvaćenih verzija po skupu. Nepoznata verzija je **odbijanje**, ne pokušaj tumačenja.

---

## Primeri — isključivo izmišljeni podaci

> Firme, PIB-ovi i cene su izmišljeni i ne predstavljaju nijednog stvarnog kupca.
> Šifre artikala odgovaraju obliku iz javnog kataloga radi čitljivosti.

### `customer_effective_price` (canonical, posle adaptera)

```json
[
  { "customer_pib": "100111222", "article_code": "40-204",
    "effective_price": "8330.0000", "currency": "RSD",
    "price_includes_tax": false, "tax_percent": "20.000",
    "list_price": "9800.0000", "discount_percent": "15.000",
    "business_date": "2026-08-24", "batch_id": "018f3c2a-…" },
  { "customer_pib": "100333444", "article_code": "40-204",
    "effective_price": "9310.0000", "currency": "RSD",
    "price_includes_tax": false, "tax_percent": "20.000",
    "list_price": "9800.0000", "discount_percent": "5.000",
    "business_date": "2026-08-24", "batch_id": "018f3c2a-…" }
]
```

Isti artikal, dva kupca, dve cene — to je cela poenta modela.

### `inventory_snapshot`

```json
[
  { "article_code": "40-204", "availability": "dostupno",
    "quantity_available": "42.000", "business_date": "2026-08-24",
    "as_of": "2026-08-24T06:55:00+02:00" },
  { "article_code": "25-30", "availability": "nepoznato",
    "quantity_available": null, "business_date": "2026-08-24",
    "as_of": "2026-08-24T06:55:00+02:00" }
]
```

### `order_line` sa snapshotom cene

```json
{
  "line_number": 1, "article_code": "40-204", "quantity": "6.000",
  "price_snapshot": "8330.0000", "price_source": "biznisoft_effective",
  "price_confirmed_at": "2026-08-24T11:04:22+02:00",
  "price_business_date": "2026-08-24", "price_includes_tax": false,
  "availability_at_submit": "dostupno"
}
```

---

## Šta se NIKAD ne nalazi u cloud bazi

| Nikad ne prelazi granicu | Zašto |
|---|---|
| Nabavne cene i marže dobavljača | Kompromitovan cloud ne sme otkriti maržu |
| Finansijski karton, saldo, dugovanje | Nema proveren izvor; fakture ga ne sadrže 🟢 |
| Kompletna knjigovodstvena evidencija | Cloud je read model, ne replika |
| BizniSoft kredencijali | Server ih nikad ne vidi; agent ih ne šalje |

---

## Otvoreno pre pisanja adaptera 🔴

| Oznaka | Pitanje | Blokira |
|---|---|---|
| P1 | Format izvoza kupaca; sadrži li PIB | M1 |
| P2 | Postoji li cena po (kupac, artikal); sa PDV-om ili bez | **M8 — ceo projekat** |
| P3 | Postoji li izvoz lagera | M7 |
| P4 | Poklapaju li se šifre artikala sa katalogom | M5, M6 |
| P5 | Kako promena cene / porudžbina ulazi u BizniSoft | M12, M18 |

Detalji u `09-owner-decisions-and-blockers.md`.
