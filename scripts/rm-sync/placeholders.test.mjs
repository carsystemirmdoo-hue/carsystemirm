import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { isPortalPlaceholder } from "./lib/placeholders.mjs";

const PORTAL = "https://info.rmpaint.com/system/files/styles/natural_limited/private/images/";

test("zamenska sličica portala se prepoznaje i po izvornom imenu fajla", () => {
  assert.equal(isPortalPlaceholder({ url: `${PORTAL}Image%20missing_1.png?itok=1F9waFua` }), true);
  assert.equal(isPortalPlaceholder({ url: `${PORTAL}Image%20missing.png` }), true);
  assert.equal(isPortalPlaceholder({ url: `${PORTAL}H%202RM1CL.png?itok=1dZPBF84` }), false);
  assert.equal(isPortalPlaceholder({ url: `${PORTAL}H%202RM1CL.png`, placeholder: true }), true);
});

test("H 2RM2 ne nosi natpis „Image missing” kao sliku proizvoda", () => {
  const catalog = JSON.parse(readFileSync(new URL("../../data/rm-catalog-products.generated.json", import.meta.url), "utf8"));
  const record = catalog.products.find((product) => product.code === "H 2RM2");
  assert.ok(record, "H 2RM2 postoji u katalogu");
  assert.equal(record.image, null);
  assert.equal(record.missingOfficialAsset, true);
});

/* ---------------- regresija: placeholder portala nikad nije slika proizvoda ---------------- */

const readJson = (relative) => JSON.parse(readFileSync(new URL(relative, import.meta.url), "utf8"));

test("nijedna objavljena R-M slika ne potiče iz zamenske sličice portala", () => {
  const manifest = readJson("../../data/rm-sync/image-manifest.generated.json");
  const published = readJson("../../data/rm-sync/published-images.generated.json");
  const placeholderShas = new Set(manifest.images.filter((image) => !image.error && isPortalPlaceholder(image)).map((image) => image.sha256));
  assert.ok(placeholderShas.size >= 2, "manifest sadrži obe poznate zamenske sličice");
  for (const [publicPath, entry] of Object.entries(published.images)) {
    assert.equal(placeholderShas.has(entry.sourceSha256), false, `${publicPath} je objavljen iz placeholder-a`);
    assert.equal(isPortalPlaceholder({ url: entry.sourceUrl }), false, `${publicPath} potiče iz „Image missing” fajla`);
  }
});

test("nijedan R-M zapis sajta ne pokazuje na sliku koja nije objavljena iz zvaničnog izvora", () => {
  const catalog = readJson("../../data/rm-catalog-products.generated.json");
  const published = readJson("../../data/rm-sync/published-images.generated.json");
  for (const product of catalog.products) {
    if (!product.image?.src?.startsWith("/products/rm/catalog/")) continue;
    assert.ok(published.images[product.image.src], `${product.code}: ${product.image.src} nije u published-images`);
  }
});

test("H 2RM2: fajl placeholder-a je uklonjen i proizvod čeka dostavu, bez odobrenja", () => {
  assert.equal(existsSync(new URL("../../public/products/rm/catalog/rm-h-2rm2-wheel-clear-coat-hardener.webp", import.meta.url)), false);
  const queue = readFileSync(new URL("../../data/catalog/image-supply/USER_IMAGE_SUPPLY_QUEUE.csv", import.meta.url), "utf8");
  assert.match(queue, /R-M WHEEL CLEAR COAT, HARDENER/);
  const lock = readJson("../../data/catalog/image-supply/manifest-lock.json");
  const approvals = JSON.stringify(lock).match(/"approved(At|By)":("[^"]*"|null)/g) ?? [];
  assert.ok(approvals.length > 0);
  for (const value of approvals) assert.match(value, /:null$/, `lock ne sme imati odobrenje bez stvarne slike: ${value}`);
});
