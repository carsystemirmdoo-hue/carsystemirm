/**
 * Jedna provera pre svakog QA prolaza.
 *
 * Staje na PRVOM nedostatku, sa razlogom i komandom koja ga rešava. Bez ovoga
 * prolaz kreće, pada na osmom koraku i za sobom ostavlja osam kaskadnih grešaka
 * u kojima se pravi uzrok ne vidi.
 *
 *   node scripts/qa/preflight.mjs
 *
 * Ne ispisuje nijednu vrednost — samo `present` / `missing` i redigovan opis.
 */

import {
  evaluateTestTarget,
  fingerprint,
  SAFETY_MESSAGES,
} from "../../db/integration/safety.mjs";
import { checkQaMasterKey, QA_ENV_MESSAGES, QA_KEY_VAR } from "./qa-env.mjs";

let greska = null;

/* --- 1. Baza -------------------------------------------------------- */

const meta = evaluateTestTarget({
  testUrl: process.env.TEST_DATABASE_URL,
  databaseUrl: process.env.DATABASE_URL,
  migrationUrl: process.env.MIGRATION_DATABASE_URL,
  vercelEnv: process.env.VERCEL_ENV,
});

if (!meta.ok) {
  greska = SAFETY_MESSAGES[meta.reason] ?? meta.reason;
  console.error(`TEST_DATABASE_URL   ODBIJENO  (${meta.reason})`);
  console.error(`  ${greska}`);
} else {
  console.log(
    `TEST_DATABASE_URL   ok        host=${meta.target.host} baza=${meta.target.database} ` +
      `otisak=${fingerprint(process.env.TEST_DATABASE_URL)}`,
  );
}

/* --- 2. MFA master ključ -------------------------------------------- */

const kljuc = checkQaMasterKey(process.env);

if (!kljuc.ok) {
  const poruka = QA_ENV_MESSAGES[kljuc.reason] ?? kljuc.reason;
  console.error(`${QA_KEY_VAR}  ODBIJENO  (${kljuc.reason})`);
  console.error(`  ${poruka}`);
  greska ??= poruka;
} else {
  console.log(`${QA_KEY_VAR}  ok        ${kljuc.bytes} bajta (base64)`);
}

/* --- 3. Build ------------------------------------------------------- */

const { existsSync } = await import("node:fs");
if (!existsSync(".next-verify/BUILD_ID")) {
  const poruka =
    "Nedostaje build u .next-verify. Browser QA pokreće `next start` nad tim izlazom.\n" +
    "  Napravite ga:  npm run build:check";
  console.error("build (.next-verify)  ODBIJENO  (missing)");
  console.error(`  ${poruka}`);
  greska ??= poruka;
} else {
  console.log("build (.next-verify)  ok");
}

if (greska) {
  console.error("\nQA prolaz nije pokrenut. Rešite gornje pa pokušajte ponovo.");
  process.exit(1);
}

console.log("\nPreflight je prošao.");
