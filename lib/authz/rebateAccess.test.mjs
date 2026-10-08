import assert from "node:assert/strict";
import test from "node:test";
import { can, capabilityForPath, seesAllCustomers } from "./permissions.mjs";

const u = (role, permissions = []) => ({ role, permissions });

test("istoriju rabata čitaju gazda, komercijalista (svoji kupci) i kancelarija; magacioner ne", () => {
  assert.equal(can(u("gazda"), "view:rabati"), true);
  assert.equal(can(u("komercijalista"), "view:rabati"), true);
  assert.equal(seesAllCustomers(u("komercijalista")), false, "opseg ostaje na dodelama");
  assert.equal(can(u("kancelarija"), "view:rabati"), true);
  assert.equal(can(u("magacioner"), "view:rabati"), false);
  assert.equal(capabilityForPath("/portal/cene/rabati-iz-faktura/kupci/abc"), "view:rabati");
});

test("čitanje ne daje predlaganje, odobravanje ni primenu", () => {
  for (const user of [u("komercijalista"), u("kancelarija"), u("komercijalista", ["analitika"])]) {
    assert.equal(can(user, "prices:propose"), false);
    assert.equal(can(user, "prices:approve"), false);
    assert.equal(can(user, "prices:apply"), false);
  }
});

test("predlaganje dolazi samo iz paketa cene_predlog; analitika menja samo opseg", () => {
  const predlagac = u("komercijalista", ["cene_predlog"]);
  assert.equal(can(predlagac, "prices:propose"), true);
  assert.equal(seesAllCustomers(predlagac), false);
  const svi = u("komercijalista", ["analitika", "cene_predlog"]);
  assert.equal(can(svi, "prices:propose"), true);
  assert.equal(seesAllCustomers(svi), true);
  assert.equal(can(svi, "prices:approve"), false);
  assert.equal(can(svi, "prices:apply"), false);
});

test("spisak kupaca bez komercijaliste vide gazda i kancelarija", () => {
  assert.equal(can(u("gazda"), "view:bez_dodele"), true);
  assert.equal(can(u("kancelarija"), "view:bez_dodele"), true);
  assert.equal(can(u("komercijalista", ["analitika", "cene_predlog"]), "view:bez_dodele"), false);
  assert.equal(capabilityForPath("/portal/kupci/bez-dodele"), "view:bez_dodele");
});
