/*
 * Ponovna provera istog fajla novijom verzijom čitača (0052, dok. 65 §3; odluka 15. 10. 2026).
 *
 * Do sada je SHA-256 fajla bio jedinstven: fajl koji je odbila starija verzija čitača nije
 * mogao ponovo da se proveri, pa je kancelarija morala da pravi nov izvoz. Sada:
 *   - isti fajl + ista verzija čitača → i dalje jedan zapis (ponovljen upload = postojeća provera);
 *   - isti fajl ima NAJVIŠE JEDAN zapis koji nije „neuspešno“ (pregled/potvrđeno/odbačeno) — nema
 *     duplih snimaka istog fajla;
 *   - neuspešan pokušaj starije verzije ostaje kao istorija, a nova provera je nov zapis.
 * Samo zamena ograničenja; podaci se ne menjaju.
 */
ALTER TABLE "stock_imports" DROP CONSTRAINT IF EXISTS "stock_imports_sha_key";
--> statement-breakpoint
ALTER TABLE "stock_imports" ADD CONSTRAINT "stock_imports_sha_parser_key" UNIQUE ("file_sha256", "parser_version");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stock_imports_sha_live_key" ON "stock_imports" ("file_sha256") WHERE "status" <> 'neuspesno';
