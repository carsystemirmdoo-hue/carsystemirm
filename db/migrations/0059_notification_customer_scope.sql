/*
 * Obaveštenje vezano za kupca (0059, provera po ulogama 2026-11-05).
 *
 * Obaveštenja su se delila samo po sposobnosti, pa komercijalista nije smeo da
 * dobije nijedno o kupcu — video bi i tuđe. Zato o upitu SVOG kupca nije
 * saznavao, iako na upit odgovara upravo on. `customer_id` sužava vidljivost:
 * red sa kupcem vidi samo ko tog kupca ima u opsegu (komercijalista preko
 * dodele; kancelarija i vlasnik sve). Postojeći redovi ostaju `NULL` i
 * ponašaju se kao do sada.
 *
 * Napomena za spajanje: 0057 (cene po kupcu) i 0058 (urednik saveta) žive na
 * nespojenim granama i imaju RANIJI `when`; moraju se primeniti pre ove, inače
 * ih migrator preskače.
 */
ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "customer_id" uuid REFERENCES "customers"("id") ON DELETE CASCADE;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_customer_idx" ON "notifications" ("customer_id");
