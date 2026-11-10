import assert from "node:assert/strict";
import test from "node:test";
import { addDays, outcomeLabel, parseCallNote, parseContact, splitPhones, telHref } from "./customerDesk.mjs";

const today = "2026-11-10";

test("beleška: ishod je obavezan, „Drugo“ traži tekst, podsetnik iz dugmeta ili datuma", () => {
  assert.equal(parseCallNote({ outcome: "" }, today).ok, false);
  assert.equal(parseCallNote({ outcome: "drugo", body: " " }, today).ok, false);
  assert.deepEqual(parseCallNote({ outcome: "javice_se", body: " zove u petak ", followUpDays: 3 }, today), {
    ok: true,
    value: { outcome: "javice_se", body: "zove u petak", followUpOn: "2026-11-13" },
  });
  assert.deepEqual(parseCallNote({ outcome: "porucio", followUpDays: 0 }, today), { ok: true, value: { outcome: "porucio", body: null, followUpOn: null } });
  assert.equal(parseCallNote({ outcome: "porucio", followUpOn: "2026-11-01" }, today).ok, false);
  assert.equal(parseCallNote({ outcome: "porucio", followUpOn: "2026-12-01" }, today).ok, true);
  assert.equal(outcomeLabel("nije_dostupan"), "Nije se javio");
});

test("datumi preko kraja meseca i godine", () => {
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
  assert.equal(addDays("2026-02-27", 2), "2026-03-01");
});

test("telefon: tel: veza samo za stvaran broj; više brojeva iz kartice", () => {
  assert.equal(telHref("063/123-4567"), "tel:0631234567");
  assert.equal(telHref("+381 63 123 4567"), "tel:+381631234567");
  assert.equal(telHref("00381631234567"), "tel:+381631234567");
  assert.equal(telHref("nema"), null);
  assert.deepEqual(splitPhones("011/123-456; 063 123 456"), ["011/123-456", "063 123 456"]);
});

test("kontakt: proverava telefon i e-poštu, prazno je null", () => {
  assert.deepEqual(parseContact({ contactName: " Mika ", phone: "063 111 222" }), {
    ok: true,
    value: { contactName: "Mika", phone: "063 111 222", phoneAlt: null, email: null, note: null },
  });
  assert.equal(parseContact({ phone: "abc" }).ok, false);
  assert.equal(parseContact({ email: "mika@" }).ok, false);
});
