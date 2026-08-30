# 19 — Kanonski ugovor i zajednički unos dokumenata (P1)

Oznake: 🟢 dokazano kodom i testom · 🔵 samo dokumentovan ugovor · 🔴 nedostaje dokaz

Nastavak na [17 — PDF i ledger](17-biznisoft-pdf-ledger.md) i [18 — spremnost
podataka](18-data-readiness.md).

**Šta P1 jeste:** zajednički, testiran unos dokumenata koji dele postojeći ručni
PDF upload i budući Windows konektor.

**Šta P1 nije:** nema API rute, uređaja, potpisa, schedulera, outboxa, Windows
procesa ni portal panela. Automatski uvoz **nije** pušten.

---

## 1. Jedan transakcioni servis

`lib/pdf/ingest.ts` je i dalje **jedini** put do `source_documents`, `invoices` i
`invoice_lines`.

| Simbol | Uloga |
|---|---|
| `ingestParsedDocument(parsed, meta, actor)` | Jedini transakcioni servis. Izdvojen iz postojećeg tela. |
| `ingestBiznisoftPdf(input, actor)` | Omotač: parsira PDF, pa poziva servis. |
| `ingestCanonicalInvoice(payload, trusted, actor)` | Canonical ulaz: validira, adaptira, pa poziva **isti** servis. |

Seam je bio mehanički: u celom `ingest.ts` se `input.bytes` pojavljivalo na
**tačno jednoj liniji** — pri parsiranju. Sve posle toga koristi samo `parsed`,
`fileName`, `issuerCode` i `runId`. 🟢

`IngestMeta` postoji da bi bilo zapisano **odakle** ti podaci smeju doći: iz
pouzdanog serverskog konteksta, nikad iz dostavljenog sadržaja. Opseg koji sam
sebe proglasi nije opseg.

### Granica servera

| Fajl | `server-only` | Zašto |
|---|---|---|
| `lib/pdf/parseDocument.ts` | **ne** | Isti parser mora moći da se pokrene lokalno. |
| `lib/pdf/extract.ts` | **da** | Serverski omotač; postojeći pozivaoci zadržavaju granicu. |
| `lib/sync/contract/**` | **ne** | Čista logika: bez baze, mreže i Next-a. |
| `lib/sync/ingestCanonical.ts` | **da** | Dodiruje bazu. |

Test čuva obe strane te granice: `parseDocument.ts` bez `server-only`/Next/db,
`extract.ts` sa `server-only`. 🟢

`ingestCanonicalInvoice` **nije** ruta ni server action i **ne proverava nijednu
dozvolu** — pozivalac mora već biti autorizovan. U P1 je pozivaju samo testovi.

---

## 2. Ugovor

**Autoritativni izvor: `contracts/invoice-ingest/v1/schema.json`.**

Validator u `lib/sync/contract/jsonSchema.mjs` tu šemu **čita**. Zod nije
upotrebljen iako je instaliran: druga definicija se raziđe tačno onda kada niko
ne gleda.

**Nova zavisnost nije dodata; `package-lock.json` je nedirnut.** `ajv` postoji u
`node_modules`, ali kao *tranzitivna* zavisnost ESLint-a i u verziji za
draft-07. Oslanjanje na tuđe stablo znači da uvoz faktura pukne kada ESLint
promeni svoje.

Validator podržava tačno onaj skup keyword-a koji ugovor koristi i **baca na
svaki koji ne poznaje** — i u šemi i u podšemi. Bez toga bi neko dodao `oneOf`
ili `format`, validator bi ga tiho preskočio, i ograničenje bi postojalo samo u
fajlu. 🟢

`lib/sync/contract/types.ts` je **samo za prevođenje** — nije validator i ništa
ne sprovodi. Test poredi njegova polja sa `Object.keys(SCHEMA.properties)`, pa
tip ne može tiho odlutati.

### Verzije

| | Vrednost | Pravilo |
|---|---|---|
| `schema_version` | `1` | Nepoznata → odbijena, ne tumači se |
| `canonicalization_version` | `1` | Vezana u sam hash |
| `parser_version` | `biznisoft-pdf-1` | **Izričita lista**, `SUPPORTED_PARSER_VERSIONS` |

