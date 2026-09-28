import assert from "node:assert/strict";
import test from "node:test";
import { planAssignments } from "./assignmentPlan.mjs";

const reps = [
  { sourceCode: "1", userId: "u-rep1", userRole: "komercijalista", userActive: true },
  { sourceCode: "2", userId: "u-rep2", userRole: "komercijalista", userActive: true },
  { sourceCode: "3", userId: "u-office", userRole: "kancelarija", userActive: true },
  { sourceCode: "4", userId: "u-gone", userRole: "komercijalista", userActive: false },
  { sourceCode: "5", userId: null, userRole: null, userActive: null },
];

test("pun lanac daje predlog; svaki prekid ima razlog", () => {
  const plan = planAssignments({
    partners: [
      { partnerCode: "10", repCode: "1" },
      { partnerCode: "11", repCode: null },
      { partnerCode: "12", repCode: "1" },
      { partnerCode: "13", repCode: "9" },
      { partnerCode: "14", repCode: "3" },
      { partnerCode: "15", repCode: "4" },
      { partnerCode: "16", repCode: "5" },
    ],
    identifiers: [
      { partnerCode: "10", customerId: "c-10", status: "mapped" },
      { partnerCode: "12", customerId: null, status: "unmapped" },
      { partnerCode: "13", customerId: "c-13", status: "mapped" },
      { partnerCode: "14", customerId: "c-14", status: "mapped" },
      { partnerCode: "15", customerId: "c-15", status: "mapped" },
      { partnerCode: "16", customerId: "c-16", status: "mapped" },
    ],
    salespeople: reps,
    existing: [],
  });
  assert.deepEqual(plan.proposed, [
    { customerId: "c-10", userId: "u-rep1", repCode: "1", partnerCodes: ["10"] },
  ]);
  assert.deepEqual(
    plan.skipped.map((s) => [s.partnerCode, s.reason]),
    [
      ["11", "no_rep_code"],
      ["12", "partner_not_mapped"],
      ["13", "rep_code_not_linked"],
      ["14", "rep_user_not_eligible"],
      ["15", "rep_user_not_eligible"],
      ["16", "rep_code_not_linked"],
    ],
  );
});

test("poslovnice istog kupca: isti komercijalista se spaja, različiti su sukob", () => {
  const identifiers = [
    { partnerCode: "30", customerId: "c-gama", status: "mapped" },
    { partnerCode: "31", customerId: "c-gama", status: "mapped" },
  ];
  const same = planAssignments({
    partners: [
      { partnerCode: "30", repCode: "1" },
      { partnerCode: "31", repCode: "1" },
    ],
    identifiers,
    salespeople: reps,
    existing: [],
  });
  assert.deepEqual(same.proposed, [
    { customerId: "c-gama", userId: "u-rep1", repCode: "1", partnerCodes: ["30", "31"] },
  ]);

  const split = planAssignments({
    partners: [
      { partnerCode: "30", repCode: "1" },
      { partnerCode: "31", repCode: "2" },
    ],
    identifiers,
    salespeople: reps,
    existing: [],
  });
  assert.deepEqual(split.proposed, []);
  assert.deepEqual(
    split.skipped.map((s) => [s.partnerCode, s.reason, s.detail]),
    [
      ["30", "customer_rep_conflict", "1, 2"],
      ["31", "customer_rep_conflict", "1, 2"],
    ],
  );
});

test("postojeća dodela se ne predlaže ponovo i ništa se ne uklanja", () => {
  const plan = planAssignments({
    partners: [{ partnerCode: "10", repCode: "1" }],
    identifiers: [{ partnerCode: "10", customerId: "c-10", status: "mapped" }],
    salespeople: reps,
    existing: [
      { userId: "u-rep1", customerId: "c-10" },
      { userId: "u-rep2", customerId: "c-99" },
    ],
  });
  assert.deepEqual(plan.proposed, []);
  assert.deepEqual(plan.alreadyAssigned, [{ customerId: "c-10", userId: "u-rep1" }]);
});
