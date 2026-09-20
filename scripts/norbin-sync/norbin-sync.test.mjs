/**
 * Norbin sync — pravila modela, na fiksiranim primerima i na stvarnom datasetu.
 *
 * Testira se ono što bi tiho pokvarilo katalog: izgubljen upitni token iz zvaničnog linka,
 * šifra koju izvor nigde ne objavljuje pretvorena u karticu, tvrdnja o dostupnosti,
 * izmišljen broj artikla i dva pakovanja jednog proizvoda prikazana kao dve kartice.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { REPO_ROOT } from "./lib/config.mjs";
import { codeOfSku } from "./lib/local-match.mjs";
import { codesIn } from "./lib/website-text.mjs";

const read = (file) => JSON.parse(readFileSync(path.join(REPO_ROOT, file), "utf8"));
const exists = (file) => existsSync(path.join(REPO_ROOT, file));
const source = exists("data/norbin-sync/source-products.generated.json") ? read("data/norbin-sync/source-products.generated.json") : null;
const plan = exists("data/norbin-sync/reports/sync-plan.generated.json") ? read("data/norbin-sync/reports/sync-plan.generated.json") : null;
const dataset = exists("data/norbin-catalog-products.generated.json") ? read("data/norbin-catalog-products.generated.json") : null;
const stock = exists("data/knowledge/norbin-stock-evidence.generated.json") ? read("data/knowledge/norbin-stock-evidence.generated.json") : null;

/* -- Čitanje šifre ------------------------------------------------------------------------ */

test("šifra se prepoznaje i iza donje crte, ali ne kao deo duže oznake", () => {
  // `\b` NE važi iza `_` (oba su znakovi reči) — zbog toga je raniji popis izgubio 6 šifara.
  assert.deepEqual(codesIn("SDS_N15-120_1L_TR.PDF"), ["N15-120"]);
  assert.deepEqual(codesIn("NORBIN ® N55-V20 2K Primer Filler grey"), ["N55-V20"]);
  assert.deepEqual(codesIn("N75-021 NORBIN Hardener Normal N75-022"), ["N75-021", "N75-022"]);
  assert.deepEqual(codesIn("bez ijedne sifre"), []);
  assert.equal(codeOfSku("NORBIN-N15-020-1L"), "N15-020");
  // Golo numeričko poklapanje se ne prihvata.
  assert.equal(codeOfSku("CARFIT-500-1L"), null);
});

/* -- Model: stvarni dataset ---------------------------------------------------------------- */

const modelTest = source && plan && dataset && stock ? test : test.skip;

modelTest("aktuelan je samo proizvod koji AKTUELNA stranica opsega linkuje", () => {
  const emea = source.products.filter((product) => product.status === "CURRENT_EMEA");
  assert.equal(emea.length, plan.summary.CURRENT_OFFICIAL_CODES);
  for (const product of emea) assert.ok(product.liveRegions.includes("en"), `${product.code}: nije živ u referentnom regionu`);
  // Zakomentarisan link je proizvođačeva odluka da proizvod ne objavi — nikad ponuda.
  for (const product of source.products.filter((entry) => entry.status === "UNLINKED_IN_SOURCE")) {
    assert.equal(product.liveRegions.length, 0);
    assert.ok(!dataset.products.some((entry) => entry.code === product.code), `${product.code} ne sme biti kartica`);
  }
});

modelTest("sistema i tonera nema — izvor ih uopšte ne objavljuje", () => {
  assert.equal(plan.summary.CURRENT_SYSTEMS, 0);
  assert.equal(plan.summary.CURRENT_PUBLIC_TONERS, 0);
  assert.ok(!dataset.products.some((product) => product.role === "system"));
});

modelTest("komponenta bez zvaničnog identiteta ne dobija karticu ni pojam pretrage", () => {
  assert.deepEqual(plan.summary.officialReferencedComponents, ["N85-025"]);
  assert.ok(!dataset.products.some((product) => product.code === "N85-025"));
  for (const product of dataset.products) {
    for (const relation of [...product.relations, ...product.usedBy]) {
      if (relation.officialIdentity) continue;
      assert.equal(relation.slug, null, `${relation.code}: nerazrešena referenca ne sme imati slug`);
    }
  }
  // Interni ERP artikal te šifre ostaje u dokazu, ne u katalogu.
  assert.ok(stock.articles.some((article) => article.manufacturerCode === "N85-025"));
});

modelTest("dostupnost dolazi iz dokaza o aktivnosti, a javni status je uvek „Na upit”", () => {
  const all = [...dataset.products, ...Object.values(dataset.enrichments)];
  const codesWithArticles = new Set(stock.articles.map((article) => article.manufacturerCode));
  for (const entry of all) {
    assert.equal(entry.availability.publicStatus, "Na upit", `${entry.code}: javni status tvrdi dostupnost`);
    const expected = codesWithArticles.has(entry.code) ? ["SELLABLE_CURRENT", "SELLABLE_CURRENT_ZERO_STOCK"] : ["NOT_IN_OUR_PROGRAMME"];
    assert.ok(expected.includes(entry.availability.status), `${entry.code}: ${entry.availability.status} ne odgovara dokazu`);
  }
  // Dokaz sadrži samo ono što je potrebno za identitet i aktivnost — ništa poslovno.
  for (const article of stock.articles) assert.deepEqual(Object.keys(article).sort(), ["articleId", "manufacturerCode", "pack", "status"]);
});

modelTest("zvanični link se prenosi doslovno, sa upitnim tokenom", () => {
  const tokenized = dataset.products.flatMap((product) => product.documents).filter((document) => document.tokenizedUrl);
  assert.ok(tokenized.length > 0, "bar jedan zvanični link nosi token");
  for (const document of tokenized) assert.match(document.href, /\?/);
  for (const product of [...dataset.products, ...Object.values(dataset.enrichments)]) {
    for (const document of product.documents) assert.match(document.href, /^https:\/\/www\.norbin-paint\.com\//);
  }
});

modelTest("brojeva artikala nema — ni zvaničnih ni naših — u javnom zapisu", () => {
  assert.equal(plan.summary.VERIFIED_ARTICLE_NUMBERS, 0);
  assert.equal(plan.summary.ASSET_FILENAME_ONLY_NUMBERS, 0);
  const published = JSON.stringify(dataset.products.map((product) => ({ ...product, availability: null })));
  assert.equal(/\b\d{6}\b/.exec(published), null, "interni broj artikla je procureo u javni zapis");
});

modelTest("dva pakovanja jednog proizvoda su jedna porodica, a stari slugovi ostaju", () => {
  const packaging = Object.entries(dataset.enrichments).filter(([, entry]) => entry.family);
  assert.equal(packaging.length, 2);
  for (const [slug, entry] of packaging) {
    assert.equal(entry.family.baseProductSlug, "norbin-n15-020");
    assert.match(slug, /^norbin-n15-020-(1l|5l)$/, "postojeća adresa se ne sme promeniti");
  }
  // Tačno jedan član nosi javni identitet porodice.
  assert.equal(packaging.filter(([, entry]) => entry.family.identity).length, 1);
});

modelTest("proizvođač ne objavljuje nijednu fotografiju", () => {
  assert.equal(dataset.meta.officialProductImages, 0);
  for (const product of dataset.products) {
    assert.equal(product.image, null);
    assert.equal(product.missingOfficialAsset, true);
  }
});
