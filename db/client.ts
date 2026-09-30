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
  const client = globalForDb.carsystemDbClient;
  if (!client) return;
  delete globalForDb.carsystemDb;
  delete globalForDb.carsystemDbClient;
  await client.end({ timeout: timeoutSeconds });
}

export { schema };
