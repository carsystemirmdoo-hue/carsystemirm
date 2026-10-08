import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Statička strana `db/integration/customerAccountScope.integration.test.mts`:
 * spisak naloga kupaca se ne može dobiti bez opsega onoga ko gleda.
 */
const read = (rel) => readFileSync(new URL(rel, new URL("../../", import.meta.url)), "utf8");

test("listCustomerAccounts traži viewer i primenjuje opseg dodela", () => {
  const source = read("lib/customers/account-service.ts");
  const fn = source.slice(source.indexOf("export async function listCustomerAccounts"));
  assert.match(fn, /^export async function listCustomerAccounts\(\s*viewer: Pick<PortalUser/);
  assert.match(fn, /seesAllCustomers\(viewer\) \? null : await loadAssignedCustomerIds\(viewer\.id\)/);
  assert.match(fn, /if \(scope !== null && scope\.length === 0\) return \[\];/);
});

test("ekran naloga prosleđuje prijavljenog korisnika", () => {
  assert.match(read("app/portal/kupci/nalozi/page.tsx"), /listCustomerAccounts\(user\)/);
});
