/*
 * Ostatak logistike (0065; odluke vlasnika 2026-11-13).
 *
 * 1. Stavke jutarnjih uvoza lagera se čuvaju za 4 poslednja potvrđena snimka (ranije 2, 0051).
 * 2. `stock_level_history`: kratka istorija lagera — samo PROMENE količine po šifri izvoza
 *    („od–do“ raspon u kome je količina bila ista). Upisuje je potvrda uvoza u istoj transakciji.
 *    Čuva se godinu dana (briše je isti ograničen postupak čuvanja, ne aplikacija).
 * 3. `stock_requests`: „traženo — nema na stanju“. Automatski iz porudžbine kupca kada potvrđen lager
 *    pokazuje 0 (ili manje), i ručno („Kupac tražio“) od komercijaliste ili kancelarije.
 *
 * Postojeći redovi se ne menjaju (stari razlog čišćenja ostaje dozvoljen).
 */
CREATE TABLE IF NOT EXISTS "stock_level_history" (
  "id" bigserial PRIMARY KEY,
  "code_key" text NOT NULL,
  "from_date" date NOT NULL,
  "to_date" date,
  "quantity" numeric(14, 3),
  "import_id" uuid NOT NULL REFERENCES "stock_imports"("id") ON DELETE RESTRICT,
  CONSTRAINT "stock_level_history_range_check" CHECK ("to_date" IS NULL OR "to_date" >= "from_date")
);
--> statement-breakpoint
-- Najviše jedan otvoren raspon po šifri.
CREATE UNIQUE INDEX IF NOT EXISTS "stock_level_history_open_key" ON "stock_level_history" ("code_key") WHERE "to_date" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_level_history_code_idx" ON "stock_level_history" ("code_key", "from_date");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "article_id" uuid NOT NULL REFERENCES "articles"("id") ON DELETE RESTRICT,
  "customer_id" uuid REFERENCES "customers"("id") ON DELETE RESTRICT,
  "quantity" numeric(14, 3),
  "source" text NOT NULL,
  "order_id" uuid REFERENCES "customer_orders"("id") ON DELETE RESTRICT,
  "stock_quantity" numeric(14, 3),
  "stock_date" date,
  "note" text,
  "requested_by" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "resolved_at" timestamp with time zone,
  "resolved_by" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  "resolution" text,
  CONSTRAINT "stock_requests_source_check" CHECK ("source" IN ('porudzbina', 'rucno')),
  CONSTRAINT "stock_requests_qty_check" CHECK ("quantity" IS NULL OR "quantity" > 0),
  CONSTRAINT "stock_requests_order_check" CHECK (("source" = 'porudzbina') = ("order_id" IS NOT NULL)),
  CONSTRAINT "stock_requests_manual_check" CHECK ("source" <> 'rucno' OR "requested_by" IS NOT NULL),
  CONSTRAINT "stock_requests_note_check" CHECK ("note" IS NULL OR length("note") <= 500),
  CONSTRAINT "stock_requests_resolved_check" CHECK (("resolved_at" IS NULL) = ("resolved_by" IS NULL))
);
--> statement-breakpoint
-- Ista stavka iste porudžbine se beleži jednom.
CREATE UNIQUE INDEX IF NOT EXISTS "stock_requests_order_article_key" ON "stock_requests" ("order_id", "article_id") WHERE "order_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_requests_open_idx" ON "stock_requests" ("article_id", "created_at") WHERE "resolved_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "stock_imports" DROP CONSTRAINT IF EXISTS "stock_imports_purge_check";
--> statement-breakpoint
ALTER TABLE "stock_imports" ADD CONSTRAINT "stock_imports_purge_check" CHECK (
  ("lines_purged_at" IS NULL) = ("lines_purged_reason" IS NULL) AND
  ("lines_purged_reason" IS NULL OR "lines_purged_reason" IN ('starija_od_dva_potvrdjena', 'starija_od_cetiri_potvrdjena', 'nepotvrdjeno_7_dana'))
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "stock_import_retention"()
RETURNS TABLE ("purged_imports" integer, "purged_lines" integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_ids uuid[];
  v_lines integer := 0;
BEGIN
  -- Isti ključ drži i potvrda (lib/stock/stock-import-service.ts): potvrde i čišćenja idu jedno za drugim.
  PERFORM pg_advisory_xact_lock(hashtext('stock_imports_retention'));
  -- Istorija lagera: godinu dana (zatvoreni rasponi stariji od godinu dana).
  DELETE FROM stock_level_history WHERE to_date IS NOT NULL AND to_date < current_date - interval '1 year';
  SELECT coalesce(array_agg(i.id), '{}') INTO v_ids
    FROM stock_imports i
   WHERE i.lines_purged_at IS NULL
     AND EXISTS (SELECT 1 FROM stock_import_lines l WHERE l.import_id = i.id)
     AND (
       (i.status = 'potvrdjeno' AND i.id NOT IN (
          SELECT k.id FROM stock_imports k WHERE k.status = 'potvrdjeno' ORDER BY k.decided_at DESC, k.id DESC LIMIT 4))
       OR (i.status IN ('pregled', 'odbaceno') AND i.uploaded_at < now() - interval '7 days')
     );
  IF cardinality(v_ids) = 0 THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;
  DELETE FROM stock_import_lines WHERE import_id = ANY (v_ids);
  GET DIAGNOSTICS v_lines = ROW_COUNT;
  UPDATE stock_imports
     SET lines_purged_at = now(),
         lines_purged_reason = CASE WHEN status = 'potvrdjeno' THEN 'starija_od_cetiri_potvrdjena' ELSE 'nepotvrdjeno_7_dana' END
   WHERE id = ANY (v_ids);
  RETURN QUERY SELECT cardinality(v_ids), v_lines;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "stock_import_retention"() FROM PUBLIC;
