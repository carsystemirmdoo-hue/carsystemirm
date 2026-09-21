/**
 * SATA sync — testovi modela, opsega i zaštitnih pravila.
 *
 * Rade nad COMMITOVANIM fajlovima (bez mreže): sirovi izvor, zaključan opseg i generisani dataset.
 */

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { readJson } from "../carsystem-sync/lib/http.mjs";
import { classifyStandalone } from "./lib/classify.mjs";
import { loadCatalogRuntime } from "../lib/catalog-runtime.mjs";
import { PATHS, REPO_ROOT, SCOPE_NAME } from "./lib/config.mjs";
import { scanForMonetaryData } from "./lib/price-gate.mjs";
import { parseConfigurator } from "./lib/configurator.mjs";
import { europeVariants, partitionStandalone, PHASE_2_BUCKETS, splitFamilies } from "./lib/scope.mjs";
import { createTranslator } from "./lib/terms.mjs";

const source = readJson(PATHS.source);
const dataset = readJson(PATHS.siteDataset);
const lock = readJson(PATHS.scopeLock);
const plan = readJson(PATHS.plan);
const taxonomy = JSON.parse(readFileSync(PATHS.taxonomy, "utf8"));
const terms = JSON.parse(readFileSync(PATHS.localizationTerms, "utf8"));
const entries = [...dataset.products, ...Object.values(dataset.enrichments)];
const { inScope, outOfScope } = splitFamilies(source, taxonomy);
const standalone = partitionStandalone(source, inScope);

test("opseg je „SATA EMEA REFINISH FAMILY SCOPE”: 66 porodica i 655 brojeva artikala, ne ceo katalog", () => {
  assert.equal(dataset.meta.scope, SCOPE_NAME);
  assert.match(dataset.meta.scopeNote, /Nije ceo SATA katalog/);
  assert.equal(inScope.length, 66);
  assert.equal(inScope.flatMap(europeVariants).length, 655);
  assert.equal(entries.length, 66);
  assert.equal(entries.reduce((sum, entry) => sum + entry.variants.length, 0), 655);
  assert.equal(dataset.products.length, 65);
  assert.deepEqual(Object.keys(dataset.enrichments), ["satajet-x-5500"]);
});

test("podela 1215 samostalnih artikala je međusobno isključiva i jednaka ODOBRENIM brojevima", () => {
  // Brojevi su odobreni 2026-09-20. Promena bez promene izvora je greška u pravilima, ne novi opseg.
  assert.deepEqual(standalone.partition, {
    SPARE_PART: 872,
    ACCESSORY_TIED_TO_APPROVED_FAMILY: 84,
    CONSUMABLE_TIED_TO_APPROVED_FAMILY: 5,
    INDUSTRIAL_ROBOTIC_LAB: 83,
    MERCHANDISING: 7,
    REGION_ONLY: 14,
    DUPLICATE_ALIAS: 0,
    UNIDENTIFIED_NO_OFFICIAL_NAME: 1,
    STANDALONE_CUSTOMER_FACING_PHASE_2: 149,
  });
  assert.equal(Object.values(standalone.partition).reduce((sum, count) => sum + count, 0), 1215);
  assert.equal(new Set(standalone.rows.map((row) => row.articleNumber)).size, 1215);
  assert.deepEqual(lock.scope.standalonePartition, standalone.partition);
  assert.equal(lock.scope.families, 66);
  assert.equal(lock.scope.articleNumbers, 655);
});

test("izmereni opseg je jednak zaključanom — svaki drift obara plan", () => {
  assert.deepEqual(plan.summary.scope, lock.scope);
  assert.equal(plan.meta.sourceFingerprint, lock.sourceFingerprint);
  assert.ok(Object.values(plan.summary.planErrors).every((list) => list.length === 0));
});

test("faza 2 je AKTUELNA i van opsega — nikad discontinued, missing ili historical", () => {
  const phase2 = standalone.rows.filter((row) => PHASE_2_BUCKETS.has(row.bucket));
  assert.equal(phase2.length, 149 + 84);
  for (const row of phase2) assert.equal(row.status, "CURRENT_OUT_OF_SCOPE_PHASE_2");
  for (const row of standalone.rows) assert.doesNotMatch(row.status, /DISCONTINUED|MISSING|HISTORICAL/i);
  const runtimeNumbers = new Set(entries.flatMap((entry) => entry.variants.map((variant) => variant.articleNumber)));
  for (const row of standalone.rows) assert.ok(!runtimeNumbers.has(row.articleNumber), `samostalan artikal ${row.articleNumber} je ušao u fazu 1`);
});

