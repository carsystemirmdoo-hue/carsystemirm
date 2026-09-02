import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  MINIMALNI_MAJOR,
  oceniRuntime,
  testiraniMajor,
} from "../smoke/runtime-contract.mjs";

/**
 * Runtime ugovor.
 *
 * Prvi stvarni Windows smoke je pao na `W02` sa `node_minor_mismatch`, na
 * Node 24.20.0 — runtime-u koji ugovor ITEKAKO podržava. Ovi testovi
 * zaključavaju da se to ne ponovi ni u jednom smeru: ni da ispravan Node padne,
 * ni da neproveren Node prođe kao dokazan.
 */

const oceni = (verzija, { testirani = 24, sqlite = true } = {}) =>
  oceniRuntime({ verzija, testirani, sqliteDostupan: sqlite });

test("konstanta ugovora se ne sme razići sa entrypoint-om", () => {
  /*
   * Dve konstante koje znače isto se pre ili kasnije raziđu ako ih niko ne
   * poredi. Entrypoint je merodavan — on stvarno odbija pokretanje.
   */
  const izvor = readFileSync(
    fileURLToPath(new URL("../bin/connector.mjs", import.meta.url)),
    "utf8",
  );
  const m = /const MINIMALNI_MAJOR = (\d+);/.exec(izvor);
  assert.ok(m, "entrypoint više ne objavljuje MINIMALNI_MAJOR");
  assert.equal(
    Number(m[1]),
    MINIMALNI_MAJOR,
    "smoke ugovor i entrypoint traže različit minimalni Node",
  );
});

test("Node 24.20.0 PROLAZI — baš verzija koja je oborila prvi smoke", () => {
  const r = oceni("24.20.0");
  assert.equal(r.status, "pass");
  assert.equal(r.kod, null);
  assert.match(r.detalj, /24\.20\.0/);
});

test("bilo koji 24.x prolazi; minor i patch nisu deo ugovora", () => {
  for (const v of ["24.0.0", "24.14.0", "24.14.2", "24.20.0", "24.99.9"]) {
    assert.equal(oceni(v).status, "pass", `${v} je odbijen`);
  }
});

test("Node 20 PADA — ispod ugovora", () => {
  const r = oceni("20.20.2", { sqlite: false });
  assert.equal(r.status, "fail");
  assert.equal(r.kod, "node_below_contract");
  // Poruka mora da imenuje pravi razlog, ne posledicu.
  assert.match(r.detalj, /major 22\+/);
});

test("Node 22 i 25 ne padaju, ali NE prolaze kao dokazani", () => {
  for (const v of ["22.11.0", "23.5.0", "25.1.0"]) {
    const r = oceni(v);
    assert.equal(r.status, "skip", `${v} nije označen kao neproveren`);
    assert.equal(r.kod, "node_major_untested");
    assert.match(r.detalj, /testiran na major 24/);
  }
});

test("nedostupan node:sqlite je zaseban kvar, ali tek IZNAD minimuma", () => {
  const r = oceni("24.20.0", { sqlite: false });
  assert.equal(r.status, "fail");
  assert.equal(r.kod, "node_sqlite_unavailable");

  /*
   * Na Node 20 je odsustvo modula POSLEDICA verzije. Prijaviti ga kao zaseban
   * kvar poslalo bi nekoga da traži nepostojeći problem u instalaciji.
   */
  assert.equal(oceni("20.20.2", { sqlite: false }).kod, "node_below_contract");
});

test("neprepoznata verzija je greška, ne tihi prolaz", () => {
  for (const v of ["", "dvadeset", "24", "24.x"]) {
    const r = oceni(v);
    assert.equal(r.status, "fail", `„${v}" je prošlo`);
    assert.equal(r.kod, "node_version_unparseable");
  }
});

test("testirani major se čita iz requiredNode, ne kuca u kod", () => {
  assert.equal(testiraniMajor("24.14.x (Windows x64, zvanični LTS sa nodejs.org)"), 24);
  assert.equal(testiraniMajor("22.9.0"), 22);
  assert.equal(testiraniMajor("bez verzije"), null);
  assert.equal(testiraniMajor(undefined), null);
});

test("kada paket ne kaže testirani major, rezultat je SKIP a ne PASS", () => {
  const r = oceni("24.20.0", { testirani: null });
  assert.equal(r.status, "skip");
  assert.equal(r.kod, "tested_major_unknown");
});

test("paket i ugovor se slažu — čita se iz pakovanja, ne iz artefakta", () => {
  /*
   * `package-meta.json` postoji tek U PAKETU; u repozitorijumu ga nema. Zato se
   * čita izvor koji ga generiše — jedina vrednost koja u repozitorijumu postoji
   * i koja će sutra završiti u paketu.
   */
  const izvor = readFileSync(
    fileURLToPath(new URL("../scripts/package-smoke.mjs", import.meta.url)),
    "utf8",
  );
  const m = /requiredNode:\s*"([^"]+)"/.exec(izvor);
  assert.ok(m, "pakovanje više ne objavljuje requiredNode");

  const testirani = testiraniMajor(m[1]);
  assert.ok(testirani !== null, `requiredNode nije čitljiv: ${m[1]}`);
  assert.ok(
    testirani >= MINIMALNI_MAJOR,
    `paket je testiran na major ${testirani}, ispod sopstvenog ugovora ${MINIMALNI_MAJOR}`,
  );
});
