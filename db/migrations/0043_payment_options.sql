/*
 * 0043 — Odobrene opcije plaćanja po kupcu.
 *
 * Kupac bira SAMO opciju koja mu je odobrena (avans, odloženo N dana). Svaka
 * opcija ima svoje rabatne uslove (price_rules.payment_condition = šifra opcije),
 * datum važenja i istoriju. Izbor opcije nije dokaz uplate: avansna cena je
 * uslovljena uplatom pre isporuke, što kancelarija proverava.
 *
 * Tok: predlog (komercijalista) → odobreno / odbijeno (vlasnik) → opozvano.
 * Redovi se ne brišu; status se menja samo kroz servis (sa tragom).
 */
ALTER TABLE "price_rules" DROP CONSTRAINT "price_rules_payment_condition_check";
--> statement-breakpoint
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_payment_condition_check"
  CHECK ("payment_condition" IS NULL OR "payment_condition" ~ '^(avans|odlozeno_[0-9]{1,3})$');
--> statement-breakpoint
CREATE TABLE "customer_payment_options" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE RESTRICT,
  "option_code" text NOT NULL,
  "status" text NOT NULL DEFAULT 'predlog',
  "effective_from" date NOT NULL,
  "effective_to" date,
  "reason" text NOT NULL,
  "proposed_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "proposed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "decided_by" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  "decided_at" timestamp with time zone,
  "decision_reason" text,
  CONSTRAINT "customer_payment_options_code_check" CHECK ("option_code" ~ '^(avans|odlozeno_[0-9]{1,3})$'),
  CONSTRAINT "customer_payment_options_status_check" CHECK ("status" IN ('predlog', 'odobreno', 'odbijeno', 'opozvano')),
  CONSTRAINT "customer_payment_options_dates_check" CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from"),
  CONSTRAINT "customer_payment_options_reason_check" CHECK (length(btrim("reason")) BETWEEN 5 AND 500)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "customer_payment_options_one_pending" ON "customer_payment_options" ("customer_id", "option_code") WHERE "status" = 'predlog';
--> statement-breakpoint
CREATE UNIQUE INDEX "customer_payment_options_one_active" ON "customer_payment_options" ("customer_id", "option_code") WHERE "status" = 'odobreno' AND "effective_to" IS NULL;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "customer_payment_options_no_delete"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'opcija plaćanja se ne briše (samo opoziv)' USING ERRCODE = 'insufficient_privilege';
END $$;
--> statement-breakpoint
CREATE TRIGGER "customer_payment_options_no_delete_trg" BEFORE DELETE ON "customer_payment_options"
  FOR EACH ROW EXECUTE FUNCTION "customer_payment_options_no_delete"();
