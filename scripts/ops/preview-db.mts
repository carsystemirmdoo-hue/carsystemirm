/**
 * Testna baza za zaštićeni Preview (Neon, Frankfurt) — postupak iz
 * docs/b2b/33-test-baza-runbook.md, korak po korak, bez ispisa tajni.
 *
 *   npx tsx --tsconfig db/integration/tsconfig.test.json scripts/ops/preview-db.mts <korak>
 *
 * Koraci (redom): check · migrate · role · verify · urls · all
 *
 * Čita ~/.carsystem-secrets/preview-test.env (scripts/ops/preview-secrets.sh):
 *   NEON_OWNER_URL          — DIREKTNA adresa vlasnika (Neon: „Connection pooling" isključen)
 *   CARSYSTEM_APP_PASSWORD  — lozinka runtime uloge (generisana)
 * i u njega upisuje PREVIEW_DATABASE_URL (pooled) i PREVIEW_DATABASE_DIRECT_URL.
 *
 * Neon: uloga napravljena kroz konzolu/CLI/API automatski dobija `neon_superuser`
 * (pg_write_all_data, CREATEROLE…). Zato se `carsystem_app` pravi OVDE, SQL-om,
 * i korak verify proverava da ta članstva ne postoje.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { readSecrets, requireSecret, SECRETS_FILE, writeSecret } from "./secrets-file.mts";

const ROLE = "carsystem_app";
const EXPECTED_MIGRATIONS = 33;
const APPEND_ONLY = ["audit_log", "customer_contact_consents", "sync_command_events"];
const REVOCATION_ONLY = ["customer_contact_verifications"];

const secrets = readSecrets();
const step = process.argv[2] ?? "help";

/** Lokalna proba skripte (lokalni Postgres) — nikad za Neon. */
const LOCAL_TEST = process.env.PREVIEW_DB_LOCAL_TEST === "1";
const isLocal = (url: URL) => LOCAL_TEST && url.hostname === "127.0.0.1";

function ownerUrl(): URL {
  const url = new URL(requireSecret(secrets, "NEON_OWNER_URL"));
  // postgres.js šalje nepoznate parametre adrese serveru kao podešavanja.
  url.searchParams.delete("channel_binding");
  if (!url.searchParams.get("sslmode") && !isLocal(url)) url.searchParams.set("sslmode", "require");
  return url;
}

function assertTarget(url: URL) {
  if (isLocal(url)) return;
  if (!/\.eu-central-1\.aws\.neon\.tech$/.test(url.hostname)) {
    throw new Error("NEON_OWNER_URL nije Neon u Frankfurtu (aws eu-central-1). Odbijeno.");
  }
  if (url.hostname.split(".")[0].endsWith("-pooler")) {
    throw new Error("NEON_OWNER_URL je pooled adresa. Za vlasnika treba DIREKTNA (pooling isključen).");
  }
}

const fingerprint = (url: URL) =>
  createHash("sha256").update(`${url.hostname}/${url.pathname}`).digest("hex").slice(0, 12);

function connect(url: URL, max = 1) {
  return postgres(url.toString(), { max, prepare: false, onnotice: () => {}, connect_timeout: 30 });
}

function appPassword(): string {
  const pw = requireSecret(secrets, "CARSYSTEM_APP_PASSWORD");
  // Ide u SQL kao literal (CREATE ROLE ne prima parametre) — dozvoljen je samo bezbedan skup znakova.
  if (!/^[A-Za-z0-9_-]{40,}$/.test(pw)) throw new Error("CARSYSTEM_APP_PASSWORD ima neočekivan oblik.");
  return pw;
}

function appUrls(owner: URL) {
  const pw = appPassword();
  const direct = new URL(owner.toString());
  direct.username = ROLE;
  direct.password = pw;
  const pooled = new URL(direct.toString());
  if (!isLocal(owner)) {
    const [endpoint, ...rest] = pooled.hostname.split(".");
    pooled.hostname = [`${endpoint}-pooler`, ...rest].join(".");
  }
  return { direct, pooled };
}

const ok = (label: string, value: boolean) => {
  console.log(`  ${value ? "✔" : "✖"} ${label}`);
  if (!value) process.exitCode = 1;
};