test("samostalna zaštitna odeća nema zvaničnu porodicu i ostaje u fazi 2 (ne izmišlja se porodica)", () => {
  const suits = standalone.rows.filter((row) => /^SATA suit (space|grey)/i.test(row.name ?? ""));
  assert.equal(suits.length, 5);
  for (const suit of suits) assert.equal(suit.bucket, "STANDALONE_CUSTOMER_FACING_PHASE_2");
  assert.ok(!entries.some((entry) => /suit space/i.test(entry.officialName)));
});

test("aktuelne porodice van opsega ostaju evidentirane (industrijski program, reklamni artikli, mlaznice)", () => {
  assert.equal(outOfScope.length, 31);
  const roles = outOfScope.reduce((acc, family) => ({ ...acc, [family.scope]: (acc[family.scope] ?? 0) + 1 }), {});
  assert.deepEqual(roles, { COMPLETE_DEVICE_INDUSTRIAL: 12, SPARE_PART: 2, MERCHANDISE: 17 });
});

test("svaki broj artikla je zvaničan član SVOJE porodice; nijedan nije dupliran ni izmišljen", () => {
  const official = new Map(inScope.map((family) => [family.id, new Set(europeVariants(family).map((variant) => variant.articleNumber))]));
  const seen = new Set();
  for (const entry of entries) for (const variant of entry.variants) {
    assert.ok(official.get(entry.familyId)?.has(variant.articleNumber), `${variant.articleNumber} nije zvaničan član ${entry.familyId}`);
    assert.ok(!seen.has(variant.articleNumber), `dupliran broj ${variant.articleNumber}`);
    seen.add(variant.articleNumber);
    assert.match(variant.articleNumber, /^\d{2,8}$/);
  }
});

test("oznaka konfiguracije je jedinstvena u porodici (birač mora da razlikuje redove)", () => {
  for (const entry of entries) assert.equal(new Set(entry.variants.map((variant) => variant.config)).size, entry.variants.length, entry.slug);
});

test("rights gate: dataset nema nijednu SATA sliku ni cenu; odobrenih runtime slika je 0", () => {
  const serialized = JSON.stringify(dataset);
  assert.doesNotMatch(serialized, /\.(webp|png|jpe?g)\b/i);
  assert.doesNotMatch(serialized, /"(price|cena|realPrice)"/i);
  assert.equal(dataset.meta.images.APPROVED_RUNTIME_IMAGES, 0);
  assert.equal(dataset.meta.images.OFFICIAL_IMAGE_AVAILABLE_NOT_APPROVED_FOR_RUNTIME, 61);
  assert.equal(dataset.meta.images.OFFICIAL_IMAGE_NOT_PUBLISHED, 5);
  assert.doesNotMatch(readFileSync(PATHS.rawArticles, "utf8"), /"(price|realPrice|item_startPrice)"/);
});

test("dokumenti: zvanična adresa doslovno (sa ?ts=), brošura samo na prihvatljivom jeziku, bez TDS/SDS", () => {
  const documents = entries.flatMap((entry) => entry.documents);
  assert.ok(documents.length > 0);
  for (const document of documents) {
    assert.match(document.href, /^https:\/\/www\.sata\.com\/media\/.+\?ts=\d+$/);
    assert.ok(["manual", "declaration", "brochure"].includes(document.kind));
    if (document.kind === "brochure") assert.ok(["en", "multilingual"].includes(document.language));
  }
  const mismatches = plan.items.flatMap((item) => item.documentMismatches).filter((entry) => entry.reason === "SOURCE_DOCUMENT_LANGUAGE_MISMATCH");
  assert.equal(mismatches.length, 7);
  for (const mismatch of mismatches) assert.ok(!documents.some((document) => document.href.includes(encodeURIComponent(mismatch.file))));
});

test("postojeći satajet-x-5500 se dopunjuje: slug ostaje, interna oznaka nije broj artikla", () => {
  const entry = dataset.enrichments["satajet-x-5500"];
  assert.equal(entry.familyId, "CF1931072");
  assert.equal(entry.variants.length, 44);
  assert.ok(!JSON.stringify(dataset).includes("SATA-X5500"));
  assert.ok(!dataset.products.some((product) => product.familyId === "CF1931072"), "porodica ne sme biti i uvezena i dopunjena");
});

test("tri CF aliasa su JEDNA porodica, ne tri kartice", () => {
  assert.equal(source.familyAliases.length, 3);
  const ids = new Set(entries.map((entry) => entry.familyId));
  for (const alias of source.familyAliases) {
    assert.ok(!ids.has(alias.id), `${alias.id} je alias i ne sme biti kartica`);
    if (ids.has(alias.aliasOf)) assert.ok(entries.find((entry) => entry.familyId === alias.aliasOf).sourceAliases.includes(alias.id));
  }
});

