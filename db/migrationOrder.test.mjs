import assert from "node:assert/strict";
import test from "node:test";
import { greskeDnevnika, stanjeMigracija, ucitajDnevnik } from "./migrationOrder.mjs";

const e = (idx, tag, when) => ({ idx, tag, when });

test("dnevnik u repozitorijumu je ispravan", async () => {
  assert.deepEqual(greskeDnevnika(await ucitajDnevnik("./db/migrations")), []);
});

test("dnevnik: vreme mora strogo da raste", () => {
  const g = greskeDnevnika([e(0, "0056_a", 200), e(1, "0058_b", 300), e(2, "0059_c", 250)]);
  assert.equal(g.length, 1);
  assert.match(g[0], /0059_c/);
});

test("dnevnik: broj u nazivu i idx", () => {
  assert.equal(greskeDnevnika([e(0, "0056_a", 1), e(1, "0056_b", 2)]).length, 1);
  assert.equal(greskeDnevnika([e(0, "0056_a", 1), e(2, "0057_b", 2)]).length, 1);
});

test("praznina u brojevima je dozvoljena (0056 → 0058)", () => {
  assert.deepEqual(greskeDnevnika([e(0, "0056_a", 1), e(1, "0058_b", 2)]), []);
});

test("migracija sa ranijim vremenom od poslednje primenjene bila bi preskočena", () => {
  // Baza ima 0058 (300); dnevnik dobija 0057 sa 250 → drizzle bi je preskočio.
  const entries = [e(0, "0056_a", 200), e(1, "0057_x", 250), e(2, "0058_b", 300)];
  const s = stanjeMigracija(entries, [200, 300]);
  assert.deepEqual(s.preskocene, ["0057_x"]);
  assert.deepEqual(s.naCekanju, []);
});

test("baza ispred koda: primenjena migracija koje nema u dnevniku", () => {
  const s = stanjeMigracija([e(0, "0056_a", 200)], [200, 250]);
  assert.deepEqual(s.nepoznate, [250]);
});

test("redovan slučaj: neprimenjene posle poslednje idu na čekanje, redom", () => {
  const entries = [e(0, "0056_a", 200), e(1, "0058_b", 300), e(2, "0059_c", 400)];
  assert.deepEqual(stanjeMigracija(entries, [200]), {
    preskocene: [],
    nepoznate: [],
    naCekanju: ["0058_b", "0059_c"],
  });
  assert.deepEqual(stanjeMigracija(entries, []).naCekanju, ["0056_a", "0058_b", "0059_c"]);
});
