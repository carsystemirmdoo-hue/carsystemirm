-- Trag revizije mora ostati nepromenljiv i posle greške u aplikativnom kodu.
-- Okidač odbija svaki UPDATE i DELETE nad audit_log, bez obzira na to koja ga uloga izvršava.
-- Ispravke se rade isključivo dodavanjem novog reda sa razlogom.

CREATE OR REPLACE FUNCTION audit_log_is_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'audit_log je append-only: % nad redom % nije dozvoljen', TG_OP, OLD.id
    USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_log_no_update ON "audit_log";
--> statement-breakpoint
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION audit_log_is_append_only();
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_log_no_delete ON "audit_log";
--> statement-breakpoint
CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION audit_log_is_append_only();
