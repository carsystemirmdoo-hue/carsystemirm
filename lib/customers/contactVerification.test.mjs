import assert from "node:assert/strict";
import test from "node:test";
import {
  decideActivation,
  decideInvitation,
  EVIDENCE_NOTE_MIN,
  VERIFICATION_MAX_AGE_DAYS,
  validateVerificationInput,
} from "./contactVerification.mjs";

const NOW = new Date("2026-09-28T10:00:00Z");
const DAY = 24 * 60 * 60_000;

function base(overrides = {}) {
  return {
    account: { id: "acc-a", customerId: "cust-a", email: "nabavka@firma-a.invalid", status: "requested" },
    customerActive: true,
    identifiers: [{ id: "idf-a", customerId: "cust-a", status: "mapped" }],
    verification: {
      customerUserId: "acc-a",
      customerId: "cust-a",
      basisIdentifierId: "idf-a",
      verifiedEmail: "nabavka@firma-a.invalid",
      verifiedAt: new Date(NOW.getTime() - DAY),
      revokedAt: null,
    },
    now: NOW,
    ...overrides,
  };
}

test("poziv prolazi samo kada su firma i osoba potvrđene", () => {
  assert.deepEqual(decideInvitation(base()), { allowed: true, reasons: [] });
});

test("e-mail sa kartice bez potvrde osobe ne dobija poziv", () => {
  const r = decideInvitation(base({ verification: null }));
  assert.equal(r.allowed, false);
  assert.deepEqual(r.reasons, ["person_not_verified"]);
});

test("firma bez potvrđene šifre partnera ne dobija poziv", () => {
  for (const identifiers of [
    [],
    [{ id: "idf-a", customerId: "cust-a", status: "unmapped" }],
    [{ id: "idf-a", customerId: "cust-a", status: "conflict" }],
    // Šifra je potvrđena, ali za DRUGU firmu.
    [{ id: "idf-a", customerId: "cust-b", status: "mapped" }],
  ]) {
    const r = decideInvitation(base({ identifiers }));
    assert.equal(r.allowed, false);
    assert.ok(r.reasons.includes("company_not_identified"), JSON.stringify(identifiers));
    assert.ok(r.reasons.includes("verification_basis_invalid"));
  }
});

test("potvrda tuđeg naloga, druge firme ili druge adrese ne važi", () => {
  const b = base();
  assert.deepEqual(
    decideInvitation(base({ verification: { ...b.verification, customerUserId: "acc-b" } })).reasons,
    ["verification_mismatch"],
  );
  assert.deepEqual(
    decideInvitation(base({ verification: { ...b.verification, customerId: "cust-b" } })).reasons,
    ["verification_mismatch"],
  );
  assert.deepEqual(
    decideInvitation(base({ verification: { ...b.verification, verifiedEmail: "drugi@firma-a.invalid" } })).reasons,
    ["verification_email_mismatch"],
  );
});

test("opozvana potvrda je isto što i nepostojeća", () => {
  const b = base();
  const r = decideInvitation(base({ verification: { ...b.verification, revokedAt: NOW } }));
  assert.deepEqual(r.reasons, ["person_not_verified"]);
});

test("potvrda ističe za NOV poziv posle roka, ne pre", () => {
  const b = base();
  const at = (days) =>
    decideInvitation(
      base({ verification: { ...b.verification, verifiedAt: new Date(NOW.getTime() - days * DAY) } }),
    );
  assert.equal(at(VERIFICATION_MAX_AGE_DAYS).allowed, true);
  assert.deepEqual(at(VERIFICATION_MAX_AGE_DAYS + 1).reasons, ["verification_expired"]);
});

test("stanja naloga: odbijen, isključen i aktivan ne dobijaju poziv", () => {
  for (const status of ["rejected", "suspended", "active"]) {
    const b = base();
    const r = decideInvitation(base({ account: { ...b.account, status } }));
    assert.deepEqual(r.reasons, ["account_status"], status);
  }
  assert.equal(decideInvitation(base({ customerActive: false })).reasons[0], "customer_inactive");
});

test("aktivacija traži stanje approved i živu potvrdu", () => {
  const b = base();
  const approved = { ...b.account, status: "approved" };
  assert.equal(decideActivation(base({ account: approved })).allowed, true);

  // Isključen POSLE izdavanja poziva: stari token više ne otvara nalog.
  assert.deepEqual(decideActivation(base({ account: { ...approved, status: "suspended" } })).reasons, [
    "account_status",
  ]);
  // Potvrda opozvana posle izdavanja poziva.
  assert.deepEqual(
    decideActivation(base({ account: approved, verification: { ...b.verification, revokedAt: NOW } })).reasons,
    ["person_not_verified"],
  );
  // Starost potvrde ne obara poziv koji je već na putu.
  assert.equal(
    decideActivation(
      base({
        account: approved,
        verification: { ...b.verification, verifiedAt: new Date(NOW.getTime() - 200 * DAY) },
      }),
    ).allowed,
    true,
  );
});

test("unos potvrde: dokaz, funkcija i URL za javni izvor", () => {
  const ok = {
    method: "callback_known_number",
    contactSource: "biznisoft_partner_record",
    evidenceNote: "Pozvan broj sa kartice, potvrdio vlasnik 28.09.",
    personRole: "vlasnik",
  };
  assert.equal(validateVerificationInput(ok), null);
  assert.match(validateVerificationInput({ ...ok, method: "email_reply" }), /način/);
  assert.match(validateVerificationInput({ ...ok, evidenceNote: "x".repeat(EVIDENCE_NOTE_MIN - 1) }), /najmanje/);
  assert.match(validateVerificationInput({ ...ok, personRole: "" }), /funkciju/);
  assert.match(
    validateVerificationInput({ ...ok, contactSource: "public_business_listing", sourceReference: "google" }),
    /URL/,
  );
  assert.equal(
    validateVerificationInput({
      ...ok,
      contactSource: "public_business_listing",
      sourceReference: "https://primer.invalid/kontakt",
    }),
    null,
  );
});
