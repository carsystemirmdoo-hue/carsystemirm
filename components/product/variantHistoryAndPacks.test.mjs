import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { expandRowVariants } from "./productVariantState.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("izbor varijante ne dodaje korak istorije (jedan „Nazad“ vraća na katalog)", async () => {
  const options = await read("./ProductVariantOptions.tsx");
  assert.match(options, /selectVariant\(view, false\)/);
  const baslac = await read("../baslac-brand/BaslacSystemPdp.tsx");
  assert.match(baslac, /\(code: string, push = false\)/);
  assert.doesNotMatch(baslac, /selectVariant\([^)]*,\s*true\)/);
  const packs = await read("./useVariantPackChoice.ts");
  assert.doesNotMatch(packs, /pushState/);
});

test("baza bez fotografije svoje zapremine dobija napomenu, ne pogrešnu oznaku", () => {
  const base = {
    key: "rm-x",
    id: "rm-x",
    slug: "rm-x",
    hasSprayBackdrop: true,
    quantityLabel: "0,5 L",
    imageQuantityLabel: "4 L",
    images: [{ src: "/products/rm/rm-x.webp" }],
  };
  const rows = [
    { id: "BC 100", sku: "BC 100", package: "kanta 4 L" },
    { id: "BC 101", sku: "BC 101", package: "pakovanje 1 L" },
  ];
  const [four, one] = expandRowVariants(base, rows, (src) => ({ src }));
  assert.equal(four.imageNote, null);
  assert.equal(four.quantityLabel, "4 L");
  assert.equal(one.quantityLabel, null);
  assert.match(one.imageNote, /Reprezentativna ambalaža 4 L\. Izabrano pakovanje: 1 L\./);
  const [unknown] = expandRowVariants({ ...base, imageQuantityLabel: null }, rows, (src) => ({ src }));
  assert.match(unknown.imageNote, /zapremina na slici nije potvrđena\. Izabrano pakovanje: 4 L\./);
  assert.equal(unknown.quantityLabel, null);
});

test("boje: jedna reprezentativna fotografija po zapremini", () => {
  const base = { key: "p", id: "p", slug: "p", hasSprayBackdrop: true, quantityLabel: null, images: [] };
  const rows = [
    { id: "A", sku: "A", package: "4 L", image: "/a.webp" },
    { id: "B", sku: "B", package: "4 L", image: "/b.webp" },
    { id: "C", sku: "C", package: "1 L" },
  ];
  const [a, b, c] = expandRowVariants(base, rows, (src) => ({ src }));
  assert.equal(a.images[0].src, "/a.webp");
  assert.equal(b.images[0].src, "/a.webp");
  assert.match(b.imageNote, /Reprezentativna ambalaža 4 L/);
  assert.equal(c.images.length, 0);
});

test("pene i drugi redovi bez spreja zadržavaju svoju sliku", () => {
  const base = { key: "p", id: "p", slug: "p", hasSprayBackdrop: false, quantityLabel: null, images: [] };
  const rows = [
    { id: "A", sku: "A", package: "150 mm", image: "/a.webp" },
    { id: "B", sku: "B", package: "150 mm", image: "/b.webp" },
  ];
  const [, b] = expandRowVariants(base, rows, (src) => ({ src }));
  assert.equal(b.images[0].src, "/b.webp");
  assert.equal(b.imageNote, null);
});