Lista verzija čitača je **niz**, ne jedna vrednost: prelazni period u kome važe
dve je normalan, ne izuzetak.

### Decimale

Novac i količine su decimalni **stringovi sa tačkom**. Nigde u lancu nema
`Number`, `parseFloat` ni aritmetike nad float-om pri gradnji zapisa.

`parseLine` zato uz brojeve vraća i `printed` — **odštampani** zapis ćelije.
`parseSerbianNumber` vraća `number`, a `String(Number(x))` nije povratak
tačnosti: binarni float ne pamti šta je pisalo.

Skale su pročitane iz `db/schema/sales.ts`, **ne iz dokumentacije**:

| Polje | Skala | Kolona |
|---|---|---|
| `quantity` | **3** | `numeric(14,3)` |
| `unit_price` | 4 | `numeric(14,4)` |
| `discount_percent` / `tax_percent` | 3 | `numeric(6,3)` |
| `tax_amount` / `gross_amount` / `printed_gross_total` | 2 | `numeric(14,2)` |

Količina ima **tri** decimale, ne dve. Više decimala od skale je **odbijanje**,
nikad zaokruživanje. Manje se dopunjuje nulama, pa `1`, `1.5` i `1.500` daju
isti canonical oblik — to je ono što čini hash stabilnim.

---

## 3. Hash pravila

### `source_hash`

SHA-256 **tačnih PDF bajtova**, `sha256:<hex>`.

> **Granica poverenja.** Server bez PDF bajtova **ne može** nezavisno da proveri
> `source_hash` prema samom PDF-u. To ostaje **tvrdnja ovlašćenog izvora**, ne
> serverski dokaz tačnosti originalnog dokumenta. 🔵

### `semantic_hash`

SHA-256 nad `carsystem/invoice-ingest/semantic/v<canonicalization_version>\n<canonical JSON>`, UTF-8.

Domenski prefiks vezuje hash za namenu i za verziju pravila normalizacije, pa
buduća promena algoritma **ne može proći nevidljivo**.

**Server ga uvek ponovo računa** iz validiranog sadržaja i poredi. Dostavljenoj
vrednosti se ne veruje. 🟢

Canonical JSON: ključevi leksikografski sortirani, bez beline, svako polje uvek
prisutno (nullable kao `null` — razlika „odsutno“ / „null“ bi dala dva hash-a za
istu stvar), bez ijednog decimalnog broja.

Normalizacija teksta je namerno uska: NFC, trim, nizovi belina → jedan razmak.
**Ne** presavijaju se dijakritici i **ne** menja se veličina slova — „Boja bela“
i „boja BELA“ mogu biti dva artikla. Šifre i brojevi dokumenata ne prolaze ni
kroz to: vodeće nule se čuvaju.

| Ulazi u hash | Ne ulazi |
|---|---|
| identitet izdavaoca i dokumenta | `parser_version` |
| partner, datumi, `date_basis`, valuta | `parser_meta` (broj strana/redova) |
| zbir zaglavlja | `source_hash` |
| sve stavke, redosledom i sa iznosima | `semantic_hash` (ne uključuje sam sebe) |
| obe verzije (ugovor + normalizacija) | ime fajla, putanja, vreme, device/run ID, potpis |

Stavke se **ne sortiraju i ne agregiraju**: ista šifra u dva reda ostaje dva
reda. Dva reda po 1 komad nisu isto što i jedan red od 2. 🟢

---

## 4. Šta ugovor izražava, šta P1 čuva, šta odbija

| Podatak | Ugovor izražava | P1 čuva | Ishod van podskupa |
|---|---|---|---|
| Vrsta dokumenta | 6 vrsta | samo `faktura` | `document_kind_unsupported` |
| Valuta | bilo koji ISO kod | samo `RSD` | `currency_unsupported` |
| `issued_on` | da | **da** | `issued_on_invalid` (nije stvaran datum) |
| `trade_date` | da (nullable) | **ne** | `trade_date_unsupported` |
| `date_basis` | `issued_on` \| `trade_date` | samo `issued_on` | `date_basis_unsupported` |
| Poslovna godina | opciono | izvedena iz `issued_on` | `business_year_mismatch` |
| Pun broj dokumenta | da, tekst | **da**, ceo | — |
| Šifre sa vodećim nulama | da, tekst | **da** | — |
| `source_hash` | da | **da** (kao `file_hash`) | — |
| `semantic_hash` | da | **ne** — nema kolonu | — |
| Poreklo dokumenta | — | **ne** — nema kolonu | — |

