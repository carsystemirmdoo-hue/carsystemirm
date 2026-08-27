/**
 * Vraća izolovanu QA bazu u prazno stanje pre prolaza.
 *
 * Postoji zato što prethodni prolaz može da bude prekinut na sredini i ostavi
 * naloge, tragove i kodove iza sebe. Bez ovoga bi drugi pokušaj počeo nad
 * zatečenim smećem i padao iz razloga koji nemaju veze sa onim što se testira.
 *
 *   TEST_DATABASE_URL=… node scripts/qa/reset-test-db.mjs
 *
 * Ne dira migration journal i ne isključuje nijedan okidač.
 */

import postgres from "postgres";
import {
  BUSINESS_TABLES,
  evaluateTestTarget,
  fingerprint,
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

console.log(
  `Meta: host=${decision.target.host} baza=${decision.target.database} ` +
    `otisak=${fingerprint(process.env.TEST_DATABASE_URL)}`,
);

/** Isti spisak kao u `db/integration/harness.mts`. */
const RESETTABLE_TABLES = [
  "audit_log",
  "auth_rate_limits",
  "user_mfa",
  "mfa_recovery_codes",
  "mfa_enrollment_grants",
  "password_reset_codes",
  "user_permissions",
  "user_preferences",
  "customer_assignments",
  "invoice_lines",
  "invoices",
  "import_rows",
  "import_runs",
  "salespeople",
  "customers",
  "articles",
  "system_settings",
  "users",
];

const sql = postgres(process.env.TEST_DATABASE_URL, { max: 1, onnotice: () => {} });

try {
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `;
  const present = new Set(tables.map((t) => t.table_name));

  if (present.size === 0) {
    console.log("Baza je prazna — nema šta da se resetuje. Pokrenite migracije.");
    process.exit(0);
  }

  /*
   * Sadržaj se proverava i ovde, ne samo pri povezivanju.
   *
   * `TRUNCATE` je nepovratan. Ako je neko u međuvremenu uperio promenljivu na
   * bazu sa pravim podacima, ime bi i dalje moglo da se slaže — sadržaj ne bi.
   */
  for (const table of BUSINESS_TABLES) {
    if (!present.has(table)) continue;
    const [{ count }] = await sql`SELECT count(*)::int AS count FROM ${sql(table)}`;
    if (count > 0) {
      const [{ qa }] = await sql`
        SELECT count(*)::int AS qa FROM users WHERE email LIKE 'qa1bverify-%'
      `;
      // Redovi koji nisu naši znače da ovo nije prazna QA meta.
      if (qa === 0) {
        console.error(
          `Tabela "${table}" ima ${count} redova, a nijedan QA nalog ne postoji. ` +
            "Ovo ne izgleda kao QA baza — reset je odbijen.",
        );
        process.exit(1);
      }
    }
  }

  const target = RESETTABLE_TABLES.filter((t) => present.has(t));
  const lista = target.map((t) => `"${t}"`).join(", ");

  // `TRUNCATE` ne pokreće okidače nad redovima, pa append-only zaštita
  // `audit_log` tabele ostaje na snazi i ne isključuje se ni na trenutak.
  await sql.unsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE`);
  console.log(`Ispražnjeno tabela: ${target.length}`);

  // Paketi dozvola dolaze iz migracije 0007 i moraju preživeti reset.
  const [{ count: paketa }] = await sql`
    SELECT count(*)::int AS count FROM permission_packages
  `;
  console.log(`Paketi dozvola posle reseta: ${paketa}`);
  if (paketa === 0) {
    console.error("Paketi dozvola su nestali — pokrenite migracije ponovo.");
    process.exit(1);
  }

  const [{ count: migracija }] = await sql`
    SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations
  `;
  console.log(`Migracija u journalu: ${migracija}`);
} catch (error) {
  console.error("Reset nije uspeo:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
