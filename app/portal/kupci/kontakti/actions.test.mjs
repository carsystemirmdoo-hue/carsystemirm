import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * Grupni predlog kontakata: kapije pred upisom i akter iz sesije (provera nad
 * izvorom, kao za veze). Servis dokazuje `db/integration/contactBulk.integration.test.mts`.
 */
const ROOT = new URL("../../../../", import.meta.url).pathname;
const kod = (await readFile(`${ROOT}app/portal/kupci/kontakti/actions.ts`, "utf8")).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
const servis = (await readFile(`${ROOT}lib/customers/contact-bulk-service.ts`, "utf8")).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

test("svaki poziv traži customer_accounts:manage; primena i svež drugi faktor istog korisnika", () => {
  assert.match(kod, /requireCapability\("customer_accounts:manage"/);
  const primena = kod.slice(kod.indexOf('if (mode === "primena") {'));
  assert.match(primena, /requireRecentMfa\(\)/);
  assert.match(primena, /fresh\.id !== actor\.id/);
  assert.match(primena, /isPartnerRegistryUploadEnabled\(\)/);
  assert.match(primena, /formData\.get\("potvrda"\) !== "da"/);
});

test("forma ne nosi aktera; bez izričite primene samo provera", () => {
  const polja = [...kod.matchAll(/formData\.get\("([^"]+)"\)/g)].map((m) => m[1]).sort();
  assert.deepEqual(polja, ["issuerCode", "mode", "potvrda", "tabela"]);
  assert.match(kod, /dryRun: mode !== "primena"/);
  assert.match(kod, /\{ id: actor\.id, name: actor\.name, role: actor\.role \}/);
});

test("servis pravi samo nalog requested bez lozinke — bez poziva, potvrde osobe i pošte", () => {
  assert.match(servis, /passwordHash: null/);
  assert.match(servis, /status: "requested"/);
  assert.doesNotMatch(servis, /issueInvitation|verifyCustomerContact|customerContactVerifications|customerMessageOutbox|customerAccountTokens/);
});
