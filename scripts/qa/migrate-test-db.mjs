/**
 * Primena migracija na izolovanu test bazu.
 *
 * Zašto zasebna skripta, a ne `npm run db:migrate`
 * ------------------------------------------------
 * `db/migrate.mjs` čita `MIGRATION_DATABASE_URL`. Da bismo njega upotrebili,
 * morali bismo test URL da postavimo pod tim imenom — a sigurnosna kapija
 * upravo odbija metu čiji je otisak jednak `MIGRATION_DATABASE_URL`. Time bi
 * jedina zaštita postala smetnja koju treba zaobići, što je najgori mogući
 * ishod za zaštitu.
 *
 * Zato ova skripta čita ISKLJUČIVO `TEST_DATABASE_URL`, prolazi kroz istu
 * kapiju kao i testovi, i nikada ne dodiruje produkcijske promenljive.
 *
 *   TEST_DATABASE_URL=… node scripts/qa/migrate-test-db.mjs
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import {
  BUSINESS_TABLES,
  evaluateTestTarget,
  fingerprint,
  MAX_TOLERATED_BUSINESS_ROWS,
  SAFETY_MESSAGES,
} from "../../db/integration/safety.mjs";

const decision = evaluateTestTarget({
  testUrl: process.env.TEST_DATABASE_URL,
  databaseUrl: process.env.DATABASE_URL,
  migrationUrl: process.env.MIGRATION_DATABASE_URL,
  vercelEnv: process.env.VERCEL_ENV,
});

if (!decision.ok) {
  console.error(SAFETY_MESSAGES[decision.reason] ?? decision.reason);
  process.exit(1);
}

// Meta se opisuje redigovano; vrednost promenljive se nikada ne ispisuje.
console.log(
  `Meta: host=${decision.target.host} baza=${decision.target.database} ` +
    `otisak=${fingerprint(process.env.TEST_DATABASE_URL)}`,
);

const sql = postgres(process.env.TEST_DATABASE_URL, { max: 1, onnotice: () => {} });

try {
  const [meta] = await sql`SELECT current_database() AS db, version() AS version`;
  console.log(`Baza: ${meta.db}`);
  console.log(`PostgreSQL: ${meta.version.split(" ").slice(0, 2).join(" ")}`);

  // Sadržaj se proverava PRE migracija: ime se može slagati, sadržaj ne laže.
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `;
  const present = new Set(tables.map((t) => t.table_name));
  console.log(`Postojećih tabela u public šemi: ${present.size}`);

  for (const table of BUSINESS_TABLES) {
    if (!present.has(table)) continue;
    const [{ count }] = await sql`SELECT count(*)::int AS count FROM ${sql(table)}`;
    if (count > MAX_TOLERATED_BUSINESS_ROWS) {
      console.error(
        `Tabela "${table}" ima ${count} redova. Ovo ne izgleda kao prazna test baza — staje se.`,
      );
      process.exit(1);
    }
  }

  await migrate(drizzle(sql), { migrationsFolder: "./db/migrations" });
  console.log("Migracije su primenjene.");

  const posle = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  console.log(`Tabela posle migracija: ${posle.length}`);
  console.log(posle.map((t) => t.table_name).join(", "));
} catch (error) {
  console.error("Migracije nisu uspele:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
