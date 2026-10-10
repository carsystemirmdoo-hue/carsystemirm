import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

/**
 * Statička provera `runtime-role.sql` naspram migracija, bez baze.
 *
 * Regresija: skripta je davala prava ručnim spiskom od 18 tabela iz
 * migracija 0000–0007. Svaka kasnija tabela (nalozi kupaca, cene, izvorni
 * dokumenti, preporuke…) ostajala je bez prava čim bi se skripta primenila,
 * a tabele samo za dodavanje iz 0014 i 0025 nisu bile zaštićene na nivou
 * uloge. Integraciona provera nad stvarnom bazom je u
 * `db/integration/runtimeRole.integration.test.mts`.
 */

const script = readFileSync(new URL("./runtime-role.sql", import.meta.url), "utf8");
const migrationsDir = new URL("../migrations/", import.meta.url);

/** Izvršni deo skripte — bez komentara, da primer iz komentara ne prođe kao naredba. */
const statements = script
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

/**
 * Tabele čiji okidač dozvoljava OGRANIČENU izmenu, pa uloga zadržava UPDATE:
 *  - potvrda kontakta: samo opoziv određenih kolona (0028);
 *  - zapis naknadnog storna: prelaz stanja, bez promene odštampane reference (0033);
 *  - otpremanje cenovnika: jednokratna odluka, podaci fajla se ne menjaju (0038).
 * DELETE im se i dalje oduzima.
 */
const REVOCATION_ONLY = new Set(["customer_contact_verifications", "invoice_reversals", "price_list_imports", "customer_payment_options"]);

function guardedTables() {
  /** @type {Map<string, Set<string>>} */
  const guarded = new Map();
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(new URL(file, migrationsDir), "utf8");
    const re = /CREATE TRIGGER\s+"?\w+"?\s+BEFORE\s+([A-Z ]+?)\s+ON\s+"?(\w+)"?/gi;
    for (const match of sql.matchAll(re)) {
      const events = match[1].toUpperCase().split(/\s+OR\s+/).map((e) => e.trim());
      const table = match[2];
      const set = guarded.get(table) ?? new Set();
      for (const event of events) set.add(event);
      guarded.set(table, set);
    }
  }
  return guarded;
}

/** Tabele pomenute u REVOKE naredbama koje oduzimaju dato pravo. */
function revokedFor(privilege) {
  const tables = new Set();
  for (const match of statements.matchAll(/REVOKE\s+([^;]*?)\s+ON\s+([^;]*?)\s+FROM\s+:runtime_role\s*;/gis)) {
    const privileges = match[1].toUpperCase();
    if (!privileges.includes(privilege) && !/\bALL\b/.test(privileges)) continue;
    for (const name of match[2].split(",")) tables.add(name.trim());
  }
  return tables;
}

test("prava se daju nad svim tabelama šeme, ne ručnim spiskom", () => {
  assert.match(
    statements,
    /GRANT\s+SELECT,\s*INSERT,\s*UPDATE,\s*DELETE\s+ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+public\s+TO\s+:runtime_role/i,
  );
});

test("svaka tabela sa okidačem protiv brisanja gubi DELETE na nivou uloge", () => {
  const revoked = revokedFor("DELETE");
  const guarded = guardedTables();
  assert.ok(guarded.size >= 4, "očekivane su bar četiri zaštićene tabele");
  for (const [table, events] of guarded) {
    if (!events.has("DELETE")) continue;
    assert.ok(revoked.has(table), `${table}: okidač odbija DELETE, a uloga ga i dalje ima`);
  }
});

test("svaka tabela samo za dodavanje gubi UPDATE na nivou uloge", () => {
  const revoked = revokedFor("UPDATE");
  for (const [table, events] of guardedTables()) {
    if (!events.has("UPDATE") || REVOCATION_ONLY.has(table)) continue;
    assert.ok(revoked.has(table), `${table}: okidač odbija UPDATE, a uloga ga i dalje ima`);
  }
});

test("tabela samo za opoziv zadržava UPDATE (opoziv je izmena)", () => {
  for (const table of REVOCATION_ONLY) {
    assert.ok(!revokedFor("UPDATE").has(table), `${table}: opoziv mora ostati moguć`);
    assert.ok(revokedFor("DELETE").has(table), `${table}: brisanje mora biti oduzeto`);
  }
});

test("ograničenja dolaze POSLE opšteg GRANT-a, da ga suze", () => {
  const grantAt = statements.search(/GRANT\s+SELECT,\s*INSERT,\s*UPDATE,\s*DELETE\s+ON\s+ALL\s+TABLES/i);
  const revokeAt = statements.search(/REVOKE\s+UPDATE,\s*DELETE,\s*TRUNCATE\s+ON\s+audit_log/i);
  assert.ok(grantAt >= 0 && revokeAt > grantAt);
});

test("nijedna naredba ne daje TRUNCATE ni CREATE", () => {
  assert.ok(!/GRANT[^;]*TRUNCATE/i.test(statements));
  assert.ok(!/GRANT[^;]*\bCREATE\b/i.test(statements));
});

test("nepostojeća uloga zaustavlja skriptu umesto tihe napomene", () => {
  assert.match(statements, /set_config\('my\.runtime_role',\s*:'runtime_role'/);
  assert.match(statements, /RAISE EXCEPTION 'Uloga % ne postoji/);
});
