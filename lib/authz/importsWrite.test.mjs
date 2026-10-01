import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CAPABILITIES, can, PACKAGE_KEYS, ROLES } from "./permissions.mjs";

/**
 * Upis uvoza je odvojen od pregleda uvoza.
 *
 * Regresija: ručno otpremanje PDF i CSV dokumenata tražilo je samo
 * `view:importi`, koje dobija i paket „analitika" — pa je komercijalista sa
 * tim paketom mogao da unese promet koji vide svi.
 */

const WRITE = "imports:write";
const READ = "view:importi";
const asUser = (role, permissions = []) => ({ role, permissions });
const root = new URL("../../", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), "utf8");

test("sposobnost postoji i odvojena je od pregleda", () => {
  assert.ok(CAPABILITIES.includes(WRITE));
  assert.ok(CAPABILITIES.includes(READ));
});

test("upis imaju samo Vlasnik i kancelarija", () => {
  const expected = { gazda: true, kancelarija: true, komercijalista: false, magacioner: false };
  for (const role of ROLES.map((r) => (typeof r === "string" ? r : r.key))) {
    assert.equal(can(asUser(role), WRITE), expected[role] ?? false, role);
  }
});

test("nijedan paket ne dodeljuje upis — ni onaj koji daje pregled", () => {
  for (const role of ["komercijalista", "magacioner"]) {
    for (const pkg of PACKAGE_KEYS) {
      assert.equal(can(asUser(role, [pkg]), WRITE), false, `${role} + ${pkg}`);
    }
    // Svi paketi zajedno takođe ne.
    assert.equal(can(asUser(role, PACKAGE_KEYS), WRITE), false, `${role} + svi paketi`);
  }
  assert.equal(can(asUser("komercijalista", ["analitika"]), READ), true, "pregled ostaje kroz paket");
});

test("obe akcije otpremanja traže upis, ne pregled", () => {
  for (const file of ["app/portal/importi/actions.ts", "app/portal/importi/pdf-actions.ts"]) {
    const source = read(file);
    assert.match(source, /requireCapability\("imports:write", "\/portal\/importi"\)/, file);
    assert.doesNotMatch(source, /requireCapability\("view:importi"/, file);
  }
});

test("ekran prikazuje obrasce za otpremanje samo uz upis", () => {
  const page = read("app/portal/importi/page.tsx");
  const gate = page.indexOf('can(user, "imports:write")');
  assert.ok(gate > 0, "obrasci nisu iza imports:write");
  assert.ok(page.indexOf("<PdfImportUpload />") > gate);
  assert.ok(page.indexOf("<ImportUpload />") > gate);
});
