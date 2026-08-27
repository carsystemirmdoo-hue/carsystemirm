import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after } from "node:test";
import { closeTestDatabase, initTestDatabase, skipReason } from "./harness.mts";

/**
 * Stanje šeme posle celog lanca migracija.
 *
 * Pretpostavka: `npm run qa:pg:migrate` je već izvršen nad istom bazom. Ovi
 * testovi ne primenjuju migracije — oni proveravaju ISHOD, uključujući ono što
 * migracija lako propusti: strane ključeve, jedinstvene indekse i `NOT NULL`.
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => {
  if (reason) {
    t.skip(reason);
    return true;
  }
  return false;
};

after(async () => {
  await closeTestDatabase();
});

test("ceo lanac migracija je zabelezen, u pravilnom redosledu", async (t) => {
  if (guard(t)) return;
  const db = await initTestDatabase();

  const journal = JSON.parse(
    await readFile(new URL("../migrations/meta/_journal.json", import.meta.url), "utf8"),
  ) as { entries: { idx: number; tag: string }[] };

  const applied = await db.sql<{ hash: string; created_at: string }[]>`
    SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at
  `;

  assert.equal(
    applied.length,
    journal.entries.length,
    `journal ima ${journal.entries.length} migracija, baza ${applied.length}`,
  );

  // Migracije 0004, 0005 i 0006 su one koje nose bezbednosnu shemu.
  for (const tag of [
    "0004_auth_hardening",
    "0005_mfa_enrollment_grants",
    "0006_account_security_package",
  ]) {
    assert.ok(
      journal.entries.some((e) => e.tag === tag),
      `nedostaje ${tag} u journalu`,
    );
  }
  // Redosled u journalu mora biti rastući po `idx`.
  const idxs = journal.entries.map((e) => e.idx);
  assert.deepEqual(idxs, [...idxs].sort((a, b) => a - b));
});

test("ponovno pokretanje migracija ne menja nista", async (t) => {
  if (guard(t)) return;
  const db = await initTestDatabase();

  const [{ count: pre }] = await db.sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations
  `;

  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  await migrate(drizzle(db.sql), { migrationsFolder: "./db/migrations" });

  const [{ count: post }] = await db.sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations
  `;
  assert.equal(post, pre, "ponovno pokretanje je dodalo migracije");
});

test("sve bezbednosne tabele postoje", async (t) => {
  if (guard(t)) return;
  const db = await initTestDatabase();

  const rows = await db.sql<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `;
  const present = new Set(rows.map((r) => r.table_name));

  for (const table of [
    "users",
    "user_permissions",
    "permission_packages",
    "user_mfa",
    "mfa_recovery_codes",
    "mfa_enrollment_grants",
    "password_reset_codes",
    "auth_rate_limits",
    "audit_log",
  ]) {
    assert.ok(present.has(table), `nedostaje tabela ${table}`);
  }
});

test("session_version postoji, nije NULL i podrazumevano je nula", async (t) => {
  if (guard(t)) return;
  const db = await initTestDatabase();

  const [col] = await db.sql<
    { data_type: string; is_nullable: string; column_default: string }[]
  >`
    SELECT data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'session_version'
  `;
  assert.ok(col, "kolona session_version ne postoji");
  assert.equal(col.is_nullable, "NO");
  assert.match(col.column_default, /^0/);
});

test("jedinstveni indeksi na otiscima kodova postoje", async (t) => {
  if (guard(t)) return;
  const db = await initTestDatabase();

  const rows = await db.sql<{ indexname: string; indexdef: string }[]>`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN ('password_reset_codes', 'mfa_enrollment_grants', 'mfa_recovery_codes')
  `;

  // Otisak reset koda mora biti jedinstven: isti otisak u dva reda značio bi da
  // jedan kod otvara dva naloga.
  const unique = rows.filter((r) => /UNIQUE/i.test(r.indexdef)).map((r) => r.indexname);
  assert.ok(
    unique.some((n) => n.includes("password_reset_codes")),
    `nema jedinstvenog indeksa na otisku reset koda: ${unique.join(", ")}`,
  );
});

test("strani kljucevi vezuju kodove za korisnika, sa kaskadnim brisanjem", async (t) => {
  if (guard(t)) return;
  const db = await initTestDatabase();

  const rows = await db.sql<
    { table_name: string; delete_rule: string; column_name: string }[]
  >`
    SELECT tc.table_name, rc.delete_rule, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
  `;

  for (const table of [
    "user_mfa",
    "mfa_recovery_codes",
    "mfa_enrollment_grants",
    "password_reset_codes",
  ]) {
    const fk = rows.find((r) => r.table_name === table && r.column_name === "user_id");
    assert.ok(fk, `${table} nema strani ključ na user_id`);
    assert.equal(
      fk.delete_rule,
      "CASCADE",
      `${table}.user_id ne briše se sa korisnikom — kodovi bi nadživeli nalog`,
    );
  }

  // Paket dozvola mora postojati pre dodele; zato RESTRICT, ne CASCADE.
  const paket = rows.find(
    (r) => r.table_name === "user_permissions" && r.column_name === "permission_key",
  );
  assert.ok(paket, "user_permissions nema strani ključ na permission_key");
  assert.equal(paket.delete_rule, "RESTRICT");
});

test("paket bezbednosti naloga je stvarno u bazi", async (t) => {
  if (guard(t)) return;
  const db = await initTestDatabase();

  const [row] = await db.sql<{ key: string; name: string }[]>`
    SELECT key, name FROM permission_packages WHERE key = 'bezbednost_naloga'
  `;
  // Bez ovog reda dodela paketa pada na strani ključ.
  assert.ok(row, "migracija 0006 nije unela paket");
  assert.equal(row.name, "Bezbednost naloga");
});

test("audit log odbija izmenu i brisanje", async (t) => {
  if (guard(t)) return;
  const db = await initTestDatabase();

  const triggers = await db.sql<{ tgname: string }[]>`
    SELECT tgname FROM pg_trigger
    WHERE tgrelid = 'audit_log'::regclass AND NOT tgisinternal
  `;
  const names = triggers.map((t2) => t2.tgname);
  assert.ok(names.some((n) => /update/i.test(n)), `nema okidača protiv UPDATE: ${names}`);
  assert.ok(names.some((n) => /delete/i.test(n)), `nema okidača protiv DELETE: ${names}`);
});