### O valuti

`RSD` **nije pročitan sa dokumenta.** Čitač BizniSoft PDF-a ne čita valutu
uopšte. To je podrazumevana vrednost **konfiguracije podržanog izvora**
(`SOURCE_CURRENCY`), ista pretpostavka pod kojom `invoices` već danas čuva iznose
bez kolone valute. Zapisana je izričito da bi pretpostavka bila vidljiva, i test
pada ako čitač jednog dana počne da čita valutu. 🟢

### O datumu prometa

Čitač poznaje **tačno jedan** datum — „Datum izdavanja računa“. Da li BizniSoft
uopšte štampa datum prometa nije poznato bez stvarnog uzorka. 🔴 Zato ugovor
nosi `trade_date: null` i `date_basis: "issued_on"`, a svaki drugačiji ulaz se
**ne prima** — primiti pa odbaciti pri upisu značilo bi da pošiljalac misli da je
podatak stigao.

### O deduplikaciji

**Semantička deduplikacija NIJE implementirana.** `semantic_hash` se računa i
proverava, ali nema gde da se sačuva. Politika duplikata i revizija ostaje
**nepromenjena**, po otisku bajtova (`source_documents_file_hash_key`). Zato
isti PDF, uvezen ručno pa poslat kao canonical (ili obrnuto), pogađa postojeću
politiku bez ijednog novog pravila. 🟢

---

## 5. Validaciona granica

Sve pre nego što ijedan red dodirne bazu. Redosled u `validateCanonicalInvoice`:

1. oblik, prema autoritativnoj šemi (`additionalProperties: false` svuda);
2. verzije ugovora, normalizacije i čitača;
3. **opseg** — `issuer.code` se poredi sa pouzdanim kontekstom, ne preuzima;
4. podržani podskup (vrsta, valuta, osnov datuma, datum prometa);
5. stvarni kalendarski datumi i doslednost osnove;
6. redni brojevi stavki 1..N, bez ponavljanja, `line_count` tačan;
7. decimalne skale i granice;
8. **nezavisna provera iznosa** — `checkLineArithmetic` i `validateTotals`, iste
   funkcije i iste tolerancije (0.011 po redu; `0.011 · n + 0.011` za zbir) koje
   koristi PDF put. Druga formula bi značila da se dva ulaza raziđu u tome šta
   prihvataju;
9. **ponovo izračunat** `semantic_hash`.

Klijentska oznaka ispravnosti **ne postoji u ugovoru**: nema polja `valid`,
`validation_status` ni sličnog, i `additionalProperties: false` ga odbija ako se
pojavi. Test to izričito tvrdi. 🟢

> Validan potpis uređaja u P2 **neće** zameniti ovu proveru. Potpis dokazuje *ko*
> je poslao, ova provera *šta* je poslato.

Poruke o odbijanju nose stabilan `code` i objašnjenje **bez ijednog dela
poslovne vrednosti**, bez SQL-a, putanja i stack trace-a. 🟢

---

## 6. Sintetički test vektori

`fixtures/dev/sync/*.canonical.json`. Očekivani hash u testu računa **nezavisna
implementacija**, ne produkcijska funkcija.

| Vektor | Stavki | `semantic_hash` (skraćeno) |
|---|---|---|
| `jedna-stavka` | 1 | `sha256:5c10bda98ddc…` |
| `vise-stavki` | 7 | `sha256:3c1f8126b443…` |
| `vodeca-nula-partner` | 1 | `sha256:4c2fbe5e5921…` |

Isečak (`vodeca-nula-partner`, šifra partnera ostaje tekst):