async function check() {
  const url = ownerUrl();
  assertTarget(url);
  const sql = connect(url);
  try {
    const [meta] = await sql<{ v: number; db: string; usr: string }[]>`
      SELECT current_setting('server_version_num')::int AS v, current_database() AS db, current_user AS usr`;
    const [{ n }] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`;
    console.log(`Meta: ${isLocal(url) ? "LOKALNA PROBA" : "Neon eu-central-1"}, otisak ${fingerprint(url)}, baza „${meta.db}"`);
    ok(`Postgres ${Math.floor(meta.v / 10000)} (traži se 13+)`, meta.v >= 130000);
    console.log(`  tabela u public šemi: ${n}`);
    if (n > 0) {
      const real = await sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM customers WHERE pib !~ '^000000'`.catch(() => [{ n: 0 }]);
      ok("nema kupaca van sintetičkog opsega PIB-a", real[0].n === 0);
    }
  } finally {
    await sql.end();
  }
}

function migrate() {
  const url = ownerUrl();
  assertTarget(url);
  const env: NodeJS.ProcessEnv = { ...process.env, MIGRATION_DATABASE_URL: url.toString(), NODE_ENV: "production" };
  delete env.DATABASE_URL;
  const result = spawnSync(process.execPath, ["db/migrate.mjs"], { env, stdio: "inherit" });
  if (result.status !== 0) throw new Error("Migracije nisu uspele (vidi izlaz iznad).");
}

async function role() {
  const url = ownerUrl();
  assertTarget(url);
  const pw = appPassword();
  const sql = connect(url);
  try {
    const exists = await sql`SELECT 1 FROM pg_roles WHERE rolname = ${ROLE}`;
    const attrs = "LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION";
    await sql.unsafe(
      exists.length
        ? `ALTER ROLE ${ROLE} WITH ${attrs} PASSWORD '${pw}'`
        : `CREATE ROLE ${ROLE} WITH ${attrs} PASSWORD '${pw}'`,
    );
    console.log(exists.length ? "Uloga postoji — lozinka i atributi osveženi." : "Uloga napravljena SQL-om.");
    const db = url.pathname.replace(/^\//, "");
    await sql.unsafe(`GRANT CONNECT ON DATABASE "${db}" TO ${ROLE}`);
    const source = await readFile(new URL("../../db/provisioning/runtime-role.sql", import.meta.url), "utf8");
    const script = source
      .split("\n")
      .filter((line) => !line.startsWith("\\set"))
      .join("\n")
      .replaceAll(":'runtime_role'", `'${ROLE}'`)
      .replaceAll(":runtime_role", ROLE);
    await sql.unsafe(script);
    console.log("db/provisioning/runtime-role.sql primenjen.");
  } finally {
    await sql.end();
  }
}

async function verify() {
  const url = ownerUrl();
  assertTarget(url);
  const sql = connect(url);
  try {
    const [{ n: migrations }] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`;
    ok(`migracije: ${migrations} (očekivano ${EXPECTED_MIGRATIONS})`, migrations === EXPECTED_MIGRATIONS);

    const [r] = await sql<{ sup: boolean; crole: boolean; cdb: boolean; rls: boolean; login: boolean }[]>`
      SELECT rolsuper AS sup, rolcreaterole AS crole, rolcreatedb AS cdb, rolbypassrls AS rls, rolcanlogin AS login
        FROM pg_roles WHERE rolname = ${ROLE}`;
    ok(`uloga ${ROLE} postoji i sme da se prijavi`, Boolean(r?.login));
    ok("bez SUPERUSER / CREATEROLE / CREATEDB / BYPASSRLS", r && !r.sup && !r.crole && !r.cdb && !r.rls);
    for (const parent of ["neon_superuser", "pg_write_all_data", "pg_read_all_data"]) {
      const [m] = await sql<{ member: boolean | null }[]>`
        SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${parent})
                    THEN pg_has_role(${ROLE}, ${parent}, 'MEMBER') END AS member`;
      ok(`nije član ${parent}`, m.member !== true);
    }

    const relations = await sql<{ name: string; kind: string }[]>`
      SELECT table_name AS name, table_type AS kind FROM information_schema.tables
       WHERE table_schema = 'public' ORDER BY table_name`;
    const missing: string[] = [];
    let protectedOk = true;
    for (const { name, kind } of relations) {
      const q = `public.${name}`;
      const [p] = await sql<{ s: boolean; i: boolean; u: boolean; d: boolean; t: boolean }[]>`
        SELECT has_table_privilege(${ROLE}, ${q}, 'SELECT') s, has_table_privilege(${ROLE}, ${q}, 'INSERT') i,
               has_table_privilege(${ROLE}, ${q}, 'UPDATE') u, has_table_privilege(${ROLE}, ${q}, 'DELETE') d,
               has_table_privilege(${ROLE}, ${q}, 'TRUNCATE') t`;
      if (!p.s) missing.push(`${name}:SELECT`);
      if (p.t) protectedOk = false;
      if (kind !== "BASE TABLE") continue;
      if (!p.i) missing.push(`${name}:INSERT`);
      if (APPEND_ONLY.includes(name)) { if (p.u || p.d) protectedOk = false; }
      else if (REVOCATION_ONLY.includes(name)) { if (!p.u || p.d) protectedOk = false; }
      else { if (!p.u) missing.push(`${name}:UPDATE`); if (!p.d) missing.push(`${name}:DELETE`); }
    }
    ok(`prava nad svih ${relations.length} tabela i view-ova`, missing.length === 0);
    if (missing.length) console.log(`    nedostaje: ${missing.join(", ")}`);
    ok("tabele samo za dodavanje zaštićene, bez TRUNCATE", protectedOk);
    const [s] = await sql<{ c: boolean }[]>`SELECT has_schema_privilege(${ROLE}, 'public', 'CREATE') c`;
    ok("bez CREATE nad šemom public", !s.c);
  } finally {
    await sql.end();
  }
}

async function urls() {
  const owner = ownerUrl();
  assertTarget(owner);
  const { direct, pooled } = appUrls(owner);
  writeSecret("PREVIEW_DATABASE_URL", pooled.toString());
  writeSecret("PREVIEW_DATABASE_DIRECT_URL", direct.toString());
  console.log(`Upisano u ${SECRETS_FILE}: PREVIEW_DATABASE_URL (pooled), PREVIEW_DATABASE_DIRECT_URL (direktna).`);

  for (const [label, url] of [["pooled", pooled], ["direktna", direct]] as const) {
    const sql = connect(url);
    try {
      const [who] = await sql<{ u: string }[]>`SELECT current_user AS u`;
      ok(`${label}: prijava kao ${ROLE}`, who.u === ROLE);
      await sql`SELECT count(*) FROM permission_packages`;
      const denied = await sql`DELETE FROM audit_log WHERE false`.then(
        () => false,
        (e: { code?: string }) => e.code === "42501",
      );
      ok(`${label}: brisanje traga revizije odbijeno (42501)`, denied);
      if (label === "direktna") {
        const held = await sql.begin(async (tx) => {
          await tx`SELECT pg_advisory_xact_lock(774155301::bigint)`;
          const [h] = await tx<{ n: number }[]>`
            SELECT count(*)::int AS n FROM pg_locks WHERE locktype = 'advisory' AND granted AND pid = pg_backend_pid()`;
          return h.n > 0;
        });
        ok("direktna: advisory brava vidljiva na istoj vezi (zaštita Vlasnika)", held);
      }
    } finally {
      await sql.end();
    }
  }
}

const steps: Record<string, () => unknown> = { check, migrate, role, verify, urls };
try {
  if (step === "all") {
    for (const name of ["check", "migrate", "role", "verify", "urls"]) {
      console.log(`\n== ${name}`);
      await steps[name]();
      if (process.exitCode) break;
    }
  } else if (steps[step]) {
    await steps[step]();
  } else {
    console.log("Koraci: check | migrate | role | verify | urls | all");
  }
} catch (error) {
  // Poruka drajvera može nositi deo adrese; ispisuje se samo kod i naša poruka.
  const e = error as { code?: string; message?: string };
  console.error(`Neuspeh (${step}): ${e.code ? `kod ${e.code}` : e.message}`);
  process.exitCode = 1;
}
