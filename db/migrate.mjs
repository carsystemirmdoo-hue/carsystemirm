/**
 * Primena migracija. Pokreće se ručno ili iz deploy koraka:
 *   npm run db:migrate
 *
 * Migracije su aditivne — nijedna ne briše postojeće poslovne podatke.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "DATABASE_URL nije podešen. Pogledajte .env.example i docs/portal/SETUP.md.",
  );
  process.exit(1);
}

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
