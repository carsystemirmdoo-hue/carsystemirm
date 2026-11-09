import assert from "node:assert/strict";
import test from "node:test";
import { can, capabilityForPath, seesAllCustomers } from "./permissions.mjs";
import { canAccessCustomer, canDecidePricesFor, decidesPricesForAllCustomers } from "./scope.mjs";

const u = (role, permissions = []) => ({ role, permissions });

test("istoriju rabata čitaju gazda, komercijalista (svoji kupci) i kancelarija; magacioner ne", () => {
  assert.equal(can(u("gazda"), "view:rabati"), true);
  assert.equal(can(u("komercijalista"), "view:rabati"), true);
  assert.equal(seesAllCustomers(u("komercijalista")), false, "opseg ostaje na dodelama");
  assert.equal(can(u("kancelarija"), "view:rabati"), true);
  assert.equal(can(u("magacioner"), "view:rabati"), false);
  assert.equal(capabilityForPath("/portal/cene/rabati-iz-faktura/kupci/abc"), "view:rabati");
});

test("kancelarija čita, ali ne predlaže, ne odobrava i ne primenjuje", () => {
  const user = u("kancelarija");
  assert.equal(can(user, "prices:propose"), false);
  assert.equal(can(user, "prices:approve"), false);
  assert.equal(can(user, "prices:apply"), false);
});

test("svaki komercijalista menja rabate (predlog + odobrenje) bez paketa; upis u BizniSoft ne", () => {
  for (const user of [u("komercijalista"), u("komercijalista", ["analitika"])]) {
    assert.equal(can(user, "prices:propose"), true);
    assert.equal(can(user, "prices:approve"), true);
    assert.equal(can(user, "prices:audit"), true, "sme da odobri i sopstveni predlog");
    assert.equal(can(user, "view:cene"), true);
    assert.equal(can(user, "prices:apply"), false);
    assert.equal(can(user, "prices:oversee"), false, "nadzor ostaje samo vlasniku");
  }
});

test("rabate menja samo SVOJIM kupcima, i kad analitika otvara pregled svih", () => {
  const svoj = "11111111-1111-4111-8111-111111111111";
  const tudj = "22222222-2222-4222-8222-222222222222";
  const rep = u("komercijalista");
  const analiticar = u("komercijalista", ["analitika"]);
  assert.equal(seesAllCustomers(analiticar), true, "pregled svih ostaje");
  for (const user of [rep, analiticar]) {
    assert.equal(canDecidePricesFor(user, [svoj], svoj), true);
    assert.equal(canDecidePricesFor(user, [svoj], tudj), false);
    assert.equal(decidesPricesForAllCustomers(user), false);
  }
  assert.equal(canAccessCustomer(analiticar, [svoj], tudj), true, "čitanje tuđeg kupca i dalje može");
  assert.equal(canDecidePricesFor(u("gazda"), [], tudj), true);
  assert.equal(decidesPricesForAllCustomers(u("gazda")), true);
});

test("spisak kupaca bez komercijaliste vide gazda i kancelarija", () => {
  assert.equal(can(u("gazda"), "view:bez_dodele"), true);
  assert.equal(can(u("kancelarija"), "view:bez_dodele"), true);
  assert.equal(can(u("komercijalista", ["analitika", "cene_predlog"]), "view:bez_dodele"), false);
  assert.equal(capabilityForPath("/portal/kupci/bez-dodele"), "view:bez_dodele");
});
