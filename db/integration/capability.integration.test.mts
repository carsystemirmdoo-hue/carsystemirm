import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import {
  cleanupQa,
  closeTestDatabase,
  ensureTestCryptoEnv,
  initTestDatabase,
  seedAccounts,
  skipReason,
  type TestDatabase,
} from "./harness.mts";

/**
 * Granica sposobnosti, nad stvarnim dodelama iz baze.
 *
 * Razlika u odnosu na jedinični test: ovde se paket dodeljuje kroz pravu tabelu
 * sa stranim ključem, a sposobnosti se računaju iz onoga što je STVARNO
 * upisano — ne iz literala u testu.
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => {
  if (reason) {
    t.skip(reason);
    return true;
  }
  return false;
};

let db: TestDatabase;

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
});

after(async () => {
  if (!reason && db) await cleanupQa(db);
  await closeTestDatabase();
});

/** Sposobnosti korisnika, iz baze — isto što radi `loadPortalUser`. */
async function sposobnostiIzBaze(userId: string) {
  const { loadPortalUser } = await import("@/lib/authz/user-repository");
  const { resolveCapabilities } = await import("@/lib/authz/permissions.mjs");
  const user = await loadPortalUser(userId);
  assert.ok(user, "korisnik nije učitan");
  return resolveCapabilities(user.role, user.permissions);
}

async function dodeliPaket(userId: string, key: string) {
  await db.sql`
    INSERT INTO user_permissions (user_id, permission_key, reason)
    VALUES (${userId}, ${key}, 'QA provera')
    ON CONFLICT DO NOTHING
  `;
}

test("magacioner sa paketom korisnici nema bezbednosnu sposobnost", async (t) => {
  if (guard(t)) return;
  const a = await seedAccounts(db, [{ key: "cap1", role: "magacioner" }]);
  await dodeliPaket(a.cap1.id, "korisnici");

  const caps = await sposobnostiIzBaze(a.cap1.id);
  assert.equal(caps.has("users:manage"), true, "paket je izgubio osnovnu svrhu");
  assert.equal(
    caps.has("users:manage_security"),
    false,
    "paket „korisnici“ i dalje daje preuzimanje tuđeg pristupa",
  );
});

test("bezbednosna sposobnost dolazi samo uz svoj paket", async (t) => {
  if (guard(t)) return;
  const a = await seedAccounts(db, [{ key: "cap2", role: "magacioner" }]);
  await dodeliPaket(a.cap2.id, "bezbednost_naloga");

  const caps = await sposobnostiIzBaze(a.cap2.id);
  assert.equal(caps.has("users:manage_security"), true);
  // Sam paket ne daje i običnu administraciju korisnika.
  assert.equal(caps.has("users:manage"), false);
});

test("gazda ima obe sposobnosti bez ijednog paketa", async (t) => {
  if (guard(t)) return;
  const a = await seedAccounts(db, [{ key: "cap3", role: "gazda" }]);
  const caps = await sposobnostiIzBaze(a.cap3.id);
  assert.equal(caps.has("users:manage"), true);
  assert.equal(caps.has("users:manage_security"), true);
});

test("komercijalista bez paketa nema nijednu od dve", async (t) => {
  if (guard(t)) return;
  const a = await seedAccounts(db, [{ key: "cap4", role: "komercijalista" }]);
  const caps = await sposobnostiIzBaze(a.cap4.id);
  assert.equal(caps.has("users:manage"), false);
  assert.equal(caps.has("users:manage_security"), false);
});

test("nepostojeci paket se ne moze dodeliti", async (t) => {
  if (guard(t)) return;
  const a = await seedAccounts(db, [{ key: "cap5", role: "komercijalista" }]);

  /*
   * Strani ključ ka `permission_packages` je poslednja odbrana od greške u
   * kucanju: `bezbednost` umesto `bezbednost_naloga` mora pasti, a ne tiho
   * napraviti dodelu koju niko ne razrešava.
   */
  await assert.rejects(
    db.sql`
      INSERT INTO user_permissions (user_id, permission_key, reason)
      VALUES (${a.cap5.id}, 'bezbednost', 'QA provera')
    `,
    /foreign key|violates/i,
  );
});

test("oduzimanje paketa odmah gasi sposobnost", async (t) => {
  if (guard(t)) return;
  const a = await seedAccounts(db, [{ key: "cap6", role: "kancelarija" }]);
  await dodeliPaket(a.cap6.id, "bezbednost_naloga");
  assert.equal((await sposobnostiIzBaze(a.cap6.id)).has("users:manage_security"), true);

  await db.sql`
    DELETE FROM user_permissions
    WHERE user_id = ${a.cap6.id} AND permission_key = 'bezbednost_naloga'
  `;
  // Dozvole se čitaju iz baze pri svakom zahtevu, pa oduzimanje deluje odmah.
  assert.equal((await sposobnostiIzBaze(a.cap6.id)).has("users:manage_security"), false);
});

test("deaktiviran korisnik se ne ucitava, bez obzira na pakete", async (t) => {
  if (guard(t)) return;
  const { loadPortalUser } = await import("@/lib/authz/user-repository");
  const a = await seedAccounts(db, [{ key: "cap7", role: "gazda", active: false }]);
  await dodeliPaket(a.cap7.id, "bezbednost_naloga");

  assert.equal(await loadPortalUser(a.cap7.id), null, "isključen nalog je učitan");
});

