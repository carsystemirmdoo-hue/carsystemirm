/**
 * Cosmos Lac sync — testovi modela, opsega i zaštitnih pravila (bez mreže; nad commitovanim fajlovima).
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { readJson } from "../carsystem-sync/lib/http.mjs";
import { loadCatalogRuntime } from "../lib/catalog-runtime.mjs";
import { PATHS, PLACEHOLDER_IMAGE, REPO_ROOT } from "./lib/config.mjs";
import { assetKeyOf, createMatcher } from "./lib/match.mjs";

const source = readJson(PATHS.source);
const sitemap = readJson(PATHS.rawSitemap);
const dataset = readJson(PATHS.siteDataset);
const plan = readJson(PATHS.plan);
const lock = readJson(PATHS.scopeLock);
const local = readJson(PATHS.localDataset);
const scope = JSON.parse(readFileSync(PATHS.scope, "utf8"));
const baseline = JSON.parse(readFileSync(PATHS.baselineUrls, "utf8"));
const runtime = loadCatalogRuntime();
const records = runtime.products.filter((product) => product.brandSlug === "cosmos-lac");
const cards = runtime.listing.canonical.filter((card) => card.brandSlug === "cosmos-lac");
const families = runtime.families.filter((family) => family.brandSlug === "cosmos-lac");
/** Zapisi koji su i dalje u katalogu za kupce; uklonjena serija ostaje samo u datasetu. */
const inCatalog = (record) => dataset.enrichments[record.slug]?.status !== "REMOVED_FROM_CUSTOMER_CATALOG";
/** Isto čitanje izvora kao u Next.js-u: doslovna putanja ili parametar sa regularnim izrazom. */
const redirectCovers = (pathname) => dataset.redirects.filter((rule) => !rule.has).some((rule) => new RegExp(`^${rule.source.replace(/:[a-z]+\(([^)]*)\)/gi, "($1)")}$`).test(pathname));
const syncOf = (slug) => dataset.enrichments[slug] ?? dataset.products.find((product) => product.slug === slug)?.sync;

test("A i C se RAČUNAJU iz izvornog modela i jednaki su zaključanom, odobrenom merenju", () => {
  const outOfScope = new Set(Object.keys(scope.outOfScopeProducts));
  const keys = new Set(source.products.map((page) => page.productKey));
  const A = [...keys].filter((key) => !outOfScope.has(key)).length;
  const pages = source.products.filter((page) => !outOfScope.has(page.productKey)).length;
  const region = Object.values(dataset.enrichments).filter((entry) => entry.status === "CURRENT_REGION_SPECIFIC").length;
  assert.equal(A, lock.measured.A_APPROVED_CURRENT_OFFICIAL_PRODUCTS);
  assert.equal(pages + region, lock.measured.C_APPROVED_CURRENT_OFFICIAL_SHADE_VARIANT_IDENTITIES);
  assert.deepEqual(plan.summary.measured, lock.measured);
  assert.equal(plan.meta.sourceFingerprint, lock.sourceFingerprint);
  assert.ok(Object.values(plan.summary.planErrors).every((list) => list.length === 0));
});

test("B = A i D = C u stvarnom runtime-u; aktuelno van opsega nije uvezeno", () => {
  const outOfScope = new Set(Object.keys(scope.outOfScopeProducts));
  const representedProducts = new Set();
  const representedPages = new Set();
  for (const product of records) {
    const sync = syncOf(product.slug);
    assert.ok(sync, `zapis bez sync identiteta: ${product.slug}`);
    if (sync.officialUrl) { representedPages.add(sync.officialUrl); representedProducts.add(sync.officialProduct); }
  }
  const pages = source.products.filter((page) => !outOfScope.has(page.productKey));
  assert.deepEqual(pages.filter((page) => !representedPages.has(page.url)).map((page) => page.url), []);
  assert.equal(representedProducts.size, lock.measured.A_APPROVED_CURRENT_OFFICIAL_PRODUCTS);
  for (const key of outOfScope) assert.ok(!representedProducts.has(key), `${key} je CURRENT_OUT_OF_SCOPE i ne sme biti uvezen`);
  assert.equal(plan.currentOutOfScope.length, 5);
  for (const entry of plan.currentOutOfScope) assert.equal(entry.status, "CURRENT_OUT_OF_SCOPE");
});

