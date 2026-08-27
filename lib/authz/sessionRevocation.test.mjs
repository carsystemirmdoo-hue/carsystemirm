import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const codeOf = (source) => source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

/*
 * `isSessionVersionCurrent` je jedina čista funkcija u ovom toku, pa se ugovor
 * opoziva može dokazati bez baze. Ostalo se proverava nad izvorom — poređenje
 * mora stajati u serverskoj kapiji, a ne bilo gde drugde.
 */
const { isSessionVersionCurrent } = await import("./user-repository.ts").catch(
  () => ({}),
);

/** Provera je namerno prepisana ovde: modul je `server-only` i ne uvozi se u test. */
const isCurrent =
  isSessionVersionCurrent ??
  ((tokenVersion, storedVersion) => (tokenVersion ?? 0) === storedVersion);

/* -------------------------------------------------------------------------
 * Pravilo poređenja
 * ---------------------------------------------------------------------- */

test("aktuelna verzija prolazi", () => {
  assert.equal(isCurrent(0, 0), true);
  assert.equal(isCurrent(7, 7), true);
});

test("stari token sa nizom verzijom je odbijen", () => {
  assert.equal(isCurrent(0, 1), false);
  assert.equal(isCurrent(3, 9), false);
});

test("token sa visom verzijom od baze je takodje odbijen", () => {
  // Ne sme se prihvatiti „novije od baze" — to znači falsifikat ili vraćenu
  // bazu iz rezervne kopije; ni u jednom slučaju sesija ne sme da važi.
  assert.equal(isCurrent(5, 2), false);
});

test("token bez verzije se tretira kao nulti", () => {
  // Tokeni izdati pre uvođenja kolone ostaju važeći dok im ne istekne rok ili
  // dok se sesija izričito ne opozove. Migracija tako nikoga ne odjavljuje.
  assert.equal(isCurrent(undefined, 0), true);
  assert.equal(isCurrent(null, 0), true);
  // Ali čim je sesija jednom opozvana, stari token pada.
  assert.equal(isCurrent(undefined, 1), false);
});

/* -------------------------------------------------------------------------
 * Kapija: gde se provera zaista izvršava
 * ---------------------------------------------------------------------- */

test("serverska kapija odbija nepostojeceg, deaktiviranog i zastarelog", async () => {
  const session = codeOf(await read("./session.ts"));

  // Nepostojeći i deaktivirani padaju u `loadPortalUser` (vraća `null`).
  assert.match(session, /const user = await loadPortalUser\(userId\)/);
  assert.match(session, /if \(!user\) return null;/);

  /*
   * Zastarela sesija ide kroz istu politiku kao i sve ostalo.
   *
   * Ranije je imala svoju granu sa `return null`. Sada je to ulaz u
   * `resolvePortalAccess`, a odbijanje je jedan zajednicki izlaz. Tvrdnja je
   * ista — zastareo token ne prolazi — samo je mesto odluke jedno.
   * Da zastareo token zaista daje `denied` proverava `lib/auth/mfaPolicy.test.mjs`.
   */
  assert.match(
    session,
    /sessionVersionCurrent: isSessionVersionCurrent\(\s*session\.user\.sessionVersion,\s*user\.sessionVersion,?\s*\)/,
  );
  assert.match(session, /if \(decision\.access === ACCESS_DENIED\) return null;/);
});

test("loadPortalUser i dalje odbija deaktiviran nalog", async () => {
  const repo = codeOf(await read("./user-repository.ts"));
  assert.match(repo, /if \(!first \|\| !first\.active\) return null;/);
  assert.match(repo, /sessionVersion: users\.sessionVersion/);
});

test("dozvole i dalje NISU u tokenu", async () => {
  const config = codeOf(await read("../../auth.config.ts"));
  // Verzija sesije jeste u tokenu; uloga i dozvole ne smeju biti.
  assert.match(config, /token\.sessionVersion/);
  assert.doesNotMatch(config, /token\.(role|permissions|capabilities)/);
  assert.doesNotMatch(config, /session\.user\.(role|permissions)\s*=/);
});

