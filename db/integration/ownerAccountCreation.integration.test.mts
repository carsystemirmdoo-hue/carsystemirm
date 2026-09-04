import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import {
  cleanupQa,
  closeTestDatabase,
  ensureTestCryptoEnv,
  initTestDatabase,
  QA_EMAIL_DOMAIN,
  QA_PREFIX,
  skipReason,
  type TestDatabase,
} from "./harness.mts";

/**
 * P0-AUTH-01 — otvaranje naloga sa ulogom „gazda“ bez sesije, nad pravom bazom.
 *
 * `createUserAction` poziva `requireCapability`/`requireSecurityAdmin`, koji
 * zavise od `auth()` (NextAuth) i, preko njega, od `next/headers` — traže pravi
 * HTTP zahtev sa kolačićem sesije. `node --test` taj kontekst nema, i projekat
 * nema mehanizam da specifičnu autentifikovanu sesiju (konkretnog korisnika,
 * konkretne uloge, sa svežim TOTP-om) simulira izvan prave Next.js runtime
 * putanje — isto ograničenje koje `enrollmentIsolation.test.mjs` već
 * dokumentuje za portal stranice ("To traži bazu i pravu sesiju").
 *
 * Ono što OVDE ostaje proverljivo STVARNIM izvršavanjem, bez tog konteksta, je
 * najniži i najčešći stvaran napad: potpuno odsustvo sesije. Test dokazuje da
 * pokušaj otvaranja „gazda“ naloga bez ijedne sesije: (a) nikad ne vrati uspeh
 * kakav `createUserAction` vraća pri stvarnom upisu, i (b) ne ostavi NIJEDAN
 * red u `users`, čak ni sa formom koja bi inače prošla svaku validaciju oblika
 * (ispravna e-pošta, dovoljno duga lozinka, „gazda“ kao uloga).
 *
 * Slučajevi koji traže KONKRETNU autentifikovanu sesiju (obična uloga bez
 * `users:manage`, „users:manage“ bez „users:manage_security“, „gazda“ bez
 * svežeg TOTP-a, „gazda“ SA svežim TOTP-om) nisu ovde pokriveni iz istog
 * razloga — vidi napomenu u završnom izveštaju zadatka.
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

test("createUserAction bez sesije ne upisuje nalog sa ulogom gazda, čak ni sa validnom formom", async (t) => {
  if (guard(t)) return;

  const { createUserAction } = await import("@/app/portal/dozvole/actions");

  const email = `${QA_PREFIX}-${randomUUID().slice(0, 8)}-noauth@${QA_EMAIL_DOMAIN}`;
  const form = new FormData();
  form.set("email", email);
  form.set("name", "QA Bez Sesije");
  form.set("role", "gazda");
  form.set("password", "dovoljno-duga-lozinka-1");
  // Namerno "validan oblik" koda (6 cifara) — dokazuje da SAMO oblik nikad
  // nije dovoljan bez sesije koja stoji iza requireSecurityAdmin.
  form.set("token", "000000");

  const [pre] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM users`;

  let stanje: "resolved" | "rejected" = "resolved";
  let rezultat: unknown;
  try {
    rezultat = await createUserAction({ error: null, ok: null }, form);
  } catch (error) {
    stanje = "rejected";
    rezultat = error;
  }

  const [posle] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM users`;
  const [nalog] = await db.sql<{ id: string }[]>`SELECT id FROM users WHERE email = ${email}`;

  assert.equal(posle.n, pre.n, "broj naloga u bazi se promenio bez ijedne sesije");
  assert.equal(nalog, undefined, "nalog sa ulogom gazda je upisan bez sesije");

  /*
   * Ne tvrdimo TAČAN oblik greške (redirect/forbidden digest vs. next/headers
   * invarijanta van request opsega) — samo da poziv nikad nije vratio uspešno
   * stanje kakvo `createUserAction` vraća pri stvarnom upisu naloga.
   */
  if (stanje === "resolved") {
    const izlaz = rezultat as { ok: string | null };
    assert.equal(izlaz.ok, null, "akcija je prijavila uspeh bez sesije");
  } else {
    assert.ok(rezultat instanceof Error || typeof rezultat === "object");
  }
});
