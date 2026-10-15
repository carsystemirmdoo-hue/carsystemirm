/*
 * 0047 — Poručivanje u celim pakovanjima (dok. 61, odluka vlasnika 2026-10-11).
 *
 * Kupac bira BROJ pojedinačnih pakovanja (limenka, kanta, komad); BizniSoft
 * obračunska količina je broj pakovanja × POTVRĐENA količina pakovanja u JM
 * artikla. Primer: JM LIT, pakovanje 5 L, 2 pakovanja = 10 LIT; JM KOM: 2 = 2.
 *
 *   1. `article_pack_sizes` — potvrđena količina jednog pakovanja u JM iz
 *      BizniSofta. Upisuje je čovek (sa dokazom); mera iz naziva nije potvrda.
 *      Jedinica se pamti: ako se JM u BizniSoftu promeni, potvrda ne važi.
 *   2. `customer_cart_items.pack_count` — izbor kupca; količina se računa.
 *   3. `customer_order_lines.pack_count` / `pack_quantity` — šta je kupac
 *      poručio, uz obračunsku količinu (`quantity`) kakvu unosi kancelarija.
 * Samo dodavanje; ništa postojeće se ne menja.
 */
CREATE TABLE IF NOT EXISTS "article_pack_sizes" (
  "article_id" uuid PRIMARY KEY,
  "pack_quantity" numeric(14, 3) NOT NULL,
  "unit" text NOT NULL,
  "label" text NOT NULL,
  "evidence" text NOT NULL,
  "confirmed_by" uuid NOT NULL,
  "confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- Izričit izuzetak (potvrda vlasnika): pakovanje je DEO jednog KOM iz BizniSofta
  -- (npr. KOM je vođen za staru kutiju od 250, a sada se prodaje paket od 125 = 0,5 KOM).
  "fractional_ok" boolean DEFAULT false NOT NULL,
  CONSTRAINT "article_pack_sizes_quantity_check" CHECK ("pack_quantity" > 0),
  -- JM komad: pakovanje se broji u celim komadima (limenka 0,5 L sa JM KOM = 1, zapremina je u oznaci).
  CONSTRAINT "article_pack_sizes_piece_check" CHECK ("unit" NOT IN ('KOM', 'KT') OR "pack_quantity" = trunc("pack_quantity") OR "fractional_ok"),
  CONSTRAINT "article_pack_sizes_article_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE RESTRICT,
  CONSTRAINT "article_pack_sizes_user_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT
);
--> statement-breakpoint
ALTER TABLE "customer_cart_items" ADD COLUMN IF NOT EXISTS "pack_count" integer;
--> statement-breakpoint
ALTER TABLE "customer_cart_items" DROP CONSTRAINT IF EXISTS "customer_cart_items_pack_count_check";
--> statement-breakpoint
ALTER TABLE "customer_cart_items" ADD CONSTRAINT "customer_cart_items_pack_count_check" CHECK ("pack_count" IS NULL OR "pack_count" > 0);
--> statement-breakpoint
ALTER TABLE "customer_order_lines" ADD COLUMN IF NOT EXISTS "pack_count" integer;
--> statement-breakpoint
ALTER TABLE "customer_order_lines" ADD COLUMN IF NOT EXISTS "pack_quantity" numeric(14, 3);
