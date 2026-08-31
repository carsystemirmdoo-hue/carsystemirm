/*
 * Poreklo dokumenta, verifikovan semantic hash, valuta i datum prometa.
 *
 * ADITIVNO. Nijedna postojeća kolona se ne menja i ne briše, nema paralelnog
 * modela faktura, i nijedan postojeći red se ne dira.
 *
 * Zašto sve odjednom: ovo su podaci koji stižu ZAJEDNO sa jednim dokumentom i
 * moraju se upisati u istoj transakciji kao i on. Razdvojene migracije bi
 * ostavile prozor u kome dokument postoji a njegovo poreklo ne.
 *
 * Šta OVA migracija NE radi
 * -------------------------
 * Ne otvara podršku za EUR, stvarni datum prometa, storno/povrat ni
 * continuation. Postojanje kolone NIJE dokaz podrške — kontrolisana odbijanja
 * iz P1 (`currency_unsupported`, `trade_date_unsupported`,
 * `document_kind_unsupported`) ostaju na snazi u `lib/sync/contract/validate.mjs`.
 * Kolone postoje da bi podatak, kada podrška dođe, imao gde da stoji verno —
 * a ne da bi se do tada nagađao.
 */

/* =========================================================================
 * Poreklo
 * ====================================================================== */

DO $$ BEGIN
  CREATE TYPE "public"."document_origin" AS ENUM (
    /* Ručni upload PDF-a kroz portal. */
    'manual_upload',
    /* Potpisan canonical dokument sa registrovanog uređaja. */
    'device',
    /* Raniji CSV uvoz iz knjigovodstva. */
    'csv_import',
    /*
     * Zatečen red bez dokaza o poreklu.
     *
     * IZRIČITO stanje, ne NULL i ne pogađanje. Red koji je nastao pre ove
     * migracije ne zna se odakle je došao, i ime fajla to NE dokazuje —
     * `canonical:<hash>` je prikazna oznaka, a ne poreklo.
     */
    'legacy_unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."value_provenance" AS ENUM (
    /* Vrednost je pročitana iz samog dokumenta. */
    'document',
    /* Vrednost je podrazumevana konfiguracijom podržanog izvora. */
    'source_default',
    /* Zatečen red; izvor vrednosti nije poznat. */
    'legacy_unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* =========================================================================
 * `source_documents` — metapodaci koji pripadaju VERZIJI dokumenta
 * ====================================================================== */

/*
 * Ovi podaci zavise od verzije i zato stoje uz izvorni dokument, ne uz fakturu.
 *
 * Dve verzije istog poslovnog dokumenta mogu imati različit semantic hash,
 * različit uređaj i različit trenutak dostave. Kada čovek izabere koja važi,
 * projekcija (`invoices`) preuzima vrednosti POBEDNIČKE verzije — vidi
 * `retargetInvoice` u `lib/pdf/ingest.ts`.
 */
ALTER TABLE "source_documents"
  ADD COLUMN IF NOT EXISTS "origin" "document_origin" NOT NULL DEFAULT 'legacy_unknown';
--> statement-breakpoint

/*
 * Semantic hash koji je SERVER izračunao i potvrdio.
 *
 * `NULL` znači „nije verifikovan“, i to je tačno stanje svakog zatečenog reda.
 * Backfill nagađanjem se NE radi: hash se može izračunati samo iz canonical
 * sadržaja, a zatečeni redovi ga nemaju.
 *
 * Čuvanje ovog hash-a NIJE semantička deduplikacija. Vidi napomenu na indeksu
 * ispod.
 */
ALTER TABLE "source_documents"
  ADD COLUMN IF NOT EXISTS "semantic_hash" text;
--> statement-breakpoint

ALTER TABLE "source_documents"
  ADD COLUMN IF NOT EXISTS "canonicalization_version" integer;
--> statement-breakpoint
ALTER TABLE "source_documents"
  ADD COLUMN IF NOT EXISTS "schema_version" integer;
--> statement-breakpoint

/* Valuta dokumenta i ODAKLE ta vrednost dolazi. */
ALTER TABLE "source_documents"
  ADD COLUMN IF NOT EXISTS "currency" text;
--> statement-breakpoint
ALTER TABLE "source_documents"
  ADD COLUMN IF NOT EXISTS "currency_provenance" "value_provenance";
--> statement-breakpoint

/* Datum prometa i osnov datuma. Oba `NULL` za sve zatečeno. */
ALTER TABLE "source_documents"
  ADD COLUMN IF NOT EXISTS "trade_date" date;
--> statement-breakpoint
ALTER TABLE "source_documents"
  ADD COLUMN IF NOT EXISTS "date_basis" text;
--> statement-breakpoint

/*
 * Uređaj koji je dostavio zapis.
 *
 * `RESTRICT`: uređaj koji je isporučio dokument se ne briše dok taj dokument
 * postoji. Brisanje uređaja ne sme progutati poreklo onoga što je uneo.
 * Strani ključ se dodaje u `0024`, kada tabela uređaja bude postojala.
 */
ALTER TABLE "source_documents"
  ADD COLUMN IF NOT EXISTS "delivered_by_device_id" uuid;
--> statement-breakpoint

/*
 * Valuta i njeno poreklo idu ZAJEDNO.
 *
 * Valuta bez zapisanog porekla je tvrdnja bez pokrića — ne bi se znalo da li je
 * pročitana sa dokumenta ili podrazumevana konfiguracijom. Reconciliation to
 * mora da razlikuje, inače bi nepoznata valuta postala „RSD dokaz“.
 */
DO $$ BEGIN
  ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_currency_provenance_ck"
    CHECK ((currency IS NULL) = (currency_provenance IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* `date_basis` sme biti samo jedna od dve poznate vrednosti. */
DO $$ BEGIN
  ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_date_basis_ck"
    CHECK (date_basis IS NULL OR date_basis IN ('issued_on', 'trade_date'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * Osnov `trade_date` traži da datum prometa zaista postoji.
 *
 * Bez ovoga bi dokument mogao da tvrdi da mu poslovno značenje nosi datum koji
 * nije dostavljen — i taj datum bi se tiho čitao kao datum izdavanja.
 */
DO $$ BEGIN
  ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_trade_date_basis_ck"
    CHECK (date_basis IS DISTINCT FROM 'trade_date' OR trade_date IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* Verifikovan hash nosi i verzije po kojima je izračunat; inače se ne može ponoviti. */
DO $$ BEGIN
  ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_semantic_hash_versions_ck"
    CHECK (
      semantic_hash IS NULL
      OR (canonicalization_version IS NOT NULL AND schema_version IS NOT NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * Indeks je NE-JEDINSTVEN, i to je odluka.
 *
 * Čuvanje semantic hash-a NIJE semantička deduplikacija. Jedinstveni indeks bi
 * je uveo tiho: reprint istog računa u drugim bajtovima ima ISTI semantic hash
 * i različit `file_hash`, pa bi drugi uvoz pao na ograničenju umesto da ode u
 * postojeći pregled konflikta verzija.
 *
 * P2 zadržava zatečeno ponašanje: različit `file_hash` ide kroz postojeći
 * `business_key_conflict`. Semantička deduplikacija ostaje NEPOKRIVEN zahtev,
 * ne prećutno završena funkcionalnost. Indeks služi pretrazi i poređenju.
 */
CREATE INDEX IF NOT EXISTS "source_documents_semantic_hash_idx"
  ON "source_documents" ("semantic_hash")
  WHERE "semantic_hash" IS NOT NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "source_documents_origin_idx"
  ON "source_documents" ("origin");
--> statement-breakpoint

COMMENT ON COLUMN "source_documents"."origin" IS
  'Poreklo dokumenta. `legacy_unknown` je izricito stanje zatecenih redova — ime fajla NIJE dokaz porekla.';
--> statement-breakpoint
COMMENT ON COLUMN "source_documents"."semantic_hash" IS
  'Semantic hash koji je SERVER izracunao i potvrdio. NULL = nije verifikovan. Cuvanje NIJE semanticka deduplikacija.';
--> statement-breakpoint
COMMENT ON COLUMN "source_documents"."currency_provenance" IS
  'Odakle valuta dolazi: `document` (procitana), `source_default` (konfiguracija izvora), `legacy_unknown`.';
--> statement-breakpoint

/* =========================================================================
 * `invoices` — projekcija aktivne verzije
 * ====================================================================== */

/*
 * Ista polja na projekciji, jer se ona čitaju bez otvaranja izvornog dokumenta.
 *
 * Vrednosti dolaze iz verzije koja VAŽI. Pri izboru druge verzije se prepisuju
 * zajedno sa stavkama i zbirovima — inače bi faktura nosila valutu jedne, a
 * iznose druge verzije.
 */
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "origin" "document_origin" NOT NULL DEFAULT 'legacy_unknown';
--> statement-breakpoint
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "currency" text;
--> statement-breakpoint
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "currency_provenance" "value_provenance";
--> statement-breakpoint
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "trade_date" date;
--> statement-breakpoint
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "date_basis" text;
--> statement-breakpoint

/*
 * NEMA globalnog backfill-a `RSD`.
 *
 * Zatečene fakture su nastale pod pretpostavkom da su iznosi dinarski, ali ta
 * pretpostavka nigde nije zapisana kao dokaz. Upisati je sada značilo bi
 * proglasiti nagađanje podatkom. `NULL` je tačan opis: ne znamo.
 */

DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_currency_provenance_ck"
    CHECK ((currency IS NULL) = (currency_provenance IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_date_basis_ck"
    CHECK (date_basis IS NULL OR date_basis IN ('issued_on', 'trade_date'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_trade_date_basis_ck"
    CHECK (date_basis IS DISTINCT FROM 'trade_date' OR trade_date IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

COMMENT ON COLUMN "invoices"."currency" IS
  'Valuta aktivne verzije. NULL za zatecene redove — RSD se NE upisuje unazad, jer pretpostavka nije dokaz.';
