import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getProductCategory,
  getProductCategorySlug,
  isProductCategorySlug,
  productCategories,
  productCategorySlugs,
} from "./productTaxonomy.mjs";

test("taksonomija ima tačno 12 kategorija", () => {
  assert.equal(productCategorySlugs.length, 12);
  assert.equal(productCategories.length, 12);
  assert.equal(new Set(productCategorySlugs).size, 12);
});

test("navigacioni linkovi i taksonomija koriste iste slugove", () => {
  const navigation = readFileSync(
    new URL("../components/layout/navigation-data.ts", import.meta.url),
    "utf8",
  );
  const linkSlugs = [
    ...navigation.matchAll(/href:\s*"\/katalog\?kategorija=([a-z-]+)"/g),
  ].map((match) => match[1]);

  assert.equal(linkSlugs.length, 12);
  assert.deepEqual([...linkSlugs].sort(), [...productCategorySlugs].sort());
});

test("nepoznata kategorija se ne prepoznaje kao validna", () => {
  assert.equal(isProductCategorySlug("boje"), true);
  assert.equal(isProductCategorySlug("izmisljena-kategorija"), false);
  assert.equal(getProductCategory("izmisljena-kategorija"), undefined);
});

test("R-M proizvodna kategorija ima prednost nad svim ostalim poljima", () => {
  // Badge bi sam po sebi vodio u Kitove; rmMetadata mora pobediti.
  assert.equal(
    getProductCategorySlug({
      rmMetadata: { category: "clearcoat" },
      badges: ["Git"],
      programSlug: "priprema-povrsine",
      phaseSlug: "lak",
    }),
    "boje",
  );
  assert.equal(
    getProductCategorySlug({ rmMetadata: { category: "bodyfiller" }, badges: [] }),
    "kitovi",
  );
  assert.equal(
    getProductCategorySlug({ rmMetadata: { category: "polishing-compound" }, badges: [] }),
    "poliranje",
  );
});

test("aerosolna boja ide u Sprejeve, aerosolni čistač u Čišćenje", () => {
  assert.equal(
    getProductCategorySlug({
      catalogMetadata: { technicalCategory: "ral-spray" },
      phaseSlug: "boja",
      programSlug: "aerosoli",
      badges: [],
    }),
    "sprejevi",
  );
  // Format nije identitet kada proizvod ima svoju funkciju.
  assert.equal(
    getProductCategorySlug({
      catalogMetadata: { technicalCategory: "cleaner" },
      phaseSlug: "priprema",
      programSlug: "aerosoli",
      badges: [],
    }),
    "ciscenje",
  );
  assert.equal(
    getProductCategorySlug({
      catalogMetadata: { technicalCategory: "antichip" },
      phaseSlug: "podloga",
      programSlug: "aerosoli",
      badges: [],
    }),
    "zastita",
  );
  assert.equal(
    getProductCategorySlug({
      catalogMetadata: { technicalCategory: "adhesive" },
      phaseSlug: "priprema",
      programSlug: "aerosoli",
      badges: [],
    }),
    "lepkovi",
  );
});

test("ručno pisani zapisi se klasifikuju po badge-u, pa po programu", () => {
  assert.equal(
    getProductCategorySlug({
      badges: ["Priprema", "Git", "Na upit"],
      programSlug: "priprema-povrsine",
    }),
    "kitovi",
  );
  assert.equal(
    getProductCategorySlug({ badges: ["Maskiranje", "Folija"], programSlug: "potrosni-materijal" }),
    "maskiranje",
  );
  assert.equal(
    getProductCategorySlug({ badges: ["Abrazivi", "P40-P800"], programSlug: "abrazivi" }),
    "abrazivi",
  );
  assert.equal(
    getProductCategorySlug({ badges: ["Oprema", "Lakiranje"], programSlug: "oprema" }),
    "oprema",
  );
});

test("proizvod bez ijednog dokaza ostaje neklasifikovan, ne pada u default", () => {
  assert.equal(
    getProductCategorySlug({ badges: [], programSlug: "nepoznat-program" }),
    undefined,
  );
  assert.equal(getProductCategorySlug({ badges: [] }), undefined);
});
