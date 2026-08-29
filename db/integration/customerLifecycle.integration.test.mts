import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
 * Lifecycle kupčevog naloga — postflight audit F-4, F-5, F-6.
 *
 * Dokazuje ono što jedinični test ne može: da se token čuva samo kao otisak,
 * da je jednokratan i vremenski ograničen, da brojač neuspeha stvarno raste u
 * bazi, i da baza odbija lozinku u stanjima koja postavlja kancelarija.
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
let fx: {
  customerId: string;
  office: { id: string; name: string; role: string };
};

const actor = () => ({
  id: fx.office.id,
  name: fx.office.name,
  role: fx.office.role,
});

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();

  const run = randomUUID().slice(0, 8);
  const [customer] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name) VALUES (${`QA${run}l`}, 'QA Lifecycle Kupac') RETURNING id`;
  const accounts = await seedAccounts(db, [{ key: "office", role: "kancelarija" }]);

  fx = { customerId: customer.id, office: accounts.office };
});

after(async () => {
  if (!reason && db) {
    await db.sql`DELETE FROM customer_account_tokens`;
    await db.sql`DELETE FROM customer_message_outbox`;
    await db.sql`DELETE FROM customer_users`;
    await db.sql`DELETE FROM customers WHERE pib LIKE 'QA%'`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

/** Nov predlog kontakta; vraća ID naloga. */
async function freshContact(): Promise<string> {
  const { proposeCustomerContact } = await import("@/lib/customers/account-service");
  const email = `qa1bverify-${randomUUID().slice(0, 8)}@qa-1b.invalid`;
  const { id } = await proposeCustomerContact(
    {
      customerId: fx.customerId,
      email,
      name: "QA Kontakt",
      reason: "QA predlog kontakta",
    },
    actor(),
  );
  return id;
}

/* -------------------------------------------------------------------------
 * Kreiranje: kancelarija ne zna lozinku
 * ---------------------------------------------------------------------- */

test("predlozen kontakt nema lozinku i ne sme se prijaviti", async (t) => {
  if (guard(t)) return;
  const { canCustomerSignIn } = await import("@/lib/authz/customer-scope.mjs");
  const id = await freshContact();

  const [row] = await db.sql<{ status: string; password_hash: string | null }[]>`
    SELECT status, password_hash FROM customer_users WHERE id = ${id}`;
  assert.equal(row.status, "requested");
  assert.equal(row.password_hash, null);
  assert.equal(canCustomerSignIn(row.status), false);
});

test("baza odbija lozinku u stanjima koja postavlja kancelarija", async (t) => {
  if (guard(t)) return;
  const id = await freshContact();

  for (const status of ["requested", "approved"]) {
    await assert.rejects(
      () => db.sql`
        UPDATE customer_users SET status = ${status}, password_hash = 'scrypt$x'
         WHERE id = ${id}`,
      /customer_users_password_lifecycle_ck/,
      `stanje ${status} je primilo lozinku`,
    );
  }
});

test("active bez lozinke se ne moze upisati", async (t) => {
  if (guard(t)) return;
  const id = await freshContact();
  await assert.rejects(
    () => db.sql`
      UPDATE customer_users SET status = 'active', password_hash = NULL WHERE id = ${id}`,
    /customer_users_password_lifecycle_ck/,
  );
});

/* -------------------------------------------------------------------------
 * Pozivnica
 * ---------------------------------------------------------------------- */

test("poziv se cuva samo kao otisak i pravi outbox red bez tokena", async (t) => {
  if (guard(t)) return;
  const { issueInvitation } = await import("@/lib/customers/invitation-service");
  const id = await freshContact();

  const { token, expiresAt } = await issueInvitation(
    { accountId: id, reason: "QA poziv" },
    actor(),
  );

  const [tok] = await db.sql<{ token_fingerprint: string; purpose: string }[]>`
    SELECT token_fingerprint, purpose FROM customer_account_tokens
     WHERE customer_user_id = ${id}`;
  assert.equal(tok.purpose, "invitation");
  assert.notEqual(tok.token_fingerprint, token, "token je sacuvan u citljivom obliku");
  assert.ok(!tok.token_fingerprint.includes(token));

  // Rok je 48 sati.
  const hours = (expiresAt.getTime() - Date.now()) / 3_600_000;
  assert.ok(hours > 47 && hours <= 48, `rok je ${hours} h`);

  // Outbox red postoji i NE nosi token — kolone za njega nema.
  const [box] = await db.sql<{ kind: string; status: string }[]>`
    SELECT kind, status FROM customer_message_outbox WHERE customer_user_id = ${id}`;
  assert.equal(box.kind, "invitation");
  assert.equal(box.status, "pending");
  const cols = await db.sql<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
     WHERE table_name = 'customer_message_outbox'`;
  const names = cols.map((c) => c.column_name);
  for (const forbidden of ["token", "link", "url", "token_fingerprint"]) {
    assert.ok(!names.includes(forbidden), `outbox nosi ${forbidden}`);
  }
});

