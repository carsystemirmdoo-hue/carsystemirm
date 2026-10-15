import assert from "node:assert/strict";
import test from "node:test";

import { customerDisplayDecision, customerStockCaption, customerStockLine, normalizeDisplayPolicy, ON_REQUEST, startOfDayIn, stockMoment } from "./displayPolicy.mjs";

const ON = { enabled: true, maxAgeHours: 24 };
const snap = { stockDate: "2026-10-15" };
const at = (iso) => new Date(iso);

test("prekidač: podešavanje vlasnika odlučuje; STOCK_CUSTOMER_DISPLAY=0 je hitno isključenje", () => {
  const now = at("2026-10-15T10:00:00Z");
  assert.equal(customerDisplayDecision({ env: {}, policy: ON, snapshot: snap, now }).show, true);
  assert.deepEqual(customerDisplayDecision({ env: { STOCK_CUSTOMER_DISPLAY: "0" }, policy: ON, snapshot: snap, now }), { show: false, reason: "iskljuceno_okruzenje" });
  assert.deepEqual(customerDisplayDecision({ env: {}, policy: null, snapshot: snap, now }), { show: false, reason: "iskljuceno_podesavanje" });
  assert.deepEqual(customerDisplayDecision({ env: {}, policy: { enabled: false, maxAgeHours: 24 }, snapshot: snap, now }), { show: false, reason: "iskljuceno_podesavanje" });
  assert.deepEqual(customerDisplayDecision({ env: {}, policy: { enabled: true }, snapshot: snap, now }), { show: false, reason: "prag_nije_zadat" });
  assert.deepEqual(customerDisplayDecision({ env: {}, policy: ON, snapshot: null, now }), { show: false, reason: "nema_snimka" });
  assert.deepEqual(normalizeDisplayPolicy({ enabled: "da", maxAgeHours: "24" }), { enabled: false, maxAgeHours: null, problems: ["prag_neispravan"] });
  assert.deepEqual(normalizeDisplayPolicy({ enabled: true, maxAgeHours: 0 }).problems, ["prag_neispravan", "prag_nije_zadat"]);
});

test("samo datum stanja → od početka dana po Beogradu; 24 h; vreme otpremanja se ne računa", () => {
  // 15. 10. 2026 je CEST (UTC+2): početak dana = 14. 10. 22:00 UTC.
  assert.equal(startOfDayIn("2026-10-15").toISOString(), "2026-10-14T22:00:00.000Z");
  // Zima (UTC+1) i dan promene vremena (25. 10. 2026).
  assert.equal(startOfDayIn("2026-12-01").toISOString(), "2026-11-30T23:00:00.000Z");
  assert.equal(startOfDayIn("2026-10-25").toISOString(), "2026-10-24T22:00:00.000Z");
  assert.equal(startOfDayIn("2026-10-26").toISOString(), "2026-10-25T23:00:00.000Z");
  const ok = customerDisplayDecision({ env: {}, policy: ON, snapshot: snap, now: at("2026-10-15T21:59:59Z") });
  assert.equal(ok.show, true);
  assert.equal(ok.show && ok.validUntil.toISOString(), "2026-10-15T22:00:00.000Z");
  assert.deepEqual(
    { ...customerDisplayDecision({ env: {}, policy: ON, snapshot: snap, now: at("2026-10-15T22:00:00Z") }), stockAt: undefined },
    { show: false, reason: "zastareo_snimak", stockAt: undefined },
  );
  assert.equal(customerDisplayDecision({ env: {}, policy: ON, snapshot: { stockDate: "2026-10-16" }, now: at("2026-10-15T12:00:00Z") }).reason, "datum_u_buducnosti");
});

test("tačno vreme stanja se koristi samo ako ga izvor ima", () => {
  const s = { stockDate: "2026-10-15", stockTime: "2026-10-15T06:30:00Z" };
  assert.equal(stockMoment(s).toISOString(), "2026-10-15T06:30:00.000Z");
  assert.equal(customerDisplayDecision({ env: {}, policy: ON, snapshot: s, now: at("2026-10-16T06:29:00Z") }).show, true);
  assert.equal(customerDisplayDecision({ env: {}, policy: ON, snapshot: s, now: at("2026-10-16T06:30:00Z") }).show, false);
  assert.equal(customerStockCaption(s).headline, "Stanje prema izvozu na dan 15.10.2026. u 08:30");
});

test("tekst za kupca: samo datum stanja, bez vremena uvoza; raspoloživost potvrđuje kancelarija", () => {
  const c = customerStockCaption(snap);
  assert.equal(c.headline, "Stanje prema izvozu na dan 15.10.2026.");
  assert.equal(c.note, "Raspoloživost potvrđuje kancelarija.");
  assert.equal("imported" in c, false);
});

test("broj celih pakovanja naniže; sve bez potvrde ili sa negativnim stanjem je „na upit“, nikad minus", () => {
  const kanta = { label: "kanta 5 L", single: false, unit: "LIT" };
  assert.deepEqual(customerStockLine({ status: "ok", packs: 3 }, kanta), { state: "ima", text: "Na stanju prema izvozu: 3 × kanta 5 L" });
  assert.deepEqual(customerStockLine({ status: "ok", packs: 0 }, kanta), { state: "nema", text: "Prema izvozu: nema celog pakovanja na stanju" });
  assert.deepEqual(customerStockLine({ status: "ok", packs: 12 }, { label: "1 kom", single: true, unit: "KOM" }), { state: "ima", text: "Na stanju prema izvozu: 12 kom" });
  for (const reason of ["pakovanje_nepotvrdjeno", "negativna_kolicina", "prazna_kolicina", "nije_u_izvozu", "sudar_sifara", "jm_razlika"]) {
    assert.deepEqual(customerStockLine({ status: "nema_broja", reason }, kanta), { state: "upit", text: ON_REQUEST }, reason);
  }
});
