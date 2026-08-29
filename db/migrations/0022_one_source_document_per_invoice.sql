/*
 * Jedna faktura — najviše jedan izvorni dokument.
 *
 * `effective_sales_ledger` spaja `invoices` sa `source_documents` preko
 * `invoice_id`. Bez ovog ograničenja dva izvorna dokumenta na istu fakturu
 * udvostručuju SVAKI red te fakture u pogledu — i to tiho, jer se nigde ne
 * vidi kao greška, nego kao veći promet.
 *
 * Do sada je invarijanta „promet se broji tačno jednom" počivala samo na tome
 * što aplikativni put uvek pravi novu fakturu. To je konvencija, ne garancija;
 * ovde postaje garancija.
 *
 * Delimičan indeks: `invoice_id` je NULL za sve što još nije proknjiženo
 * (karantin, čekanje mapiranja, sudar), a takvih redova ima mnogo i oni se
 * međusobno ne sudaraju.
 */
CREATE UNIQUE INDEX IF NOT EXISTS "source_documents_invoice_key"
  ON "source_documents" ("invoice_id")
  WHERE "invoice_id" IS NOT NULL;
--> statement-breakpoint

COMMENT ON INDEX "source_documents_invoice_key" IS
  'Jedna faktura sme imati najvise jedan izvorni dokument. Brani effective_sales_ledger od udvostrucenja prometa preko LEFT JOIN-a.';
