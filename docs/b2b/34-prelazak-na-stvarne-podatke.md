# 34 — Prelazak sa sintetičkih na stvarne podatke: plan

**Status (2026-10-02): plan, ništa nije uvezeno.** Testna Neon baza
(`carsystem-preview-test`) sadrži isključivo sintetičke podatke iz
[33](33-test-baza-runbook.md). Stvarni podaci ne ulaze u nju — za pilot se
pravi poseban projekat baze.

## 1. Gde koji podatak živi (iz koda)

| Podatak | Tabele | Kako ulazi danas |
|---|---|---|
| Originalni PDF | **ne čuva se** u bazi niti u gitu; samo SHA-256 otisak (`source_documents.file_hash`), semantički otisak, broj strana | upload u portalu (`lib/pdf/ingest.ts`), konektor uređaja |
| Pročitane fakture (izvor) | `source_documents`, `source_document_lines` (tekst ćelija + `raw_cells`) | isto |
| Knjižene fakture | `invoices`, `invoice_lines` | iz `source_documents` posle mapiranja kupca; CSV put je zatvoren (`lib/import/csv-gate.mjs`) |
| Kupci | `customers`, `customer_external_identifiers` (šifra partnera iz BizniSoft-a), `customer_groups`, `customer_assignments` (komercijalista) | `lib/commercial/identity-service.ts`, ručno u portalu |
| Nalozi kupaca | `customer_users`, `customer_account_tokens` | aktivacija iz portala (kancelarija) |
| Artikli i veza sa katalogom | `articles`, `article_catalog_mappings` (šifra → slug kataloga) | `lib/commercial/mapping-service.ts`; ljudska potvrda |
| Cene | `price_lists`, `price_list_items`, `price_list_customer_terms` | **nema uvoza** — piše ih samo sintetički seed; čita `lib/ordering/ordering-service.ts` |
| Rabati | `price_rules` (brend / grupa / artikal / kupac) | `lib/pricing/rule-service.ts`, ručno u portalu |
| Partnerske prodavnice | `partner_records`, `partner_imports` | `lib/partners/partner-registry-service.ts` (flag isključen) |

## 2. Šta je gde

| Gde | Šta |
|---|---|
| Neon (test) | samo sintetika: 3 fakture, 5 stavki, 0 izvornih dokumenata, kupci A/B, demo cenovnik |
| Lokalno, van gita | stvarni BizniSoft PDF-ovi u privatnom folderu (vidi [16](16-biznisoft-pdf-evidence-audit.md)); otisci i rezultati lokalne obrade |
| Treba iz BizniSoft-a | šifarnik partnera (šifra, naziv, PIB, MB, adresa); šifarnik artikala; **cenovnik sa datumom važenja**; rabati po kupcu/grupi; istorija fakturisanja za ceo period; uzorci storna/povrata/knjižnog odobrenja ([18 §7](18-data-readiness.md)) |

## 3. Postupak uvoza

Preduslovi: poseban Neon projekat za pilot na planu sa dužim povratkom u
vremenu (Free ima 6 h); `PORTAL_MFA_MODE=enforced`; Vlasnik sa vezanim drugim
faktorom; `CUSTOMER_ORDERING` ostaje isključen.

1. **Proba na anonimizovanoj kopiji.** Isti fajlovi, kupci zamenjeni
   sintetičkim PIB-ovima (prefiks `000000`), uvoz u test bazu. Cilj: broj
   dokumenata, odbijenih i onih za ručni pregled pre nego što se dira stvarno.
2. **Snimak pre uvoza.** Neon grana (`pre-import-<datum>`) neposredno pre
   svakog talasa; to je tačka povratka.
3. **Šifarnici pre faktura:** kupci → spoljne šifre → artikli → veza sa
   katalogom (ljudska potvrda; sličnost naziva nije dokaz identiteta).
4. **Fakture u talasima** (npr. po mesecu), upload PDF-ova kroz portal.
   Duplikati se hvataju na tri nivoa koje kod već ima:
   - isti fajl (`file_hash`, jedinstven indeks) → „isti fajl, preskočeno";
   - isti poslovni identitet (izdavalac + vrsta + broj) sa drugim sadržajem →
     `revision_status='conflict'`, čeka ručnu odluku, ne knjiži se;
   - knjižena faktura: jedinstven `(company_id, document_kind, number, year)`.
5. **Provera talasa:** broj izvornih = knjiženih + na pregledu + odbijenih;
   zbir prometa po mesecu poređen sa knjigovodstvom (kancelarija).
6. **Cene i rabati** tek posle potvrde artikala; za cenovnik treba nov,
   testiran uvoz (danas ne postoji) — pravila cena moraju proći testove pre
   produkcije.
7. **Povratak:** greška u talasu → vraćanje na granu iz koraka 2 (ili tačka u
   vremenu unutar prozora plana); talas se ponavlja posle ispravke. Ništa se ne
   briše ručno iz tabela sa evidencijom (`audit_log` je samo za dodavanje).

## 4. Kapacitet (izmereno 2026-10-02)

**Neon test baza danas:** 11 MB ukupno (sistemski katalog i prazne tabele);
51 tabela u šemi `public` zauzima 2,2 MiB.

**Merenje po redu:** lokalni Postgres 17, ista šema (migracije 0000–0032),
10.000 sintetičkih faktura × 8 stavki, sa svim indeksima, posle `VACUUM`:

| Tabela | Ukupno | Po redu |
|---|---|---|
| `invoices` | 3,4 MB | ≈ 344 B |
| `invoice_lines` | 25,1 MB | ≈ 314 B |
| `source_documents` | 8,3 MB | ≈ 831 B |
| `source_document_lines` | 38,2 MB | ≈ 478 B |

Pretpostavke: opis stavke ~45 znakova, šifra ~10, `raw_cells` ~12 ćelija
(~200 znakova), jedan izvorni dokument po fakturi.

Formula: **≈ 1,2 KB po fakturi + ≈ 0,8 KB po stavci** (izvor + knjiženo).
Primer: 8 stavki ≈ 7,5 KB → oko 130.000 takvih faktura po 1 GB, bez
`audit_log`-a, porudžbina, preporuka i rezerve za rast indeksa.

**Zaključak se ne donosi bez stvarnih brojeva:** broj faktura godišnje, prosečan
broj stavki, broj godina istorije i rast `audit_log`-a. Te brojeve daje
BizniSoft izvoz iz §2.

## 5. Uslovi (zvanične stranice, provereno 2026-10-02)

**Neon** (neon.com/pricing):
- Free: 1 GB po projektu (20 GB ukupno na nalogu), 100 CU-sati po projektu,
  10 grana, istorija 6 h, 5 GB prenosa po projektu, gašenje posle 5 min, bez
  kartice.
- Launch: bez mesečnog minimuma; $0,106 po CU-satu, $0,35 po GB-mesecu;
  povratak do 7 dana.

**Vercel** (vercel.com/pricing, vercel.com/docs/plans/hobby):
- Hobby: $0, **samo lična, nekomercijalna upotreba**. Uključeno mesečno:
  1.000.000 poziva funkcija, 4 CPU-sata, 360 GB-sati memorije, 100 GB
  prenosa. Funkcije do 300 s. Logovi 1 h. Posle prekoračenja čeka se 30 dana.
- Pro: $20 po razvojnom sedištu mesečno, uz $20 kredita za potrošnju; preko
  uključenog: $0,60 po milion poziva, $0,128 po CPU-satu, 1 TB prenosa pa
  $0,15/GB. Zaštita lozinkom $20 po projektu mesečno (Vercel Authentication je
  besplatan i na Hobby-ju).
