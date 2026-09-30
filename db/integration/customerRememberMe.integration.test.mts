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

/** „Zapamti me" za kupce: rotacija, dozvola, opoziv i porudžbina iz obnovljene sesije. */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => {
  if (reason) {
    t.skip(reason);
    return true;
  }
  return false;
};

const RUN = randomUUID().slice(0, 6);
let db: TestDatabase;
let owner: { id: string; name: string; role: string };
let customerId = "";
let accountId = "";
const PASSWORD = "Qa-lozinka-dugacka-1";
type Tok = typeof import("@/lib/auth/remember-tokens");
let tok: Tok;

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const accounts = await seedAccounts(db, [{ key: "owner", role: "gazda" }]);
  owner = { id: accounts.owner.id, name: accounts.owner.name, role: accounts.owner.role };
  const { hashPassword } = await import("@/lib/auth/password.mjs");
  const [c] = await db.sql<{ id: string }[]>`INSERT INTO customers (pib, name) VALUES (${`QAR${RUN}`}, ${`QA Zapamti ${RUN}`}) RETURNING id`;
  customerId = c.id;
  const [u] = await db.sql<{ id: string }[]>`
    INSERT INTO customer_users (customer_id, email, name, password_hash, status)
    VALUES (${c.id}, ${`qar-${RUN}@qa.invalid`}, 'QA kupac', ${await hashPassword(PASSWORD)}, 'active') RETURNING id`;
  accountId = u.id;
  tok = await import("@/lib/auth/remember-tokens");
});

