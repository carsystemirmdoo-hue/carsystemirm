-- Opoziv postojećih sesija.
--
-- Auth.js sa JWT strategijom ne vodi evidenciju izdatih tokena: odjava briše
-- kolačić u tom pregledaču, ali ukraden token ostaje važeći do isteka. Ovaj
-- brojač je jedino mesto na kome se sesija može poništiti — token nosi vrednost
-- iz trenutka prijave, a server je pri svakom zahtevu poredi sa ovom kolonom.
--
-- Migracija je aditivna: kolona ima `DEFAULT 0`, pa se postojeći redovi popune
-- sami i nijedan korisnik ne biva odjavljen uvođenjem ove izmene.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "session_version" integer DEFAULT 0 NOT NULL;
