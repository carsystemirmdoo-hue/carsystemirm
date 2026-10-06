import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { stagePendingRightsImages } from "./stage-pending-rights-images.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const registry = JSON.parse(readFileSync(path.join(ROOT, "data/catalog/image-supply/supplied-images.json"), "utf8"));
const pending = registry.images.filter((image) => image.rightsBasis !== "OWNER_CONFIRMED");

function sandbox() {
  const root = mkdtempSync(path.join(tmpdir(), "pending-rights-"));
  mkdirSync(path.join(root, "data/catalog/image-supply"), { recursive: true });
  cpSync(path.join(ROOT, "data/catalog/image-supply/supplied-images.json"), path.join(root, "data/catalog/image-supply/supplied-images.json"));
  cpSync(path.join(ROOT, "review-assets"), path.join(root, "review-assets"), { recursive: true });
  return root;
}

test("slike bez potvrđenog prava nisu u praćenom public/ i imaju izvor van njega", () => {
  assert.ok(pending.length > 0);
  for (const image of pending) {
    assert.match(image.path, /\/pending-rights\//, image.imageId);
    assert.ok(image.stagedSource && !image.stagedSource.startsWith("public/"), image.imageId);
    assert.ok(existsSync(path.join(ROOT, image.stagedSource)), image.stagedSource);
  }
  assert.match(readFileSync(path.join(ROOT, ".gitignore"), "utf8"), /^public\/products\/\*\/pending-rights\/$/m);
});

test("Production build: u public/ ne ostaje nijedna slika bez potvrđenog prava", () => {
  const root = sandbox();
  stagePendingRightsImages({ root, vercelEnv: "preview" });
  for (const image of pending) assert.ok(existsSync(path.join(root, "public", image.path)));
  const result = stagePendingRightsImages({ root, vercelEnv: "production" });
  assert.equal(result.removed.length, pending.length);
  for (const image of pending) assert.equal(existsSync(path.join(root, "public", image.path)), false, image.path);
});

test("lokalno i Preview: slike se postavljaju radi pregleda", () => {
  const root = sandbox();
  for (const env of [undefined, "preview"]) {
    const result = stagePendingRightsImages({ root, vercelEnv: env });
    assert.equal(result.staged.length, pending.length);
  }
});

test("Production build briše i zaostale kopije koje više nisu u registru", () => {
  const root = sandbox();
  const stray = path.join(root, "public/products/norbin/pending-rights/stara-kopija.webp");
  mkdirSync(path.dirname(stray), { recursive: true });
  writeFileSync(stray, "x");
  stagePendingRightsImages({ root, vercelEnv: "production" });
  assert.equal(existsSync(stray), false);
  assert.equal(existsSync(path.join(root, "public/products/norbin/pending-rights")), false);
});
