import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import {
  cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase, seedAccounts, skipReason, type TestDatabase,
} from "./harness.mts";

/**
 * Alat za vezu kupaca: primena SAMO potvrđenih predloga, idempotentno.
 * Sve vrednosti su sintetičke (PIB-ovi ispod 10.000.000, izmišljeni nazivi).
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => { if (reason) { t.skip(reason); return true; } return false; };

let db: TestDatabase;
let actor: { id: string; name: string; role: string };
const ISSUER = `QA${randomUUID().slice(0, 6)}`;
let pibs: string[];

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const accounts = await seedAccounts(db, [{ key: "link-office", role: "kancelarija" }]);
  actor = { id: accounts["link-office"].id, name: accounts["link-office"].name, role: "kancelarija" };
  const { pibCheckDigit } = await import("@/lib/partners/pib.mjs");
  const base = randomInt(100000, 999000);
  pibs = [0, 1, 2].map((i) => { const first8 = String(base + i).padStart(8, "0"); return `${first8}${pibCheckDigit(first8)}`; });
});

after(async () => {
  if (!reason && db) {
    await db.sql`DELETE FROM customer_external_identifiers WHERE issuer_code = ${ISSUER}`;
    await db.sql`DELETE FROM customers WHERE pib IN ${db.sql(pibs)}`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

const register = () => [
  { code: "28", pib: pibs[0], name: "QA PRIMER A", city: "QA" },
  { code: "394", pib: pibs[1], name: "QA PRIMER B" },
  { code: "77", pib: pibs[2], name: "QA PRIMER C" },
];
const partners = () => [
  { code: "00028", pib: pibs[0], documents: 2 },
  { code: "00394", pib: pibs[1], documents: 1 },
  { code: "00077", pib: pibs[2], documents: 1 },
];

test("probni prolaz ne upisuje ništa; nepotvrđen predlog se ne primenjuje", async (t) => {
  if (guard(t)) return;
  const { planFromDatabase, applyConfirmedLinks } = await import("@/lib/commercial/customerLinkApply");
  const { proposals } = await planFromDatabase({ issuerCode: ISSUER, register: register(), invoicePartners: partners() });
  assert.equal(proposals.length, 3);
  const decisions = proposals.map((p, i) => ({ key: p.key, decision: (i === 2 ? "" : "potvrdi") as "potvrdi" | "", confirmedBy: "QA Kancelarija" }));
  const dry = await applyConfirmedLinks({ issuerCode: ISSUER, register: register(), invoicePartners: partners(), decisions, dryRun: true }, actor);
  assert.deepEqual(dry.map((o) => o.result).sort(), ["not_confirmed", "would_apply", "would_apply"]);
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM customers WHERE pib IN ${db.sql(pibs)}`;
  assert.equal(n, 0, "probni prolaz ne pravi kupce");
});

test("primena potvrđenih, pa ponovno pokretanje bez duplikata i bez naloga za prijavu", async (t) => {
  if (guard(t)) return;
  const { planFromDatabase, applyConfirmedLinks } = await import("@/lib/commercial/customerLinkApply");
  // Postojeći kupac sa PIB-om B i šifra C koja već čeka mapiranje (kao posle uvoza).
  const [existingB] = await db.sql<{ id: string }[]>`INSERT INTO customers (pib, name) VALUES (${pibs[1]}, 'QA postojeći B') RETURNING id`;
  await db.sql`INSERT INTO customer_external_identifiers (source_system, issuer_code, external_partner_code, status)
               VALUES ('biznisoft', ${ISSUER}, '00077', 'unmapped')`;

  const first = await planFromDatabase({ issuerCode: ISSUER, register: register(), invoicePartners: partners() });
  const byCode = new Map(first.proposals.map((p) => [p.invoiceCode, p]));
  assert.equal(byCode.get("00028")!.action, "create_customer_and_link");
  assert.equal(byCode.get("00394")!.action, "link_existing_customer");
  assert.equal(byCode.get("00077")!.action, "create_customer_and_link");

  const decisions = first.proposals.map((p) => ({ key: p.key, decision: "potvrdi" as const, confirmedBy: "QA Kancelarija" }));
  const out = await applyConfirmedLinks({ issuerCode: ISSUER, register: register(), invoicePartners: partners(), decisions, dryRun: false }, actor);
  assert.deepEqual(out.map((o) => o.result).sort(), ["created_and_linked", "created_and_linked", "linked_existing"]);

  const idents = await db.sql<{ code: string; status: string; customer_id: string; verified_by: string; note: string }[]>`
    SELECT external_partner_code AS code, status, customer_id, verified_by, note
    FROM customer_external_identifiers WHERE issuer_code = ${ISSUER} ORDER BY code`;
  assert.deepEqual(idents.map((i) => [i.code, i.status]), [["00028", "mapped"], ["00077", "mapped"], ["00394", "mapped"]]);
  assert.ok(idents.every((i) => i.verified_by === actor.id && /Potvrdio: QA Kancelarija/.test(i.note)));
  assert.equal(idents.find((i) => i.code === "00394")!.customer_id, existingB.id, "vezano za postojećeg kupca");

  // Stari otisci posle primene više ne važe — ponovna primena istih potvrda je zastarela, ne duplikat.
  const again = await applyConfirmedLinks({ issuerCode: ISSUER, register: register(), invoicePartners: partners(), decisions, dryRun: false }, actor);
  assert.ok(again.every((o) => o.result === "stale" || o.result === "already_linked"));

  // Nov plan: sve je već povezano.
  const second = await planFromDatabase({ issuerCode: ISSUER, register: register(), invoicePartners: partners() });
  assert.deepEqual(second.proposals.map((p) => p.action), ["already_linked", "already_linked", "already_linked"]);
  const redo = await applyConfirmedLinks({
    issuerCode: ISSUER, register: register(), invoicePartners: partners(),
    decisions: second.proposals.map((p) => ({ key: p.key, decision: "potvrdi" as const, confirmedBy: "QA" })), dryRun: false,
  }, actor);
  assert.ok(redo.every((o) => o.result === "already_linked"));

  const [{ customersN }] = await db.sql<{ customersN: number }[]>`SELECT count(*)::int AS "customersN" FROM customers WHERE pib IN ${db.sql(pibs)}`;
  const [{ identN }] = await db.sql<{ identN: number }[]>`SELECT count(*)::int AS "identN" FROM customer_external_identifiers WHERE issuer_code = ${ISSUER}`;
  assert.equal(customersN, 3);
  assert.equal(identN, 3);
  const [{ accounts }] = await db.sql<{ accounts: number }[]>`
    SELECT count(*)::int AS accounts FROM customer_users cu JOIN customers c ON c.id = cu.customer_id WHERE c.pib IN ${db.sql(pibs)}`;
  assert.equal(accounts, 0, "nalog za prijavu se ne pravi");
  const [{ audits }] = await db.sql<{ audits: number }[]>`
    SELECT count(*)::int AS audits FROM audit_log WHERE entity_label LIKE ${`biznisoft/${ISSUER}/%`}`;
  assert.equal(audits, 5, "dve otvaranja kupca + tri veze");
});

test("predlog zastareo posle promene stanja se ne primenjuje", async (t) => {
  if (guard(t)) return;
  const { applyConfirmedLinks } = await import("@/lib/commercial/customerLinkApply");
  const out = await applyConfirmedLinks({
    issuerCode: ISSUER, register: register(), invoicePartners: partners(),
    decisions: [{ key: "0000000000000000", decision: "potvrdi", confirmedBy: "QA" }], dryRun: false,
  }, actor);
  assert.deepEqual(out.map((o) => o.result), ["stale"]);
});
