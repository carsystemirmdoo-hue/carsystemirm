import assert from "node:assert/strict";
import test from "node:test";
import { buildAuditEntry, redactSensitive } from "./auditEntry.mjs";

const actor = { id: "u-1", name: "Aleksandar Novković", role: "gazda" };

test("zapis sadrži izvršioca, entitet, stanje pre i posle i razlog", () => {
  const entry = buildAuditEntry({
    actor,
    action: "Dodeljen paket dozvola",
    entityType: "Korisnik",
    entityId: "u-2",
    entityLabel: "Miroslav Suljagić",
    before: { analitika: false },
    after: { analitika: true },
    reason: "Potreba za dubljom analizom prodaje",
    correlationId: "corr-1",
  });

  assert.equal(entry.actorUserId, "u-1");
  assert.equal(entry.actorLabel, "Aleksandar Novković (gazda)");
  assert.equal(entry.entityId, "u-2");
  assert.deepEqual(entry.valueBefore, { analitika: false });
  assert.deepEqual(entry.valueAfter, { analitika: true });
  assert.equal(entry.reason, "Potreba za dubljom analizom prodaje");
  assert.equal(entry.correlationId, "corr-1");
});

test("nepotpun zapis se odbija umesto da se upiše bez konteksta", () => {
  assert.throws(() =>
    buildAuditEntry({ actor, entityType: "Korisnik", action: "" }),
  );
  assert.throws(() => buildAuditEntry({ actor, action: "Radnja" }));
  assert.throws(() =>
    buildAuditEntry({ action: "Radnja", entityType: "Korisnik" }),
  );
});

test("ime i uloga se zamrzavaju u trenutku radnje", () => {
  const entry = buildAuditEntry({
    actor: { id: "u-3", name: "Zoran Perić", role: "magacioner" },
    action: "Štampa adresnice",
    entityType: "Pošiljka",
  });
  // Kasnija promena uloge ne sme da prepiše istorijski zapis.
  assert.equal(entry.actorLabel, "Zoran Perić (magacioner)");
});

test("osetljive vrednosti se ne upisuju u trag revizije", () => {
  const entry = buildAuditEntry({
    actor,
    action: "Kreiran korisnik",
    entityType: "Korisnik",
    after: {
      email: "novi@carsystem.rs",
      password: "tajna-lozinka",
      passwordHash: "scrypt$16384$8$1$abc$def",
      profil: { apiKey: "bex-123", grad: "Inđija" },
    },
  });

  assert.equal(entry.valueAfter.email, "novi@carsystem.rs");
  assert.equal(entry.valueAfter.password, "[redigovano]");
  assert.equal(entry.valueAfter.passwordHash, "[redigovano]");
  assert.equal(entry.valueAfter.profil.apiKey, "[redigovano]");
  assert.equal(entry.valueAfter.profil.grad, "Inđija");
});

test("redigovanje ide i kroz nizove", () => {
  const out = redactSensitive([{ token: "abc" }, { grad: "Niš" }]);
  assert.equal(out[0].token, "[redigovano]");
  assert.equal(out[1].grad, "Niš");
});

test("izostavljene vrednosti pre i posle su null, a ne prazan objekat", () => {
  const entry = buildAuditEntry({
    actor,
    action: "Neuspela prijava",
    entityType: "Korisnik",
  });
  assert.equal(entry.valueBefore, null);
  assert.equal(entry.valueAfter, null);
  assert.equal(entry.reason, null);
});