test("enrollment-only sesija nema nijednu poslovnu sposobnost", async (t) => {
  if (guard(t)) return;
  const { isBlockedBySensitivity, resolvePortalAccess, mfaStateFrom, ACCESS_ENROLLMENT_ONLY } =
    await import("@/lib/auth/mfa-policy.mjs");
  const { readMfaStatus } = await import("@/lib/auth/mfa-service");
  const a = await seedAccounts(db, [{ key: "cap8", role: "gazda" }]);

  const decision = resolvePortalAccess({
    mode: "enroll",
    environment: "test",
    accountActive: true,
    mfaState: mfaStateFrom(await readMfaStatus(a.cap8.id)),
    factor: "none",
  });
  assert.equal(decision.access, ACCESS_ENROLLMENT_ONLY);

  // Čak i gazda: ograničena sesija ne nosi nijednu sposobnost.
  for (const capability of [
    "view:home",
    "view:kupci",
    "view:dozvole",
    "users:manage",
    "users:manage_security",
    "settings:manage",
    "export:data",
  ]) {
    assert.equal(
      isBlockedBySensitivity(capability, decision),
      true,
      `enrollment-only propušta ${capability}`,
    );
  }
});

test("svi kanonski paketi postoje u bazi posle migracija", async (t) => {
  if (guard(t)) return;
  const { PERMISSION_PACKAGES } = await import("@/lib/authz/permissions.mjs");

  /*
   * Prvi prolaz nad svežom bazom pao je ovde: capability model je očekivao
   * pakete, a `permission_packages` je bila prazna jer ju je punio isključivo
   * `db/seed.mjs`, koji nije deo migracija. Sveža produkcijska instalacija bi
   * imala isti problem — svaka dodela bi pala na strani ključ.
   *
   * Migracija 0007 sada seeduje ceo spisak. Ovaj test poredi bazu sa kanonskom
   * listom, pa razilaženje ne može proći neprimećeno.
   */
  const rows = await db.sql<{ key: string; name: string }[]>`
    SELECT key, name FROM permission_packages ORDER BY key
  `;
  const uBazi = new Set(rows.map((r) => r.key));

  const nedostaju = PERMISSION_PACKAGES.filter((p) => !uBazi.has(p.key)).map((p) => p.key);
  assert.deepEqual(nedostaju, [], `nedostaju paketi: ${nedostaju.join(", ")}`);

  // Nazivi se takođe poklapaju — inače bi matrica dozvola pokazivala jedno, a
  // baza čuvala drugo.
  for (const paket of PERMISSION_PACKAGES) {
    const red = rows.find((r) => r.key === paket.key);
    assert.equal(red?.name, paket.name, `naziv se razlikuje za ${paket.key}`);
  }
});

test("dodela svakog kanonskog paketa prolazi kroz strani kljuc", async (t) => {
  if (guard(t)) return;
  const { PERMISSION_PACKAGES } = await import("@/lib/authz/permissions.mjs");
  const a = await seedAccounts(db, [{ key: "cap9", role: "komercijalista" }]);

  // Sveža instalacija mora moći da dodeli SVAKI paket, ne samo one koje je
  // slučajno neko ranije ubacio ručno.
  for (const paket of PERMISSION_PACKAGES) {
    await db.sql`
      INSERT INTO user_permissions (user_id, permission_key, reason)
      VALUES (${a.cap9.id}, ${paket.key}, 'QA provera')
      ON CONFLICT DO NOTHING
    `;
  }

  const [{ count }] = await db.sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM user_permissions WHERE user_id = ${a.cap9.id}
  `;
  assert.equal(count, PERMISSION_PACKAGES.length);
});

test("reset ne dira pakete dozvola ni migration journal", async (t) => {
  if (guard(t)) return;
  const { readFile } = await import("node:fs/promises");

  /*
   * Tvrdnja je nedestruktivna namerno.
   *
   * Poziv `resetQaDatabase()` usred paketa testova ispraznio bi bazu i drugim
   * fajlovima ispod nogu. Zato se ovde proverava SPISAK tabela koje reset sme
   * da dira, a stvarno ponašanje potvrđuje `scripts/qa/reset-test-db.mjs`, koji
   * posle svakog `TRUNCATE` broji pakete i migracije i pada ako ih nema.
   */
  const harness = await readFile(new URL("./harness.mts", import.meta.url), "utf8");
  const spisak = harness.slice(
    harness.indexOf("const RESETTABLE_TABLES"),
    harness.indexOf("];", harness.indexOf("const RESETTABLE_TABLES")),
  );
  assert.ok(!spisak.includes("permission_packages"), "reset briše pakete dozvola");
  assert.ok(!spisak.includes("__drizzle_migrations"), "reset briše migration journal");
  assert.ok(spisak.includes("audit_log"), "reset ne čisti trag, pa se prolaz ne može ponoviti");

  const skripta = await readFile(
    new URL("../../scripts/qa/reset-test-db.mjs", import.meta.url),
    "utf8",
  );
  assert.match(skripta, /RESTART IDENTITY CASCADE/);
  assert.match(skripta, /permission_packages/);
  assert.match(skripta, /__drizzle_migrations/);
  // Nijedan okidač se ne isključuje; `TRUNCATE` ih ionako ne pokreće.
  assert.ok(!/DISABLE TRIGGER|ALTER TABLE[^;]*TRIGGER/i.test(skripta));
});