test("kartice: svaka podeljena kartica daje tačan broj naslednika (+14); uklonjena serija ne daje nijednu", () => {
  assert.equal(cards.filter((card) => /molotow/.test(card.id)).length, 0);
  assert.equal(cards.length - baseline.cards, 14 + 4 - 2, "neto: +14 od podele, +4 nova zvanična proizvoda, −2 kartice uklonjene serije");
  const expected = { "cosmos-lac-lubricants-oil": 6, "cosmos-lac-lubricants-grease": 4, "cosmos-lac-putties-filler": 3, "cosmos-lac-varnishes-varnish": 2, "cosmos-lac-w-wood-care-varnish": 2, "cosmos-lac-wheel-rim-wheel-rim": 2, "cosmos-lac-zinc-zinc": 2 };
  let gain = 0;
  for (const [base, count] of Object.entries(expected)) {
    const members = local.filter((record) => record.baseProductSlug === base).map((record) => runtime.products.find((product) => product.slug === record.slug));
    const successorCards = new Set(members.map((product) => { const family = runtime.getFamilyForProduct(product); return family ? `family:${family.slug}` : product.slug; }));
    assert.equal(successorCards.size, count, base);
    for (const id of successorCards) assert.ok(cards.some((card) => card.id === id), `${id} nije vidljiva kartica`);
    gain += count - 1;
  }
  assert.equal(gain, 14);
});

test("nijedna kartica van linija boja ne meša različite zvanične proizvode", () => {
  const COLOUR_LINES = new Set(["chalk-effect", "easy-max", "fast-acrylic", "flame", "flame-blue", "flame-orange", "ral", "spray-bike"]);
  const pageByUrl = new Map(source.products.map((page) => [page.url, page]));
  for (const family of families) {
    const pages = family.variants.map((variant) => pageByUrl.get(syncOf(variant.slug)?.officialUrl)).filter(Boolean);
    if (pages.some((page) => COLOUR_LINES.has(page.family))) continue;
    assert.ok(new Set(pages.map((page) => page.productKey)).size <= 1, `${family.slug} meša proizvode`);
  }
});

test("četiri nova zvanična proizvoda su kartice; nove nijanse ulaze u karticu svog proizvoda", () => {
  assert.deepEqual([...dataset.meta.newOfficialProducts].sort(), ["acrylic-varnish", "effect-container", "high-heat-container", "name:chrome-effect"]);
  const cardIds = new Set(cards.map((card) => card.id));
  for (const id of ["family:cosmos-lac-acrylic-varnish", "family:cosmos-lac-high-heat-container", "cosmos-lac-chrome-effect-450-container", "cosmos-lac-gold-effect-451-container"]) assert.ok(cardIds.has(id), id);
  const familyOf = (slug) => runtime.getFamilyForProduct(runtime.products.find((product) => product.slug === slug))?.baseProductSlug;
  assert.equal(familyOf("cosmos-lac-easy-max-glitter-912-multi"), "cosmos-lac-easy-max-easy-max");
  assert.equal(familyOf("cosmos-lac-ral-9003-matt-signal-white"), "cosmos-lac-ral-ral");
  assert.equal(familyOf("cosmos-lac-flame-orange-fo-314-piglet-pink-dark"), "cosmos-lac-flame-orange-flame-orange");
});

