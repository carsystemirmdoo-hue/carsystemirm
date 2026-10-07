import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDatabase>;

type PoolClient = ReturnType<typeof postgres>;

function createClient(connectionString: string): PoolClient {
  return postgres(connectionString, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idle_timeout: 20,
    prepare: false,
  });
}

function createDatabase(client: PoolClient) {
  return drizzle(client, { schema });
}

/**
 * Jedan pool po procesu, U SVIM OKRUŽENJIMA.
 *
 * Ranije se instanca čuvala samo kada `NODE_ENV !== "production"`, pa je u
 * produkciji SVAKI poziv `getDb()` otvarao nov pool (do `DATABASE_POOL_MAX`
 * veza, zatvaranih tek posle 20 s mirovanja). Portal stranica zove više
 * servisa odjednom, i `next start` je posle desetak stranica iscrpeo
 * `max_connections` (`53300 too many clients`). Na Vercelu isto važi po
 * instanci funkcije.
 *
 * `globalThis` umesto promenljive modula: u razvoju Next.js ponovo učitava
 * module, a pool mora preživeti to učitavanje. Ključ `carsystemDb` koristi i
 * integracioni harness (`db/integration/harness.mts`) da podmetne svoju
 * instancu — zato se ne menja.
 */
const globalForDb = globalThis as unknown as {
  carsystemDb?: Database;
  carsystemDbClient?: PoolClient;
  carsystemDirectDb?: Database;
  carsystemDirectDbClient?: PoolClient;
};

/**
 * Konekcija se otvara tek pri prvom upitu. Bez ovoga bi `next build` i `tsc`
 * pucali na mašinama koje nemaju DATABASE_URL, a build ne dodiruje bazu.
 */
export function getDb(): Database {
  if (globalForDb.carsystemDb) return globalForDb.carsystemDb;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL nije podešen. Pogledajte .env.example i docs/portal/SETUP.md.",
    );
  }

  const client = createClient(connectionString);
  const db = createDatabase(client);
  globalForDb.carsystemDb = db;
  globalForDb.carsystemDbClient = client;
  return db;
}

/**
 * Adresa direktne veze, ili `null` kada je ne treba otvarati posebno.
 *
 * Čista funkcija nad promenljivim okruženja, da bi bila proveriva bez baze.
 * `null` znači „koristi `getDb()`": promenljiva nije postavljena, ili je ista
 * kao `DATABASE_URL` (tada je i glavna veza već direktna).
 */
export function directConnectionString(env: {
  DATABASE_URL?: string;
  DATABASE_DIRECT_URL?: string;
}): string | null {
  const direct = env.DATABASE_DIRECT_URL?.trim();
  if (!direct) return null;
  if (direct === env.DATABASE_URL?.trim()) return null;
  return direct;
}

/**
 * Direktna veza (bez spojnice/pooler-a) za radnje kojima transaction pooler
 * nije dovoljan — danas samo zaštita poslednjeg naloga Vlasnika
 * (`withOwnerGuard`, `pg_advisory_xact_lock` + provera u `pg_locks`).
 *
 * `DATABASE_URL` na Vercelu treba da bude pooled adresa (mnogo kratkih
 * funkcija), a `DATABASE_DIRECT_URL` direktna adresa iste baze, sa istom
 * runtime ulogom. Bez nje se koristi `getDb()`; ako je tada glavna veza
 * pooled, `withOwnerGuard` to otkrije i ODBIJE radnju — nikad je ne izvrši bez
 * zaštite. Pool je namerno mali: ove radnje su retke.
 */
export function getDirectDb(): Database {
  const connectionString = directConnectionString({
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_DIRECT_URL: process.env.DATABASE_DIRECT_URL,
  });
  if (!connectionString) return getDb();
  if (globalForDb.carsystemDirectDb) return globalForDb.carsystemDirectDb;

  const client = postgres(connectionString, {
    max: Number(process.env.DATABASE_DIRECT_POOL_MAX ?? 2),
    idle_timeout: 20,
    prepare: false,
  });
  const db = createDatabase(client);
  globalForDb.carsystemDirectDb = db;
  globalForDb.carsystemDirectDbClient = client;
  return db;
}

/**
 * Zatvara pool i briše keš, pa sledeći `getDb()` pravi nov.
 *
 * Za skripte, testove i gašenje procesa. Aplikacija ga ne zove po zahtevu —
 * pool živi koliko i proces. Upiti u toku dobijaju `timeoutSeconds` da se
 * završe pre prekida veza.
 *
 * Instancu koju je podmetnuo neko drugi (harness) ne zatvara: nije je ni
 * otvorio, i njen vlasnik je zatvara sam.
 */
export async function closeDb(timeoutSeconds = 5): Promise<void> {
  const direct = globalForDb.carsystemDirectDbClient;
  if (direct) {
    delete globalForDb.carsystemDirectDb;
    delete globalForDb.carsystemDirectDbClient;
    await direct.end({ timeout: timeoutSeconds });
  }
  const client = globalForDb.carsystemDbClient;
  if (!client) return;
  delete globalForDb.carsystemDb;
  delete globalForDb.carsystemDbClient;
  await client.end({ timeout: timeoutSeconds });
}

export { schema };