test("token ne ulazi u audit", async (t) => {
  if (guard(t)) return;
  const { issueInvitation } = await import("@/lib/customers/invitation-service");
  const id = await freshContact();
  const { token } = await issueInvitation({ accountId: id, reason: "QA poziv" }, actor());

  const rows = await db.sql<{ payload: string }[]>`
    SELECT (coalesce(value_before::text,'') || coalesce(value_after::text,'')
            || coalesce(reason,'') || coalesce(entity_label,'')) AS payload
      FROM audit_log WHERE entity_id = ${id}`;
  for (const row of rows) {
    assert.ok(!row.payload.includes(token), "token je procurio u audit");
  }
});

test("aktivacija trosi token, postavlja lozinku i obara sesije", async (t) => {
  if (guard(t)) return;
  const { issueInvitation, activateWithInvitation } = await import(
    "@/lib/customers/invitation-service"
  );
  const id = await freshContact();
  const { token } = await issueInvitation({ accountId: id, reason: "QA poziv" }, actor());

  const [before] = await db.sql<{ session_version: number }[]>`
    SELECT session_version FROM customer_users WHERE id = ${id}`;

  assert.deepEqual(
    await activateWithInvitation({ token, password: "kupceva-lozinka-123" }),
    { ok: true },
  );

  const [after] = await db.sql<
    { status: string; password_hash: string; session_version: number }[]
  >`SELECT status, password_hash, session_version FROM customer_users WHERE id = ${id}`;
  assert.equal(after.status, "active");
  assert.ok(after.password_hash?.startsWith("scrypt$"));
  assert.ok(after.session_version > before.session_version, "sesije nisu opozvane");

  const [tok] = await db.sql<{ used_at: Date | null }[]>`
    SELECT used_at FROM customer_account_tokens WHERE customer_user_id = ${id}`;
  assert.ok(tok.used_at, "token nije oznacen kao iskorisen");
});

test("isti token drugi put ne prolazi", async (t) => {
  if (guard(t)) return;
  const { issueInvitation, activateWithInvitation } = await import(
    "@/lib/customers/invitation-service"
  );
  const id = await freshContact();
  const { token } = await issueInvitation({ accountId: id, reason: "QA poziv" }, actor());

  assert.equal((await activateWithInvitation({ token, password: "prva-lozinka-123" })).ok, true);
  assert.equal(
    (await activateWithInvitation({ token, password: "druga-lozinka-123" })).ok,
    false,
    "jednokratan token je iskoriscen dvaput",
  );
});

test("nov poziv ponistava prethodni", async (t) => {
  if (guard(t)) return;
  const { issueInvitation, activateWithInvitation } = await import(
    "@/lib/customers/invitation-service"
  );
  const id = await freshContact();
  const prvi = await issueInvitation({ accountId: id, reason: "QA poziv 1" }, actor());
  await issueInvitation({ accountId: id, reason: "QA poziv 2" }, actor());

  assert.equal(
    (await activateWithInvitation({ token: prvi.token, password: "lozinka-123456" })).ok,
    false,
    "stari poziv je i dalje otvoren",
  );
});

test("istekao token ne prolazi", async (t) => {
  if (guard(t)) return;
  const { issueInvitation, activateWithInvitation } = await import(
    "@/lib/customers/invitation-service"
  );
  const id = await freshContact();
  const { token } = await issueInvitation({ accountId: id, reason: "QA poziv" }, actor());

  await db.sql`
    UPDATE customer_account_tokens SET expires_at = now() - interval '1 minute'
     WHERE customer_user_id = ${id}`;

  assert.equal(
    (await activateWithInvitation({ token, password: "lozinka-123456" })).ok,
    false,
  );
});