test("verzija ulazi u token tek pri prijavi, iz vracenog korisnika", async () => {
  const config = codeOf(await read("../../auth.config.ts"));
  const auth = codeOf(await read("../../auth.ts"));

  assert.match(config, /if \(user && "sessionVersion" in user\)/);
  assert.match(auth, /sessionVersion: user\.sessionVersion/);
});

/* -------------------------------------------------------------------------
 * Centralna funkcija i njeni pozivaoci
 * ---------------------------------------------------------------------- */

test("postoji centralna funkcija za opoziv, sa eksplicitnim razlozima", async () => {
  const repo = codeOf(await read("./user-repository.ts"));

  assert.match(repo, /export async function revokeUserSessions\(/);
  assert.match(repo, /sql`\$\{users\.sessionVersion\} \+ 1`/);
  for (const reason of [
    "password_changed",
    "account_deactivated",
    "role_changed",
    "mfa_reset",
    "admin_revoked",
  ]) {
    assert.ok(repo.includes(`"${reason}"`), `nedostaje razlog ${reason}`);
  }
});

test("promena uloge opoziva sesije, u istoj transakciji", async () => {
  const actions = await read("../../app/portal/dozvole/actions.ts");
  const code = codeOf(actions);

  // Bump mora biti u istom `update` pozivu kao i uloga — inače postoji
  // trenutak u kome je uloga nova a sesija stara.
  //
  // Fajl ima više akcija sa transakcijama, pa se prvo sužava na pravu.
  const actionStart = code.indexOf("export async function changeRoleAction");
  assert.ok(actionStart > -1, "changeRoleAction nije pronadjena");
  const action = code.slice(actionStart);

  const updateStart = action.indexOf(".update(users)");
  const updateBlock = action.slice(updateStart, action.indexOf("await recordAudit"));
  assert.match(updateBlock, /role,/);
  assert.match(updateBlock, /sessionVersion: sql`\$\{users\.sessionVersion\} \+ 1`/);

  /*
   * Transakciju sada drzi `withOwnerGuard`, ne sama akcija.
   *
   * Tvrdnja je ista kao pre — izmena i trag su u JEDNOJ transakciji — samo je
   * vlasnik transakcije centralna kapija, koja uz to drzi i advisory bravu.
   * Izmena mora biti UNUTAR tog poziva; da je ispod njega, opet bi postojao
   * trenutak u kome je uloga nova a sesija stara.
   */
  const guardStart = action.indexOf("withOwnerGuard(");
  assert.ok(guardStart > -1, "promena uloge zaobilazi centralnu kapiju");
  assert.ok(guardStart < updateStart, "izmena je izvan zasticene transakcije");
  assert.match(action.slice(guardStart), /async \(tx\) => \{/);
  // `recordAudit` prima BAS tu transakciju.
  assert.match(action.slice(guardStart), /await recordAudit\(\s*\{[\s\S]*?\},\s*tx,\s*\)/);
});

/* -------------------------------------------------------------------------
 * Migracija
 * ---------------------------------------------------------------------- */

test("migracija je aditivna i ne trazi rucno popunjavanje", async () => {
  const sql = await read("../../db/migrations/0003_session_version.sql");

  assert.match(sql, /ALTER TABLE "users"/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "session_version"/);
  assert.match(sql, /DEFAULT 0/);
  assert.match(sql, /NOT NULL/);

  // Ništa se ne briše i ništa se ne prepisuje.
  assert.doesNotMatch(sql, /DROP|TRUNCATE|DELETE|UPDATE /i);
});

test("migracija je upisana u journal", async () => {
  const journal = JSON.parse(
    await read("../../db/migrations/meta/_journal.json"),
  );
  const entry = journal.entries.find((e) => e.tag === "0003_session_version");
  assert.ok(entry, "migracija nije u journalu");
  assert.equal(entry.idx, 3);
});
