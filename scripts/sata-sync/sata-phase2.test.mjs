/**
 * SATA faza 2 — samostalan i vezan pribor. Brojevi se MERE (plan, dataset, runtime) i porede sa zaključanim
 * opsegom; ništa nije upisano rukom u test osim odluka koje je korisnik izričito doneo (brojevi artikala).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { loadCatalogRuntime } from "../lib/catalog-runtime.mjs";
import { PATHS } from "./lib/config.mjs";
import { groupPhase2, parseOfficialName } from "./lib/phase2-grouping.mjs";
import { UNTRANSLATED_MARKERS, translateAttribute } from "./lib/phase2-terms.mjs";

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const plan = readJson(PATHS.phase2Plan);
const lock = readJson(PATHS.phase2Lock);
const scope = readJson(PATHS.phase2Scope);
const dataset = readJson(PATHS.siteDataset);
const registry = readJson(PATHS.identityRegistry);
const runtime = loadCatalogRuntime();
const sata = runtime.products.filter((product) => product.brandSlug === "sata");
const bySlug = new Map(sata.map((product) => [product.slug, product]));
const cardOf = (slug) => plan.cards.find((card) => card.slug === slug);
const cardOfArticle = (number) => plan.cards.find((card) => card.variants.some((row) => row.articleNumber === number));

test("svih 238 izvornih brojeva artikala je klasifikovano: VISIBLE ili INTENTIONALLY_EXCLUDED:<razlog>", () => {
  const entries = Object.entries(plan.articles);
  assert.equal(entries.length, lock.measured.sourceArticles);
  assert.equal(entries.length, 149 + 84 + 5, "zaključana particija faze 1: 149 + 84 + 5");
  for (const [number, entry] of entries) assert.match(entry.status, /^(VISIBLE|INTENTIONALLY_EXCLUDED:[A-Z_]+)$/, number);
  const visible = entries.filter(([, entry]) => entry.status === "VISIBLE");
  assert.equal(visible.length + lock.measured.excludedArticles, entries.length);
  assert.deepEqual(plan.summary.measured, lock.measured, "izmereno = zaključano");
  // Svaki vidljivi broj je tačno na jednoj kartici; nijedan isključeni nije u runtime-u.
  const owners = new Map();
  for (const product of sata) for (const id of (product.detail?.variants?.content.rows ?? []).map((row) => row.id).concat(product.detail?.variants ? [] : [product.manufacturerCode].filter(Boolean))) owners.set(id, [...(owners.get(id) ?? []), product.slug]);
  for (const [number, entry] of entries) {
    if (entry.status === "VISIBLE") assert.deepEqual(owners.get(number), [entry.card], number);
    else assert.equal(owners.has(number), false, `${number} je isključen, a u runtime-u je`);
  }
});

test("faza 1 je netaknuta: 66 porodica / 655 brojeva artikala, isti slugovi, bez sudara sa fazom 2", () => {
  const phase1 = [...dataset.products, ...Object.values(dataset.enrichments)];
  assert.equal(phase1.length, 66);
  const numbers = phase1.flatMap((entry) => entry.variants.map((row) => row.articleNumber));
  assert.equal(numbers.length, 655);
  const phase2Numbers = new Set(Object.keys(plan.articles));
  assert.equal(numbers.filter((number) => phase2Numbers.has(number)).length, 0);
  for (const slug of Object.keys(registry.phase2)) assert.ok(!registry.products[slug] && !registry.enriched?.[slug], slug);
  for (const entry of phase1) assert.ok(bySlug.has(entry.slug), entry.slug);
});

test("grupisanje je gramatičko: isti ostatak naziva, razlika samo u prepoznatim atributima ili u klauzuli „for …”", () => {
  for (const card of plan.cards.filter((entry) => entry.variants.length > 1)) {
    assert.equal(card.grouping, "LOCAL_CATALOG_GROUPING", card.slug);
    const stems = new Set(card.variants.map((row) => parseOfficialName(row.officialName).stem));
    assert.equal(stems.size, 1, `${card.slug}: različit ostatak naziva ${[...stems].join(" | ")}`);
    for (const row of card.variants) assert.ok(row.officialName, `${row.articleNumber}: zvanični naziv mora ostati sačuvan`);
  }
  // Dve višečlane grupe se nikad ne spajaju: nastavci za 1000 B i 1000 K su dve kartice.
  assert.notEqual(cardOfArticle("154211").slug, cardOfArticle("154435").slug);
  // Nema sličnosti naziva: „folding” i „magnetic” nisu isti proizvod bez dokumentovanog pravila.
  assert.notEqual(cardOfArticle("1110527").slug, cardOfArticle("1103522").slug);
  // Determinizam: isti ulaz, isti izlaz, bez obzira na redosled.
  const articles = Object.entries(plan.articles).map(([articleNumber, entry]) => ({ articleNumber, name: entry.officialName, tiedFamily: entry.tiedFamily }));
  const keyOf = (groups) => JSON.stringify(groups.map((group) => group.rows.map((row) => row.articleNumber)));
  assert.equal(keyOf(groupPhase2(articles)), keyOf(groupPhase2([...articles].reverse())));
});

test("lokalna grupa se nigde ne predstavlja kao zvanična SATA porodica", () => {
  for (const card of plan.cards.filter((entry) => entry.variants.length > 1)) {
    const product = bySlug.get(card.slug);
    assert.doesNotMatch(JSON.stringify([product.name, product.shortDescription, product.detail]), /zvani[čc]n\w* SATA porodic|official SATA famil/i, card.slug);
    assert.match(product.detail.variants.content.description, /grupisane u katalogu sajta/);
  }
  assert.match(dataset.phase2.meta.scopeNote, /NE zvanične SATA porodice/);
});

test("odobrene odluke: SATA air hose 11 redova, suit space S–XL + suit grey, 63974 zasebna kartica, SGE dve kartice", () => {
  const hose = cardOf("sata-air-hose");
  assert.equal(hose.variants.length, 11);
  assert.ok(hose.axes.length >= 3, "više osa ide kroz postojeću tabelu redova");
  assert.equal(new Set(bySlug.get("sata-air-hose").detail.variants.content.rows.map((row) => row.values.config)).size, 11, "oznake redova su jednoznačne");

  assert.deepEqual(cardOf("sata-suit-space").variants.map((row) => row.label), ["S (42/44)", "M (46/48)", "L (50/52)", "XL (54/56)"]);
  assert.equal(cardOf("sata-suit-grey").variants.length, 1);
  assert.equal(bySlug.get("sata-suit-space").taxonomyCategory, "zastita");

  const pump = cardOfArticle("63974");
  assert.equal(pump.variants.length, 1);
  assert.deepEqual(pump.relatedFamilies.map((family) => family.slug), ["sata-vario-top-spray"]);
  assert.ok(!dataset.products.find((entry) => entry.slug === "sata-vario-top-spray").variants.some((row) => row.articleNumber === "63974"), "nije 656. red faze 1");

  for (const number of ["27722", "27730"]) { const card = cardOfArticle(number); assert.equal(card.variants.length, 1); assert.match(bySlug.get(card.slug).name, /^SGE /, "SGE ostaje doslovan termin proizvođača"); }
});

test("isti zvanični naziv pod dva broja artikla: jedna kartica, oba broja kao redovi, sa oznakom porekla", () => {
  for (const pair of [["1083807", "1110527"]]) {
    const card = cardOfArticle(pair[0]);
    assert.deepEqual(card.variants.map((row) => row.articleNumber).sort(), [...pair].sort());
    assert.equal(card.duplicateOfficialNames, scope.duplicateOfficialNames.provenance);
    assert.deepEqual(bySlug.get(card.slug).detail.variants.content.rows.map((row) => row.id).sort(), [...pair].sort());
  }
});

test("scope gate ima prioritet: air warmer carbon (cilj van kataloga) nema karticu, a dokaz o dva broja pod istim nazivom ostaje", () => {
  const pair = ["214759", "1000132"];
  for (const number of pair) {
    const entry = plan.articles[number];
    assert.equal(entry.status, "INTENTIONALLY_EXCLUDED:ACCESSORY_FOR_PRODUCT_OUTSIDE_RUNTIME_CATALOGUE", number);
    assert.equal(entry.runtimeStatus, "CURRENT_OUTSIDE_APPROVED_RUNTIME_CONTEXT");
    assert.deepEqual(entry.sameOfficialNameAs, pair.filter((other) => other !== number));
    assert.equal(entry.provenance, scope.duplicateOfficialNames.provenance);
    assert.deepEqual(dataset.phase2.meta.excluded[number].sameOfficialNameAs, entry.sameOfficialNameAs, "dokaz ostaje i u datasetu");
    assert.equal(cardOfArticle(number), undefined, "nema kartice");
    assert.ok(!sata.some((product) => JSON.stringify([product.sku, product.manufacturerCode, product.searchTerms, product.detail?.variants]).includes(`"${number}"`)), `${number} nije u runtime-u ni u pretrazi`);
  }
  assert.ok(!Object.keys(registry.phase2).some((slug) => /air-warmer-carbon/.test(slug)), "slug nije kreiran");
  assert.ok(!sata.some((product) => /air warmer carbon/i.test(product.name)));
  assert.doesNotMatch(JSON.stringify(pair.map((number) => plan.articles[number])), /discontinued|historical/i);
});

test("isključenja: izložbeno postolje, LAB, parts kit i pribor za proizvode van runtime kataloga — bez kartice, zapis ostaje", () => {
  const excluded = Object.fromEntries(Object.entries(plan.articles).filter(([, entry]) => entry.status !== "VISIBLE").map(([number, entry]) => [number, entry.status.split(":")[1]]));
  assert.equal(excluded["1750"], "MERCHANDISING_DISPLAY");
  assert.equal(excluded["177238"], "LAB_OUT_OF_APPROVED_SCOPE");
  assert.equal(excluded["1183425"], "SPARE_PARTS_KIT_OUT_OF_APPROVED_SCOPE");
  const outside = Object.entries(plan.articles).filter(([, entry]) => entry.runtimeStatus === "CURRENT_OUTSIDE_APPROVED_RUNTIME_CONTEXT");
  assert.equal(outside.length, lock.measured.excludedByReason.ACCESSORY_FOR_PRODUCT_OUTSIDE_RUNTIME_CATALOGUE);
  for (const [number, entry] of outside) assert.ok(scope.outsideApprovedRuntimeContext.targets.some((target) => entry.officialName.toLowerCase().includes(`for ${target.toLowerCase()}`)), number);
  // Isključeni ostaju u datasetu kao aktuelni zapisi izvora; nisu discontinued.
  assert.deepEqual(Object.keys(dataset.phase2.meta.excluded).sort(), Object.keys(excluded).sort());
  assert.doesNotMatch(JSON.stringify(dataset.phase2.meta.excluded), /discontinued|historical/i);
});

test("vezani pribor: sopstvena kartica + veza iz PDP-a porodice faze 1 kroz postojeći odeljak; 0 redova dodato fazi 1", () => {
  const tied = Object.entries(plan.articles).filter(([, entry]) => entry.tiedFamily && entry.status === "VISIBLE");
  assert.ok(tied.length > 0);
  const familySlugById = new Map([...dataset.products, ...Object.values(dataset.enrichments)].map((entry) => [entry.familyId, entry.slug]));
  for (const [number, entry] of tied) {
    const card = cardOfArticle(number);
    const familySlug = familySlugById.get(entry.tiedFamily);
    assert.ok(card.relatedFamilies.some((family) => family.slug === familySlug), number);
    assert.ok(bySlug.get(familySlug).detail.compatibleProducts.content.items.some((item) => item.productSlug === card.slug), `${familySlug} → ${card.slug}`);
    assert.ok(bySlug.get(card.slug).detail.compatibleProducts.content.items.some((item) => item.productSlug === familySlug), `${card.slug} → ${familySlug}`);
  }
  assert.equal(bySlug.get("sata-rps-the-original").detail.compatibleProducts.content.title, "Koristi se zajedno sa");
});

test("rights gate i anti-invention: placeholder, 0 dokumenata, bez cene; brojevi u oznaci reda postoje u zvaničnom nazivu", () => {
  assert.equal(dataset.phase2.meta.images.APPROVED_RUNTIME_IMAGES, 0);
  assert.doesNotMatch(JSON.stringify(dataset.phase2), /sata\.com\/media|\.webp|\.jpe?g|\.png/i, "nijedna adresa slike u datasetu");
  for (const card of plan.cards) {
    const product = bySlug.get(card.slug);
    assert.equal(product.productImage.src, "/images/products/placeholder-product.svg");
    assert.equal(product.documents.length, 0);
    assert.equal(product.publicStatus, "Na upit");
    assert.doesNotMatch(JSON.stringify([product.name, product.shortDescription, product.specifications, product.detail.variants?.content.rows.map((row) => row.values)]), /\bprice\b|\bcena\b|€|\bEUR\b/i, card.slug);
    for (const row of card.variants) {
      const own = row.label.replace(/za .*$/, "");
      assert.doesNotMatch(own, UNTRANSLATED_MARKERS, `${row.articleNumber}: ${row.label}`);
      for (const number of own.match(/\d+(?:[.,]\d+)?/g) ?? []) assert.ok(row.officialName.replace(/(\d)\s*x\s*(\d)/g, (_, a, b) => `${a} x ${b}`).includes(number) || number === row.articleNumber, `${row.articleNumber}: broj ${number} nije u zvaničnom nazivu`);
    }
  }
  // „price per meter” postaje samo „prodaje se na metar”.
  const byMeter = plan.cards.flatMap((card) => card.variants).filter((row) => row.soldByMeter);
  assert.ok(byMeter.length >= 3);
  assert.equal(translateAttribute("net price per meter"), "prodaje se na metar");
  assert.equal(translateAttribute('G 1/4" (female thread)'), 'G 1/4" unutrašnji navoj');
  assert.equal(translateAttribute("(packing unit 5 pieces)"), "pakovanje 5 kom.");
});

test("taksonomija koristi samo postojeće kategorije; slugovi su zaključani u append-only registru", () => {
  const taxonomy = runtime.requireModule("lib/product-taxonomy.ts");
  const known = new Set(["pribor", "zastita", "radionica", "oprema"]);
  for (const card of plan.cards) {
    assert.ok(known.has(card.taxonomy.category), card.slug);
    assert.equal(taxonomy.getProductCategorySlug(bySlug.get(card.slug)), card.taxonomy.category, card.slug);
    assert.deepEqual(registry.phase2[card.slug].articleNumbers, card.variants.map((row) => row.articleNumber).sort(), card.slug);
    assert.match(card.slug, /^sata-[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(card.slug.length <= 80, card.slug);
  }
  assert.equal(new Set(plan.cards.map((card) => card.slug)).size, plan.cards.length);
});

test("pretraga: broj artikla, zvanični naziv, oznaka reda i kompatibilnost su pojmovi kartice", () => {
  for (const card of plan.cards) {
    const terms = new Set(bySlug.get(card.slug).searchTerms);
    for (const row of card.variants) {
      assert.ok(terms.has(row.articleNumber), `${card.slug}: ${row.articleNumber}`);
      assert.ok(terms.has(row.officialName), `${card.slug}: zvanični naziv`);
      if (row.compat) assert.ok(terms.has(row.compat), `${card.slug}: ${row.compat}`);
    }
  }
});
