/*
 * Izričito ugovoren rabat 0 % je potvrđen uslov (0039).
 *
 * 0029 je dozvoljavao samo rabat > 0, pa „kupac ima dogovor bez rabata“ nije
 * mogao da se zapiše i nije se razlikovao od „rabat nije poznat“. Sada:
 * zapis 0 % = potvrđena osnovna cena; bez zapisa = cena na upit
 * (`orderabilityProblem`, `rebate_unknown`).
 */
ALTER TABLE "price_list_customer_terms" DROP CONSTRAINT IF EXISTS "price_list_customer_terms_discount_percent_check";
--> statement-breakpoint
ALTER TABLE "price_list_customer_terms" ADD CONSTRAINT "price_list_customer_terms_discount_percent_check"
  CHECK ("discount_percent" >= 0 AND "discount_percent" < 100);
