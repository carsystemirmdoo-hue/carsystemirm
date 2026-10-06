# 48 — Naknadno pristiglo potpuno storno

**Status (2026-10-06): kod i migracija `0033` na grani `fix/storno-naknadno-2026-10`;
provereno na izolovanoj test bazi. Pilot i produkcija NISU menjani.**
Prethodno: [37 — storna](37-storna-partneri-i-prethodne-godine.md) §2.

## 1. Problem

Pravilo iz 37 §2 isključuje par original + storno samo **pre** uvoza. Kada
storno stigne posle originala koji je već u prometu, original je i dalje
ulazio u `effective_sales_ledger`, `recommendation_input_lines` i pokazatelje
kupca (broj faktura, prva/poslednja kupovina) — kupovina koje nije bilo.
Read-only provera pilota (privatni izveštaj): od svih poznatih storna samo
jedan original je u pilotu; četiri storna bez odštampane reference nemaju
original u pilotu.

## 2. Pravilo

- Storno se čuva kao izvorni dokument, kao i do sada (ne knjiži se kao faktura).
- Veza sa originalom samo po **odštampanoj referenci** (broj i datum originala
  iz napomene storna) — nikad po iznosu, datumu ili kupcu.
- **Primenjuje se** (`applied`) samo kada je `compareStornoToOriginal` = `full`
  (isti kupac, sve stavke iste šifre/cene/rabata poništene, zbirovi se potiru),
  datum iz reference jednak datumu originala, original čist (`original`, nije na
  pregledu) i nije već storniran.
- Sve ostalo — delimično, drugi kupac, drugi datum, original sa više verzija,
  drugi fajl istog storna — ide na ručni pregled (`review`); **original ostaje u
  prometu**.
- Storno bez proknjiženog originala čeka (`waiting_original`) i primenjuje se
  sam kada se original proknjiži (bilo kojim putem knjiženja).
- Kada se razrešenjem revizije promene stavke originala, veza se ocenjuje ponovo.

## 3. Šta se menja

| Deo | Izmena |
|---|---|
| `0033_invoice_reversals.sql` | tabela `invoice_reversals` (jedinstveno po stornu; najviše jedno `applied` po originalu; okidač: zapis se ne briše, referenca se ne menja); pogledi ledgera i ulaza preporuka: iste kolone, dodato samo `NOT EXISTS applied` |
| `db/rollback/0033_…down.sql` | vraća poglede na 0021/0026 i uklanja tabelu (up → down → up daje istu šemu) |
| `lib/pdf/reversal.ts` | `registerStorno`, `settleWaitingReversals`, `reevaluateReversalsForInvoice` |
| `lib/pdf/ingest.ts` | storno sa referencom → veza; posle svakog knjiženja → storna koja čekaju; posle razrešenja revizije → ponovna ocena; lista dokumenata nosi stanje storna |
| `lib/ledger/effective-invoice.ts` | `notReversedCondition()` u zajedničkom uslovu prometa |
| `lib/customers/customer-queries.ts` | broj faktura i prva/poslednja kupovina bez storniranih; istorija faktura kupca zadržava dokument uz oznaku `reversed` |
| Ekrani | `/portal/importi/dokumenti`: „stornirano, van prometa" / „storno: primenjeno · čeka original · na pregledu"; `/kupac/fakture`: „stornirano" |
| Trag revizije | „Storno primenjen — original isključen iz prometa", „Storno čeka original", „Storno na ručnom pregledu" (redigovana oznaka, bez celog broja) |

Konektor i dalje ne šalje storno (lokalno ga vodi kao nepodržan); storno ulazi
ručnim uploadom na `/portal/importi`.

## 4. Provere

- `db/integration/stornoReversal.integration.test.mts` (7): original pa
  storno; storno pa original; delimično; drugi kupac i drugi datum; bez
  reference (i drugi račun istog kupca netaknut); isti fajl ponovo
  (`duplicate_file`) i drugi fajl istog storna (`review`, jedno `applied`);
  zapis se ne briše i referenca se ne menja. Dva uzastopna prolaza ostavljaju
  bazu praznu.
- Stvarni par iz pilota (privatni test, PDF-ovi se ne stavljaju u repo), na
  izolovanoj bazi: pre storna 25 stavki u prometu i ulazu preporuka; posle 0;
  uklonjen doprinos jednak neto i bruto iznosu originala; oba dokumenta i
  faktura ostaju.
- Ceo integracioni paket na izolovanoj bazi: 521/522; jedini pad
  (`syncOperations`, „dvostruki klik…") prolazi samostalno 3/3 — vremenska
  osetljivost pod opterećenjem, nevezano za storno.

## 5. Datum u prometu

Promet, ulaz preporuka i pokazatelji kupca koriste **`issued_on` = datum
izdavanja** sa fakture (`date_basis = issued_on`; `trade_date` je za uvezene
dokumente prazan — `lib/recommendations/policy.mjs`). BizniSoft kontrolni
izveštaj „Pregled dokumenata firme za period" prikazuje **datum prometa**.
Kada se ta dva datuma razlikuju u mesecu, pilot i izveštaj stavljaju isti
račun u različite mesece (u pilotu 6 takvih računa, jedan i u različite
godine). Pravilo se ovde **ne menja**; odluka (izdavanje ili promet za
mesečne zbirove i kontrolu prema BizniSoftu) ostaje otvorena.

## 6. Primena na pilot (čeka odobrenje)

1. Rezervna kopija: `pilot-backup.sh dump` + `verify`.
2. Migracija `0033` vlasnikom baze (`MIGRATION_DATABASE_URL`, `npm run db:migrate`).
3. Lokalni pilot server iz ove grane (`NEXT_DIST_DIR=.next-pilot`, build).
4. Upload storna na `/portal/importi` (Vlasnik, drugi faktor) → ishod
   „karantin", stanje storna „primenjeno".
5. Provera samo čitanjem: red u `invoice_reversals` (`applied`, `full`,
   efekat = iznosi originala); original van ledgera i ulaza preporuka; broj
   faktura u pilotu nepromenjen; nema dokumenata na ručnom pregledu.
6. Rezervna kopija posle.

**Oporavak:** `db/rollback/0033_invoice_reversals.down.sql` u jednoj
transakciji + kod na verziju pre 0033 — original se vraća u promet, izvorni
dokument storna ostaje. Za potpun povratak stanja: vraćanje kopije iz koraka 1.
