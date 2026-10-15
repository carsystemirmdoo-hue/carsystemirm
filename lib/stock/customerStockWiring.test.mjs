import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/*
 * Lager kupcima (dok. 65 §4, odluka 15. 10. 2026): izvorni ugovori koje jedinični testovi
 * ne pokrivaju — maintenance propušta SAMO kupčevu sesiju, API ne daje stanje bez sesije,
 * prekidač je samo za vlasnika uz svež drugi faktor i audit.
 */
const read = (p) => readFile(new URL(`../../${p}`, import.meta.url), "utf8");

test("maintenance: prijavljen kupac prolazi bez koda sajta; ostali i dalje idu na „sajt u pripremi“", async () => {
  const mw = await read("middleware.ts");
  assert.match(mw, /const signedInCustomer = Boolean\(request\.auth\?\.user\?\.id\) && request\.auth\?\.user\?\.subject === SUBJECT_CUSTOMER;/);
  assert.match(mw, /const hasAccess = signedInCustomer \|\| \(await hasSiteAccess\(request\)\);/);
  assert.match(mw, /if \(maintenanceEnabled && !hasAccess\) \{\s*return redirectTo\(request, MAINTENANCE_ROUTE\);/);
});

test("API ponuda: bez kupčeve sesije 401 bez podataka; stanje samo iz servisa prikaza", async () => {
  const api = await read("app/api/kupac/ponude/route.ts");
  assert.match(api, /if \(!session\) return Response\.json\(\{ signedIn: false \}, \{ status: 401, headers: NO_STORE \}\);/);
  assert.ok(api.indexOf("if (!session)") < api.indexOf("customerStockFor("), "sesija pre čitanja lagera");
  assert.match(api, /"Cache-Control": "no-store, private"/);
});

test("prekidač prikaza: settings:manage, svež drugi faktor istog korisnika, audit u istoj transakciji", async () => {
  const a = await read("app/portal/zalihe/actions.ts");
  assert.match(a, /requireCapability\("settings:manage", PATH\)/);
  assert.match(a, /requireRecentMfaOrReauth\(PATH\)/);
  assert.match(a, /fresh\.id !== actor\.id \|\| !can\(fresh, "settings:manage"\)/);
  assert.match(a, /db\.transaction\(async \(tx\) => \{[\s\S]*recordAudit\([\s\S]*AUDIT_ACTIONS\.stockDisplayChanged[\s\S]*tx,\s*\);/);
  assert.match(a, /maxAgeHours: MAX_AGE_HOURS/);
  assert.match(a, /const MAX_AGE_HOURS = 24;/);
});
