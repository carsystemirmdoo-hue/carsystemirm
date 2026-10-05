import assert from "node:assert/strict";
import test from "node:test";
import { CONTACT_COLUMNS, ContactProposalError, planContactProposals, proposalReason, readContactProposals } from "./contactProposalFiles.mjs";

const HEAD = CONTACT_COLUMNS.join(";");
const row = (o = {}) =>
  [o.code ?? "00028", o.pib ?? "100000001", o.naziv ?? "Firma", o.email ?? "Kontakt@Firma.test", o.ime ?? "Firma — kontakt iz BizniSoft-a",
    o.odluka ?? "potvrdi", o.potvrdio ?? "Mile Dulić", o.napomena ?? "Potvrda postojeće poslovne komunikacije."].join(";");
const state = (over = {}) => ({
  customersByCode: new Map([["00028", { id: "c1", pib: "100000001", active: true }]]),
  accountsByEmail: new Map(),
  accountsByCustomer: new Map(),
  ...over,
});
const plan = (lines, over) => planContactProposals({ rows: readContactProposals([HEAD, ...lines].join("\n")), ...state(over) }).map((p) => p.outcome);

test("zaglavlje mora biti tačno; odluka samo potvrdi/odbij/prazno", () => {
  assert.throws(() => readContactProposals("a;b\n1;2"), ContactProposalError);
  assert.throws(() => readContactProposals(HEAD), /nema redova/);
  assert.throws(() => readContactProposals([HEAD, row({ odluka: "da" })].join("\n")), /odluka/);
  const [r] = readContactProposals(`﻿${HEAD}\n${row()}`);
  assert.equal(r.email, "kontakt@firma.test");
  assert.equal(r.red, 2);
});

test("potvrđen, povezan, PIB isti, bez naloga → biće upisano", () => {
  assert.deepEqual(plan([row()]), ["would_create"]);
});

test("firma se nalazi samo po povezanoj šifri; PIB je provera, naziv se ne koristi", () => {
  assert.deepEqual(plan([row({ code: "28" })]), ["code_not_mapped"]);
  assert.deepEqual(plan([row({ pib: "100000002" })]), ["pib_mismatch"]);
  assert.deepEqual(plan([row({ naziv: "Sasvim drugo ime" })]), ["would_create"]);
});

test("nepotvrđen, neispravan i dupli red se ne upisuju", () => {
  assert.deepEqual(plan([row({ odluka: "" })]), ["not_confirmed"]);
  assert.deepEqual(plan([row({ potvrdio: "" })]), ["not_confirmed"]);
  assert.deepEqual(plan([row({ email: "nije-adresa" })]), ["invalid_row"]);
  assert.deepEqual(plan([row({ ime: "X" })]), ["invalid_row"]);
  assert.deepEqual(plan([row(), row()]), ["duplicate_in_file", "duplicate_in_file"]);
});

test("neaktivan kupac, istovetan kontakt, tuđa adresa i drugi kontakt kupca", () => {
  assert.deepEqual(plan([row()], { customersByCode: new Map([["00028", { id: "c1", pib: "100000001", active: false }]]) }), ["customer_inactive"]);
  assert.deepEqual(plan([row()], { accountsByEmail: new Map([["kontakt@firma.test", { customerId: "c1" }]]) }), ["already_present"]);
  assert.deepEqual(plan([row()], { accountsByEmail: new Map([["kontakt@firma.test", { customerId: "c2" }]]) }), ["email_taken_other_customer"]);
  assert.deepEqual(plan([row()], { accountsByCustomer: new Map([["c1", [{ email: "drugi@firma.test", status: "requested" }]]]) }), ["customer_has_other_contact"]);
  assert.deepEqual(plan([row()], { accountsByCustomer: new Map([["c1", [{ email: "drugi@firma.test", status: "rejected" }]]]) }), ["would_create"]);
});

test("razlog nosi ko je potvrdio, ko je primenio i izvor adrese", () => {
  const [r] = readContactProposals([HEAD, row()].join("\n"));
  const reason = proposalReason(r, "Akter");
  assert.match(reason, /Potvrdio u tabeli: Mile Dulić; primenio: Akter\. Izvor adrese: BizniSoft kartica partnera\./);
  assert.ok(reason.length <= 500);
});
