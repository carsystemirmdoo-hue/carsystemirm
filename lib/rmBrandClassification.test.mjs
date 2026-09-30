import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  RM_CATEGORY_BY_DESIGNATION,
  RM_CATEGORY_BY_ROLE,
  RM_SYSTEM_BY_LINE,
  rmCategoryFromDesignation,
  rmBrandClassificationFromSyncEntry,
} from "./rmBrandClassification.mjs";

const catalog = JSON.parse(readFileSync(new URL("../data/rm-catalog-products.generated.json", import.meta.url), "utf8"));
const archive = JSON.parse(readFileSync(new URL("../data/rm-imported-products.generated.json", import.meta.url), "utf8"));
const archiveTaxonomy = new Map(archive.products.map((product) => [product.slug, product.taxonomy]));

const entry = (overrides) => ({ code: null, role: "hardener", line: null, series: null, technologyTags: [], ...overrides });

test("svaki zapis R-M sinhronizacije dobija klasifikaciju iz zvaničnih polja", () => {
  const missing = catalog.products.filter((product) => !rmBrandClassificationFromSyncEntry(product)).map((product) => product.slug);
  assert.deepEqual(missing, []);
});

test("sistem i serija dolaze samo iz zvanične linije i serije, nikad iz naziva", () => {
  // Naziv pominje UNO HD, ali zapis nema liniju → nema sistema.
  assert.equal(rmBrandClassificationFromSyncEntry(entry({ code: "H 9999", line: null })).system, null);
  assert.equal(rmBrandClassificationFromSyncEntry(entry({ line: "UNO HD" })).system, "uno-hd");
  // „GRAPHITE HD” u polju serije je sistem, ne serija.
  assert.equal(rmBrandClassificationFromSyncEntry(entry({ line: "GRAPHITE HD", series: "GRAPHITE HD" })).series, null);
  assert.equal(rmBrandClassificationFromSyncEntry(entry({ series: "Pioneer Series" })).series, "pioneer");

  for (const product of catalog.products) {
    const metadata = rmBrandClassificationFromSyncEntry(product);
    assert.equal(metadata.system, product.line ? RM_SYSTEM_BY_LINE[product.line] ?? null : null, product.slug);
  }
});

test("nepoznata kategorija ne dobija izmišljeno grupisanje", () => {
  assert.equal(rmBrandClassificationFromSyncEntry(entry({ role: "commercial-vehicle" })), undefined);
  assert.equal(rmBrandClassificationFromSyncEntry(entry({ role: "nepoznato", code: "X 1234" })), undefined);
  assert.equal(rmBrandClassificationFromSyncEntry(entry({ role: null })), undefined);
  // Nasleđeni ključ objekta nije kategorija.
  assert.equal(rmBrandClassificationFromSyncEntry(entry({ role: "toString" })), undefined);
  // Nepoznata linija, serija i tehnologija ostaju prazne.
  const metadata = rmBrandClassificationFromSyncEntry(entry({ line: "CRYSTAL BASE", series: "Element Series", technologyTags: ["Nano"] }));
  assert.deepEqual(metadata, { system: null, series: null, category: "hardener", technology: null, finish: null, categoryLabel: null });
});

test("Basecoat/Topcoat se ne predstavlja kao bazna boja", () => {
  assert.equal(rmBrandClassificationFromSyncEntry(entry({ role: "basecoat-topcoat", code: "SC T2A203" })).categoryLabel, "Bazna ili završna boja");
  assert.equal(rmBrandClassificationFromSyncEntry(entry({ role: "basecoat-topcoat", code: "A 2530X" })).category, "additive");
  assert.equal(rmBrandClassificationFromSyncEntry(entry({ role: "basecoat-topcoat", code: "A 2530X" })).categoryLabel, null);
});

test("dve zvanične tehnološke oznake se ne svode na izbor jedne", () => {
  assert.equal(rmBrandClassificationFromSyncEntry(entry({ technologyTags: ["UV-A"] })).technology, "uv");
  assert.equal(rmBrandClassificationFromSyncEntry(entry({ technologyTags: ["UV-A", "DTM"] })).technology, null);
});

test("CRYSTAL BASE nema aktivan zapis u R-M sinhronizaciji", () => {
  assert.equal(Object.values(RM_SYSTEM_BY_LINE).includes("crystal-base"), false);
  const crystal = catalog.products.filter((product) => /crystal/i.test(`${product.line} ${product.officialName} ${product.slug}`));
  assert.deepEqual(crystal.map((product) => product.slug), []);
});

test("slovo oznake i kategorija portala se razilaze samo kod „A” oznaka", () => {
  const rows = [...catalog.products, ...Object.entries(catalog.enrichments).map(([slug, value]) => ({ slug, ...value }))];
  const conflicts = rows.filter((row) => {
    const byLetter = rmCategoryFromDesignation(row.code);
    return byLetter && byLetter !== RM_CATEGORY_BY_ROLE[row.role];
  });
  assert.ok(conflicts.length > 0);
  for (const row of conflicts) assert.match(row.code, /^A \S/, `${row.slug} ${row.code} ${row.role}`);
});

test("pravilo slova se slaže sa već potvrđenim zapisima iz arhive", () => {
  let checked = 0;
  for (const [slug, enrichment] of Object.entries(catalog.enrichments)) {
    const confirmed = archiveTaxonomy.get(slug);
    const byLetter = rmCategoryFromDesignation(enrichment.code);
    if (!confirmed || !byLetter) continue;
    // A 2210/2220 (aktivatori), A 2520/2530 (blenderi), A 2560 — u arhivi su aditivi.
    if (byLetter === "additive") assert.equal(confirmed.category, "additive", slug);
    checked += 1;
  }
  assert.ok(checked >= 5);
  assert.equal(RM_CATEGORY_BY_DESIGNATION.A, "additive");
});

test("oznaka bez razmaka ili sa nepoznatim slovom ne daje kategoriju", () => {
  assert.equal(rmCategoryFromDesignation("GHD CV 12"), null);
  assert.equal(rmCategoryFromDesignation("SC T2A203"), null);
  assert.equal(rmCategoryFromDesignation("DIAMONT var CV"), null);
  assert.equal(rmCategoryFromDesignation(null), null);
  assert.equal(rmCategoryFromDesignation("PK 2A15"), "cleaner");
});
