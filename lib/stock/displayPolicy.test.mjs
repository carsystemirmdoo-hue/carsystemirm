import assert from "node:assert/strict";
import test from "node:test";

import { customerDisplayDecision, customerStockCaption, customerStockLine, daysBetween, normalizeDisplayPolicy } from "./displayPolicy.mjs";

const snap = { stockDate: "2026-10-12", confirmedAt: "2026-10-13T06:05:00Z" };
const ON = { STOCK_CUSTOMER_DISPLAY: "1" };

test("podrazumevano isključeno: bez env-a, bez podešavanja, bez praga", () => {
  assert.deepEqual(customerDisplayDecision({ env: {}, policy: { enabled: true, maxAgeDays: 3 }, snapshot: snap, today: "2026-10-13" }), { show: false, reason: "iskljuceno_okruzenje" });
  assert.deepEqual(customerDisplayDecision({ env: ON, policy: null, snapshot: snap, today: "2026-10-13" }), { show: false, reason: "iskljuceno_podesavanje" });
  assert.deepEqual(customerDisplayDecision({ env: ON, policy: { enabled: true }, snapshot: snap, today: "2026-10-13" }), { show: false, reason: "prag_nije_zadat" });
  assert.deepEqual(normalizeDisplayPolicy({ enabled: true }).problems, ["prag_nije_zadat"]);
  assert.deepEqual(normalizeDisplayPolicy({ enabled: "da", maxAgeDays: "3" }), { enabled: false, maxAgeDays: null, problems: ["prag_neispravan"] });
});

test("prag zastarelosti po datumu stanja, ne po vremenu uvoza", () => {
  const policy = { enabled: true, maxAgeDays: 1 };
  assert.deepEqual(customerDisplayDecision({ env: ON, policy, snapshot: snap, today: "2026-10-13" }), { show: true });
  assert.deepEqual(customerDisplayDecision({ env: ON, policy, snapshot: snap, today: "2026-10-14" }), { show: false, reason: "zastareo_snimak" });
  assert.deepEqual(customerDisplayDecision({ env: ON, policy, snapshot: { ...snap, stockDate: "2026-10-15" }, today: "2026-10-14" }), { show: false, reason: "datum_u_buducnosti" });
  assert.deepEqual(customerDisplayDecision({ env: ON, policy, snapshot: null, today: "2026-10-14" }), { show: false, reason: "nema_snimka" });
  assert.equal(daysBetween("2026-02-28", "2026-03-01"), 1);
});

test("tekst: samo datum stanja; vreme uvoza odvojeno; raspoloživost potvrđuje kancelarija", () => {
  const c = customerStockCaption(snap);
  assert.equal(c.headline, "Stanje prema poslednjem izvozu: 12.10.2026.");
  assert.match(c.imported, /^Uvezeno 13\. ?10\. ?2026\.? u 08:05$/);
  assert.equal(c.note, "Raspoloživost potvrđuje kancelarija.");
});

test("broj pakovanja samo kada postoji; bez broja nema teksta", () => {
  assert.deepEqual(customerStockLine({ status: "ok", packs: 3 }, "5 L"), { state: "ima", text: "Prema izvozu: 3 × 5 L" });
  assert.equal(customerStockLine({ status: "ok", packs: 0 }, "5 L").state, "nema");
  assert.equal(customerStockLine({ status: "nema_broja", reason: "pakovanje_nepotvrdjeno" }, null), null);
});