test("nemački zvanični nazivi: prikaz je funkcionalni prevod, zvanični naziv ostaje u identitetu", () => {
  const expected = { CF1931351: ["Luftmikrometer", "SATA Mikrometar vazduha"], CF1931352: ["Manometer", "SATA Manometar"], CF1931357: ["Lackierpistolenkoffer", "SATA Kofer za pištolj za lakiranje"] };
  for (const [id, [official, display]] of Object.entries(expected)) {
    const entry = entries.find((candidate) => candidate.familyId === id);
    assert.equal(entry.officialName, official);
    assert.equal(entry.name, display);
  }
});

test("taksonomija je odobrena raspodela; jet X edicije su oprema", () => {
  const byCategory = entries.reduce((acc, entry) => ({ ...acc, [entry.taxonomy.category]: (acc[entry.taxonomy.category] ?? 0) + 1 }), {});
  assert.deepEqual(byCategory, { oprema: 42, pribor: 13, zastita: 9, radionica: 2 });
  for (const id of ["CF1931392", "CF1931393", "CF1931394"]) assert.equal(entries.find((entry) => entry.familyId === id).taxonomy.category, "oprema");
});

test("konfigurator: parentId i izabrane vrednosti se čitaju iz markupa, ne iz redosleda u naslovu", () => {
  const html = `<div data-variant-switch-options='{"url":"https:\\/\\/www.sata.com\\/en\\/detail\\/0123456789abcdef0123456789abcdef\\/switch"}'>
    <div class="product-detail-configurator-group-wrapper x"><h4> Nozzle Technology </h4>
      <div class="product-detail-configurator-option"><input type="radio" class="is-combinable" checked><label title="RP"></label></div>
      <div class="product-detail-configurator-option"><input type="radio" class=""><label title="HVLP"></label></div></div></div>`;
  const parsed = parseConfigurator(html);
  assert.equal(parsed.parentId, "0123456789abcdef0123456789abcdef");
  assert.deepEqual(parsed.selection, { "Nozzle Technology": "RP" });
  assert.deepEqual(parsed.axes[0].options.map((option) => [option.value, option.combinable]), [["RP", true], ["HVLP", false]]);
});

test("rečnik: brojevi i oznake prolaze doslovno, nepoznata reč se ne pogađa", () => {
  const translate = createTranslator(terms);
  assert.deepEqual(translate.value("290 l/min"), { text: "290 l/min", translated: true });
  assert.equal(translate.value("DIGITAL pro").text, "DIGITAL pro");
  assert.equal(translate.value('1/4" (male thread)').text, '1/4" (spoljni navoj)');
  assert.equal(translate.value("RPS Becher Set (0,6 l / 0,9 l)").text, "RPS set čaša (0,6 l / 0,9 l)");
  assert.equal(translate.value("k.A. °C").omitted, true);
  assert.equal(translate.value("Some unknown English phrase").translated, false);
});

test("„Air cap” je deo pištolja, ne reklamni artikal", () => {
  assert.equal(classifyStandalone("Air cap jet K RP 1.1"), "SPARE_PART");
  assert.notEqual(classifyStandalone("Test air cap for SATAjet X 5500"), "MERCHANDISE");
});

test("satajet-x-5500: isti slug i interni ključ, javno zvanični CF1931072, stara oznaka ostaje pretraživa, bez duplikata", () => {
  const runtime = loadCatalogRuntime();
  const sata = runtime.products.filter((product) => product.brandSlug === "sata");
  const record = sata.find((product) => product.slug === "satajet-x-5500");
  assert.ok(record, "slug satajet-x-5500 mora ostati");
  // `sku` je interni ključ (`canonicalVariantKey` → `?varijanta=`) i NE menja se.
  assert.equal(record.sku, "SATA-X5500");
  assert.equal(runtime.productVariantKey(record), "SATA-X5500");
  assert.equal(record.publicCode, "CF1931072");
  assert.equal(record.manufacturerCode, "CF1931072");
  assert.ok(record.searchTerms.includes("SATA-X5500"), "stara lokalna oznaka mora ostati pojam pretrage");
  assert.ok(record.searchTerms.includes("CF1931072"));

  // Kartica prikazuje zvanični identifikator porodice, kao i ostalih 65 SATA kartica.
  // Faza 1: kartice faze 2 (pribor, zaseban ključ dataseta) imaju sopstvene testove u `sata-phase2.test.mjs`.
  const phase2Slugs = new Set(JSON.parse(readFileSync(PATHS.siteDataset, "utf8")).phase2.products.map((entry) => entry.slug));
  const cards = runtime.listing.canonical.filter((card) => card.brandSlug === "sata" && !phase2Slugs.has(card.id));
  assert.equal(cards.length, 66);
  assert.equal(cards.find((card) => card.id === "satajet-x-5500").productCode, "CF1931072");
  for (const card of cards) assert.match(card.productCode, /^CF\d+$/, card.id);
  assert.ok(!cards.some((card) => /SATA-X5500/.test(JSON.stringify([card.productCode, card.shortCode]))));

  // Jedna porodica = jedan zapis: CF1931072 ne sme postojati i kao uvezen zapis.
  assert.equal(sata.filter((product) => [product.sku, product.publicCode, product.manufacturerCode].includes("CF1931072")).length, 1);
  assert.equal(sata.filter((product) => !phase2Slugs.has(product.slug)).length, 66);
  // Zvanični brojevi artikala su u redovima; interna oznaka nije među njima.
  const rows = record.detail.variants.content.rows;
  assert.equal(rows.length, 44);
  assert.ok(rows.every((row) => /^\d+$/.test(row.values.article)));
});

