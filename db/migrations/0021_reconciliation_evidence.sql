/*
 * Dokaz usaglašavanja postaje stvaran strani ključ.
 *
 * `price_rules_confirmed_needs_invoice_ck` je do sada tražio da
 * `reconciled_invoice_id` nije NULL — ali nijedan strani ključ nije proveravao
 * da taj UUID zaista postoji u `invoices`. Nasumičan UUID je prolazio proveru i
 * pravilo bi bilo „potvrđeno" bez ijednog reda prometa iza sebe.
 *
 * RESTRICT, ne CASCADE: dokaz ne sme tiho nestati ispod potvrđenog pravila.
 */
DO $$ BEGIN
  ALTER TABLE "price_rules"
    ADD CONSTRAINT "price_rules_reconciled_invoice_fk"
    FOREIGN KEY ("reconciled_invoice_id") REFERENCES "invoices"("id")
    ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "price_rules"
    ADD CONSTRAINT "price_rules_reconciled_line_fk"
    FOREIGN KEY ("reconciled_invoice_line_id") REFERENCES "invoice_lines"("id")
    ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * Ledger dobija i identitet stavke.
 *
 * Bez njega usaglašavanje može da kaže „na nekoj fakturi jeste", ali ne i na
 * kojoj tačno stavci — a upravo ta stavka je jedini dokaz koji se kasnije može
 * otvoriti i proveriti.
 *
 * Kolona se DODAJE na kraj: `CREATE OR REPLACE VIEW` ne dozvoljava menjanje
 * redosleda ni tipova postojećih kolona.
 */
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
  sd.id IS NULL
  OR (sd.revision_status = 'original' AND sd.manual_review <> 'pending');
