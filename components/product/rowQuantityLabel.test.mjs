import { test } from "node:test";
import assert from "node:assert/strict";
import { rowQuantityLabel } from "./productVariantState.mjs";

test("oznaka količine prati red tabele pakovanja", () => {
  assert.equal(rowQuantityLabel({ label: "1.6 kg limenka sa učvršćivačem" }), "1,6 kg");
  assert.equal(rowQuantityLabel({ label: "kanta 4 L" }), "4 L");
  assert.equal(rowQuantityLabel({ label: "8.11 kg kartuša sa učvršćivačem" }), "8,11 kg");
  assert.equal(rowQuantityLabel({ label: "500 ml" }), "500 ml");
  assert.equal(rowQuantityLabel({ package: "1,0 l", label: "Limenka" }), "1 L");
  assert.equal(rowQuantityLabel({ label: "RX253A / orbita 3 mm" }), null);
  assert.equal(rowQuantityLabel({ label: "P80" }), null);
});
