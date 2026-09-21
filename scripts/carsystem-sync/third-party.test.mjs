/**
 * Proizvodi drugih proizvođača u Carsystem katalogu (RUPES): brend za kupca je proizvođač, a zapis,
 * adresa, šifra artikla i slika ostaju Carsystem-ovi. Brojevi se mere nad runtime-om i fajlom opsega.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { PATHS, REPO_ROOT } from "./lib/config.mjs";
import { OWN_GROUP, THIRD_PARTY_GROUP, articleIdsOf, partitionCarsystemSourced } from "./lib/sourced-products.mjs";
import { loadCatalogRuntime } from "../lib/catalog-runtime.mjs";

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const dataset = readJson(PATHS.siteDataset);
const registry = readJson(PATHS.identityRegistry);
const source = readJson(PATHS.source);
const thirdParty = readJson(PATHS.thirdParty);
const maker = thirdParty.manufacturers.rupes;
const runtime = loadCatalogRuntime();
const data = runtime.requireModule("lib/carsystem-data.ts");
const { own, thirdParty: thirdPartyProducts, manufacturerBySlug } = partitionCarsystemSourced(runtime.products, dataset);
const scopeSlugs = Object.keys(maker.products).sort();
const cards = runtime.listing.canonical;
const codeKey = (text) => String(text ?? "").toUpperCase().replace(/\s+/g, "");

test("opseg je RUPES_PRODUCTS_FROM_CARSYSTEM_PROGRAM i jednak je skupu koji izvor sam imenuje kao RUPES", () => {
  assert.equal(maker.scope, "RUPES_PRODUCTS_FROM_CARSYSTEM_PROGRAM");
  const named = dataset.products.filter((entry) => /^rupes\b/i.test(entry.officialName)).map((entry) => entry.slug).sort();
  assert.deepEqual(named, scopeSlugs);
  assert.deepEqual(dataset.products.filter((entry) => entry.manufacturer).map((entry) => entry.slug).sort(), scopeSlugs);
});

test("svi proizvodi iz opsega su pod brendom rupes; nijedan nije ostao pod Carsystem", () => {
  assert.deepEqual(thirdPartyProducts.map((product) => product.slug).sort(), scopeSlugs);
  for (const product of thirdPartyProducts) assert.equal(product.brandSlug, "rupes", product.slug);
  assert.equal(own.filter((product) => /rupes/i.test(`${product.slug} ${product.name}`)).length, 0);
  assert.deepEqual(cards.filter((card) => card.brandSlug === "rupes").map((card) => card.id).sort(), scopeSlugs);
  assert.equal(cards.filter((card) => card.brandSlug === "carsystem" && /rupes/i.test(`${card.id} ${card.name ?? ""}`)).length, 0);
});

test("promena brenda ne menja ukupan broj kartica iz Carsystem izvora ni ijednu adresu", () => {
  const sourcedCards = cards.filter((card) => card.brandSlug === "carsystem" || card.brandSlug === "rupes");
  assert.equal(sourcedCards.length, own.length + thirdPartyProducts.length);
  assert.equal(dataset.meta.coverageGroups[OWN_GROUP].products + dataset.meta.coverageGroups[THIRD_PARTY_GROUP].rupes.products, dataset.products.length);
  for (const slug of scopeSlugs) {
    assert.ok(registry.products[slug], `${slug} nije u registru identiteta`);
    assert.ok(runtime.products.some((product) => product.slug === slug), `${slug} više nije živa adresa`);
  }
  assert.equal(new Set(runtime.products.map((product) => product.slug)).size, runtime.products.length, "dupli slug");
});

test("rupes je aktivan brend sa tekstualnim nazivom, nije u futureBrands, bez tvrdnji o distribuciji", () => {
  const brand = data.brands.find((candidate) => candidate.slug === "rupes");
  assert.ok(brand);
  assert.equal(brand.routes.landing, "/brendovi/rupes");
  assert.equal(brand.logo, undefined, "logo fajl nije odobren — brend se prikazuje tekstualno");
  assert.ok(!data.futureBrands.some((candidate) => candidate.slug === "rupes"));
  assert.match(`${brand.description} ${brand.presentation.heroKicker}`, /RUPES proizvodi iz Carsystem programa/);
  assert.match(brand.overview, /nije kompletan RUPES katalog/i);
  assert.doesNotMatch(JSON.stringify(brand), /zvani[čc]n\w* (distributer|zastupnik)|ovla[šs][ćc]en|ekskluzivn|authori[sz]ed|official/i);
  // Programi brenda pokrivaju programe svih njegovih proizvoda.
  const programs = new Set(data.getPublicProgramGroupsForBrand("rupes").flatMap((group) => group.internalProgramSlugs));
  for (const product of thirdPartyProducts) assert.ok(programs.has(product.programSlug), `${product.slug}: program ${product.programSlug}`);
});

test("šifra proizvođača je potvrđena RUPES oznaka modela; Carsystem broj artikla ostaje ključ i red tabele", () => {
  for (const product of thirdPartyProducts) {
    const entry = dataset.products.find((candidate) => candidate.slug === product.slug);
    assert.equal(product.sku, entry.leadArticleNumber, `${product.slug}: interni ključ se ne menja`);
    assert.doesNotMatch(product.manufacturerCode ?? "", /^\d{3}\.\d{3}$/, `${product.slug}: Carsystem broj nije šifra proizvođača`);
    assert.equal(product.manufacturerCode ?? null, entry.manufacturer.modelCode);
    assert.equal(product.publicCode ?? null, entry.manufacturer.modelCode);
    assert.deepEqual(articleIdsOf(product, manufacturerBySlug).sort(), entry.variants.map((variant) => variant.articleNumber).sort(), `${product.slug}: brojevi artikala`);
  }
  const byslug = (slug) => runtime.products.find((product) => product.slug === slug);
  assert.equal(byslug("carsystem-rupes-angle-polishing-machine-lh76p").publicCode, "LH76P");
  // Više modela u jednoj kartici, ili šifra koju Carsystem ne navodi → kartica nema šifru proizvođača.
  assert.equal(byslug("carsystem-rupes-skorpio-e-rx").manufacturerCode, null);
  assert.equal(byslug("carsystem-rupes-polish-pad").manufacturerCode, null);
  assert.equal(byslug("carsystem-rupes-carrier").manufacturerCode, null);
});

test("nijedna oznaka modela nije izmišljena: svaka doslovno stoji u zvaničnom Carsystem nazivu ili specifikaciji", () => {
  for (const [slug, entry] of Object.entries(maker.products)) {
    const official = source.products.find((product) => product.sourceKey === dataset.products.find((candidate) => candidate.slug === slug).sourceKey);
    for (const [articleNumber, model] of Object.entries(entry.articles)) {
      const article = official.articles.find((candidate) => candidate.articleNumber === articleNumber);
      assert.ok(article, `${slug}: ${articleNumber} nije u izvoru`);
      assert.ok(codeKey(`${official.officialName} ${article.specification ?? ""}`).includes(codeKey(model.modelCode)), `${slug}: ${model.modelCode}`);
      assert.ok(maker.evidenceLevels[model.evidence], `${slug}: nivo dokaza ${model.evidence}`);
    }
    if (entry.cardModelCode) assert.equal(Object.values(entry.articles).find((model) => model.modelCode === entry.cardModelCode)?.evidence, "OFFICIAL_CONFIRMED", slug);
  }
});

test("tri proizvoda sa slabijim dokazom nose svoj status i kupac ga vidi", () => {
  const status = (slug) => dataset.products.find((entry) => entry.slug === slug).manufacturer.manufacturerStatus;
  assert.equal(status("carsystem-rupes-polishing-machine-lhr75e"), "DISCONTINUED_BY_RUPES_BUT_CARSYSTEM_LISTED");
  assert.equal(status("carsystem-rupes-47-105-replacement-carbon-brush"), "CARSYSTEM_LISTED_RUPES_IDENTITY_OFFICIAL_PAGE_UNCONFIRMED");
  assert.equal(status("carsystem-rupes-cleaning-and-maintenance-oil"), "CARSYSTEM_LISTED_RUPES_IDENTITY_OFFICIAL_PAGE_UNCONFIRMED");
  const notCurrent = dataset.products.filter((entry) => entry.manufacturer && entry.manufacturer.manufacturerStatus !== "CURRENT_ON_OFFICIAL_SITE");
  assert.equal(notCurrent.length, 3);
  for (const entry of notCurrent) {
    const facts = runtime.products.find((product) => product.slug === entry.slug).detail.technicalFacts.content;
    assert.ok(facts.some((fact) => fact.label === "Status kod proizvođača" && fact.detail), `${entry.slug}: status nije prikazan`);
  }
  // Aktuelan proizvod ne dobija red o statusu.
  const current = runtime.products.find((product) => product.slug === "carsystem-rupes-polishing-machine-lh19e");
  assert.ok(!current.detail.technicalFacts.content.some((fact) => fact.label === "Status kod proizvođača"));
});

test("pretraga: brend, oznake modela (i osnovni model), Carsystem brojevi artikala i porodice", () => {
  const terms = (slug) => new Set(runtime.products.find((product) => product.slug === slug).searchTerms.map(codeKey));
  for (const [slug, expected] of Object.entries({
    "carsystem-rupes-skorpio-e-rx": ["RUPES", "RX253A", "RX253", "RX256A", "157.326", "157.328", "Skorpio"],
    "carsystem-rupes-ibrid-nano": ["HR81M", "HR81ML", "9.DA40S", "iBrid", "157.318"],
    "carsystem-rupes-vacuum-cleaner-s145": ["S145EPM", "S145PL", "157.472"],
    "carsystem-rupes-back-pad": ["981.500", "981.600", "158.291"],
    "carsystem-rupes-polishing-machine-lh19e": ["LH19E", "BigFoot", "157.322"],
  })) for (const term of expected) assert.ok(terms(slug).has(codeKey(term)), `${slug}: ${term}`);
  // Carsystem-ov sopstveni proizvod ne dobija ovaj sloj.
  const ownSample = own.find((product) => registry.products[product.slug]);
  assert.equal(ownSample.brandSlug, "carsystem");
});

test("slike su postojeći Carsystem packshotovi sa oznakom RUPES_IMAGE_RIGHTS_REVIEW; ništa sa rupes.com", () => {
  const published = readJson(path.join(REPO_ROOT, "data/carsystem-sync/published-images.generated.json")).images;
  for (const product of thirdPartyProducts) {
    const entry = dataset.products.find((candidate) => candidate.slug === product.slug);
    assert.equal(entry.manufacturer.imageRights, "RUPES_IMAGE_RIGHTS_REVIEW");
    for (const image of [product.productImage, ...product.galleryImages]) {
      assert.match(image.src, /^\/products\/carsystem\/catalog\//, product.slug);
      assert.match(published[image.src].sourceUrl, /^https:\/\/www\.carsystem\.org\//, image.src);
    }
  }
  assert.doesNotMatch(JSON.stringify(dataset.products.map((entry) => [entry.image, entry.gallery])), /rupes\.com/);
  assert.equal(maker.logo.status, "NO_APPROVED_ASSET");
});