/* -------------------------------------------------------------------------
 * Reset
 * ---------------------------------------------------------------------- */

async function activeAccount(): Promise<{ id: string; email: string }> {
  const { issueInvitation, activateWithInvitation } = await import(
    "@/lib/customers/invitation-service"
  );
  const id = await freshContact();
  const { token } = await issueInvitation({ accountId: id, reason: "QA poziv" }, actor());
  await activateWithInvitation({ token, password: "pocetna-lozinka-123" });
  const [row] = await db.sql<{ email: string }[]>`
    SELECT email FROM customer_users WHERE id = ${id}`;
  return { id, email: row.email };
}

test("reset je jednokratan, kratkotrajan i obara sesije", async (t) => {
  if (guard(t)) return;
  const { requestPasswordReset, completePasswordReset } = await import(
    "@/lib/customers/invitation-service"
  );
  const account = await activeAccount();

  const issued = await requestPasswordReset({ email: account.email });
  assert.ok(issued, "reset nije izdat aktivnom nalogu");

  const [tok] = await db.sql<{ expires_at: Date }[]>`
    SELECT expires_at FROM customer_account_tokens
     WHERE customer_user_id = ${account.id} AND purpose = 'password_reset'`;
  const minutes = (tok.expires_at.getTime() - Date.now()) / 60_000;
  assert.ok(minutes > 59 && minutes <= 60, `rok je ${minutes} min`);

  const [before] = await db.sql<{ session_version: number }[]>`
    SELECT session_version FROM customer_users WHERE id = ${account.id}`;

  assert.equal(
    (await completePasswordReset({ token: issued.token, password: "nova-lozinka-123" })).ok,
    true,
  );
  assert.equal(
    (await completePasswordReset({ token: issued.token, password: "treca-lozinka-123" })).ok,
    false,
    "reset token je upotrebljen dvaput",
  );

  const [after] = await db.sql<{ session_version: number }[]>`
    SELECT session_version FROM customer_users WHERE id = ${account.id}`;
  assert.ok(after.session_version > before.session_version);
});

