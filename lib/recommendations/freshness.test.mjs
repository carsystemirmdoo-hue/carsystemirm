import assert from "node:assert/strict";
import test from "node:test";
import { AGED_AFTER_DAYS, freshnessOf } from "./freshness.mjs";

const run = { asOfDate: "2026-09-28", startedAt: new Date("2026-09-28T20:09:00Z") };
const doc = (issuedOn, ingestedAt) => ({ issuedOn, ingestedAt: ingestedAt ? new Date(ingestedAt) : null });

test("bez obračuna nema statusa", () => {
  assert.equal(freshnessOf({ run: null, documents: [], today: "2026-09-29" }).state, "no_run");
});

test("novi dokument posle obračuna: uvezen posle početka obračuna", () => {
  const f = freshnessOf({
    run,
    documents: [doc("2026-07-09", "2026-07-10T08:00:00Z"), doc("2026-09-28", "2026-09-29T07:30:00Z")],
    today: "2026-09-29",
  });
  assert.equal(f.state, "new_documents");
  assert.deepEqual(f.newDocuments.map((d) => d.issuedOn), ["2026-09-28"]);
});

test("novi dokument posle obračuna: izdat posle dana obračuna (i bez vremena uvoza)", () => {
  const f = freshnessOf({ run, documents: [doc("2026-09-29", null)], today: "2026-09-29" });
  assert.equal(f.state, "new_documents");
});

test("stari dokumenti ne čine obračun zastarelim", () => {
  const f = freshnessOf({ run, documents: [doc("2026-07-09", "2026-07-10T08:00:00Z")], today: "2026-09-29" });
  assert.equal(f.state, "current");
  assert.equal(f.runAgeDays, 1);
});

test("obračun star dva dana je označen, ali nije isto što i nov dokument", () => {
  const f = freshnessOf({ run, documents: [], today: "2026-09-30" });
  assert.equal(AGED_AFTER_DAYS, 2);
  assert.equal(f.state, "aged");
  assert.equal(f.runAgeDays, 2);
});
