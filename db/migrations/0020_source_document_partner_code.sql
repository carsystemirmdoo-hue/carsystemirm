/*
 * Šifra partnera sa dokumenta.
 *
 * Bez nje se dokument koji čeka mapiranje ne može pronaći kada čovek konačno
 * poveže šifru sa kupcem — a jedina alternativa bi bila ponovno čitanje PDF-a,
 * što znači da bi original morao trajno da se čuva. Ovako se posle uvoza fajl
 * više ne dodiruje.
 *
 * Tekst, ne broj: vodeća nula je deo šifre.
 */
ALTER TABLE "source_documents"
  ADD COLUMN IF NOT EXISTS "external_partner_code" text;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "source_documents_partner_idx"
  ON "source_documents" ("issuer_code", "external_partner_code")
  WHERE "invoice_id" IS NULL;
--> statement-breakpoint

COMMENT ON COLUMN "source_documents"."external_partner_code" IS
  'Sifra partnera tacno kako stoji na dokumentu, sa vodecim nulama. Sluzi za naknadno knjizenje kada se sifra mapira na kupca.';
