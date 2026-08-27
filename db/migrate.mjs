/**
 * Primena migracija. Pokreće se ručno ili iz deploy koraka:
 *   npm run db:migrate
 *
 * Migracije su aditivne — nijedna ne briše postojeće poslovne podatke.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/*
 * Migracije idu nalogom koji sme DDL; aplikacija ne sme.
 *
 * Runtime nalog (`DATABASE_URL`) treba da bude ograničen: bez `CREATE`,
 * `ALTER`, `DROP`, bez vlasništva nad tabelama i bez prava da menja audit.
 * Ako bi migracije išle tim nalogom, sva ta ograničenja bi morala da otpadnu i
 * kompromitovana aplikacija bi mogla da obriše audit trigger.
 *
 * U produkciji `MIGRATION_DATABASE_URL` je OBAVEZAN. U razvoju se dozvoljava
 * povratak na `DATABASE_URL`, jer lokalna PGlite baza ima jedan nalog.
 */
const isProduction =
  process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

const migrationUrl = process.env.MIGRATION_DATABASE_URL;
const connectionString = migrationUrl ?? (isProduction ? null : process.env.DATABASE_URL);

if (isProduction && !migrationUrl) {
  console.error(
    "MIGRATION_DATABASE_URL nije podešen. U produkciji se DDL ne sme izvršavati " +
      "runtime nalogom — vidi docs/b2b/10-db-roles-runbook.md.",
  );
  process.exit(1);
}

if (!connectionString) {
  console.error(
    "Nije podešen nijedan connection string. Pogledajte .env.example i docs/portal/SETUP.md.",
  );
  process.exit(1);
}

console.log(
  migrationUrl
    ? "Migracije: koristi se MIGRATION_DATABASE_URL."
    : "Migracije: MIGRATION_DATABASE_URL nije podešen — razvojni povratak na DATABASE_URL.",
);

// `max: 1` jer migracije moraju ići redom, kroz jednu konekciju.
const client = postgres(connectionString, { max: 1 });

try {
  await migrate(drizzle(client), { migrationsFolder: "./db/migrations" });
  console.log("Migracije su primenjene.");
} catch (error) {
  console.error("Migracije nisu uspele:", error);
  process.exitCode = 1;
} finally {
  await client.end();
}
