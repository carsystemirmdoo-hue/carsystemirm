import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessCustomer,
  filterCustomerRows,
  filterRowsByCustomer,
} from "./scope.mjs";

const komercijalista = { role: "komercijalista", permissions: [] };
const drugiKomercijalista = { role: "komercijalista", permissions: [] };
const gazda = { role: "gazda", permissions: [] };
const analiticar = { role: "komercijalista", permissions: ["analitika"] };
const magacioner = { role: "magacioner", permissions: ["otprema"] };

const MOJI = ["kupac-1", "kupac-2"];

test("komercijalista otvara samo dodeljene kupce", () => {
  assert.ok(canAccessCustomer(komercijalista, MOJI, "kupac-1"));
  assert.ok(!canAccessCustomer(komercijalista, MOJI, "kupac-9"));
});

test("menjanje ID-a kupca u adresi ne otvara tuđeg kupca", () => {
  // Isti korisnik, ID iz tuđe liste — mora biti odbijen.
  assert.ok(!canAccessCustomer(drugiKomercijalista, [], "kupac-1"));
  assert.ok(!canAccessCustomer(komercijalista, MOJI, "kupac-3"));
  assert.ok(!canAccessCustomer(komercijalista, MOJI, ""));
  assert.ok(!canAccessCustomer(null, MOJI, "kupac-1"));
});

test("Gazda i nosilac paketa „analitika“ vide sve kupce", () => {
  assert.ok(canAccessCustomer(gazda, [], "bilo-koji"));
  assert.ok(canAccessCustomer(analiticar, [], "bilo-koji"));
});

test("Magacioner nema pristup kupcima ni preko praznog opsega", () => {
  assert.ok(!canAccessCustomer(magacioner, [], "kupac-1"));
});

test("izvoz ne sme da sadrži kupce izvan opsega korisnika", () => {
  const svi = [{ id: "kupac-1" }, { id: "kupac-2" }, { id: "kupac-9" }];
  assert.deepEqual(
    filterCustomerRows(komercijalista, MOJI, svi).map((row) => row.id),
    ["kupac-1", "kupac-2"],
  );
  assert.equal(filterCustomerRows(gazda, [], svi).length, 3);
});

test("redovi vezani za kupca se filtriraju istim pravilom", () => {
  const fakture = [
    { broj: "2026-1", customerId: "kupac-1" },
    { broj: "2026-2", customerId: "kupac-9" },
  ];
  const vidljive = filterRowsByCustomer(
    komercijalista,
    MOJI,
    fakture,
    (row) => row.customerId,
  );
  assert.deepEqual(
    vidljive.map((row) => row.broj),
    ["2026-1"],
  );
});

test("filtriranje vraća novu listu, bez menjanja ulazne", () => {
  const svi = [{ id: "kupac-1" }];
  const rezultat = filterCustomerRows(gazda, [], svi);
  assert.notEqual(rezultat, svi);
  assert.deepEqual(rezultat, svi);
});

test("nedostajuća lista dodela se tretira kao prazna, ne kao pun pristup", () => {
  assert.ok(!canAccessCustomer(komercijalista, undefined, "kupac-1"));
  assert.equal(
    filterCustomerRows(komercijalista, undefined, [{ id: "kupac-1" }]).length,
    0,
  );
});
