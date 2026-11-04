import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { closeTestDatabase, ensureTestCryptoEnv, initTestDatabase, skipReason, type TestDatabase } from "./harness.mts";

/**
 * Brojač pokušaja pod istovremenim zahtevima (2026-11-04).
 *
 * Odluka se ranije računala iz vrednosti pročitane PRE upisa, pa je talas
 * istovremenih pokušaja ceo prolazio. Sada svaki pokušaj dobija redni broj iz
 * istog upisa: u prozoru prolazi tačno `limit` pokušaja, blokada počinje jednom
 * i tokom nje se ništa ne broji dalje.
 */
const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => (reason ? (t.skip(reason), true) : false);
const RUN = randomUUID().slice(0, 8);
let db: TestDatabase;

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
});

after(async () => {
  if (!reason && db) await db.sql`DELETE FROM auth_rate_limits WHERE scope = 'password'`;
  await closeTestDatabase();
});

const svc = async () => import("@/lib/auth/rate-limit-service");

test("40 istovremenih pokušaja na jedan nalog: prolazi tačno 10, blokada počinje jednom", async (t) => {
  if (guard(t)) return;
  const { registerAttempt } = await svc();
  const now = new Date();
  const account = `paralelno-${RUN}@qa.invalid`;
  const decisions = await Promise.all(
    Array.from({ length: 40 }, () => registerAttempt({ scope: "password", accountIdentifier: account, clientIp: null, now })),
  );
  assert.equal(decisions.filter((d) => d.allowed).length, 10, "politika lozinke: 10 po nalogu u prozoru");
  assert.equal(decisions.filter((d) => d.justBlocked).length, 1, "trag blokade samo jednom");

  // Tokom blokade sledeći pokušaj ne prolazi i ne pomera blokadu.
  const later = await registerAttempt({ scope: "password", accountIdentifier: account, clientIp: null, now: new Date(now.getTime() + 60_000) });
  assert.equal(later.allowed, false);
  assert.equal(later.justBlocked, false);
});

test("posle isteka blokade i prozora brojanje kreće ispočetka", async (t) => {
  if (guard(t)) return;
  const { registerAttempt } = await svc();
  const now = new Date();
  const account = `istek-${RUN}@qa.invalid`;
  for (let i = 0; i < 11; i += 1) await registerAttempt({ scope: "password", accountIdentifier: account, clientIp: null, now });
  const blocked = await registerAttempt({ scope: "password", accountIdentifier: account, clientIp: null, now: new Date(now.getTime() + 5 * 60_000) });
  assert.equal(blocked.allowed, false);
  const fresh = await registerAttempt({ scope: "password", accountIdentifier: account, clientIp: null, now: new Date(now.getTime() + 16 * 60_000) });
  assert.equal(fresh.allowed, true, "nov prozor posle 15 min blokade");
});

test("brojač po adresi deli talas sa više naloga", async (t) => {
  if (guard(t)) return;
  const { registerAttempt } = await svc();
  const now = new Date();
  const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
  const decisions = await Promise.all(
    Array.from({ length: 50 }, (_, i) => registerAttempt({ scope: "password", accountIdentifier: `ip-${RUN}-${i}@qa.invalid`, clientIp: ip, now })),
  );
  assert.equal(decisions.filter((d) => d.allowed).length, 30, "politika lozinke: 30 po adresi u prozoru");
});
