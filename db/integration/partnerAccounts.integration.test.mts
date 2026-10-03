import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
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
 * Registar partnera → kupac → potvrđena osoba → poziv → dodela komercijalisti.
 *
 * Sve nad SINTETIČKIM podacima (`fixtures/dev/partners/partner-prep-synthetic.xlsx`).
 * Nijedna stvarna adresa, nijedan poslat poziv.
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => {
  if (reason) {
    t.skip(reason);
    return true;
  }
  return false;
};

const ISSUER = "QA-PARTNER";
const FIXTURE = new URL("../../fixtures/dev/partners/partner-prep-synthetic.xlsx", import.meta.url);

type Actor = { id: string; name: string; role: string };
let db: TestDatabase;
let fx: { office: Actor; owner: Actor; repA: Actor; repB: Actor };

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const accounts = await seedAccounts(db, [
    { key: "office", role: "kancelarija" },
    { key: "owner", role: "gazda" },
    { key: "repA", role: "komercijalista" },
    { key: "repB", role: "komercijalista" },
  ]);
  const pick = (a: { id: string; name: string; role: string }) => ({ id: a.id, name: a.name, role: a.role });
  fx = {
    office: pick(accounts.office),
    owner: pick(accounts.owner),
    repA: pick(accounts.repA),
    repB: pick(accounts.repB),
  };
});

