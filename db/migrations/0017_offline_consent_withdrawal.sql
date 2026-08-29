/*
 * Offline povlačenje saglasnosti.
 *
 * Aditivno i idempotentno. Tabela ostaje append-only — okidač iz 0014 se ne
 * dira.
 *
 * Zašto se ranije pravilo menja
 * -----------------------------
 * `0014` je dozvoljavao offline `granted`, a offline `withdrawn` zabranjivao,
 * uz obrazloženje da povlačenje kupac mora raditi sam. Namera je bila dobra —
 * spreciti da neko drugi odlucuje umesto kupca — ali je ishod bio suprotan od
 * zeljenog: kupac koji opozove saglasnost telefonom, e-poštom ili pisanim
 * zahtevom nije mogao biti evidentiran, pa bi u sistemu i dalje stajao kao
 * saglasan. Teze pravilo je proizvodilo netačan zapis.
 *
 * Zaštita se zato premešta sa ZABRANE na DOKAZ: offline zapis mora imati
 * potpis zaposlenog I referencu na zahtev. Ko tvrdi da je kupac povukao
 * saglasnost, mora reći odakle to zna.
 */

ALTER TABLE "customer_contact_consents"
  DROP CONSTRAINT IF EXISTS "customer_contact_consents_source_ck";
--> statement-breakpoint

/*
 * Novo pravilo:
 *   - self-service: bez potpisa zaposlenog (kupac je sam akter);
 *   - offline: potpis OBAVEZAN, i napomena OBAVEZNA — bez obzira na to da li
 *     se pristanak daje ili povlači.
 *
 * Napomena je kratka referenca na zahtev („telefonski zahtev 12.09.",
 * „pisani zahtev, protokol 41/26"). Sadržaj privatne poruke se NE prepisuje —
 * tabela i dalje ne čuva ništa osim odluke i njenog traga.
 */
DO $$ BEGIN
  ALTER TABLE "customer_contact_consents"
    ADD CONSTRAINT "customer_contact_consents_source_ck"
    CHECK (
      (source = 'customer_self_service' AND recorded_by IS NULL)
      OR (source = 'office_recorded_offline'
          AND recorded_by IS NOT NULL
          AND note IS NOT NULL
          AND btrim(note) <> '')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