after(async () => {
  if (!reason && db) {
    await db.sql`DELETE FROM customer_remember_tokens WHERE account_id = ${accountId}`;
    await db.sql`DELETE FROM customer_users WHERE id = ${accountId}`;
    await db.sql`DELETE FROM customers WHERE id = ${customerId}`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/129.0 Safari/537.36";
const activeCount = async () =>
  (await db.sql<{ n: number }[]>`SELECT count(*)::int n FROM customer_remember_tokens WHERE account_id = ${accountId} AND revoked_at IS NULL`)[0].n;

test("obnova rotira token; dozvola važi jednom; porodica ne produžava rok", async (t) => {
  if (guard(t)) return;
  const { raw, expiresAt } = await tok.issueRememberToken(accountId, UA);
  const r = await tok.redeemRememberToken(raw);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.notEqual(r.raw, raw, "nov token");
  assert.equal(r.expiresAt.getTime(), expiresAt.getTime(), "rotacija ne produžava 30 dana");
  const acc = await tok.consumeRememberGrant(r.grant);
  assert.equal(acc?.id, accountId);
  assert.equal(await tok.consumeRememberGrant(r.grant), null, "dozvola se troši samo jednom");
  const [old] = await db.sql<{ revoked_reason: string }[]>`SELECT revoked_reason FROM customer_remember_tokens WHERE replaced_by IS NOT NULL AND account_id = ${accountId}`;
  assert.equal(old.revoked_reason, "rotated");
  // Istekla dozvola.
  const r2 = await tok.redeemRememberToken(r.raw);
  assert.ok(r2.ok);
  if (!r2.ok) return;
  assert.equal(await tok.consumeRememberGrant(r2.grant, new Date(Date.now() + 61_000)), null);
  await tok.revokeRememberTokenByRaw(r2.raw);
});

test("stari token: u prozoru tolerancije samo odbijen; kasnije gasi porodicu i sve sesije", async (t) => {
  if (guard(t)) return;
  const { raw } = await tok.issueRememberToken(accountId, UA);
  const r = await tok.redeemRememberToken(raw);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(await tok.redeemRememberToken(raw), { ok: false, reason: "rotated_recently" });
  const r2 = await tok.redeemRememberToken(r.raw);
  assert.ok(r2.ok, "nov token i dalje važi posle benignog ponavljanja");
  if (!r2.ok) return;
  const [{ v: before }] = await db.sql<{ v: number }[]>`SELECT session_version v FROM customer_users WHERE id = ${accountId}`;
  // Prvi token je zamenjen pre više od minut → ponovna upotreba = mogući ukraden token.
  await db.sql`UPDATE customer_remember_tokens SET revoked_at = now() - interval '5 minutes' WHERE revoked_reason = 'rotated' AND account_id = ${accountId}`;
  assert.deepEqual(await tok.redeemRememberToken(raw), { ok: false, reason: "reuse_detected" });
  const [{ v: afterV }] = await db.sql<{ v: number }[]>`SELECT session_version v FROM customer_users WHERE id = ${accountId}`;
  assert.equal(afterV, before + 1, "sve žive sesije naloga opozvane");
  assert.equal((await tok.redeemRememberToken(r2.raw)).ok, false, "cela porodica ugašena");
});

test("odjava na uređaju gasi samo taj uređaj", async (t) => {
  if (guard(t)) return;
  const a = await tok.issueRememberToken(accountId, UA);
  const b = await tok.issueRememberToken(accountId, "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1");
  await tok.revokeRememberTokenByRaw(a.raw, "logout");
  assert.equal((await tok.redeemRememberToken(a.raw)).ok, false);
  const rb = await tok.redeemRememberToken(b.raw);
  assert.ok(rb.ok, "drugi uređaj ostaje");
  if (rb.ok) await tok.revokeRememberTokenByRaw(rb.raw);
});

test("odjava sa svih uređaja: verzija sesije +1 i nijedan uređaj se ne obnavlja", async (t) => {
  if (guard(t)) return;
  const a = await tok.issueRememberToken(accountId, UA);
  const b = await tok.issueRememberToken(accountId, UA);
  const [{ v }] = await db.sql<{ v: number }[]>`SELECT session_version v FROM customer_users WHERE id = ${accountId}`;
  await tok.logoutAllDevices(accountId, "qa@qa.invalid");
  const [{ v: v2 }] = await db.sql<{ v: number }[]>`SELECT session_version v FROM customer_users WHERE id = ${accountId}`;
  assert.equal(v2, v + 1);
  assert.equal((await tok.redeemRememberToken(a.raw)).ok, false);
  assert.equal((await tok.redeemRememberToken(b.raw)).ok, false);
  assert.equal(await activeCount(), 0);
});

test("promena lozinke gasi zapamćene uređaje (i bez izričitog opoziva)", async (t) => {
  if (guard(t)) return;
  const { raw } = await tok.issueRememberToken(accountId, UA);
  const { changeCustomerPassword } = await import("@/lib/customers/invitation-service");
  assert.deepEqual(await changeCustomerPassword({ accountId, currentPassword: PASSWORD, newPassword: `${PASSWORD}-novo` }), { ok: true });
  assert.deepEqual(await tok.redeemRememberToken(raw), { ok: false, reason: "session_revoked" });
  assert.equal(await activeCount(), 0, "porodica je ugašena pri pokušaju");
});

test("isključen nalog: obnova odbijena, a ni zaostala dozvola ne izdaje sesiju", async (t) => {
  if (guard(t)) return;
  const { raw } = await tok.issueRememberToken(accountId, UA);
  const early = await tok.redeemRememberToken(raw);
  assert.ok(early.ok);
  if (!early.ok) return;
  const { setCustomerAccountStatus } = await import("@/lib/customers/account-service");
  await setCustomerAccountStatus({ accountId, status: "suspended", reason: "QA isključenje" }, owner);
  assert.equal(await tok.consumeRememberGrant(early.grant), null, "dozvola izdata pre isključenja ne važi");
  const again = await tok.redeemRememberToken(early.raw);
  assert.equal(again.ok, false);
  await db.sql`UPDATE customer_users SET status = 'active' WHERE id = ${accountId}`;
});

test("najviše 5 uređaja; porodica istekla posle 30 dana", async (t) => {
  if (guard(t)) return;
  await db.sql`UPDATE customer_remember_tokens SET revoked_at = now(), revoked_reason = 'logout' WHERE account_id = ${accountId} AND revoked_at IS NULL`;
  const raws: string[] = [];
  for (let i = 0; i < 6; i += 1) raws.push((await tok.issueRememberToken(accountId, UA)).raw);
  assert.equal(await activeCount(), 5);
  assert.equal((await tok.redeemRememberToken(raws[0])).ok, false, "najstariji je ugašen");
  const aged = await tok.redeemRememberToken(raws[5], new Date(Date.now() + 31 * 24 * 3600 * 1000));
  assert.deepEqual(aged, { ok: false, reason: "expired" });
});

test("porudžbina iz obnovljene sesije traži lozinku i ne pravi zahtev", async (t) => {
  if (guard(t)) return;
  const { submitCartRequest } = await import("@/lib/ordering/ordering-service");
  const r = await submitCartRequest(
    { accountId, customerId, customerName: "QA", email: "qa@qa.invalid", name: "QA", status: "active", assurance: "remembered" },
    { idempotencyKey: randomUUID(), fingerprint: "x" },
  );
  assert.equal(r.status, "reauth");
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int n FROM customer_orders WHERE customer_id = ${customerId}`;
  assert.equal(n, 0);
});
