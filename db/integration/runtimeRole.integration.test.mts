import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import { closeTestDatabase, initTestDatabase, QA_PREFIX, skipReason, type TestDatabase } from "./harness.mts";

/**
 * `db/provisioning/runtime-role.sql` primenjen na stvarnu, migriranu bazu.
 *
 * Regresija: skripta je davala prava samo nad 18 tabela iz 0000–0007, pa bi
 * aplikacija posle primene ostala bez pristupa svemu iz 0008 i kasnije.
 * Statička strana iste provere je u `db/provisioning/runtimeRole.test.mjs`.
 *
 * Uloga je jednokratna (`QA_PREFIX` + nasumičan sufiks), bez prava prijave,
 * i briše se na kraju zajedno sa svim pravima i podrazumevanim pravima
 * (`DROP OWNED BY`).
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => {
  if (reason) {
    t.skip(reason);
    return true;
  }
  return false;
};

const APPEND_ONLY = ["audit_log", "customer_contact_consents", "sync_command_events"];
/** Ograničena izmena (opoziv 0028, prelaz stanja storna 0033): UPDATE ostaje, DELETE ne. */
const REVOCATION_ONLY = ["customer_contact_verifications", "invoice_reversals"];

let db: TestDatabase;
/** Prava PUBLIC nad šemom pre primene skripte (skripta ih oduzima). */
let publicSchemaAcl: { usage: boolean; create: boolean } = { usage: false, create: false };
const role = `${QA_PREFIX}_app_${randomBytes(4).toString("hex")}`;

/** Skripta prilagođena izvršavanju bez psql-a: psql promenljive postaju vrednosti. */
async function provisioningFor(roleName: string): Promise<string> {
  const source = await readFile(new URL("../provisioning/runtime-role.sql", import.meta.url), "utf8");
  return source
    .split("\n")
    .filter((line) => !line.startsWith("\\set"))
    .join("\n")
    .replaceAll(":'runtime_role'", `'${roleName}'`)
    .replaceAll(":runtime_role", `"${roleName}"`);
}

before(async () => {
  if (reason) return;
  db = await initTestDatabase();
  const [row] = await db.sql<{ acl: string | null }[]>`
    SELECT nspacl::text AS acl FROM pg_namespace WHERE nspname = 'public'`;
  // Stavka bez imena uloge pre `=` je PUBLIC, npr. `=U/pg_database_owner`.
  const entry = (row.acl ?? "").replace(/[{}]/g, "").split(",").find((e) => e.startsWith("="));
  const rights = entry ? entry.slice(1).split("/")[0] : "";
  publicSchemaAcl = { usage: rights.includes("U"), create: rights.includes("C") };
});

after(async () => {
  if (reason || !db) return;
  const exists = await db.sql`SELECT 1 FROM pg_roles WHERE rolname = ${role}`;
  if (exists.length) {
    await db.sql.unsafe(`DROP OWNED BY "${role}"`);
    await db.sql.unsafe(`DROP ROLE "${role}"`);
  }
  // Skripta oduzima prava PUBLIC nad šemom; test baza se vraća u zatečeno stanje.
  if (publicSchemaAcl.usage) await db.sql.unsafe("GRANT USAGE ON SCHEMA public TO PUBLIC");
  if (publicSchemaAcl.create) await db.sql.unsafe("GRANT CREATE ON SCHEMA public TO PUBLIC");
});

// Otvoren pool drži proces živim posle poslednjeg testa.
after(async () => {
  await closeTestDatabase();
});

test("skripta odbija nepostojeću ulogu", async (t) => {
  if (guard(t)) return;
  const missing = `${QA_PREFIX}_missing_${randomBytes(4).toString("hex")}`;
  await assert.rejects(db.sql.unsafe(await provisioningFor(missing)), /ne postoji/);
});

test("posle primene uloga ima prava nad SVAKOM tabelom i view-om šeme", async (t) => {
  if (guard(t)) return;
  await db.sql.unsafe(`CREATE ROLE "${role}" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE`);
  await db.sql.unsafe(await provisioningFor(role));

  const relations = await db.sql<{ name: string; kind: string }[]>`
    SELECT table_name AS name, table_type AS kind
      FROM information_schema.tables
     WHERE table_schema = 'public'
     ORDER BY table_name`;
  assert.ok(relations.length >= 40, `očekivano bar 40 relacija, nađeno ${relations.length}`);
  assert.ok(relations.some((r) => r.name === "effective_sales_ledger"), "view ledger-a mora postojati");

  const missing: string[] = [];
  for (const { name, kind } of relations) {
    const [row] = await db.sql<{ sel: boolean; ins: boolean; upd: boolean; del: boolean; trn: boolean }[]>`
      SELECT has_table_privilege(${role}, ${`public.${name}`}, 'SELECT')   AS sel,
             has_table_privilege(${role}, ${`public.${name}`}, 'INSERT')   AS ins,
             has_table_privilege(${role}, ${`public.${name}`}, 'UPDATE')   AS upd,
             has_table_privilege(${role}, ${`public.${name}`}, 'DELETE')   AS del,
             has_table_privilege(${role}, ${`public.${name}`}, 'TRUNCATE') AS trn`;
    if (!row.sel) missing.push(`${name}: SELECT`);
    assert.equal(row.trn, false, `${name}: TRUNCATE ne sme postojati`);
    if (kind !== "BASE TABLE") continue;
    if (!row.ins) missing.push(`${name}: INSERT`);
    if (APPEND_ONLY.includes(name)) {
      assert.equal(row.upd, false, `${name}: UPDATE mora biti oduzet`);
      assert.equal(row.del, false, `${name}: DELETE mora biti oduzet`);
    } else if (REVOCATION_ONLY.includes(name)) {
      assert.equal(row.upd, true, `${name}: opoziv traži UPDATE`);
      assert.equal(row.del, false, `${name}: DELETE mora biti oduzet`);
    } else {
      if (!row.upd) missing.push(`${name}: UPDATE`);
      if (!row.del) missing.push(`${name}: DELETE`);
    }
  }
  assert.deepEqual(missing, [], "uloga je bez potrebnih prava");

  const [schema] = await db.sql<{ create: boolean; usage: boolean }[]>`
    SELECT has_schema_privilege(${role}, 'public', 'CREATE') AS create,
           has_schema_privilege(${role}, 'public', 'USAGE')  AS usage`;
  assert.equal(schema.create, false);
  assert.equal(schema.usage, true);
});

test("pod ulogom: čitanje radi, brisanje traga revizije je odbijeno", async (t) => {
  if (guard(t)) return;
  await db.sql.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL ROLE "${role}"`);
    await tx.unsafe("SELECT count(*) FROM recommendation_results");
    await tx.unsafe("SELECT count(*) FROM effective_sales_ledger");
    // `savepoint` vraća transakciju u ispravno stanje posle odbijene naredbe.
    await assert.rejects(
      tx.savepoint((sp) => sp.unsafe("DELETE FROM audit_log WHERE false")),
      (error: { code?: string }) => {
        assert.equal(error.code, "42501");
        return true;
      },
    );
    // Posle odbijanja ista transakcija i dalje čita.
    await tx.unsafe("SELECT count(*) FROM audit_log");
  });
});
