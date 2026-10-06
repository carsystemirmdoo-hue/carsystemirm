import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { suppliedImageAllowed } from "./supplied-image-rights.mjs";

const registry = JSON.parse(readFileSync(new URL("../data/catalog/image-supply/supplied-images.json", import.meta.url), "utf8"));

test("potvrđeno pravo važi svuda", () => {
  for (const env of [undefined, "development", "preview", "production"]) assert.equal(suppliedImageAllowed({ rightsBasis: "OWNER_CONFIRMED" }, env), true);
});

test("nepotvrđeno pravo: lokalno i Preview da, Production ne", () => {
  const entry = { rightsBasis: "OWNER_CONFIRMATION_REQUIRED" };
  assert.equal(suppliedImageAllowed(entry, undefined), true);
  assert.equal(suppliedImageAllowed(entry, "preview"), true);
  assert.equal(suppliedImageAllowed(entry, "production"), false);
});

test("nijedna slika sa nepotvrđenim pravom ne ulazi u Production", () => {
  const pending = registry.images.filter((image) => image.rightsBasis !== "OWNER_CONFIRMED");
  for (const image of pending) assert.equal(suppliedImageAllowed(image, "production"), false, image.imageId);
});

test("distributerski renderi moraju nositi izričitu oznaku prava", () => {
  for (const image of registry.images.filter((entry) => entry.sourceBasis === "DISTRIBUTOR_HOSTED_MANUFACTURER_RENDER")) {
    assert.ok(["OWNER_CONFIRMED", "OWNER_CONFIRMATION_REQUIRED"].includes(image.rightsBasis), image.imageId);
  }
});
