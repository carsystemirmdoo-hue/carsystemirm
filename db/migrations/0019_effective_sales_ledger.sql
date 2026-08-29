/*
 * Jedan kanonski ledger prodaje.
 *
 * Aditivno: pogled nad POSTOJEĆIM `invoices` / `invoice_lines`. Nijedna tabela
 * se ne dira i nijedan red prometa se ne duplira — upravo zato je pogled, a ne
 * druga tabela. Druga tabela bi značila drugu istinu, i pitanje „koja važi" na
 * koje niko ne bi imao odgovor.
 *
 * Ovaj pogled će kasnije koristiti preporuke, prognoza, analitika i „poslednja
 * fakturisana cena". Zato mora biti JEDINO mesto sa kog se čita promet.
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

  /*
   * Kofa u koju red spada.
   *
   * Rečnik je postojeći `document_kind` — nijedna nova vrednost nije izmišljena.
   */
  CASE i.document_kind
    WHEN 'faktura'           THEN 'gross_sales'
    WHEN 'povrat_robe'       THEN 'returns'
    WHEN 'storno'            THEN 'cancellations'
    WHEN 'knjizno_odobrenje' THEN 'corrections'
    WHEN 'korekcija_cene'    THEN 'corrections'
    WHEN 'korekcija_popusta' THEN 'corrections'
    ELSE 'unclassified'
  END AS bucket,

  /*
   * Da li red sme da uđe u NETO prodaju.
   *
   * Samo prodaja. Povrat, storno i korekcija se PRIKAZUJU u svojim kofama, ali
   * ne ulaze u neto dok se ne poveže sa originalom — a veza traži izričitu
   * referencu u dokumentu, koju nijedan stvaran uzorak još ne pokazuje.
   *
   * Alternativa bi bila da se predznak pogađa iz tipa. To bi značilo da jedan
   * pogrešno prepoznat dokument oduzme promet koji nikad nije oduzet, i da se
   * greška vidi tek pri poređenju sa knjigovodstvom.
   */
  (i.document_kind = 'faktura') AS enters_net,

  /*
   * Predznak za buduće izvođenje neto vrednosti.
   *
   * Postoji da bi ugovor bio zapisan, ne da bi se odmah primenio: dok
   * `enters_net` ne bude tačan za korektivne dokumente, predznak se ne koristi.
   */
  CASE
    WHEN i.document_kind = 'faktura' THEN 1
    WHEN i.document_kind IN ('povrat_robe', 'storno') THEN -1
    ELSE 0
  END AS sign
FROM invoices i
JOIN invoice_lines il ON il.invoice_id = i.id
LEFT JOIN source_documents sd ON sd.invoice_id = i.id
WHERE
  /*
   * Dokument koji je ZAMENJEN ili je u sudaru NE ulazi u ledger.
   *
   * Ovo je jedina odbrana od dvostrukog brojanja originala i njegove revizije.
   * `sd.id IS NULL` propušta fakture iz ranijeg CSV uvoza — one nemaju izvorni
   * PDF i legitimne su.
   */
  sd.id IS NULL
  OR (sd.revision_status = 'original' AND sd.manual_review <> 'pending');
--> statement-breakpoint

COMMENT ON VIEW "effective_sales_ledger" IS
  'Jedini izvor prometa. Iskljucuje zamenjene i sporne dokumente. Povrat, storno i korekcija se prikazuju u svojim kofama ali ne ulaze u neto dok veza sa originalom nije dokazana.';
