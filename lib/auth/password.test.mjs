import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "./password.mjs";

test("ispravna lozinka prolazi, pogrešna ne", async () => {
  const stored = await hashPassword("ispravna-lozinka-2026");
  assert.equal(await verifyPassword("ispravna-lozinka-2026", stored), true);
  assert.equal(await verifyPassword("pogresna-lozinka-2026", stored), false);
});

test("lozinka se nigde ne čuva u čitljivom obliku", async () => {
  const stored = await hashPassword("tajna-lozinka-2026");
  assert.ok(!stored.includes("tajna-lozinka-2026"));
  assert.ok(stored.startsWith("scrypt$"));
});

test("ista lozinka daje različit zapis zbog nasumične soli", async () => {
  const a = await hashPassword("ista-lozinka-2026");
  const b = await hashPassword("ista-lozinka-2026");
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("ista-lozinka-2026", a), true);
  assert.equal(await verifyPassword("ista-lozinka-2026", b), true);
});

test("prekratka lozinka se odbija pri postavljanju", async () => {
  await assert.rejects(() => hashPassword("kratka"));
  await assert.rejects(() => hashPassword(""));
});

test("neispravan zapis vraća false umesto izuzetka", async () => {
  // Iz ponašanja se ne sme zaključivati o stanju naloga.
  for (const stored of [
    null,
    undefined,
    "",
    "nije-hash",
    "scrypt$16384$8$1$samo-tri-dela",
    "bcrypt$16384$8$1$c28=$aGFzaA==",
    "scrypt$x$8$1$c28=$aGFzaA==",
  ]) {
    assert.equal(await verifyPassword("bilo-koja-lozinka", stored), false);
  }
});

test("prazna so ili prazan hash ne prolaze", async () => {
  assert.equal(await verifyPassword("lozinka", "scrypt$16384$8$1$$"), false);
});
