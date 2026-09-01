/*
 * Jedini dozvoljeni ulaz u recommendation engine.
 *
 * ZAŠTO POSEBAN POGLED, A NE `effective_sales_ledger`
 * ---------------------------------------------------
 * `effective_sales_ledger` je jedini izvor PROMETA i namerno propušta i ono što
 * preporuke ne smeju da vide:
 *
 *   - fakture bez izvornog dokumenta (`sd.id IS NULL`) — legitimne za promet,
 *     jer potiču iz ranijeg CSV uvoza, ali bez revizione zaštite;
 *   - `validation_status` uopšte ne proverava — ledger se oslanja na to da
 *     nevalidan dokument nikad ne dobije `invoice_id`, što je invarijanta
 *     knjiženja, ne uslov pogleda;
 *   - povrat, storno i korekciju (u svojim kofama, van `enters_net`).
 *
 * Preporuka tvrdi „ovaj kupac će ovo ponovo tražiti". Ta tvrdnja sme da počiva
 * ISKLJUČIVO na dokumentu koji ima svoj PDF, prošao proveru, nije zamenjen, nije
 * sporan, nije na pregledu, i čiji je kupac potvrđeno mapiran. Zato je ovo
 * ODVOJEN, UŽI pogled — ne drugi ledger, nego filter nad istim tabelama.
 *
 * Pogled ne bi bio dovoljan da je samo dokumentovan: sve što je ovde napisano
 * dokazuje `db/integration/recommendationInput.integration.test.mts`.
 */

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

  /*
   * Snapshot naziva, redom pouzdanosti izvora.
   *
   * `il.description` je ono što je STVARNO odštampano na dokumentu; registar
   * artikala (`articles.name`) je izveden i može se kasnije promeniti. Šifra je
   * poslednja rezerva — bolje prikazati šifru nego prazan naziv.
   *
   * Naziv NIJE identitet artikla i nigde se ne koristi za povezivanje.
   */
  coalesce(nullif(btrim(il.description), ''), a.name, il.article_code)
                              AS article_name
FROM invoices i
JOIN invoice_lines il ON il.invoice_id = i.id

/*
 * INNER JOIN — ovo je uslov `source_document_id IS NOT NULL`.
 *
 * `LEFT JOIN` bi propustio fakture iz ranijeg CSV uvoza. One nemaju PDF iza
 * sebe, pa se za njih ne može dokazati ni revizija ni validacija — a preporuka
 * bez tog dokaza je nagađanje sa datumom.
 *
 * Udvostručenja nema: `source_documents_invoice_key` (migracija 0022) dozvoljava
 * najviše jedan izvorni dokument po fakturi.
 */
JOIN source_documents sd ON sd.invoice_id = i.id

/*
 * Kupac mora biti POTVRĐENO mapiran, i to SADA.
 *
 * Nije dovoljno što je mapiranje postojalo u trenutku knjiženja: kada
 * kancelarija kasnije povuče ili ospori šifru partnera, promet ostaje u
 * ledgeru (dogodio se), ali preporuka mora da nestane — ona tvrdi nešto o
 * BUDUĆNOSTI tog kupca.
 *
 * Poređenje je EXACT po (izvor, izdavalac, šifra), sa vodećim nulama, i traži
 * da veza pokazuje na istog kupca na koga je faktura knjižena. Šifra bez
 * `external_partner_code` na dokumentu ovde otpada sama — `NULL` se ne poklapa.
 */
JOIN customer_external_identifiers cei
       ON cei.source_system = 'biznisoft'
      AND cei.issuer_code = sd.issuer_code
      AND cei.external_partner_code = sd.external_partner_code
      AND cei.customer_id = i.customer_id
      AND cei.status = 'mapped'

LEFT JOIN articles a ON a.id = il.article_id

WHERE
  /*
   * Samo pozitivna prodajna faktura.
   *
   * `document_kind = 'faktura'` isključuje storno, povrat, knjižno odobrenje,
   * obe korekcije i `nepoznato` (koje je `unclassified` u ledgeru) — jednim
   * uslovom, bez spiska koji se pri sledećoj vrednosti enum-a razilazi.
   */
  i.document_kind = 'faktura'

  /*
   * Dokument je prošao proveru.
   *
   * Ledger ovo ne proverava jer se oslanja na knjiženje. Ovde se proverava
   * izričito: `totals_mismatch`, `unparsable` i `unsupported_requires_sample`
   * su tri različita načina da dokument bude netačan, i nijedan ne sme da
   * postane osnov predviđanja.
   */
  AND sd.validation_status = 'valid'

  /* Nije zamenjen, nije u sudaru, ne čeka odluku o verziji. */
  AND sd.revision_status = 'original'

  /* Nije na ručnom pregledu. */
  AND sd.manual_review <> 'pending'

  /*
   * Ne potiče iz legacy/CSV kanala bez revizione zaštite.
   *
   * Pozitivan spisak, ne negativan: nova vrednost u `document_origin` mora
   * svesno da se doda ovde, a ne da tiho uđe u preporuke.
   */
  AND sd.origin IN ('manual_upload', 'device')

  /*
   * Šifra artikla je neprazan tekst.
   *
   * `invoice_lines.article_code` je `NOT NULL`, ali knjiženje upisuje prazan
   * string kada dokument šifru nije dao (`line.articleCode ?? ""`). Prazna
   * šifra nije artikal i ne sme da postane par sa kupcem.
   *
   * Vrednost se NIGDE ne trimuje u rezultatu — vodeće nule i tačan oblik su
   * poslovni identitet. `btrim` je samo u uslovu, da red od samih razmaka ne
   * prođe kao „neprazan".
   */
  AND btrim(il.article_code) <> ''

  /*
   * Red predstavlja stvarnu isporuku.
   *
   * Negativna količina unutar fakture je korekcija ušivena u dokument, a
   * negativan iznos je odobrenje — nijedno nije kupovina. Nula količina takođe
   * nije: red koji ništa nije isporučio ne dokazuje da će kupac to ponovo
   * tražiti.
   *
   * Ovo NIJE prognoza količine i količina se nigde dalje ne prenosi — vidi
   * `docs/b2b/06-recommendation-engine-v1.md` i GO/NO-GO nalaz o JM.
   */
  AND il.quantity > 0
  AND il.line_amount >= 0;
--> statement-breakpoint

COMMENT ON VIEW "recommendation_input_lines" IS
  'Jedini dozvoljeni ulaz u recommendation engine. Uzi od effective_sales_ledger: trazi izvorni dokument, valid provetu, original reviziju, zatvoren rucni pregled, poreklo manual_upload/device, potvrdjeno mapiranog kupca, nepraznu sifru artikla i pozitivan prodajni red.';