after(async () => {
  if (!reason && db) {
    await db.sql`TRUNCATE customer_contact_verifications`;
    await db.sql`DELETE FROM customer_account_tokens`;
    await db.sql`DELETE FROM customer_message_outbox`;
    await db.sql`DELETE FROM customer_users`;
    await db.sql`DELETE FROM customer_assignments`;
    await db.sql`DELETE FROM salespeople WHERE source_code IN ('1', '2', '3')`;
    await db.sql`DELETE FROM customer_external_identifiers WHERE issuer_code = ${ISSUER}`;
    await db.sql`DELETE FROM partner_imports WHERE issuer_code = ${ISSUER}`;
    await db.sql`DELETE FROM notifications`;
    await db.sql`DELETE FROM customers WHERE name LIKE 'QA %'`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

const svc = {
  registry: () => import("@/lib/partners/partner-registry-service"),
  assignments: () => import("@/lib/partners/assignment-service"),
  accounts: () => import("@/lib/customers/account-service"),
  invitations: () => import("@/lib/customers/invitation-service"),
  verification: () => import("@/lib/customers/verification-service"),
};

async function customerIdOf(partnerCode: string): Promise<string> {
  const [row] = await db.sql<{ customer_id: string }[]>`
    SELECT customer_id FROM customer_external_identifiers
     WHERE issuer_code = ${ISSUER} AND external_partner_code = ${partnerCode} AND status = 'mapped'`;
  assert.ok(row, `šifra ${partnerCode} nije povezana`);
  return row.customer_id;
}

async function identifierIdOf(partnerCode: string): Promise<string> {
  const [row] = await db.sql<{ id: string }[]>`
    SELECT id FROM customer_external_identifiers
     WHERE issuer_code = ${ISSUER} AND external_partner_code = ${partnerCode}`;
  return row.id;
}

async function propose(customerId: string, label: string): Promise<{ id: string; email: string }> {
  const { proposeCustomerContact } = await svc.accounts();
  const email = `qa1bverify-${label}-${randomUUID().slice(0, 6)}@qa-1b.invalid`;
  const { id } = await proposeCustomerContact(
    { customerId, email, name: `QA ${label}`, reason: "QA predlog kontakta" },
    fx.repA,
  );
  return { id, email };
}

const verifyInput = (accountId: string, basisIdentifierId: string) => ({
  accountId,
  basisIdentifierId,
  method: "callback_known_number",
  contactSource: "biznisoft_partner_record",
  evidenceNote: "QA: pozvan broj sa kartice partnera, potvrdio vlasnik.",
  personRole: "vlasnik",
});

/* -------------------------------------------------------------------------
 * 1. Registar
 * ---------------------------------------------------------------------- */

test("uvoz registra: brojke iz podataka, ponovljen fajl se ne upisuje dvaput", async (t) => {
  if (guard(t)) return;
  const { recordPartnerImport } = await svc.registry();
  const bytes = readFileSync(FIXTURE);

  const first = await recordPartnerImport(
    { fileName: "partner-prep-synthetic.xlsx", bytes, issuerCode: ISSUER },
    fx.office,
  );
  assert.equal(first.duplicate, false);
  assert.equal(first.summary.partners, 10);
  assert.equal(first.summary.repAssignedCandidates, 8);
  assert.equal(first.summary.needsReview, 2);

  const again = await recordPartnerImport(
    { fileName: "isti-fajl-drugo-ime.xlsx", bytes, issuerCode: ISSUER },
    fx.office,
  );
  assert.equal(again.duplicate, true);
  assert.equal(again.importId, first.importId);

  const [{ n }] = await db.sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM partner_records WHERE import_id = ${first.importId}`;
  assert.equal(n, 10);

  // "0012" i "12" su dva partnera, i vodeća nula je sačuvana.
  const codes = await db.sql<{ partner_code: string }[]>`
    SELECT partner_code FROM partner_records
     WHERE import_id = ${first.importId} AND partner_code IN ('0012', '12') ORDER BY 1`;
  assert.deepEqual(codes.map((c) => c.partner_code), ["0012", "12"]);
});

test("trag uvoza ne sadrži nijednu adresu e-pošte ni telefon", async (t) => {
  if (guard(t)) return;
  const rows = await db.sql<{ payload: string }[]>`
    SELECT concat_ws(' ', entity_label, value_before::text, value_after::text, reason) AS payload
      FROM audit_log WHERE action = 'Uvezen registar BizniSoft partnera'`;
  assert.ok(rows.length >= 1);
  for (const r of rows) {
    assert.doesNotMatch(r.payload, /@|qa-partner|555/);
  }
});

/* -------------------------------------------------------------------------
 * 2. Partner → kupac: odluka čoveka, nikad po PIB-u sama
 * ---------------------------------------------------------------------- */

test("nov kupac traži ispravan PIB; isti PIB se ne spaja sam", async (t) => {
  if (guard(t)) return;
  const { linkPartnerToCustomer } = await svc.registry();

  for (const code of ["0012", "12", "20", "21", "30"]) {
    const r = await linkPartnerToCustomer(
      { issuerCode: ISSUER, partnerCode: code, mode: "create", reason: "QA otvaranje" },
      fx.owner,
    );
    assert.equal(r.identityStatus, "mapped", code);
  }

  await assert.rejects(
    linkPartnerToCustomer({ issuerCode: ISSUER, partnerCode: "40", mode: "create", reason: "QA razlog" }, fx.owner),
    (e: { code?: string }) => e.code === "pib_not_valid",
  );
  await assert.rejects(
    linkPartnerToCustomer({ issuerCode: ISSUER, partnerCode: "50", mode: "create", reason: "QA razlog" }, fx.owner),
    (e: { code?: string }) => e.code === "pib_not_valid",
  );
  // Poslovnica 31 ima isti PIB kao 30: sistem NE pripaja sam.
  await assert.rejects(
    linkPartnerToCustomer({ issuerCode: ISSUER, partnerCode: "31", mode: "create", reason: "QA razlog" }, fx.owner),
    (e: { code?: string }) => e.code === "pib_exists",
  );
  const gama = await customerIdOf("30");
  const attached = await linkPartnerToCustomer(
    { issuerCode: ISSUER, partnerCode: "31", mode: "attach", customerId: gama, reason: "QA poslovnica" },
    fx.owner,
  );
  assert.equal(attached.customerId, gama);

  // Već povezana šifra se ne prevezuje kroz registar.
  await assert.rejects(
    linkPartnerToCustomer(
      { issuerCode: ISSUER, partnerCode: "0012", mode: "attach", customerId: gama, reason: "QA razlog" },
      fx.owner,
    ),
    (e: { code?: string }) => e.code === "already_linked",
  );
  const [{ n }] = await db.sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM customers WHERE pib = (SELECT pib FROM customers WHERE id = ${gama})`;
  assert.equal(n, 1, "isti PIB ne sme dati dva kupca");
});

test("uz šifru iz registra upisuje se i oblik sa fakture — samo kada je nedvosmislen", async (t) => {
  if (guard(t)) return;
  // „20" je jedinstven bez vodećih nula → i „00020" pokazuje na istog kupca.
  assert.equal(await customerIdOf("00020"), await customerIdOf("20"));
  assert.equal(await customerIdOf("00031"), await customerIdOf("30"), "poslovnica: oblik sa fakture ide na pripojenog kupca");
  // „0012" i „12" su dva partnera: oblik „00012" bi bio dvosmislen i ne pravi se.
  const [{ n }] = await db.sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM customer_external_identifiers
     WHERE issuer_code = ${ISSUER} AND external_partner_code = '00012'`;
  assert.equal(n, 0);
});

/* -------------------------------------------------------------------------
 * 3. Kapija poziva
 * ---------------------------------------------------------------------- */

test("e-mail bez potvrde osobe ne dobija poziv", async (t) => {
  if (guard(t)) return;
  const { issueInvitation, InvitationBlockedError } = await svc.invitations();
  const alfa = await customerIdOf("0012");
  const acc = await propose(alfa, "alfa-nepotvrdjen");
  await assert.rejects(
    issueInvitation({ accountId: acc.id, reason: "QA poziv" }, fx.office),
    (e: unknown) =>
      e instanceof InvitationBlockedError && e.reasons.join() === "person_not_verified",
  );
  const [row] = await db.sql<{ status: string; n: number }[]>`
    SELECT u.status, (SELECT count(*)::int FROM customer_account_tokens t WHERE t.customer_user_id = u.id) AS n
      FROM customer_users u WHERE u.id = ${acc.id}`;
  assert.equal(row.status, "requested");
  assert.equal(row.n, 0, "odbijen poziv ne sme ostaviti token");
});

test("firma bez potvrđene šifre partnera ne dobija poziv ni potvrdu", async (t) => {
  if (guard(t)) return;
  const { issueInvitation, InvitationBlockedError } = await svc.invitations();
  const { verifyCustomerContact } = await svc.verification();
  const [loose] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name) VALUES (${`QA${randomUUID().slice(0, 7)}`}, 'QA Bez sifre') RETURNING id`;
  const acc = await propose(loose.id, "bez-sifre");

  await assert.rejects(
    issueInvitation({ accountId: acc.id, reason: "QA razlog" }, fx.office),
    (e: unknown) =>
      e instanceof InvitationBlockedError &&
      e.reasons.includes("company_not_identified") &&
      e.reasons.includes("person_not_verified"),
  );
  // Potvrda na osnovu TUĐE šifre partnera je odbijena.
  await assert.rejects(
    verifyCustomerContact(verifyInput(acc.id, await identifierIdOf("12")), fx.office),
    (e: { code?: string }) => e.code === "basis_invalid",
  );
});

test("baza ne prima potvrdu čija firma nije firma naloga", async (t) => {
  if (guard(t)) return;
  const alfa = await customerIdOf("0012");
  const beta = await customerIdOf("12");
  const acc = await propose(alfa, "alfa-fk");
  await assert.rejects(
    db.sql`
      INSERT INTO customer_contact_verifications
        (customer_user_id, customer_id, basis_identifier_id, verified_email, person_role,
         method, contact_source, evidence_note, verified_by)
      VALUES (${acc.id}, ${beta}, ${await identifierIdOf("12")}, ${acc.email}, 'vlasnik',
              'in_person', 'provided_by_company', 'QA direktan upis mimo servisa', ${fx.office.id})`,
    /customer_contact_verifications_account_fk/,
  );
});

test("pun tok: potvrda → poziv → aktivacija → nalog vidi samo svoju firmu", async (t) => {
  if (guard(t)) return;
  const { verifyCustomerContact } = await svc.verification();
  const { issueInvitation, activateWithInvitation } = await svc.invitations();
  const alfa = await customerIdOf("0012");
  const acc = await propose(alfa, "alfa-pun-tok");

  await verifyCustomerContact(verifyInput(acc.id, await identifierIdOf("0012")), fx.office);
  await assert.rejects(
    verifyCustomerContact(verifyInput(acc.id, await identifierIdOf("0012")), fx.office),
    (e: { code?: string }) => e.code === "already_verified",
  );

  const { token } = await issueInvitation({ accountId: acc.id, reason: "QA poziv" }, fx.office);
  const done = await activateWithInvitation({ token, password: "QA-lozinka-duga-2026" });
  assert.equal(done.ok, true);

  const [row] = await db.sql<{ status: string; customer_id: string }[]>`
    SELECT status, customer_id FROM customer_users WHERE id = ${acc.id}`;
  assert.equal(row.status, "active");
  assert.equal(row.customer_id, alfa);

  // Trag potvrde nosi način i izvor, ne belešku o dokazu.
  const audit = await db.sql<{ after: string }[]>`
    SELECT value_after::text AS after FROM audit_log
     WHERE action = 'Potvrđena ovlašćena osoba kupca' AND entity_id = ${acc.id}`;
  assert.equal(audit.length, 1);
  assert.match(audit[0].after, /callback_known_number/);
  assert.doesNotMatch(audit[0].after, /pozvan broj/);
});

test("potvrda se ne briše i ne prepravlja — samo opoziva", async (t) => {
  if (guard(t)) return;
  const [v] = await db.sql<{ id: string }[]>`
    SELECT id FROM customer_contact_verifications WHERE revoked_at IS NULL LIMIT 1`;
  await assert.rejects(
    db.sql`UPDATE customer_contact_verifications SET evidence_note = 'prepravljeno naknadno' WHERE id = ${v.id}`,
    /samo opoziv/,
  );
  await assert.rejects(
    db.sql`DELETE FROM customer_contact_verifications WHERE id = ${v.id}`,
    /samo za dodavanje/,
  );
});

test("opoziv posle izdatog poziva: stari link ne otvara nalog", async (t) => {
  if (guard(t)) return;
  const { verifyCustomerContact, revokeCustomerAccess } = await svc.verification();
  const { issueInvitation, activateWithInvitation } = await svc.invitations();
  const beta = await customerIdOf("12");
  const acc = await propose(beta, "beta-opoziv");
  await verifyCustomerContact(verifyInput(acc.id, await identifierIdOf("12")), fx.office);
  const { token } = await issueInvitation({ accountId: acc.id, reason: "QA poziv" }, fx.office);

  const [before] = await db.sql<{ v: number }[]>`SELECT session_version AS v FROM customer_users WHERE id = ${acc.id}`;
  await revokeCustomerAccess({ accountId: acc.id, reason: "QA: osoba napustila firmu" }, fx.office);

  const result = await activateWithInvitation({ token, password: "QA-lozinka-duga-2026" });
  assert.equal(result.ok, false);
  const [row] = await db.sql<{ status: string; v: number; hash: string | null }[]>`
    SELECT status, session_version AS v, password_hash AS hash FROM customer_users WHERE id = ${acc.id}`;
  assert.equal(row.status, "suspended");
  assert.equal(row.hash, null);
  assert.ok(row.v > before.v, "sesije nisu opozvane");
  const [{ open }] = await db.sql<{ open: number }[]>`
    SELECT count(*)::int AS open FROM customer_account_tokens
     WHERE customer_user_id = ${acc.id} AND used_at IS NULL AND superseded_at IS NULL`;
  assert.equal(open, 0);
});

test("potvrda opozvana mimo servisa: aktivacija i dalje pada (druga linija odbrane)", async (t) => {
  if (guard(t)) return;
  const { verifyCustomerContact } = await svc.verification();
  const { issueInvitation, activateWithInvitation } = await svc.invitations();
  const beta = await customerIdOf("12");
  const acc = await propose(beta, "beta-druga-linija");
  await verifyCustomerContact(verifyInput(acc.id, await identifierIdOf("12")), fx.office);
  const { token } = await issueInvitation({ accountId: acc.id, reason: "QA poziv" }, fx.office);

  // Token ostaje otvoren; opozvana je samo potvrda.
  await db.sql`
    UPDATE customer_contact_verifications
       SET revoked_at = now(), revoked_by = ${fx.office.id}, revoke_reason = 'QA direktno'
     WHERE customer_user_id = ${acc.id} AND revoked_at IS NULL`;
  const result = await activateWithInvitation({ token, password: "QA-lozinka-duga-2026" });
  assert.equal(result.ok, false);
  const [row] = await db.sql<{ status: string }[]>`SELECT status FROM customer_users WHERE id = ${acc.id}`;
  assert.equal(row.status, "approved");
  const [audit] = await db.sql<{ reason: string }[]>`
    SELECT reason FROM audit_log
     WHERE action = 'Odbijena aktivacija kupčevog naloga' AND entity_id = ${acc.id}`;
  assert.match(audit.reason, /person_not_verified/);
});

test("isključenje posle izdatog poziva poništava token (ranija rupa)", async (t) => {
  if (guard(t)) return;
  const { verifyCustomerContact } = await svc.verification();
  const { issueInvitation, activateWithInvitation } = await svc.invitations();
  const { setCustomerAccountStatus } = await svc.accounts();
  const beta = await customerIdOf("12");
  const acc = await propose(beta, "beta-iskljucen");
  await verifyCustomerContact(verifyInput(acc.id, await identifierIdOf("12")), fx.office);
  const { token } = await issueInvitation({ accountId: acc.id, reason: "QA poziv" }, fx.office);

  await setCustomerAccountStatus(
    { accountId: acc.id, status: "suspended", reason: "QA isključenje" },
    fx.office,
  );
  const result = await activateWithInvitation({ token, password: "QA-lozinka-duga-2026" });
  assert.equal(result.ok, false);
  const [row] = await db.sql<{ status: string }[]>`SELECT status FROM customer_users WHERE id = ${acc.id}`;
  assert.equal(row.status, "suspended");
});

test("deljena e-pošta dve firme ne može postati nalog obe", async (t) => {
  if (guard(t)) return;
  const { proposeCustomerContact } = await svc.accounts();
  const a = await customerIdOf("20");
  const b = await customerIdOf("21");
  const shared = `qa1bverify-knjige-${randomUUID().slice(0, 6)}@qa-1b.invalid`;
  await proposeCustomerContact({ customerId: a, email: shared, name: "QA Knjige", reason: "QA razlog" }, fx.office);
  await assert.rejects(
    proposeCustomerContact({ customerId: b, email: shared, name: "QA Knjige", reason: "QA razlog" }, fx.office),
    (e: { code?: string }) => e.code === "duplicate_email",
  );
});

/* -------------------------------------------------------------------------
 * 4. Dodele iz šifre komercijaliste i opseg
 * ---------------------------------------------------------------------- */

test("plan dodela: pun lanac dodeljuje, poslovnice sa dva komercijaliste su sukob", async (t) => {
  if (guard(t)) return;
  const { linkSalespersonCode, previewAssignmentPlan, applyAssignmentPlan } = await svc.assignments();

  // Pre veze šifara nema nijednog predloga.
  const empty = await previewAssignmentPlan(ISSUER);
  assert.equal(empty.proposed.length, 0);
  assert.ok(empty.skipped.every((s) => s.reason !== "customer_rep_conflict"));

  await assert.rejects(
    linkSalespersonCode({ sourceCode: "3", userId: fx.office.id }, fx.owner),
    (e: { code?: string }) => e.code === "not_sales_rep",
  );
  await linkSalespersonCode({ sourceCode: "1", userId: fx.repA.id }, fx.owner);
  await linkSalespersonCode({ sourceCode: "2", userId: fx.repB.id }, fx.owner);

  const plan = await previewAssignmentPlan(ISSUER);
  const gama = await customerIdOf("30");
  assert.ok(plan.skipped.some((s) => s.partnerCode === "30" && s.reason === "customer_rep_conflict"));
  assert.ok(!plan.proposed.some((p) => p.customerId === gama));

  const applied = await applyAssignmentPlan(ISSUER, fx.owner);
  assert.equal(applied.granted, plan.proposed.length);
  const again = await applyAssignmentPlan(ISSUER, fx.owner);
  assert.equal(again.granted, 0, "ponovljena primena ne sme dodati ništa");

  const rows = await db.sql<{ basis: string }[]>`SELECT DISTINCT basis FROM customer_assignments`;
  assert.deepEqual(rows.map((r) => r.basis), ["biznisoft_rep_code"]);
});

test("komercijalista vidi samo dodeljene kupce — provera na serveru, po ID-u", async (t) => {
  if (guard(t)) return;
  const { loadAssignedCustomerIds } = await import("@/lib/authz/user-repository");
  const { canAccessCustomer } = await import("@/lib/authz/scope.mjs");
  const alfa = await customerIdOf("0012"); // komercijalista 1
  const beta = await customerIdOf("12"); // komercijalista 2
  const gama = await customerIdOf("30"); // sukob — nikome

  const a = await loadAssignedCustomerIds(fx.repA.id);
  const b = await loadAssignedCustomerIds(fx.repB.id);
  const repA = { role: "komercijalista", permissions: [] };
  const office = { role: "kancelarija", permissions: [] };

  assert.equal(canAccessCustomer(repA, a, alfa), true);
  assert.equal(canAccessCustomer(repA, a, beta), false, "A vidi kupca komercijaliste B");
  assert.equal(canAccessCustomer(repA, b, alfa), false, "B vidi kupca komercijaliste A");
  assert.equal(canAccessCustomer(repA, a, gama), false);
  assert.equal(canAccessCustomer(repA, b, gama), false);
  assert.equal(canAccessCustomer(office, [], gama), true, "kancelarija vidi sve");
});

test("oduzimanje dodele deluje odmah i ostavlja trag", async (t) => {
  if (guard(t)) return;
  const { removeAssignment, assignCustomer } = await svc.assignments();
  const { loadAssignedCustomerIds } = await import("@/lib/authz/user-repository");
  const gama = await customerIdOf("30");

  await assignCustomer({ customerId: gama, userId: fx.repA.id, reason: "QA ručna odluka posle sukoba" }, fx.owner);
  assert.ok((await loadAssignedCustomerIds(fx.repA.id)).includes(gama));

  const r = await removeAssignment({ customerId: gama, userId: fx.repA.id, reason: "QA preraspodela" }, fx.owner);
  assert.equal(r.removed, true);
  assert.ok(!(await loadAssignedCustomerIds(fx.repA.id)).includes(gama));

  const actions = await db.sql<{ action: string }[]>`
    SELECT action FROM audit_log WHERE entity_id = ${gama} ORDER BY id`;
  assert.deepEqual(
    actions.map((x) => x.action).filter((x) => x.startsWith("Kupac")),
    ["Kupac dodeljen komercijalisti", "Kupac oduzet komercijalisti"],
  );
});

/* -------------------------------------------------------------------------
 * Neaktivan kupac: bez poziva; istorija i veza ostaju; povratak vraća poziv.
 * ---------------------------------------------------------------------- */

test("neaktivan kupac ne dobija poziv; veza ostaje; vraćen u aktivne opet može", async (t) => {
  if (guard(t)) return;
  const { verifyCustomerContact } = await svc.verification();
  const { issueInvitation, InvitationBlockedError } = await svc.invitations();
  const { setCustomerActive, CustomerStatusError } = await import("@/lib/customers/customer-status-service");
  const alfa = await customerIdOf("0012");
  const acc = await propose(alfa, "alfa-neaktivan");
  await verifyCustomerContact(verifyInput(acc.id, await identifierIdOf("0012")), fx.office);

  await assert.rejects(setCustomerActive({ customerId: alfa, active: false, reason: "x" }, fx.office),
    (e: unknown) => e instanceof CustomerStatusError && e.code === "reason_short");
  await setCustomerActive({ customerId: alfa, active: false, reason: "Poslovna potvrda: više ne radi" }, fx.office);
  await assert.rejects(setCustomerActive({ customerId: alfa, active: false, reason: "ponovo isto" }, fx.office),
    (e: unknown) => e instanceof CustomerStatusError && e.code === "no_change");

  await assert.rejects(
    issueInvitation({ accountId: acc.id, reason: "QA poziv" }, fx.office),
    (e: unknown) => e instanceof InvitationBlockedError && e.reasons.includes("customer_inactive"),
  );
  // Veza šifre i kupac ostaju; ništa nije obrisano.
  const [{ n }] = await db.sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM customer_external_identifiers WHERE customer_id = ${alfa} AND status = 'mapped'`;
  assert.ok(n >= 1, "veza šifre je nestala");
  const trag = await db.sql<{ action: string; reason: string; after: string }[]>`
    SELECT action, reason, value_after::text AS after FROM audit_log
     WHERE entity_id = ${alfa} AND action LIKE 'Kupac %aktiv%' ORDER BY created_at`;
  assert.deepEqual(trag.map((x) => x.action), ["Kupac označen kao neaktivan"]);
  assert.equal(trag[0].reason, "Poslovna potvrda: više ne radi");

  await setCustomerActive({ customerId: alfa, active: true, reason: "QA: vraćen" }, fx.office);
  const { token } = await issueInvitation({ accountId: acc.id, reason: "QA poziv" }, fx.office);
  assert.ok(token);
});
