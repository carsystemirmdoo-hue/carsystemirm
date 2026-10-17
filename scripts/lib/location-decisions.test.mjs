import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { applyLocationDecisions } from "./location-decisions.mjs";

const base = [
  { id: "a", name: "Prodavnica A", address: "A. ULICA 1", city: "A", type: "partner", verificationStatus: "pending", coordinateStatus: "geocoded_preview", isPublic: true, latitude: 45, longitude: 20 },
  { id: "b", name: "B", address: "B. ULICA 2", city: "B", type: "partner", verificationStatus: "pending", coordinateStatus: "geocoded_preview", isPublic: true, latitude: 45.1, longitude: 20.1 },
  { id: "c", name: "Sporna", address: "C. SELO 0", city: "C", type: "partner", verificationStatus: "pending", coordinateStatus: "approximate", isPublic: true, latitude: 44, longitude: 21 },
  { id: "v", name: "Potvrđena", address: "Ulica 3, V", city: "V", type: "store", verificationStatus: "verified", coordinateStatus: "verified", isPublic: true, latitude: 44.5, longitude: 20.5 },
];
const decisions = {
  decisions: [
    { id: "a", status: "reviewed", type: "store", name: "Prodavnica A", address: "Ulica 1, A", city: "A" },
    { id: "b", mergeInto: "v" },
  ],
};

test("revidiran zapis postaje javan sa vrstom i javnom adresom", () => {
  const { locations } = applyLocationDecisions(base, decisions);
  const a = locations.find((item) => item.id === "a");
  assert.equal(a.verificationStatus, "reviewed");
  assert.equal(a.type, "store");
  assert.equal(a.address, "Ulica 1, A");
});

test("duplikat se uklanja, a naziv postaje alternativni naziv cilja", () => {
  const { locations } = applyLocationDecisions(base, decisions);
  assert.equal(locations.some((item) => item.id === "b"), false);
  assert.deepEqual(locations.find((item) => item.id === "v").alternativeNames, ["B"]);
});

test("zapis bez odluke ostaje pending (sporni se ne prikazuju)", () => {
  const { locations } = applyLocationDecisions(base, decisions);
  assert.equal(locations.find((item) => item.id === "c").verificationStatus, "pending");
});

test("ponovna primena daje isti rezultat", () => {
  const once = applyLocationDecisions(base, decisions).locations;
  const twice = applyLocationDecisions(once, decisions).locations;
  assert.deepEqual(twice, once);
});

test("revidiran zapis mora imati javnu vrstu", () => {
  assert.throws(() =>
    applyLocationDecisions(base, { decisions: [{ id: "a", status: "reviewed", type: "unknown" }] }),
  );
});

test("javni fajl odluka ne nosi obrazloženja ni interne podatke", () => {
  const file = JSON.parse(fs.readFileSync(new URL("../../data/public-location-decisions.json", import.meta.url)));
  const allowed = new Set(["id", "status", "type", "name", "address", "city", "mergeInto"]);
  for (const decision of file.decisions) {
    for (const key of Object.keys(decision)) assert.ok(allowed.has(key), `${decision.id}: ${key}`);
    assert.doesNotMatch(JSON.stringify(decision), /\b0\d{2}[ /-]?\d{3}/, `${decision.id}: telefon`);
  }
});