```json
{
  "document": { "kind": "faktura", "number": "99-RN900000004",
                "issued_on": "2026-01-04", "trade_date": null,
                "date_basis": "issued_on", "currency": "RSD" },
  "partner": { "external_code": "00042" },
  "lines": [{ "line_number": 1, "article_code": "900002",
              "quantity": "2.000", "unit_price": "120.0000",
              "discount_percent": "0.000", "tax_percent": "20.000",
              "tax_amount": "48.00", "gross_amount": "288.00" }]
}
```

**Podržani i nepodržani uzorci imaju različita očekivanja.** Od sedam
sintetičkih PDF-ova, četiri su `valid`; `nastavak-tabele`, `zbir-se-ne-poklapa` i
`neispravan-bez-zaglavlja` **nemaju** canonical oblik i test to tvrdi. Canonical
zapis se ne pravi ni „sa oznakom da nije valjan“ — takav payload bi server morao
da razlikuje po polju koje dolazi od pošiljaoca.

Payload ne nosi ime fajla, putanju, sirov tekst reda ni PIB — iako PIB **postoji**
u pročitanom dokumentu. 🟢

---

## 7. Dopune potrebne pre P2

Minimalan spisak, izveden iz onoga što je P1 udario u granicu:

1. **Kolona za valutu** na `invoices` (i/ili `invoice_lines`) — bez nje se
   podržani podskup ne može proširiti van RSD.
2. **Kolona za datum prometa** + zapis osnove (`date_basis`) — bez nje
   `trade_date` ostaje nepodržan.
3. **Kolona za `semantic_hash`** na `source_documents` — bez nje semantička
   deduplikacija ne postoji, ma koliko se hash tačno računao.
4. **Kolona za poreklo dokumenta** (`origin`: ručni upload / uređaj / CSV).
   Danas canonical put upisuje izvedenu oznaku `canonical:<12 hex>` u
   `file_name`, jer je kolona `NOT NULL` — to je **zaobilaženje, ne rešenje**.
5. **Akter koji nije korisnik.** `audit_log.actor_user_id` i
   `import_runs.started_by` su strani ključevi ka `users`; uređaj nije korisnik.
   Rešenje je nullable akter uz `actor_label`, **ne izmišljen korisnik**.
6. **Asimetrični potpis uređaja** — privatni ključ na uređaju, javni na serveru.
   **HMAC iz starog nacrta nije odobrena zamena.** Kriptografija se u P1 ne
   implementira.
7. **Nova sposobnost za komande uređaja** (npr. `devices:manage`).
   `view:importi` se **ne sme** širiti; `documents:resolve` je za odluke o
   verzijama.

Stavke 1–4 traže migraciju. **U P1 nema nijedne migracije, nove tabele ni
promene dozvola.**

---

## 8. Neusaglašeni raniji nacrti

[04 — ugovor Sync Agenta](04-sync-agent-contract.md) i
[03 — nacrt ugovora o podacima](03-data-contract-draft.md) opisuju **snapshot /
dataset** model (`customer_effective_prices`, `business_date`, „snapshot postaje
active“) i **HMAC** potpis. Oba su **neusaglašena** sa onim što je izgrađeno:

- izgrađen je **dokument-orijentisan** model (`source_documents` → `invoices`),
  ne dnevni snapshot. Ovojnica iz `04 §3` se ne primenjuje doslovno;
- potpis za P2 je **asimetričan**, ne HMAC.

Iz `04` ostaje na snazi: sedam nepregovarljivih pravila (§1), provera stabilnosti
fajla (§2), prozor ±5 min i `nonce` protiv replay-a (§5).

Ovo je **oznaka neusaglašenosti**, ne prepisivanje tih dokumenata.

---

## 9. Provera

```bash
npm run test:contract           # 37 — cista logika ugovora
npm run test:contract-adapter   # 11 — lokalni adapter (tsx)
npm run test:integration        # PG, izolovana QA baza
```

Svi podaci su **sintetički**. Nijedno ime, PIB, šifra ni iznos nije stvaran.

> **Prolazak Node testa ne dokazuje Windows kompatibilnost.** To ostaje prihvatna
> provera P3.
