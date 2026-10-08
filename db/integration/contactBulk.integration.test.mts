import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase, seedAccounts, skipReason, type TestDatabase } from "./harness.mts";

/**
 * Grupni predlog kontakata: provera ne upisuje ništa, primena pravi samo naloge
 * `requested` bez lozinke uz trag, ponovno pokretanje preskače istovetne, a
 * neslaganja (tuđa adresa, drugi kontakt, neaktivan kupac, PIB) se izdvajaju.
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => {
  if (reason) {
    t.skip(reason);
    return true;
  }
  return false;
};

const ISSUER = "QA-KONTAKTI";
let db: TestDatabase;
let owner: { id: string; name: string; role: string };
const kupac: Record<"A" | "B" | "C" | "D", { id: string; pib: string }> = {} as never;
const tag = randomUUID().slice(0, 6);

const HEAD = "sifra_na_fakturi;pib;naziv;e_adresa;ime;odluka;potvrdio;napomena";
const red = (k: keyof typeof kupac, email: string, pib = kupac[k].pib) =>
  `P${k};${pib};QA ${k};${email};QA ${k} — kontakt iz BizniSoft-a;potvrdi;QA kancelarija;QA potvrda postojeće poslovne komunikacije.`;

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const accounts = await seedAccounts(db, [{ key: "owner", role: "gazda" }]);
  owner = { id: accounts.owner.id, name: accounts.owner.name, role: accounts.owner.role };
  for (const k of ["A", "B", "C", "D"] as const) {
    const pib = `QK${tag}${k}`;
    const [c] = await db.sql<{ id: string }[]>`INSERT INTO customers (pib, name, active) VALUES (${pib}, ${`QA ${k}`}, ${k !== "C"}) RETURNING id`;
    kupac[k] = { id: c.id, pib };
    await db.sql`
      INSERT INTO customer_external_identifiers (source_system, issuer_code, external_partner_code, customer_id, status)
      VALUES ('biznisoft', ${ISSUER}, ${`P${k}`}, ${c.id}, 'mapped')`;
  }
  // D već ima drugi kontakt.
  await db.sql`INSERT INTO customer_users (customer_id, email, name, status) VALUES (${kupac.D.id}, ${`d-${tag}@qa.test`}, 'QA D', 'requested')`;
});

after(async () => {
  if (!reason && db) {
    const ids = Object.values(kupac).map((k) => k.id);
    await db.sql`DELETE FROM customer_users WHERE customer_id IN ${db.sql(ids)}`;
    await db.sql`DELETE FROM customer_external_identifiers WHERE issuer_code = ${ISSUER}`;
    await db.sql`DELETE FROM customers WHERE id IN ${db.sql(ids)}`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

test("provera ne upisuje; primena upisuje samo ispravne; ponovo = preskočeno", async (t) => {
  if (guard(t)) return;
  const { readContactProposals } = await import("@/lib/customers/contactProposalFiles.mjs");
  const { applyContactProposals } = await import("@/lib/customers/contact-bulk-service");
  const rows = readContactProposals(
    [
      HEAD,
      red("A", `a-${tag}@qa.test`),
      red("B", `b-${tag}@qa.test`, "POGRESAN"),
      red("C", `c-${tag}@qa.test`),
      red("D", `d2-${tag}@qa.test`),
      `PX;X;QA X;x-${tag}@qa.test;QA X;potvrdi;QA kancelarija;QA potvrda postojeće poslovne komunikacije.`,
    ].join("\n"),
  );
  const outcomes = (r: { outcome: string }[]) => r.map((o) => o.outcome);
  const expected = ["would_create", "pib_mismatch", "customer_inactive", "customer_has_other_contact", "code_not_mapped"];

  assert.deepEqual(outcomes(await applyContactProposals({ issuerCode: ISSUER, rows, dryRun: true }, owner)), expected);
  const [{ n: posleProvere }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM customer_users WHERE customer_id = ${kupac.A.id}`;
  assert.equal(posleProvere, 0);

  assert.deepEqual(outcomes(await applyContactProposals({ issuerCode: ISSUER, rows, dryRun: false }, owner)), ["created", ...expected.slice(1)]);
  const [nalog] = await db.sql<{ status: string; password_hash: string | null; decision_reason: string; name: string }[]>`
    SELECT status, password_hash, decision_reason, name FROM customer_users WHERE customer_id = ${kupac.A.id}`;
  assert.equal(nalog.status, "requested");
  assert.equal(nalog.password_hash, null);
  assert.equal(nalog.name, "QA A — kontakt iz BizniSoft-a");
  assert.match(nalog.decision_reason, /Potvrdio u tabeli: QA kancelarija; primenio: .+\. Izvor adrese: BizniSoft kartica partnera\./);
  const [{ n: trag }] = await db.sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM audit_log WHERE action = 'Predložen kontakt kupca' AND actor_user_id = ${owner.id}
      AND entity_id IN (SELECT id::text FROM customer_users WHERE customer_id = ${kupac.A.id})`;
  assert.equal(trag, 1);
  const [{ n: pozivi }] = await db.sql<{ n: number }[]>`
    SELECT (SELECT count(*) FROM customer_account_tokens t JOIN customer_users u ON u.id = t.customer_user_id WHERE u.customer_id = ${kupac.A.id})
         + (SELECT count(*) FROM customer_message_outbox o JOIN customer_users u ON u.id = o.customer_user_id WHERE u.customer_id = ${kupac.A.id})
         + (SELECT count(*) FROM customer_contact_verifications WHERE customer_id = ${kupac.A.id}) AS n`;
  assert.equal(Number(pozivi), 0);

  assert.deepEqual(outcomes(await applyContactProposals({ issuerCode: ISSUER, rows, dryRun: false }, owner)), ["already_present", ...expected.slice(1)]);
  const [{ n: ukupno }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM customer_users WHERE customer_id IN (${kupac.A.id}, ${kupac.B.id}, ${kupac.C.id})`;
  assert.equal(ukupno, 1);
});

test("adresa koja već pripada drugoj firmi se izdvaja, ne prepisuje", async (t) => {
  if (guard(t)) return;
  const { readContactProposals } = await import("@/lib/customers/contactProposalFiles.mjs");
  const { applyContactProposals } = await import("@/lib/customers/contact-bulk-service");
  const rows = readContactProposals([HEAD, red("B", `a-${tag}@qa.test`)].join("\n"));
  const [o] = await applyContactProposals({ issuerCode: ISSUER, rows, dryRun: false }, owner);
  assert.equal(o.outcome, "email_taken_other_customer");
});
