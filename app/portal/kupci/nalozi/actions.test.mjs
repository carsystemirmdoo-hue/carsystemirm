import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * Radnje nad postojećim kupčevim nalogom poštuju opseg komercijaliste.
 *
 * Regresija (revizija 2026-10-11, A12): spisak naloga je bio ograničen na
 * dodeljene kupce, ali poziv, stanje, saglasnost, potvrda, opoziv i predaja
 * pošte primali su ID bez provere opsega. Razrešavanje kupca iz naloga dokazuje
 * `db/integration/customerAccountScope.integration.test.mts`.
 */
const ROOT = new URL("../../../../", import.meta.url).pathname;
const kod = (await readFile(`${ROOT}app/portal/kupci/nalozi/actions.ts`, "utf8")).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

const telo = (ime) => {
  const start = kod.indexOf(`export async function ${ime}(`);
  assert.ok(start >= 0, `${ime} postoji`);
  const kraj = kod.indexOf("export async function", start + 10);
  return kod.slice(start, kraj === -1 ? undefined : kraj);
};

const SERVIS = {
  issueInvitationAction: "issueInvitation(",
  markHandedOverAction: "markOutboxHandedOver(",
  setAccountStatusAction: "setCustomerAccountStatus(",
  recordOfflineConsentAction: "recordOfflineConsentDecision(",
  verifyContactAction: "verifyCustomerContact(",
  revokeAccessAction: "revokeCustomerAccess(",
};

for (const [ime, poziv] of Object.entries(SERVIS)) {
  test(`${ime}: opseg kupca se proverava pre upisa`, () => {
    const t = telo(ime);
    const provera = t.indexOf("await inScope(actor,");
    assert.ok(provera > 0, "poziva inScope");
    assert.ok(provera < t.indexOf(poziv), "pre poziva servisa");
  });
}

test("predlog kontakta i dalje ide kroz requireCustomerAccess", () => {
  assert.match(telo("proposeContactAction"), /requireCustomerAccess\(actor, parsed\.data\.customerId\)/);
});

test("inScope: nepostojeći nalog nije dozvola, postojeći ide kroz requireCustomerAccess", () => {
  const start = kod.indexOf("async function inScope(");
  const f = kod.slice(start, kod.indexOf("\n}\n", start));
  assert.match(f, /if \(!customerId\) return false;/);
  assert.match(f, /await requireCustomerAccess\(actor, customerId\);/);
});
