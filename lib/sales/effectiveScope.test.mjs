import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Statička strana provere iz `db/integration/salesEffective.integration.test.mts`:
 * ekrani prometa ne smeju čitati `invoices` mimo pravila ledger-a.
 */
const read = (rel) => readFileSync(new URL(rel, new URL("../../", import.meta.url)), "utf8");

test("loadSalesLines uvek primenjuje uslov važećeg dokumenta", () => {
  const source = read("lib/sales/queries.ts");
  const body = source.slice(source.indexOf("export async function loadSalesLines"));
  const fnEnd = body.indexOf("\n}\n");
  const fn = body.slice(0, fnEnd);
  assert.match(fn, /const conditions = \[effectiveInvoiceCondition\(\)\]/);
  assert.match(fn, /\.where\(and\(\.\.\.conditions\)\)/);
});

test("agregati (zbir, po grupi) primenjuju isti uslov i iste filtere kao stavke", () => {
  const source = read("lib/sales/queries.ts");
  for (const name of ["loadSalesSummary", "loadSalesBreakdown"]) {
    const body = source.slice(source.indexOf(`export async function ${name}`));
    const fn = body.slice(0, body.indexOf("\n}\n"));
    assert.match(fn, /const conditions = \[effectiveInvoiceCondition\(\)\]/, name);
    assert.match(fn, /conditions\.push\(\.\.\.filterConditions\(scope, filter\)\)/, name);
    assert.match(fn, /\.where\(and\(\.\.\.conditions\)\)/, name);
  }
});

test("ekrani prometa ne računaju zbirove iz ograničene liste stavki", () => {
  for (const rel of ["app/portal/prodaja/page.tsx", "app/portal/analitika/page.tsx", "app/portal/povrati/page.tsx", "app/portal/kupci/page.tsx", "app/api/portal/izvoz/route.ts"]) {
    const src = read(rel);
    assert.doesNotMatch(src, /summarize(By)?\(/, `${rel} ne sme sabirati učitane stavke`);
  }
});

test("uslov je isti kao WHERE pogleda effective_sales_ledger", () => {
  const predicate = read("lib/ledger/effective-invoice.ts");
  const view = read("db/migrations/0019_effective_sales_ledger.sql");
  const rule = "sd.revision_status = 'original' AND sd.manual_review <> 'pending'";
  assert.ok(view.includes(rule), "pogled je promenio pravilo — uskladite effective-invoice.ts");
  assert.ok(predicate.includes(`NOT (${rule})`));
});
