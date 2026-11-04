-- Povratak 0057. Pravila tipa „akcija" se pre brisanja kolone moraju opozvati ili obrisati ručno,
-- inače bi posle povratka postala redovna pravila u sukobu sa redovnim rabatom istog opsega.
ALTER TABLE "price_list_import_rows" DROP COLUMN IF EXISTS "file_pack";
ALTER TABLE "price_list_import_rows" DROP COLUMN IF EXISTS "file_unit";
ALTER TABLE "price_list_import_rows" DROP COLUMN IF EXISTS "raw_price";
ALTER TABLE "price_list_imports" DROP CONSTRAINT IF EXISTS "price_list_imports_format_check";
ALTER TABLE "price_list_imports" DROP COLUMN IF EXISTS "decisions";
ALTER TABLE "price_list_imports" DROP COLUMN IF EXISTS "supplier_name";
ALTER TABLE "price_list_imports" DROP COLUMN IF EXISTS "supplier_key";
ALTER TABLE "price_list_imports" DROP COLUMN IF EXISTS "code_kind";
ALTER TABLE "price_list_imports" DROP COLUMN IF EXISTS "column_map";
ALTER TABLE "price_list_imports" DROP COLUMN IF EXISTS "price_unit";
ALTER TABLE "price_list_imports" DROP COLUMN IF EXISTS "source_format";
DROP TABLE IF EXISTS "rebate_change_notices";
DROP TABLE IF EXISTS "supplier_article_codes";
DROP TABLE IF EXISTS "article_new_defaults";
ALTER TABLE "price_rules" DROP CONSTRAINT IF EXISTS "price_rules_rule_kind_check";
ALTER TABLE "price_rules" DROP COLUMN IF EXISTS "rule_kind";
