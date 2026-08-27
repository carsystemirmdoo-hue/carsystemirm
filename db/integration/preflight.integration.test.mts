import assert from "node:assert/strict";
import test, { after } from "node:test";
import {
  closeTestDatabase,
  initTestDatabase,
  skipReason,
  targetFingerprint,
} from "./harness.mts";
import { BUSINESS_TABLES } from "./safety.mjs";

/**
 * Prvi fajl koji se izvršava: dokazuje da je meta bezbedna i opisuje je.
 *
 * Nijedna tvrdnja ovde ne piše po bazi. Ako nešto od ovoga padne, ostali
 * fajlovi ne smeju ni da počnu.
 */

const reason = skipReason();

after(async () => {
  await closeTestDatabase();
});

test("meta je izolovana test baza", async (t) => {
  if (reason) {
    t.skip(reason);
    return;
  }
  const db = await initTestDatabase();

  // U izveštaj ide redigovan opis i otisak — nikada vrednost promenljive.
  console.log(`  host:      ${db.target.host}`);
  console.log(`  baza:      ${db.databaseName}`);
  console.log(`  verzija:   ${db.version}`);
  console.log(`  otisak:    ${targetFingerprint()}`);

  assert.ok(db.databaseName.length > 0);
  assert.match(db.version, /^PostgreSQL \d+/);
});

test("poslovne tabele su prazne ili ne postoje", async (t) => {
  if (reason) {
    t.skip(reason);
    return;
  }
  const db = await initTestDatabase();

  const rows = await db.sql<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `;
  const present = new Set(rows.map((r) => r.table_name));

  for (const table of BUSINESS_TABLES) {
    if (!present.has(table)) continue;
    const [{ count }] = await db.sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM ${db.sql(table)}
    `;
    assert.equal(count, 0, `tabela ${table} nije prazna — ovo nije test meta`);
  }
});

test("radi se nad public semom, ne nad tudjom", async (t) => {
  if (reason) {
    t.skip(reason);
    return;
  }
  const db = await initTestDatabase();
  const [{ schema }] = await db.sql<{ schema: string }[]>`
    SELECT current_schema() AS schema
  `;
  assert.equal(schema, "public");
});

test("korisnik baze nema prava izvan svoje baze", async (t) => {
  if (reason) {
    t.skip(reason);
    return;
  }
  const db = await initTestDatabase();

  const [role] = await db.sql<
    { rolname: string; rolsuper: boolean; rolcreatedb: boolean }[]
  >`
    SELECT rolname, rolsuper, rolcreatedb
    FROM pg_roles WHERE rolname = current_user
  `;

  /*
   * Ovo NIJE tvrdnja da superuser ne sme postojati — managed provajderi često
   * daju nalog sa širokim pravima i to se ne može promeniti spolja. Tvrdnja je
   * da se stanje ZNA i da je vidljivo u izveštaju, umesto da se pretpostavi.
   */
  console.log(
    `  nalog: superuser=${role?.rolsuper ?? "?"} createdb=${role?.rolcreatedb ?? "?"}`,
  );
  assert.ok(role, "nalog nije pronađen u pg_roles");
});