test("vrednosti osa: kod konfiguracije i nejasan termin ostaju zvanični (SOURCE_TERM_UNTRANSLATED), dokaziv se prevodi", () => {
  const untranslated = plan.summary.SOURCE_TERM_UNTRANSLATED;
  assert.deepEqual(untranslated.map((entry) => entry.term).sort(), ["Nozzle type = - 55 SK", "Nozzle type = - 79 SK", "Nozzle type = DA Druck"]);
  for (const entry of untranslated) {
    assert.equal(entry.status, "SOURCE_TERM_UNTRANSLATED");
    assert.match(entry.reason, /^(CONFIGURATION_CODE|SEMANTICALLY_AMBIGUOUS)/);
  }
  // Nijedna neprevedena vrednost ne sme proći bez odluke.
  assert.equal(plan.summary.untranslatedAxisValues, 0);

  const family = entries.find((entry) => entry.familyId === "CF1931080");
  const glueGun = family.variants.find((variant) => variant.articleNumber === "214320");
  assert.equal(glueGun.values["axis-nozzle-type"], "DA Druck");
  // „Druckbecher” = čaša pod pritiskom: zvanični EN naziv ISTOG artikla kaže „pressurised cup”.
  assert.match(glueGun.officialName, /pressurised cup/);
  assert.equal(glueGun.values["axis-spraygun-cup-system"], "čaša pod pritiskom BVD 0,7 l");
  assert.ok(family.sourceAxisTerms.includes("Druckbecher BVD 0,7 l"), "zvanična vrednost mora ostati pretraživa");

  const pressureGun = entries.find((entry) => entry.familyId === "CF1931098");
  const codes = pressureGun.variants.map((variant) => variant.values["axis-nozzle-type"]);
  assert.ok(codes.includes("- 55 SK") && codes.includes("- 79 SK"), "kod konfiguracije se prikazuje doslovno");
  // Sirova vrednost ostaje i u izvornom modelu.
  const sourceFamily = source.families.find((candidate) => candidate.id === "CF1931098");
  assert.ok(sourceFamily.variants.some((variant) => variant.selection["Nozzle type"] === "- 55 SK"));
});

test("price gate: u celom SATA opsegu nema nijednog novčanog polja ni iznosa", () => {
  const result = scanForMonetaryData(
    [path.join(REPO_ROOT, "data", "sata-sync"), PATHS.siteDataset, path.join(REPO_ROOT, "docs", "SATA_CATALOG_SYNC.md"), path.join(REPO_ROOT, "scripts", "sata-sync"), path.join(REPO_ROOT, "lib", "sata-catalog-products.ts")],
    { root: REPO_ROOT, exclude: [path.join(REPO_ROOT, "data", "sata-sync", "reports", "price-gate.generated.json")] },
  );
  assert.deepEqual(result.findings, []);
  assert.ok(result.files > 30);
  // Crawler čuva samo imenovana polja — nijedno od njih nije novčano.
  const keys = new Set(readJson(PATHS.rawArticles).articles.flatMap((article) => Object.keys(article)));
  assert.deepEqual([...keys].sort(), ["articleNumber", "descriptionLength", "downloads", "firstImage", "galleryImages", "name", "numberOnPage", "offered", "officialCategory", "ogImage", "options", "parentId", "parentSkus", "path", "selection", "technicalData", "unavailableNote"]);
});

test("price gate zaista hvata novčane podatke (kontrolisani fixture)", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "sata-price-gate-"));
  try {
    const euro = String.fromCharCode(0x20ac);
    writeFileSync(path.join(dir, "leak.json"), JSON.stringify({ articleNumber: "1", realPrice: 0, currency: "X", taxRate: 19, note: `19,90 ${euro}` }));
    const kinds = scanForMonetaryData([dir], { root: dir }).findings.map((finding) => `${finding.kind}:${finding.match.replace(/[\s":]/g, "")}`).sort();
    assert.deepEqual(kinds, ["MONETARY_KEY:currency", "MONETARY_KEY:realPrice", "MONETARY_KEY:taxRate", `MONETARY_VALUE:19,90${euro}`]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