test("reset za nepostojecu adresu ne otkriva nista", async (t) => {
  if (guard(t)) return;
  const { requestPasswordReset } = await import("@/lib/customers/invitation-service");

  const brojReset = async () => {
    const [{ count }] = await db.sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM customer_account_tokens
       WHERE purpose = 'password_reset'`;
    return count;
  };

  const pre = await brojReset();
  assert.equal(await requestPasswordReset({ email: "nepostojeci@qa-1b.invalid" }), null);
  assert.equal(await brojReset(), pre, "izdat je token za nepostojeci nalog");

  // Ni nalog koji je predlozen a jos nije aktiviran ne dobija reset.
  const id = await freshContact();
  const [row] = await db.sql<{ email: string }[]>`
    SELECT email FROM customer_users WHERE id = ${id}`;
  assert.equal(await requestPasswordReset({ email: row.email }), null);
  assert.equal(await brojReset(), pre, "neaktiviran nalog je dobio reset");
});

test("promena lozinke iz sesije trazi staru lozinku", async (t) => {
  if (guard(t)) return;
  const { changeCustomerPassword } = await import(
    "@/lib/customers/invitation-service"
  );
  const account = await activeAccount();

  assert.equal(
    (
      await changeCustomerPassword({
        accountId: account.id,
        currentPassword: "pogresna-lozinka",
        newPassword: "nova-lozinka-123",
      })
    ).ok,
    false,
  );
  assert.equal(
    (
      await changeCustomerPassword({
        accountId: account.id,
        currentPassword: "pocetna-lozinka-123",
        newPassword: "nova-lozinka-123",
      })
    ).ok,
    true,
  );
});

/* -------------------------------------------------------------------------
 * Lockout i audit prijave
 * ---------------------------------------------------------------------- */

test("neuspela prijava stvarno uvecava brojac i pravi audit", async (t) => {
  if (guard(t)) return;
  const { recordCustomerLoginFailure } = await import(
    "@/lib/customers/account-service"
  );
  const account = await activeAccount();

  await recordCustomerLoginFailure({
    accountId: account.id,
    email: account.email,
    reason: "bad_password",
    rateLimited: false,
  });

  const [row] = await db.sql<{ failed_login_attempts: number }[]>`
    SELECT failed_login_attempts FROM customer_users WHERE id = ${account.id}`;
  assert.equal(row.failed_login_attempts, 1, "brojac je ostao mrtav");

  const [audit] = await db.sql<{ action: string; reason: string }[]>`
    SELECT action, reason FROM audit_log WHERE entity_id = ${account.id}
      AND action LIKE 'Neuspela prijava%'`;
  assert.ok(audit, "neuspela prijava nije ostavila trag");
});

test("osam promasaja zakljucava nalog", async (t) => {
  if (guard(t)) return;
  const { recordCustomerLoginFailure, CUSTOMER_MAX_FAILED_ATTEMPTS } = await import(
    "@/lib/customers/account-service"
  );
  const account = await activeAccount();

  for (let i = 0; i < CUSTOMER_MAX_FAILED_ATTEMPTS; i += 1) {
    await recordCustomerLoginFailure({
      accountId: account.id,
      email: account.email,
      reason: "bad_password",
      rateLimited: false,
    });
  }

  const [row] = await db.sql<
    { failed_login_attempts: number; locked_until: Date | null }[]
  >`SELECT failed_login_attempts, locked_until FROM customer_users WHERE id = ${account.id}`;
  assert.equal(row.failed_login_attempts, CUSTOMER_MAX_FAILED_ATTEMPTS);
  assert.ok(row.locked_until, "nalog nije zakljucan");
  assert.ok(row.locked_until.getTime() > Date.now());
});

test("konkurentni promasaji ne gube nijedan (bez lost-update)", async (t) => {
  if (guard(t)) return;
  const { recordCustomerLoginFailure } = await import(
    "@/lib/customers/account-service"
  );
  const account = await activeAccount();

  /*
   * Brojač se uvećava u SQL-u. Da se čita pa upisuje, pet paralelnih pokušaja
   * bi upisalo istu vrednost i napadač bi dobio višestruko više pokušaja.
   */
  await Promise.all(
    Array.from({ length: 5 }, () =>
      recordCustomerLoginFailure({
        accountId: account.id,
        email: account.email,
        reason: "bad_password",
        rateLimited: false,
      }),
    ),
  );

  const [row] = await db.sql<{ failed_login_attempts: number }[]>`
    SELECT failed_login_attempts FROM customer_users WHERE id = ${account.id}`;
  assert.equal(row.failed_login_attempts, 5, "izgubljen je bar jedan pokusaj");
});

test("uspesna prijava resetuje brojac i belezi trag", async (t) => {
  if (guard(t)) return;
  const { recordCustomerLoginFailure, markCustomerSignedIn } = await import(
    "@/lib/customers/account-service"
  );
  const account = await activeAccount();

  await recordCustomerLoginFailure({
    accountId: account.id,
    email: account.email,
    reason: "bad_password",
    rateLimited: false,
  });
  await markCustomerSignedIn(account.id, account.email);

  const [row] = await db.sql<
    { failed_login_attempts: number; locked_until: Date | null; last_login_at: Date }[]
  >`SELECT failed_login_attempts, locked_until, last_login_at
      FROM customer_users WHERE id = ${account.id}`;
  assert.equal(row.failed_login_attempts, 0);
  assert.equal(row.locked_until, null);
  assert.ok(row.last_login_at);

  const [audit] = await db.sql<{ action: string }[]>`
    SELECT action FROM audit_log WHERE entity_id = ${account.id}
      AND action LIKE 'Uspešna prijava%'`;
  assert.ok(audit, "uspesna prijava nije ostavila trag");
});

test("audit prijave ne nosi lozinku ni token", async (t) => {
  if (guard(t)) return;
  const rows = await db.sql<{ payload: string }[]>`
    SELECT (coalesce(value_before::text,'') || coalesce(value_after::text,'')
            || coalesce(reason,'')) AS payload
      FROM audit_log WHERE entity_type = 'Kupčev nalog'`;
  for (const row of rows) {
    assert.ok(!/scrypt\$/.test(row.payload), "hes lozinke je u auditu");
    assert.ok(!/lozinka-\d/.test(row.payload), "lozinka je u auditu");
  }
});
