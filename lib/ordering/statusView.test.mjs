import { test } from "node:test";
import assert from "node:assert/strict";
import { ORDER_STATUS_LABELS } from "./orderRules.mjs";
import { orderStage } from "./statusView.mjs";

const STATUSES = Object.keys(ORDER_STATUS_LABELS);

test("svako stanje ima srpsku oznaku, ton i potez za obe strane", () => {
  for (const s of STATUSES) {
    for (const audience of ["customer", "office"]) {
      const v = orderStage(s, { audience });
      assert.ok(v.label && !/[a-z]+_[a-z]+/.test(v.label), `${s}/${audience}: ${v.label}`);
      assert.ok(["info", "warning", "success", "danger", "neutral"].includes(v.tone));
      assert.ok(["customer", "office", "none"].includes(v.turn));
      assert.ok(v.turnText.length > 0);
      assert.ok(v.title.length > 0 && !v.title.startsWith("Na potezu"));
    }
  }
});

test("ko je na potezu", () => {
  assert.equal(orderStage("awaiting_customer", { audience: "customer" }).turnText, "Na potezu: Vi");
  assert.equal(orderStage("awaiting_customer", { audience: "office" }).turnText, "Na potezu: kupac");
  assert.equal(orderStage("submitted", { audience: "customer" }).turn, "office");
  assert.equal(orderStage("changes_requested", { audience: "customer", pendingProposal: true }).turn, "customer");
  assert.equal(orderStage("confirmed", { audience: "office" }).turn, "office");
  assert.equal(orderStage("confirmed", { audience: "office", biznisoftRecorded: true }).turn, "none");
  assert.equal(orderStage("confirmed", { audience: "customer" }).turn, "none");
});

test("stara verzija nema poteza i ne nudi radnje", () => {
  const v = orderStage("awaiting_customer", { audience: "customer", oldVersion: true });
  assert.equal(v.turn, "none");
  assert.match(v.turnText, /Stara verzija/);
});

test("potvrđena porudžbina kupcu ne tvrdi da je faktura ili isporuka", () => {
  assert.match(orderStage("confirmed", { audience: "customer" }).next, /nije faktura ni potvrda isporuke/);
});
