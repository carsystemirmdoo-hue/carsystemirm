import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import postgres from "postgres";

/**
 * Izvor i probna baza sa RAZLIČITIM collation-om (Neon vs Postgres na GitHub
 * runneru). Kontrolni zbir sadržaja ne sme da zavisi od toga: prvi stvarni
 * prolaz 2026-10-09 je pao jer je `ORDER BY` pratio collation baze.
 * Traži lokalni Postgres: BACKUP_TEST_ADMIN_URL (127.0.0.1).
 */
const ADMIN = process.env.BACKUP_TEST_ADMIN_URL;
const skip = !ADMIN || !/@(127\.0\.0\.1|localhost):/.test(ADMIN) ? "nema lokalnog BACKUP_TEST_ADMIN_URL" : false;
const TOOL = new URL("./db-backup.mjs", import.meta.url).pathname;

test("kontrolni zbir je isti kada izvor i probna baza imaju različit collation", { skip, timeout: 120000 }, async () => {
  const admin = postgres(ADMIN, { max: 1, onnotice: () => {} });
  const ime = `collation_izvor_${Date.now()}`;
  const out = mkdtempSync(join(tmpdir(), "collation-"));
  try {
    // ICU en-US sa ka-shifted zanemaruje interpunkciju kao glibc en_US na Linux runneru; probna baza ostaje na
    // podrazumevanom collation-u klastera. macOS libc en_US.UTF-8 sortira po bajtovima i ne bi ništa dokazao.
    await admin.unsafe(`CREATE DATABASE "${ime}" TEMPLATE template0 ENCODING 'UTF8' LOCALE_PROVIDER icu ICU_LOCALE 'en-US-u-ka-shifted' LOCALE 'C'`);
    const src = new URL(ADMIN);
    src.pathname = `/${ime}`;
    const s = postgres(src.toString(), { max: 1, onnotice: () => {} });
    await s.unsafe(`CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint);
      CREATE TABLE public.recenice (id serial PRIMARY KEY, tekst text);
      CREATE VIEW public.effective_sales_ledger AS SELECT 1::int AS invoice_id, date '2026-01-01' AS issued_on, 1.0::numeric AS line_amount, true AS enters_net;
      INSERT INTO drizzle.__drizzle_migrations(hash, created_at) VALUES ('b', 1), ('A', 2), ('_z', 3), ('a', 4);
      INSERT INTO public.recenice(tekst) VALUES ('Žika'), ('zeka'), ('Ana'), ('ana'), ('_test'), ('Zoran'), ('éclair'), ('10'), ('9');
      -- Više od 9 redova: tekst reda počinje sa „(id,“, a ICU zanemaruje zagrade i zareze,
      -- pa se redosled „(1,“ / „(10,“ razlikuje od bajtovnog — kao 37 migracija na Neon-u.
      INSERT INTO drizzle.__drizzle_migrations(hash, created_at) SELECT md5(g::text), g FROM generate_series(5, 40) g;
      INSERT INTO public.recenice(tekst) SELECT 'Red ' || g FROM generate_series(10, 40) g;`);
    await s.end();
    const env = { ...process.env, SOURCE_DATABASE_URL: src.toString(), RESTORE_ADMIN_URL: ADMIN };
    assert.equal(spawnSync(process.execPath, [TOOL, "dump", "--out", out, "--label", "collation"], { env }).status, 0);
    const base = join(out, readdirSync(out).find((f) => f.endsWith(".dump")).replace(/\.dump$/, ""));
    const v = spawnSync(process.execPath, [TOOL, "verify", "--dump", `${base}.dump`, "--manifest", `${base}.manifest.json`], { env, encoding: "utf8" });
    assert.equal(v.status, 0, `vraćanje nije prošlo uz drugi collation: ${v.stdout}`);
  } finally {
    await admin.unsafe(`DROP DATABASE IF EXISTS "${ime}" WITH (FORCE)`).catch(() => {});
    await admin.end();
    rmSync(out, { recursive: true, force: true });
  }
});
