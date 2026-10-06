/*
 * Naknadno pristiglo POTPUNO storno (docs/b2b/48).
 *
 * Storno se čuva kao izvorni dokument (kao i do sada) i, kada je veza sa
 * originalom DOKAZANA, upisuje se ovde. Primenjeno storno isključuje original
 * iz prometa i iz ulaza preporuka; nijedan dokument se ne briše niti menja.
 *
 *   - `waiting_original` — storno nosi odštampanu referencu, original još nije
 *     proknjižen; primenjuje se sam kada original stigne;
 *   - `applied`          — potpuno storno, dokazana veza; original ne ulazi u
 *     promet, preporuke ni pokazatelje kupovine;
 *   - `review`           — delimično, nesaglasno ili sporno; original OSTAJE u
 *     prometu dok čovek ne odluči.
 */
CREATE TYPE "reversal_status" AS ENUM ('waiting_original', 'applied', 'review');
--> statement-breakpoint

CREATE TABLE "invoice_reversals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "storno_source_document_id" uuid NOT NULL REFERENCES "source_documents"("id") ON DELETE RESTRICT,
  "issuer_code" text NOT NULL,
  /* Odštampana referenca iz napomene storna — jedini dokaz veze. */
  "original_number" text NOT NULL,
  "original_date" date,
  "original_source_document_id" uuid REFERENCES "source_documents"("id") ON DELETE RESTRICT,
  "original_invoice_id" uuid REFERENCES "invoices"("id") ON DELETE RESTRICT,
  "status" "reversal_status" NOT NULL,
  /* Ishod `compareStornoToOriginal`: full | partial | mismatch. */
  "comparison" text,
  "reasons" text[] DEFAULT '{}'::text[] NOT NULL,
  /* Doprinos originala koji je primenom uklonjen (za izveštaj; ne računa se iz njega). */
  "net_effect" numeric(14, 2),
  "gross_effect" numeric(14, 2),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "invoice_reversals_storno_key" UNIQUE ("storno_source_document_id"),
  CONSTRAINT "invoice_reversals_comparison_ck" CHECK ("comparison" IS NULL OR "comparison" IN ('full', 'partial', 'mismatch')),
  CONSTRAINT "invoice_reversals_applied_ck" CHECK (
    "status" <> 'applied'
    OR ("original_invoice_id" IS NOT NULL AND "original_source_document_id" IS NOT NULL AND "comparison" = 'full')
  )
);
--> statement-breakpoint

/* Jedan original se ne poništava dvaput — ni ponovljenim ni drugim stornom. */
CREATE UNIQUE INDEX "invoice_reversals_one_applied_key" ON "invoice_reversals" ("original_invoice_id") WHERE "status" = 'applied';
--> statement-breakpoint
CREATE INDEX "invoice_reversals_waiting_idx" ON "invoice_reversals" ("issuer_code", "original_number") WHERE "status" = 'waiting_original';
--> statement-breakpoint

/* Trag se ne briše: zapis storna menja samo stanje, nikad identitet veze. */
CREATE OR REPLACE FUNCTION "invoice_reversals_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'invoice_reversals se ne brišu; stanje se menja uz trag'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (NEW.id, NEW.storno_source_document_id, NEW.issuer_code, NEW.original_number, NEW.original_date)
     IS DISTINCT FROM
     (OLD.id, OLD.storno_source_document_id, OLD.issuer_code, OLD.original_number, OLD.original_date) THEN
    RAISE EXCEPTION 'odštampana referenca storna se ne menja'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER "invoice_reversals_guard_trg"
  BEFORE UPDATE OR DELETE ON "invoice_reversals"
  FOR EACH ROW EXECUTE FUNCTION "invoice_reversals_guard"();
--> statement-breakpoint

/* Ledger: iste kolone kao u 0021; dodato samo isključenje primenjenog storna. */
CREATE OR REPLACE VIEW "effective_sales_ledger" AS
SELECT
  i.id                        AS invoice_id,
  i.company_id                AS issuer_code,
  i.customer_id,
  i.issued_on,
  i.document_kind,
  il.line_number,
  il.article_id,
  il.article_code,
  il.quantity,
  il.unit_price,
  il.discount_percent,
  il.tax_percent,
  il.line_amount,
  sd.id                       AS source_document_id,
  CASE i.document_kind
    WHEN 'faktura'           THEN 'gross_sales'
    WHEN 'povrat_robe'       THEN 'returns'
    WHEN 'storno'            THEN 'cancellations'
    WHEN 'knjizno_odobrenje' THEN 'corrections'
    WHEN 'korekcija_cene'    THEN 'corrections'
    WHEN 'korekcija_popusta' THEN 'corrections'
    ELSE 'unclassified'
  END AS bucket,
  (i.document_kind = 'faktura') AS enters_net,
  CASE
    WHEN i.document_kind = 'faktura' THEN 1
    WHEN i.document_kind IN ('povrat_robe', 'storno') THEN -1
    ELSE 0
  END AS sign,
  il.id                       AS invoice_line_id
FROM invoices i
JOIN invoice_lines il ON il.invoice_id = i.id
LEFT JOIN source_documents sd ON sd.invoice_id = i.id
WHERE
  (sd.id IS NULL
   OR (sd.revision_status = 'original' AND sd.manual_review <> 'pending'))
  AND NOT EXISTS (
    SELECT 1 FROM invoice_reversals r
     WHERE r.original_invoice_id = i.id AND r.status = 'applied'
  );
--> statement-breakpoint

/* Ulaz preporuka: iste kolone kao u 0026; dodato samo isključenje primenjenog storna. */
CREATE OR REPLACE VIEW "recommendation_input_lines" AS
SELECT
  i.id                        AS invoice_id,
  il.id                       AS invoice_line_id,
  il.line_number,
  sd.id                       AS source_document_id,
  i.customer_id,
  i.issued_on,
  i.company_id                AS issuer_code,
  il.article_code,
  coalesce(nullif(btrim(il.description), ''), a.name, il.article_code)
                              AS article_name
FROM invoices i
JOIN invoice_lines il ON il.invoice_id = i.id
JOIN source_documents sd ON sd.invoice_id = i.id
JOIN customer_external_identifiers cei
       ON cei.source_system = 'biznisoft'
      AND cei.issuer_code = sd.issuer_code
      AND cei.external_partner_code = sd.external_partner_code
      AND cei.customer_id = i.customer_id
      AND cei.status = 'mapped'
LEFT JOIN articles a ON a.id = il.article_id
WHERE
  i.document_kind = 'faktura'
  AND sd.validation_status = 'valid'
  AND sd.revision_status = 'original'
  AND sd.manual_review <> 'pending'
  AND sd.origin IN ('manual_upload', 'device')
  AND btrim(il.article_code) <> ''
  AND il.quantity > 0
  AND il.line_amount >= 0
  AND NOT EXISTS (
    SELECT 1 FROM invoice_reversals r
     WHERE r.original_invoice_id = i.id AND r.status = 'applied'
  );
