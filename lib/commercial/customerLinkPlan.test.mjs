import assert from "node:assert/strict";
import test from "node:test";
import { planCustomerLinks } from "./customerLinkPlan.mjs";
import { pibCheckDigit } from "../partners/pib.mjs";

// Sintetički PIB-ovi sa ispravnom kontrolnom cifrom.
const pib = (first8) => `${first8}${pibCheckDigit(first8)}`;
const A = pib("10000001"), B = pib("10000002"), C = pib("10000003"), D = pib("10000004");

const REGISTER = [
  { code: "28", pib: A, name: "PRIMER A DOO", city: "MESTO" },
  { code: "394", pib: B, name: "PRIMER B DOO" },
  { code: "500", pib: C, name: "PRIMER C", blocked: true },
  { code: "77", pib: D, name: "PRIMER D DOO" },
];
const EMPTY = { customersByPib: new Map(), identifiers: new Map() };
const plan = (invoicePartners, existing = EMPTY) =>
  planCustomerLinks({ issuerCode: "QA", register: REGISTER, invoicePartners, existing });

test("šifra sa nulama + isti PIB: predlog novog kupca, izvorne šifre sačuvane", () => {
  const { proposals, excluded } = plan([{ code: "00028", pib: A, documents: 3 }]);
  assert.equal(excluded.length, 0);
  const [p] = proposals;
  assert.equal(p.action, "create_customer_and_link");
  assert.equal(p.invoiceCode, "00028");
  assert.equal(p.registerCode, "28");
  assert.equal(p.name, "PRIMER A DOO");
  assert.match(p.key, /^[0-9a-f]{16}$/);
});

test("kupac sa istim PIB-om postoji: veza na njega, ne nov kupac", () => {
  const existing = { customersByPib: new Map([[A, { id: "c-1", name: "Postojeći" }]]), identifiers: new Map() };
  const [p] = plan([{ code: "00028", pib: A, documents: 1 }], existing).proposals;
  assert.equal(p.action, "link_existing_customer");
  assert.equal(p.customerId, "c-1");
});

test("ponovno pokretanje posle primene: već povezano, bez nove radnje", () => {
  const existing = {
    customersByPib: new Map([[A, { id: "c-1", name: "Postojeći" }]]),
    identifiers: new Map([["00028", { customerId: "c-1", status: "mapped" }]]),
  };
  const [p] = plan([{ code: "00028", pib: A, documents: 1 }], existing).proposals;
  assert.equal(p.action, "already_linked");
});

test("šifra koja čeka mapiranje (iz ranijeg uvoza) se dopunjuje", () => {
  const existing = { customersByPib: new Map(), identifiers: new Map([["00028", { customerId: null, status: "unmapped" }]]) };
  assert.equal(plan([{ code: "00028", pib: A, documents: 1 }], existing).proposals[0].action, "create_customer_and_link");
});

test("nejasni slučajevi se izdvajaju, ne predlažu", () => {
  const otherCustomer = {
    customersByPib: new Map([[A, { id: "c-1", name: "x" }]]),
    identifiers: new Map([["00028", { customerId: "c-2", status: "mapped" }]]),
  };
  const reasons = (ps, ex = EMPTY) => plan(ps, ex).excluded.map((e) => e.reason);
  assert.deepEqual(reasons([{ code: "00028", pib: B, documents: 1 }]), ["pib_mismatch"]);
  assert.deepEqual(reasons([{ code: "00999", pib: A, documents: 1 }]), ["not_in_register"]);
  assert.deepEqual(reasons([{ code: "00500", pib: C, documents: 1 }]), ["partner_blocked_in_register"]);
  assert.deepEqual(reasons([{ code: "00028", pib: A, documents: 1 }], otherCustomer), ["identifier_points_to_other_customer"]);
  assert.deepEqual(reasons([{ code: "00028", pib: A, documents: 1 }], { customersByPib: new Map(), identifiers: new Map([["00028", { customerId: null, status: "conflict" }]]) }), ["identifier_in_conflict"]);
  // Isti PIB pod dve šifre sa faktura.
  assert.deepEqual(reasons([{ code: "00028", pib: A, documents: 1 }, { code: "0028", pib: A, documents: 1 }]).sort(), ["pib_under_several_invoice_codes", "pib_under_several_invoice_codes"]);
});

test("nov kupac traži ispravan domaći PIB", () => {
  const reg = [{ code: "9", pib: "123456789", name: "X" }];
  const out = planCustomerLinks({ issuerCode: "QA", register: reg, invoicePartners: [{ code: "00009", pib: "123456789", documents: 1 }], existing: EMPTY });
  assert.deepEqual(out.excluded.map((e) => e.reason), ["pib_not_valid_for_new_customer"]);
});

test("naziv se nikad ne koristi za vezu: isti naziv, druga šifra — nije predlog", () => {
  const reg = [...REGISTER, { code: "29", pib: pib("10000009"), name: "PRIMER A DOO" }];
  const out = planCustomerLinks({ issuerCode: "QA", register: reg, invoicePartners: [{ code: "00029", pib: A, documents: 1 }], existing: EMPTY });
  assert.deepEqual(out.excluded.map((e) => e.reason), ["pib_mismatch"]);
});

test("predlog ne sadrži ništa o nalogu za prijavu", () => {
  const [p] = plan([{ code: "00077", pib: D, documents: 1 }]).proposals;
  assert.equal(JSON.stringify(p).includes("email"), false);
  assert.equal(JSON.stringify(p).includes("account"), false);
});

test("izdavalac je obavezan", () => {
  assert.throws(() => planCustomerLinks({ issuerCode: " ", register: [], invoicePartners: [], existing: EMPTY }));
});
