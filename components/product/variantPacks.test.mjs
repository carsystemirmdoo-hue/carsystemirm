import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPackIndex, packLabelsOf, packSlug } from "./variantPacks.mjs";

test("pakovanja iz stvarnog teksta, bez pretpostavki", () => {
  assert.deepEqual(packLabelsOf("kanta 4 L"), ["4 L"]);
  assert.deepEqual(packLabelsOf("pakovanje 0,5 L"), ["0,5 L"]);
  assert.deepEqual(packLabelsOf("1 L · 4 L"), ["1 L", "4 L"]);
  assert.deepEqual(packLabelsOf("bočica 125 ml"), ["125 ml"]);
  assert.deepEqual(packLabelsOf(""), []);
});

test("grupe idu od najvećeg pakovanja, sa brojem varijanti", () => {
  const { packs, packsByVariant } = buildPackIndex([
    { id: "a", package: "pakovanje 1 L" },
    { id: "b", package: "kanta 4 L" },
    { id: "c", package: "pakovanje 0,5 L" },
    { id: "d", package: "1 L · 4 L" },
    { id: "e", package: null },
  ]);
  assert.deepEqual(
    packs.map((p) => `${p.label}:${p.count}`),
    ["4 L:2", "1 L:2", "0,5 L:1"],
  );
  assert.deepEqual(packsByVariant.get("d"), ["1 L", "4 L"]);
  assert.deepEqual(packsByVariant.get("e"), []);
  assert.equal(packSlug("0,5 L"), "0-5-l");
});
