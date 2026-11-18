import assert from "node:assert/strict";
import test from "node:test";
import { can, capabilityForPath, navGroupsFor } from "./permissions.mjs";

const u = (role, permissions = []) => ({ role, permissions });
const hrefs = (user) => navGroupsFor(user).flatMap((g) => g.items.map((i) => i.href));

test("lager listu vide komercijalista, vlasnik i kancelarija; magacioner ne", () => {
  for (const role of ["komercijalista", "gazda", "kancelarija"]) {
    assert.equal(can(u(role), "view:lager_lista"), true, role);
    assert.ok(hrefs(u(role)).includes("/portal/lager-lista"), `${role}: u meniju`);
  }
  assert.equal(can(u("magacioner"), "view:lager_lista"), false);
  assert.equal(capabilityForPath("/portal/lager-lista"), "view:lager_lista");
});

test("komercijalista: lager lista je u grupi „Prodaja“, a uvoz lagera i dalje nije njegov", () => {
  const prodaja = navGroupsFor(u("komercijalista")).find((g) => g.label === "Prodaja");
  assert.equal(prodaja?.items[0]?.href, "/portal/lager-lista");
  assert.equal(can(u("komercijalista"), "imports:write"), false);
  assert.equal(can(u("komercijalista"), "view:zalihe"), false);
});
