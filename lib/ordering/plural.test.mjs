import assert from "node:assert/strict";
import test from "node:test";
import { countOf, STAVKA } from "./plural.mjs";

test("srpska množina stavki", () => {
  assert.deepEqual([0, 1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 112].map((n) => countOf(n, STAVKA)),
    ["0 stavki", "1 stavka", "2 stavke", "4 stavke", "5 stavki", "11 stavki", "12 stavki", "14 stavki", "21 stavka", "22 stavke", "25 stavki", "101 stavka", "112 stavki"]);
});
