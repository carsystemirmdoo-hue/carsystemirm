import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import postgres from "postgres";
import { evaluateTestTarget } from "./safety.mjs";
import { skipReason } from "./harness.mts";

/**
 * `getDb()` u PRODUKCIONOM režimu: jedan pool po procesu, i zatvaranje.
 *
 * Regresija: u produkciji je svaki `getDb()` otvarao nov pool. Integracioni
 * testovi to nikad nisu videli jer ne rade sa `NODE_ENV=production`, a
 * harness ionako podmeće svoju instancu. Ovaj fajl zato NE zove
 * `initTestDatabase()` — koristi pravi `db/client.ts`, i broji stvarne veze
 * u `pg_stat_activity` preko zasebnog posmatrača.
 *
 * Svaki test fajl radi u sopstvenom procesu (`--test-concurrency=1`), pa
 * `NODE_ENV` i `globalThis` ovde ne diraju druge fajlove.
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => {
  if (reason) {
    t.skip(reason);
    return true;
  }
  return false;
};

const POOL_MAX = 3;
const OBSERVER_APP = "carsystem-pool-observer";
let observer: ReturnType<typeof postgres> | null = null;

/** Veze ove baze koje nisu posmatrač — dakle veze aplikacionog pool-a. */
async function appConnections(): Promise<number> {
  const [row] = await observer!<{ n: number }[]>`
    SELECT count(*)::int AS n FROM pg_stat_activity
     WHERE datname = current_database()
       AND pid <> pg_backend_pid()
       AND application_name <> ${OBSERVER_APP}
       AND backend_type = 'client backend'`;
  return row.n;
}

async function waitFor(check: () => Promise<boolean>, ms = 5000): Promise<boolean> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await check()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return check();
}

before(async () => {
  if (reason) return;
  const url = process.env.TEST_DATABASE_URL!;
  const decision = evaluateTestTarget({
    testUrl: url,
    databaseUrl: process.env.DATABASE_URL,
    migrationUrl: process.env.MIGRATION_DATABASE_URL,
    vercelEnv: process.env.VERCEL_ENV,
  });
  if (!decision.ok) throw new Error(`test meta odbijena: ${decision.reason}`);

  observer = postgres(url, {
    max: 1,
    onnotice: () => {},
    connection: { application_name: OBSERVER_APP },
  });
  // Tek posle kapije: proizvodni klijent gađa test bazu, u produkcionom režimu.
  process.env.DATABASE_URL = url;
  process.env.DATABASE_POOL_MAX = String(POOL_MAX);
  (process.env as Record<string, string>).NODE_ENV = "production";
});

after(async () => {
  if (reason) return;
  const { closeDb } = await import("@/db/client");
  await closeDb();
  await observer?.end();
});

test("produkcija: getDb() vraća istu instancu pri svakom pozivu", async (t) => {
  if (guard(t)) return;
  const { getDb } = await import("@/db/client");
  const first = getDb();
  for (let i = 0; i < 50; i += 1) assert.equal(getDb(), first);
});

test("produkcija: 40 paralelnih upita kroz getDb() ne prelazi DATABASE_POOL_MAX veza", async (t) => {
  if (guard(t)) return;
  const { getDb } = await import("@/db/client");
  const { sql } = await import("drizzle-orm");

  // Svaki upit ponovo zove getDb(), kao što to rade servisi portala.
  await Promise.all(
    Array.from({ length: 40 }, () => getDb().execute(sql`SELECT pg_sleep(0.05)`)),
  );
  const open = await appConnections();
  assert.ok(open >= 1, "pool nije otvorio nijednu vezu");
  assert.ok(open <= POOL_MAX, `otvoreno ${open} veza, a pool sme najviše ${POOL_MAX}`);
});

test("closeDb() zatvara sve veze, a sledeći getDb() otvara nov, ispravan pool", async (t) => {
  if (guard(t)) return;
  const { getDb, closeDb } = await import("@/db/client");
  const { sql } = await import("drizzle-orm");
  const before = getDb();
  await before.execute(sql`SELECT 1`);
  assert.ok((await appConnections()) >= 1);

  await closeDb();
  assert.ok(await waitFor(async () => (await appConnections()) === 0), "veze su ostale otvorene");

  const next = getDb();
  assert.notEqual(next, before, "posle zatvaranja mora nastati nova instanca");
  const [row] = await next.execute<{ ok: number }>(sql`SELECT 1 AS ok`);
  assert.equal(row.ok, 1);

  await closeDb();
  await closeDb(); // drugi poziv je bezopasan
  assert.ok(await waitFor(async () => (await appConnections()) === 0));
});

test("closeDb() ne zatvara instancu koju je podmetnuo neko drugi", async (t) => {
  if (guard(t)) return;
  const { getDb, closeDb } = await import("@/db/client");
  const planted = { planted: true } as unknown as ReturnType<typeof getDb>;
  const g = globalThis as unknown as { carsystemDb?: unknown };
  g.carsystemDb = planted;
  try {
    await closeDb();
    assert.equal(getDb(), planted, "tuđa instanca je uklonjena");
  } finally {
    delete g.carsystemDb;
  }
});
