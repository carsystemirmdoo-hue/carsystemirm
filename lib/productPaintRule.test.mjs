import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  BASLAC_PAINT_FINISHES,
  PAINT_RULE_OVERRIDES,
  getProductDataShade,
  isPaintProduct,
} from "./productPaintRule.mjs";

const rm = (category, slug = `rm-${category}`) => ({
  slug,
  rmMetadata: { category, system: null, series: null, technology: null, finish: null },
});

const cosmos = (productType, colorSource, slug = `cosmos-${productType}`) => ({
  slug,
  visual: {
    treatment: "paint",
    productType,
    visualMode: "color-on-hover",
    backgroundColor: "#AA3311",
    foregroundTone: "light",
    colorSource,
  },
});

const baslac = (technicalCategory, finish, slug = "baslac-x") => ({
  slug,
  catalogMetadata: { technicalCategory, finish, colorName: "X" },
});

test('R-M: samo basecoat je boja; sistemske komponente nisu', () => {
  assert.equal(isPaintProduct(rm("basecoat")), true);
  for (const category of [
    "clearcoat",
    "primer-filler",
    "bodyfiller",
    "hardener",
    "thinner",
    "additive",
    "cleaner",
    "polishing-compound",
  ]) {
    assert.equal(isPaintProduct(rm(category)), false, category);
  }
});

test("Cosmos Lac: aerosol za farbanje jeste boja, ostali aerosoli nisu", () => {
  assert.equal(isPaintProduct(cosmos("color", "ral")), true);
  assert.equal(isPaintProduct(cosmos("color", "manual-estimate")), true);
  // antichip / cink su tipa "spray" — aerosol, ali ne farba
  assert.equal(isPaintProduct(cosmos("spray", "cap-sample")), false);
  for (const type of ["neutral", "clearcoat", "primer", "filler"]) {
    assert.equal(isPaintProduct(cosmos(type, "cap-sample")), false, type);
  }
});

test("Baslac: mešni tonovi linija 30/35/45 jesu boja; konverteri, aditivi i tehnički deo nisu", () => {
  for (const finish of BASLAC_PAINT_FINISHES) {
    assert.equal(isPaintProduct(baslac("Line 35", finish)), true, finish);
    assert.equal(isPaintProduct(baslac("Line 45", finish)), true, finish);
    assert.equal(isPaintProduct(baslac("Line 30", finish)), true, finish);
  }
  for (const finish of ["Converter", "Aditiv", "Tehnički", null]) {
    assert.equal(isPaintProduct(baslac("Line 45", finish)), false, String(finish));
  }
  assert.equal(isPaintProduct(baslac("Line 30 CV", "Converter")), false);
  assert.equal(isPaintProduct(baslac("Priprema podloge", null)), false);
});

test('reč „sprej” u nazivu i faza „boja” nisu dokaz', () => {
  assert.equal(
    isPaintProduct({ slug: "sprej-za-ciscenje", name: "Sprej za čišćenje", phaseSlug: "boja", programSlug: "aerosoli" }),
    false,
  );
  assert.equal(isPaintProduct({ slug: "nepoznat" }), false);
});

test("izuzeci su centralizovani i pobeđuju lestvicu", () => {
  assert.equal(PAINT_RULE_OVERRIDES["baslac-30-s510-s-serija"], true);
  assert.equal(isPaintProduct({ slug: "baslac-30-s510-s-serija" }), true);
  assert.equal(PAINT_RULE_OVERRIDES["baslac-30-s00"], false);
  assert.equal(isPaintProduct(baslac("Line 30", "Transparent", "baslac-30-s00")), false);
});

test("stvarna nijansa: boja uvek, prajmer/kit/zaštitni sprej samo iz izmerenog izvora, neutralno nikad", () => {
  assert.equal(getProductDataShade(cosmos("color", "manual-estimate")), "#AA3311");
  assert.equal(getProductDataShade(cosmos("primer", "cap-sample")), "#AA3311");
  assert.equal(getProductDataShade(cosmos("spray", "name-derived")), "#AA3311");
  assert.equal(getProductDataShade(cosmos("primer", "manual-estimate")), null);
  assert.equal(getProductDataShade(cosmos("neutral", "cap-sample")), null);
  assert.equal(getProductDataShade(cosmos("clearcoat", "name-derived")), null);
  assert.equal(getProductDataShade({ slug: "x" }), null);
});

test("PDP grafit i katalog kartica čitaju isto pravilo", () => {
  const motion = readFileSync(
    new URL("../components/product/productMotion.ts", import.meta.url),
    "utf8",
  );
  assert.match(motion, /from "@\/lib\/product-paint-rule"/);
  assert.match(motion, /return isPaintProduct\(product\)/);

  const card = readFileSync(
    new URL("../components/catalog/CatalogProductCard.tsx", import.meta.url),
    "utf8",
  );
  // Boja brenda samo na /katalog (catalogSystem) i samo bez nijanse proizvoda.
  assert.match(card, /listing\.presentation\.shade \?\? getBrandCardColor\(brand\)/);
});
