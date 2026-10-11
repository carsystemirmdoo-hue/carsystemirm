import assert from "node:assert/strict";
import test from "node:test";
import { isoDateOrNull, normalizeSalesFilter, NO_MATCH_ID } from "./filterInput.mjs";

test("datum: samo stvaran kalendarski dan", () => {
  assert.equal(isoDateOrNull("2026-02-28"), "2026-02-28");
  assert.equal(isoDateOrNull("2024-02-29"), "2024-02-29");
  for (const v of ["2026-02-31", "2026-13-01", "2026-00-10", "31/01/2026", "", undefined, "2026-1-1", "2026-01-01' OR 1=1"]) {
    assert.equal(isoDateOrNull(v), null, String(v));
  }
});

test("neispravan ID ne širi skup: postaje ID koji ne pogađa ništa", () => {
  const f = normalizeSalesFilter({ kupac: "nije-uuid", komercijalista: "123" });
  assert.equal(f.customerId, NO_MATCH_ID);
  assert.equal(f.salespersonId, NO_MATCH_ID);
  assert.equal(normalizeSalesFilter({}).customerId, null, "bez filtera ostaje bez filtera");
  const id = "6d03cd52-4e01-4661-afd4-93ac5459882f";
  assert.equal(normalizeSalesFilter({ kupac: id }).customerId, id);
});

test("obrnut period se okreće; nemoguć datum se izostavlja", () => {
  assert.deepEqual(
    (({ from, to }) => ({ from, to }))(normalizeSalesFilter({ from: "2026-10-01", to: "2026-09-01" })),
    { from: "2026-09-01", to: "2026-10-01" },
  );
  assert.equal(normalizeSalesFilter({ from: "2026-02-31" }).from, null);
});
