import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Zaštita poslednjeg Vlasnika ide direktnom vezom (`DATABASE_DIRECT_URL`).
 *
 * `withOwnerGuard` drži `pg_advisory_xact_lock` i proverava ga u `pg_locks`;
 * iza transaction pooler-a ta provera odbija radnju. Odluka 2026-10-01:
 * posebna direktna veza SAMO za te radnje, ostatak aplikacije ide kroz pooler.
 */

const root = new URL("../../", import.meta.url);
const code = (rel) =>
  readFileSync(new URL(rel, root), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

/** Kopija pravila iz `db/client.ts` (TS fajl se ne uvozi u `node --test`); test ispod proverava da su iste. */
function directConnectionString(env) {
  const direct = env.DATABASE_DIRECT_URL?.trim();
  if (!direct) return null;
  if (direct === env.DATABASE_URL?.trim()) return null;
  return direct;
}

test("izbor veze: posebna samo kada je zadata i različita od glavne", () => {
  assert.equal(directConnectionString({ DATABASE_URL: "postgres://a" }), null);
  assert.equal(directConnectionString({ DATABASE_URL: "postgres://a", DATABASE_DIRECT_URL: " " }), null);
  assert.equal(directConnectionString({ DATABASE_URL: "postgres://a", DATABASE_DIRECT_URL: "postgres://a" }), null);
  assert.equal(directConnectionString({ DATABASE_URL: "postgres://p", DATABASE_DIRECT_URL: "postgres://d" }), "postgres://d");
});

test("pravilo u db/client.ts je isto kao ovde", () => {
  const client = code("db/client.ts");
  assert.match(client, /const direct = env\.DATABASE_DIRECT_URL\?\.trim\(\);\s*if \(!direct\) return null;\s*if \(direct === env\.DATABASE_URL\?\.trim\(\)\) return null;\s*return direct;/);
  assert.match(client, /export function getDirectDb\(\): Database \{\s*const connectionString = directConnectionString\(/);
  assert.match(client, /if \(!connectionString\) return getDb\(\);/);
});

test("withOwnerGuard otvara transakciju direktnom vezom i zadržava proveru brave", () => {
  const guard = code("lib/authz/security-admin.ts");
  const fn = guard.slice(guard.indexOf("export async function withOwnerGuard"));
  assert.match(fn, /return getDirectDb\(\)\.transaction\(/);
  assert.match(fn, /pg_advisory_xact_lock/);
  assert.match(fn, /pid = pg_backend_pid\(\)/);
});

test("integracioni harness briše DATABASE_DIRECT_URL pre ijednog testa", () => {
  const harness = code("db/integration/harness.mts");
  const set = harness.indexOf("process.env.DATABASE_URL = url;");
  const del = harness.indexOf("delete process.env.DATABASE_DIRECT_URL;");
  assert.ok(set > 0 && del > set);
});
