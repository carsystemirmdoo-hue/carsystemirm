/*
 * Idempotentna obaveštenja.
 *
 * Aditivno i idempotentno.
 *
 * Bez ključa za razlikovanje, isti uslov bi proizveo nov red pri svakoj
 * mutaciji koja ga ponovo primeti — a lista koja se puni istim redom prestaje
 * da se čita. Ovo je razlog zbog koga se obaveštenja gase u praksi: ne zato
 * što ih nema, nego zato što ih ima previše istih.
 */

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "dedupe_key" text;
--> statement-breakpoint

/*
 * Jedno OTVORENO obaveštenje po ključu.
 *
 * `WHERE status <> 'resolved'` je namerno: kada čovek zatvori obaveštenje, a
 * uslov se kasnije ponovo pojavi, to je nov događaj i zaslužuje nov red. Da je
 * indeks pokrivao i zatvorene, ponovna pojava problema bi prošla nemo — što je
 * gore od duplikata.
 */
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_dedupe_open_key"
  ON "notifications" ("dedupe_key")
  WHERE "dedupe_key" IS NOT NULL AND status <> 'resolved';
