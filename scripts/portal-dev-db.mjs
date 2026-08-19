/**
 * Lokalna Postgres baza za razvoj i proveru, bez instalacije na sistem.
 *
 * Pokreće PGlite (Postgres preveden u WebAssembly) i izlaže ga na TCP portu
 * pravim Postgres protokolom, pa se aplikacija povezuje običnim DATABASE_URL-om
 * i ne zna razliku.
 *
 * Namenjeno isključivo razvoju. Produkcija koristi pravi Postgres
 * (Neon ili Supabase) — vidi docs/portal/SETUP.md.
 *
 *   node scripts/portal-dev-db.mjs
 *   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/postgres
 */

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const port = Number(process.env.PORTAL_DEV_DB_PORT ?? 55432);
const dataDir = process.env.PORTAL_DEV_DB_DIR ?? "./tmp/portal-dev-db";

const db = await PGlite.create({ dataDir });
const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1" });
await server.start();

console.log(
  `Razvojna baza radi na postgres://postgres:postgres@127.0.0.1:${port}/postgres`,
);
console.log(`Podaci: ${dataDir}`);

const stop = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
