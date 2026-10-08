/*
 * Pravilo cene koje važi SAMO u portalu i oznaka serije upisa.
 *
 * `approved_pending_biznisoft` znači „odobreno, čeka ručni unos u BizniSoft".
 * Pravila primenjena na pilotu iz istorije faktura NISU nalog za unos u
 * BizniSoft: `biznisoft_entry_required = false` gasi obaveštenje kancelariji i
 * zabranjuje evidentiranje unosa (`office_recorded`) dok vlasnik ne odluči
 * drugačije. Postojeća pravila ostaju kao do sada (podrazumevano `true`).
 *
 * `source_batch` grupiše pravila nastala jednim upisom, da bi se taj upis
 * mogao opozvati bez diranja pravila nastalih ili menjanih kasnije.
 */
ALTER TABLE "price_rules" ADD COLUMN "biznisoft_entry_required" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "price_rules" ADD COLUMN "source_batch" text;
--> statement-breakpoint
CREATE INDEX "price_rules_source_batch_idx" ON "price_rules" ("source_batch") WHERE "source_batch" IS NOT NULL;
