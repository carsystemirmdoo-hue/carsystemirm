/*
 * Povratni postupak za 0033_invoice_reversals.
 *
 * NIJE deo lanca migracija (drizzle čita samo `db/migrations`). Pokreće se
 * ručno, vlasnikom baze (MIGRATION_DATABASE_URL), u jednoj transakciji:
 *
 *   psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -1 \
 *     -f db/rollback/0033_invoice_reversals.down.sql
 *
 * Posle povratka VRATITI i kod na verziju pre 0033. Pogledi se vraćaju na
 * definicije iz 0021 i 0026: primenjena storna PRESTAJU da isključuju
 * originale (promet ponovo računa poništene kupovine). Izvorni dokumenti
 * storna ostaju (`source_documents`, na ručnom pregledu); trag revizije se ne
 * dira. Pre povratka izvesti zapise veza:
 *
 *   \copy (SELECT * FROM invoice_reversals) TO 'storna-0033.csv' CSV HEADER
 */
CREATE OR REPLACE VIEW "effective_sales_ledger" AS
SELECT
  i.id AS invoice_id, i.company_id AS issuer_code, i.customer_id, i.issued_on, i.document_kind,
  il.line_number, il.article_id, il.article_code, il.quantity, il.unit_price, il.discount_percent,
  il.tax_percent, il.line_amount, sd.id AS source_document_id,
  CASE i.document_kind
    WHEN 'faktura' THEN 'gross_sales' WHEN 'povrat_robe' THEN 'returns' WHEN 'storno' THEN 'cancellations'
    WHEN 'knjizno_odobrenje' THEN 'corrections' WHEN 'korekcija_cene' THEN 'corrections'
    WHEN 'korekcija_popusta' THEN 'corrections' ELSE 'unclassified'
  END AS bucket,
  (i.document_kind = 'faktura') AS enters_net,
  CASE WHEN i.document_kind = 'faktura' THEN 1 WHEN i.document_kind IN ('povrat_robe', 'storno') THEN -1 ELSE 0 END AS sign,
  il.id AS invoice_line_id
FROM invoices i
JOIN invoice_lines il ON il.invoice_id = i.id
LEFT JOIN source_documents sd ON sd.invoice_id = i.id
WHERE sd.id IS NULL OR (sd.revision_status = 'original' AND sd.manual_review <> 'pending');

CREATE OR REPLACE VIEW "recommendation_input_lines" AS
SELECT
  i.id AS invoice_id, il.id AS invoice_line_id, il.line_number, sd.id AS source_document_id,
  i.customer_id, i.issued_on, i.company_id AS issuer_code, il.article_code,
  coalesce(nullif(btrim(il.description), ''), a.name, il.article_code) AS article_name
FROM invoices i
JOIN invoice_lines il ON il.invoice_id = i.id
JOIN source_documents sd ON sd.invoice_id = i.id
JOIN customer_external_identifiers cei
       ON cei.source_system = 'biznisoft' AND cei.issuer_code = sd.issuer_code
      AND cei.external_partner_code = sd.external_partner_code
      AND cei.customer_id = i.customer_id AND cei.status = 'mapped'
LEFT JOIN articles a ON a.id = il.article_id
WHERE i.document_kind = 'faktura' AND sd.validation_status = 'valid' AND sd.revision_status = 'original'
  AND sd.manual_review <> 'pending' AND sd.origin IN ('manual_upload', 'device')
  AND btrim(il.article_code) <> '' AND il.quantity > 0 AND il.line_amount >= 0;

DROP TRIGGER IF EXISTS "invoice_reversals_guard_trg" ON "invoice_reversals";
DROP FUNCTION IF EXISTS "invoice_reversals_guard"();
DROP TABLE IF EXISTS "invoice_reversals";
DROP TYPE IF EXISTS "reversal_status";
