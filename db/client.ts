import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDatabase>;

function createDatabase(connectionString: string) {
  const client = postgres(connectionString, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idle_timeout: 20,
    prepare: false,
  });
  return drizzle(client, { schema });
}

const globalForDb = globalThis as unknown as {
  carsystemDb?: ReturnType<typeof createDatabase>;
};

/**
 * Konekcija se otvara tek pri prvom upitu. Bez ovoga bi `next build` i `tsc`
 * pucali na mašinama koje nemaju DATABASE_URL, a build ne dodiruje bazu.
 */
export function getDb() {
  if (globalForDb.carsystemDb) return globalForDb.carsystemDb;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL nije podešen. Pogledajte .env.example i docs/portal/SETUP.md.",
    );
  }

  const db = createDatabase(connectionString);
  // U razvoju Next.js često reinicijalizuje module; bez keša bi se otvarao novi pool.
  if (process.env.NODE_ENV !== "production") globalForDb.carsystemDb = db;
  return db;
}

export { schema };
