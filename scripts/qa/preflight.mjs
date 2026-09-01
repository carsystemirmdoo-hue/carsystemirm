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

const { existsSync, statSync } = await import("node:fs");
const { readdir, stat } = await import("node:fs/promises");
const { join } = await import("node:path");

const NAPRAVI = "  Napravite ga:  npm run build:check";

if (!existsSync(".next-verify/BUILD_ID")) {
  const poruka =
    "Nedostaje build u .next-verify. Browser QA pokreće `next start` nad tim izlazom.\n" +
    NAPRAVI;
  console.error("build (.next-verify)  ODBIJENO  (missing)");
  console.error(`  ${poruka}`);
  greska ??= poruka;
} else {
  /*
   * Postojanje build-a NIJE dokaz da je to build koda koji se proverava.
   *
   * `npm run build` piše u `.next`, a browser QA servira `.next-verify`. Ko
   * zaboravi `build:check` dobija zelen QA prolaz nad STARIM ekranom — a to je
   * gore od pada: pad se vidi, a ovo izgleda kao dokaz. Ovde je i nastalo:
   * prolaz je dva puta potvrdio ekran koji u tom trenutku više nije postojao.
   */
  const IZVORI = ["app", "components", "features", "lib", "public"];
  const PRESKOCI = new Set(["node_modules", ".next", ".next-verify", ".next-dev"]);

  const najnoviji = async (dir) => {
    let max = 0;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return 0; // Folder ne postoji u ovom repozitorijumu; nije greška.
    }
    for (const e of entries) {
      if (PRESKOCI.has(e.name)) continue;
      const put = join(dir, e.name);
      if (e.isDirectory()) max = Math.max(max, await najnoviji(put));
      else max = Math.max(max, (await stat(put)).mtimeMs);
    }
    return max;
  };

  const buildovan = statSync(".next-verify/BUILD_ID").mtimeMs;
  let izvor = 0;
  for (const d of IZVORI) izvor = Math.max(izvor, await najnoviji(d));

  if (izvor > buildovan) {
    const minuta = Math.round((izvor - buildovan) / 60000);
    const poruka =
      `Build u .next-verify je stariji od izvora (za ~${minuta} min). Browser QA bi ` +
      "proverio ekran koji više ne postoji, i prošao.\n" +
      NAPRAVI;
    console.error("build (.next-verify)  ODBIJENO  (zastareo)");
    console.error(`  ${poruka}`);
    greska ??= poruka;
  } else {
    console.log("build (.next-verify)  ok        noviji od izvora");
  }
}

if (greska) {
  console.error("\nQA prolaz nije pokrenut. Rešite gornje pa pokušajte ponovo.");
  process.exit(1);
}

console.log("\nPreflight je prošao.");