test("0 polomljenih adresa: svaka adresa iz stanja pre synca postoji ili ima preusmerenje", () => {
  const liveFamilies = new Set(families.map((family) => family.slug));
  const redirected = new Set(baseline.familySlugs.filter((slug) => redirectCovers(`/proizvodi/grupa/${slug}`)));
  for (const slug of baseline.familySlugs) assert.ok(liveFamilies.has(slug) || redirected.has(slug), `porodična adresa bez odredišta: ${slug}`);
  const liveProducts = new Set(records.map((product) => product.slug));
  for (const slug of baseline.productSlugs) assert.ok(liveProducts.has(slug) || redirectCovers(`/proizvodi/${slug}`), `adresa proizvoda nestala: ${slug}`);
  // „Wheel Rim” je isti proizvod kao stara kartica, pa zadržava adresu bez preusmerenja.
  assert.ok(liveFamilies.has("cosmos-lac-wheel-rim"));
  assert.ok(!redirected.has("cosmos-lac-wheel-rim"));
  // Pravila iz dataseta su ona koja `next.config.ts` zaista učitava.
  assert.match(readFileSync(path.join(REPO_ROOT, "next.config.ts"), "utf8"), /\.\.\.\(cosmosLacSync\.redirects/);
  for (const rule of dataset.redirects.filter((entry) => entry.has)) assert.ok(liveProducts.has(rule.destination.replace("/proizvodi/", "")));
});

test("Molotow je REMOVED_FROM_CUSTOMER_CATALOG: 0 u runtime-u, zapisi sačuvani, adrese preusmerene, nije discontinued", () => {
  const removal = scope.removedFromCustomerCatalog;
  const removed = Object.entries(dataset.enrichments).filter(([, entry]) => entry.status === removal.status);
  assert.equal(removed.length, 73);
  assert.deepEqual([...new Set(removed.map(([slug]) => local.find((record) => record.slug === slug).line))].sort(), ["Molotow Burner", "Molotow Premium"]);
  // Istorijski podatak ostaje: zapis je i dalje u Brand Kit datasetu, izvorna klasifikacija se ne menja.
  for (const [, entry] of removed) { assert.equal(entry.classification, "LEGACY_LOCAL_ONLY"); assert.doesNotMatch(JSON.stringify(entry), /discontinued/i); }
  // Runtime: nijedan zapis, varijanta, kartica ni porodica.
  const removedSlugs = new Set(removed.map(([slug]) => slug));
  assert.equal(runtime.products.filter((product) => removedSlugs.has(product.slug) || /molotow/i.test(`${product.slug} ${product.name}`)).length, 0);
  assert.equal(runtime.families.filter((family) => /molotow/i.test(family.slug) || family.variants.some((variant) => removedSlugs.has(variant.slug))).length, 0);
  assert.equal(runtime.listing.canonical.filter((card) => /molotow/i.test(`${card.id} ${card.name ?? ""}`)).length, 0);
  // Stare adrese: pravilo po prefiksu pokriva svih 73 + 2, a ne zahvata nijednu živu adresu.
  const rules = dataset.redirects.filter((entry) => entry.destination === removal.redirectDestination);
  assert.equal(rules.length, 2);
  const patterns = rules.map((rule) => new RegExp(`^${rule.source.replace(/:[a-z]+\(([^)]*)\)/gi, "($1)")}$`));
  const covered = (pathname) => patterns.some((pattern) => pattern.test(pathname));
  for (const slug of removedSlugs) assert.ok(covered(`/proizvodi/${slug}`), slug);
  for (const slug of baseline.familySlugs.filter((candidate) => /molotow/.test(candidate))) assert.ok(covered(`/proizvodi/grupa/${slug}`), slug);
  for (const product of runtime.products) assert.ok(!covered(`/proizvodi/${product.slug}`), product.slug);
  for (const family of runtime.families) assert.ok(!covered(`/proizvodi/grupa/${family.slug}`), family.slug);
  assert.ok(runtime.requireModule("lib/carsystem-data.ts").brands.some((brand) => brand.routes.landing === removal.redirectDestination), "cilj preusmerenja je živa stranica brenda");
});

test("šest zapisa bez zvanične stranice ostaje netaknuto LEGACY_LOCAL_ONLY", () => {
  const legacy = Object.entries(dataset.enrichments).filter(([, entry]) => entry.status === "LEGACY_LOCAL_ONLY");
  assert.equal(legacy.length, 6);
  for (const [slug, entry] of legacy) {
    assert.equal(entry.officialUrl, null);
    assert.equal(entry.document, null);
    assert.equal(entry.baseProductSlug, undefined);
    const record = local.find((candidate) => candidate.slug === slug);
    const product = runtime.products.find((candidate) => candidate.slug === slug);
    assert.equal(product.catalogMetadata.baseProductSlug, record.baseProductSlug);
    assert.equal(product.productImage.src, record.image);
    assert.equal(product.name, record.displayNameSr);
  }
  const names = legacy.map(([slug]) => local.find((record) => record.slug === slug).officialName).sort();
  assert.deepEqual(names.map((name) => /(\d{3})/.exec(name)[1]).sort(), ["231", "334", "403", "574", "575", "712"]);
});

test("11 zapisa objavljenih samo na drugim jezicima su CURRENT i nose poreklo (jezik + zvanična adresa)", () => {
  const region = Object.entries(dataset.enrichments).filter(([, entry]) => entry.status === "CURRENT_REGION_SPECIFIC");
  assert.equal(region.length, 11);
  for (const [slug, entry] of region) {
    assert.ok(entry.sourceLocales.length >= 1, slug);
    for (const origin of entry.sourceLocales) {
      assert.match(origin.url, new RegExp(`^https://cosmoslac\\.com/${origin.locale}/products/`));
      assert.ok(sitemap.localePaths[origin.locale].includes(origin.url.replace(`https://cosmoslac.com/${origin.locale}/products/`, "")), `${origin.url} nije u zvaničnom sitemap-u`);
    }
  }
});

test("SOURCE_TITLE_INCONSISTENCY: adresa + šifra + Brand Kit imaju prednost nad pogrešnim naslovom stranice", () => {
  const match = createMatcher(source, sitemap);
  const ral9003 = local.find((record) => record.ralCode === "9003" && record.line === "RAL");
  assert.equal(assetKeyOf(ral9003), "ral-9003-signal-white");
  assert.equal(match(ral9003).official.slug, "ral-9003-signal-white");
  assert.equal(source.products.find((page) => page.slug === "ral-9003-signal-white").officialName, "Ral 9002 – Grey White", "izvor i dalje nosi pogrešan naslov");
  const entry = dataset.enrichments[ral9003.slug];
  assert.equal(entry.sourceTitleInconsistency.status, "SOURCE_TITLE_INCONSISTENCY");
  assert.equal(entry.officialName, "RAL 9003 – Signal White");
  assert.ok(!entry.officialCodes.includes("9002") && !entry.officialCodes.includes("RAL 9002"));
  const fast = Object.values(dataset.enrichments).find((candidate) => candidate.officialSlug === "fast-acrylic-ral-8017-chocolate-brown");
  assert.equal(fast.officialName, "Fast Acrylic RAL 8017 – Chocolate Brown");
  // Pogrešan naslov ne sme da napravi drugi identitet za RAL 9002 / 8011.
  assert.equal(Object.values(dataset.enrichments).filter((candidate) => candidate.officialSlug === "ral-9002-grey-white").length, 1);
});

test("pakovanje: kupac vidi zvanično kada ga izvor navodi, postojeće kada ga ne navodi, ništa kada ga nema", () => {
  const { getProductPackageLabel, getProductVariantSelector } = runtime.requireModule("lib/carsystem-data.ts");
  const productOf = (slug) => runtime.products.find((candidate) => candidate.slug === slug);
  const packRow = (product) => product.specifications.find((fact) => fact.label === "Pakovanje")?.value ?? null;

  // 1) zvanično = 400 ml, lokalno = „400 ml / 500 ml" (RAL 9003 sjaj)
  const ral = local.find((record) => record.ralCode === "9003" && record.line === "RAL");
  assert.equal(ral.volume, "400 ml / 500 ml");
  assert.deepEqual(dataset.enrichments[ral.slug].packaging, { status: "OFFICIAL_CURRENT", customerFacing: "400 ml", official: "400 ml", local: "400 ml / 500 ml", localDiverges: true });
  assert.equal(getProductPackageLabel(productOf(ral.slug)), "400 ml");
  assert.equal(packRow(productOf(ral.slug)), "400 ml");
  assert.deepEqual(productOf(ral.slug).packages.map((option) => option.label), ["400 ml"]);
  // `volume` ostaje podatak kataloga: razmera ambalaže, ose varijanti i pretraga se ne pomeraju.
  assert.equal(productOf(ral.slug).catalogMetadata.volume, "400 ml / 500 ml");

  // 2) zvanično = 500 ml, lokalno = 400 ml (Sealer 260) — i oznaka količine na ambalaži prati potvrđeno
  const sealer = local.find((record) => record.line === "Sealer" && record.cosmosCode === "260");
  assert.equal(sealer.volume, "400 ml");
  assert.equal(dataset.enrichments[sealer.slug].packaging.customerFacing, "500 ml");
  assert.equal(dataset.enrichments[sealer.slug].packaging.local, "400 ml");
  assert.equal(getProductPackageLabel(productOf(sealer.slug)), "500 ml");
  assert.deepEqual(productOf(sealer.slug).size, { volumeValue: 500, volumeUnit: "ml", volumeStatus: "verified" });

  // 3) SOURCE_UNSPECIFIED — ni izvor ni katalog: ništa se ne izmišlja
  const [unspecifiedSlug, unspecified] = Object.entries(dataset.enrichments).find(([, entry]) => entry.packaging.status === "SOURCE_UNSPECIFIED");
  assert.deepEqual(unspecified.packaging, { status: "SOURCE_UNSPECIFIED", customerFacing: null, official: null, local: null, localDiverges: false });
  assert.equal(packRow(productOf(unspecifiedSlug)), null);
  assert.equal(getProductPackageLabel(productOf(unspecifiedSlug)), "Na upit");

  // 4) LOCAL_EXISTING — izvor ćuti, katalog ima podatak: prikazuje se postojeći, neizmenjen
  for (const [slug, entry] of Object.entries(dataset.enrichments).filter(([, candidate]) => candidate.packaging.status === "LOCAL_EXISTING" && candidate.status !== "REMOVED_FROM_CUSTOMER_CATALOG")) {
    const record = local.find((candidate) => candidate.slug === slug);
    assert.equal(entry.packaging.customerFacing, record.volume);
    assert.equal(getProductPackageLabel(productOf(slug)), record.volume);
  }

  // 5) lokalni podatak se nikad ne briše, ni kada se razlikuje
  for (const [slug, entry] of Object.entries(dataset.enrichments)) assert.equal(entry.packaging.local ?? null, local.find((record) => record.slug === slug).volume ?? null, slug);

  // 6) varijante pakovanja jedne zvanične stranice prikazuju SVAKA svoje pakovanje
  const fiberglass = local.filter((record) => /Fiberglass Premium/.test(record.officialName));
  assert.deepEqual(fiberglass.map((record) => getProductPackageLabel(productOf(record.slug))).sort(), ["1 kg", "5 kg"]);

  // 7) birač varijanti: svaka nijansa nosi SVOJE pakovanje (Flame Orange ima nijanse sa više zvaničnih mera)
  const flame = local.find((record) => record.cosmosCode === "FO-901");
  const selector = getProductVariantSelector(productOf(flame.slug));
  const byId = new Map(selector.variants.map((variant) => [variant.sku, variant.package]));
  assert.equal(byId.get("FO-901"), "400 ml / 500 ml / 600 ml");
  assert.equal(byId.get("FO-100"), "400 ml");
});

test("tehnički podaci su po varijanti: red Pakovanje i šifra pripadaju izabranoj nijansi, ne predstavniku", () => {
  const family = families.find((candidate) => candidate.baseProductSlug === "cosmos-lac-ral-ral");
  const facts = (product) => Object.fromEntries(product.specifications.map((fact) => [fact.label, fact.value]));
  const matt = family.variants.find((variant) => variant.slug === "cosmos-lac-ral-9003-matt-signal-white");
  const representative = family.representative;
  assert.notEqual(matt.slug, representative.slug);
  assert.equal(facts(matt).Pakovanje, undefined, "RAL 9003 mat: zvanična stranica ne navodi pakovanje, pa reda nema");
  assert.equal(facts(matt).RAL, "RAL 9003");
  assert.notEqual(facts(matt).Nijansa, facts(representative).Nijansa);
});

test("dokumenti: isti zvanični dokument svim nijansama proizvoda; polomljen PDF se ne prikazuje; SDS se ne izmišlja", () => {
  const byProduct = new Map();
  for (const entry of [...Object.values(dataset.enrichments), ...dataset.products.map((product) => product.sync)]) {
    if (!entry.officialProduct || !entry.document) continue;
    byProduct.set(entry.officialProduct, new Set([...(byProduct.get(entry.officialProduct) ?? []), entry.document.href]));
    assert.doesNotMatch(entry.document.title, /SDS|MSDS|bezbednos/i);
    assert.match(entry.document.href, /^https:\/\/cosmoslac\.com\/pdfs\/products\/en\//);
  }
  for (const [key, hrefs] of byProduct) assert.equal(hrefs.size, 1, `${key} ima više od jednog dokumenta`);
  const broken = Object.entries(dataset.enrichments).filter(([, entry]) => entry.documentSourceBroken);
  assert.equal(broken.length, 1);
  assert.match(broken[0][1].documentSourceBroken, /Penetrating-Oil/);
  assert.equal(broken[0][1].document, null);
  const product = runtime.products.find((candidate) => candidate.slug === broken[0][0]);
  assert.ok(!product.documents.some((document) => /Penetrating-Oil/.test(document.href ?? "")));
});

test("slike: 742 Brand Kit fajla netaknuta (isti put, fajl postoji, SHA iz izvornog zapisa), novi zapisi na placeholderu", () => {
  for (const record of local.filter(inCatalog)) {
    const product = runtime.products.find((candidate) => candidate.slug === record.slug);
    assert.equal(product.productImage.src, record.image);
  }
  for (const record of local.filter((_, index) => index % 25 === 0)) {
    const file = path.join(REPO_ROOT, "public", record.image);
    assert.ok(existsSync(file), record.image);
    assert.equal(createHash("sha256").update(readFileSync(file)).digest("hex"), record.productionSha256, record.image);
  }
  assert.equal(dataset.products.length, 11);
  for (const product of dataset.products) assert.equal(product.image, PLACEHOLDER_IMAGE);
  assert.doesNotMatch(JSON.stringify(dataset), /cosmoslac\.com\/wp-content/);
  assert.equal(dataset.meta.images.importedImages, 0);
});

test("pretraga: zvanična šifra, zvanični naziv i zvanična adresa su pojmovi pretrage; lokalni naziv ostaje", () => {
  const product = runtime.products.find((candidate) => candidate.slug === "cosmos-lac-flame-orange-fo-314-piglet-pink-dark");
  assert.ok(product.searchTerms.includes("FO-314"));
  assert.ok(product.searchTerms.includes("flame-orange-fo-314-piglet-pink-dark"));
  const existing = runtime.products.find((candidate) => candidate.catalogMetadata?.ralCode === "9003" && candidate.catalogMetadata.line === "RAL" && candidate.catalogMetadata.finish === "sjaj");
  assert.ok(existing.searchTerms.includes("RAL 9003"));
  assert.equal(existing.name, local.find((record) => record.slug === existing.slug).displayNameSr);
});

test("`cosmos:validate` radi iz čistog checkout-a (bez Brand Kit-a); strogi režim bez njega pada", () => {
  const scripts = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")).scripts;
  // Jedna komanda proverava oba sloja: Brand Kit dataset i dopunu synca.
  assert.match(scripts["cosmos:validate"], /validate-cosmos-lac-catalog\.mjs && npm run cosmos-lac:sync:validate/);
  // Regeneracija iz Brand Kit-a ga po prirodi traži — zato strogi režim, i provera da sync ostaje čist.
  assert.match(scripts["cosmos:update"], /--require-source-assets && npm run cosmos-lac:sync:check/);

  const run = (args) => spawnSync(process.execPath, ["scripts/validate-cosmos-lac-catalog.mjs", ...args], { cwd: REPO_ROOT, encoding: "utf8", env: { ...process.env, COSMOS_BRAND_KIT_DIR: path.join(REPO_ROOT, ".cache", "nema-brand-kita") } });
  const relaxed = run([]);
  assert.equal(relaxed.status, 0, relaxed.stderr);
  assert.match(relaxed.stdout, /742 published variants/);
  assert.match(relaxed.stdout, /Brand Kit nije prisutan/);
  const strict = run(["--require-source-assets"]);
  assert.equal(strict.status, 1);
  assert.match(strict.stderr, /strogi režim/);
});
