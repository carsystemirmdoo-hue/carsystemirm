/**
 * R-M sync — pravila modela, na fiksiranim primerima i na stvarnom datasetu.
 *
 * Testira se ono što bi tiho pokvarilo katalog: pomešana uloga (učvršćivač kao varijanta
 * laka), toner kao kartica, duplirani zapis za proizvod koji već vodimo, i taksonomija koja
 * bi sve R-M svrstala u „Boje”.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { normalizeCode, parseTds } from "./lib/tds.mjs";
import { resolveTaxonomy } from "./lib/taxonomy.mjs";

const read = (file) => JSON.parse(readFileSync(new URL(file, import.meta.url).pathname.replace("/scripts/rm-sync/", "/"), "utf8"));
const source = existsSync("data/rm-sync/source-products.generated.json") ? read("../../data/rm-sync/source-products.generated.json") : null;
const plan = existsSync("data/rm-sync/reports/sync-plan.generated.json") ? read("../../data/rm-sync/reports/sync-plan.generated.json") : null;
const dataset = existsSync("data/rm-catalog-products.generated.json") ? read("../../data/rm-catalog-products.generated.json") : null;
const taxonomyRules = read("../../data/rm-sync/taxonomy-map.json").rules;

const TDS_PAGES = [
  `Technical Information\nGlossTOP+\nC 2A64 Clear coat, superior gloss\nPage 1 of 2 07/2026\nApplication Advance Series - Clear coat especially for ONYX HD basecoat.\nKey Features Clear coat for superior gloss and high end result.\nMixing Ratio 2:1 + 10%\nHardener 50 % by volume H 2A14 - Topcoat hardener, fast\nH 2A24 - Topcoat hardener, medium\nThinner 10 % by volume R 2A14 - Thinner, fast\nPotlife at 20°C 2 h\nNozzle Size 1.3 -1.4\nFilm thickness 40-60 μm\nDrying at 20°C 10 h\nDrying at 60°C 30 min`,
  `Sand with P400 and P500 before application.\n2004/42/IIB(d)(420)419: The EU limit value for this product (product category: IIB.d) in ready-for-use form\nis max 420 g/l. The VOC content of this product is 419 g/l.\nR-M Refinish Coatings by Surventis`,
];

test("TDS se čita kao činjenice: razmera, učvršćivači, razređivači, VOC, sušenje", () => {
  const tds = parseTds(TDS_PAGES);
  assert.equal(tds.revision, "2026-07");
  assert.equal(tds.publisher, "Surventis");
  assert.equal(tds.mixingRatio, "2:1 + 10%");
  assert.deepEqual(tds.hardeners, ["H 2A14", "H 2A24"]);
  assert.deepEqual(tds.thinners, ["R 2A14"]);
  assert.equal(tds.potLife, "at 20°C 2 h");
  assert.equal(tds.filmThickness, "40-60 μm");
  assert.deepEqual(tds.drying, ["Drying at 20°C 10 h", "Drying at 60°C 30 min"]);
  assert.deepEqual(tds.voc, { category: "IIB.d", limit: 420, content: 419 });
});

test("granulacija brusnog papira („P400”) nije R-M oznaka proizvoda", () => {
  const tds = parseTds(TDS_PAGES);
  assert.ok(!tds.mentionedCodes.includes("P 400"), "P 400 je FEPA granulacija, ne šifra");
  assert.ok(tds.mentionedCodes.includes("H 2A14"));
  assert.equal(normalizeCode("c2a64"), "C 2A64");
  assert.equal(normalizeCode(" h 2a14 "), "H 2A14");
});

test("taksonomija prati ULOGU, ne brend: čistač, kit i aerosol ne završavaju u „Boje”", () => {
  const byCode = new Map();
  const of = (product) => resolveTaxonomy({ introduction: [], tds: null, usedBy: [], ...product }, byCode, taxonomyRules);
  assert.equal(of({ role: "cleaner" }).category, "ciscenje");
  assert.equal(of({ role: "bodyfiller" }).category, "kitovi");
  assert.equal(of({ role: "undercoat", introduction: ["1K Filler supplied in an aerosol can"] }).category, "sprejevi");
  assert.equal(of({ role: "undercoat" }).category, "boje");
  assert.equal(of({ role: "undercoat" }).phaseSlug, "podloga");
  assert.equal(of({ role: "clearcoat" }).phaseSlug, "lak");
  // Učvršćivač KITA ide uz kitove, ne uz lakove.
  assert.equal(of({ role: "hardener", tds: { application: "This product is used in R-M body filler." } }).category, "kitovi");
  assert.equal(of({ role: "hardener" }).category, "boje");
});

test("komponenta nasleđuje fazu proizvoda koji je koristi", () => {
  const byCode = new Map([["P 2A61", { role: "undercoat" }], ["C 2A64", { role: "clearcoat" }]]);
  const undercoatHardener = resolveTaxonomy({ role: "hardener", kind: "component", introduction: [], tds: null, usedBy: ["P 2A61"] }, byCode, taxonomyRules);
  assert.equal(undercoatHardener.phaseSlug, "podloga");
  const clearcoatHardener = resolveTaxonomy({ role: "hardener", kind: "component", introduction: [], tds: null, usedBy: ["C 2A64"] }, byCode, taxonomyRules);
  assert.equal(clearcoatHardener.phaseSlug, "lak");
});

test("izvor: sistem je jedan zapis, a mixing baze nemaju karticu", { skip: !source && "nema source dataseta" }, () => {
  const systems = source.products.filter((product) => product.kind === "system");
  assert.ok(systems.length >= 8, "očekivano najmanje 8 sistema za nijansiranje");
  for (const system of systems) assert.equal(system.code && /^[A-Z]{1,3} \d/.test(system.code), false, `${system.code}: sistem ne nosi oznaku artikla`);
  // HB baze su komponente sistema, ne proizvodi sa karticom.
  const componentCodes = new Set(source.systemComponents.map((component) => component.code));
  assert.ok(componentCodes.size >= 10);
  for (const code of componentCodes) assert.ok(!source.products.some((product) => product.code === code), `${code} ne sme biti zaseban zapis`);
});

test("izvor: učvršćivač/razređivač je samostalan zapis sa odnosima, nikad varijanta", { skip: !source && "nema source dataseta" }, () => {
  const clearcoat = source.products.find((product) => product.code === "C 2A64");
  assert.equal(clearcoat.kind, "product");
  assert.ok(clearcoat.relations.hardeners.length >= 2);
  for (const code of clearcoat.relations.hardeners) {
    const hardener = source.products.find((product) => product.code === code);
    assert.equal(hardener.kind, "component");
    assert.equal(hardener.role, "hardener");
    assert.ok(hardener.usedBy.includes("C 2A64"), `${code} mora znati da ga C 2A64 koristi`);
  }
});

test("plan: svaka oznaka je na tačno jednom zapisu i postojeći zapisi se dopunjuju, ne dupliraju", { skip: !plan && "nema plana" }, () => {
  const codes = plan.items.filter((item) => item.code).map((item) => item.code);
  assert.equal(new Set(codes).size, codes.length, "oznaka se pojavljuje dvaput");
  const slugs = plan.items.filter((item) => item.slug).map((item) => item.slug);
  assert.equal(new Set(slugs).size, slugs.length, "dva zapisa dele slug");
  assert.deepEqual(plan.summary.planErrors, { duplicateSlugs: [], duplicateCodes: [], localRecordForTwoCodes: [] });
  // Postojećih 59 uvezenih zapisa zadržava svoj slug (URL se ne menja).
  const enriched = plan.items.filter((item) => item.action === "ENRICH_EXISTING");
  assert.ok(enriched.length >= 59);
  for (const item of enriched) assert.ok(!item.slug.startsWith("rm-a-") && !item.slug.startsWith("rm-c-"), `${item.slug}: dopuna ne sme da dobije nov slug`);
});

test("dataset: zapisi nose zvaničnu oznaku, referencu na TDS i „Na upit” pakovanje", { skip: !dataset?.products.length && "dataset je prazan" }, () => {
  // Zvanični identifikator portala ume da bude i imenski („AGILIS”, „SC T2A203”), pa se
  // proverava da POSTOJI u izvoru, a ne da liči na šifru.
  const officialCodes = new Set(source.products.map((product) => product.code));
  for (const product of dataset.products) {
    if (product.code) assert.ok(officialCodes.has(product.code), `${product.code} nije zvanična oznaka sa portala`);
    for (const document of product.documents) assert.match(document.href, /^https:\/\/techinfo\.rmpaint\.com\//);
    assert.equal(product.content.productType.length > 0, true);
  }
  const withRelations = dataset.products.filter((product) => product.relations.length);
  assert.ok(withRelations.length > 0, "nijedan zapis nema sistemske odnose");
  for (const product of withRelations) for (const relation of product.relations) assert.ok(["USES_HARDENER", "USES_REDUCER", "USES_ADDITIVE"].includes(relation.relation));
});
