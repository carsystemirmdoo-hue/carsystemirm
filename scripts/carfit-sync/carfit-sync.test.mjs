import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import { readJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS } from "./lib/config.mjs";
import { componentRole, isCompanionRole } from "./lib/components.mjs";
import { parseDescriptor, parseDocuments, parseProductContent, parseVariants } from "./lib/html.mjs";
import { loadLocalProducts, matchLocalProduct, measureKey } from "./lib/local-match.mjs";

const block = (heading, body) => `<h3>${heading}</h3><div>${body}</div>`;

test("šifre se čitaju po markeru, a opis je tekst između dva markera", () => {
  const html = "Item no.: <b>6-300-0040</b>, grit P40, 50 pcs.<br />Item no.: <b>6-300-0060</b>, grit P60, 50 pcs.";
  assert.deepEqual(
    parseVariants(html, "Discs").map((variant) => [variant.articleNumber, variant.descriptor, variant.component]),
    [["6-300-0040", "grit P40, 50 pcs.", "Discs"], ["6-300-0060", "grit P60, 50 pcs.", "Discs"]],
  );
});

test("nemački marker „Art.-Nr.” daje iste šifre kao engleski „Item no.”", () => {
  assert.deepEqual(parseVariants("Art.-Nr.: <b>7-325-1000</b>, 1 l", null).map((variant) => variant.articleNumber), ["7-325-1000"]);
});

test("proizvođačeva skraćenica 3-225-0002/0200/0400 se širi u zasebne šifre istog prefiksa", () => {
  const variants = parseVariants("Item no.: <b>3-225-0002</b>/0200/0400/0850, 1 hard cup, 1 collar", null);
  assert.deepEqual(variants.map((variant) => variant.articleNumber), ["3-225-0002", "3-225-0200", "3-225-0400", "3-225-0850"]);
  assert.equal(variants[0].shorthandOf, null);
  assert.equal(variants[1].shorthandOf, "3-225-0002/0200/0400/0850");
  assert.ok(variants.every((variant) => variant.descriptor === "1 hard cup, 1 collar"));
});

test("h3 je granica komponente: učvršćivač ne postaje pakovanje laka", () => {
  const html = `<h2>Description</h2><p>Clear coat.</p>${block("Clearcoat", "Item no.: <b>7-325-1000</b>, 1 l")}${block("Hardener", "Item no.: <b>7-336-1000</b>, 1 l")}<h2>Application</h2><p>Refinish.</p>`;
  const parsed = parseProductContent(html);
  assert.deepEqual(parsed.variants.map((variant) => [variant.articleNumber, variant.component]), [["7-325-1000", "Clearcoat"], ["7-336-1000", "Hardener"]]);
  assert.deepEqual(parsed.description, ["Clear coat."]);
  assert.deepEqual(parsed.application, ["Refinish."]);
  assert.deepEqual(parsed.unmarkedArticleTokens, []);
});

test("uloga komponente: prateće komponente naspram oblika iste porodice", () => {
  assert.equal(componentRole(null), "main");
  assert.equal(componentRole("Clearcoat"), "main");
  assert.equal(componentRole("Hardener"), "hardener");
  assert.equal(componentRole("Härter"), "hardener");
  assert.equal(componentRole("Discs"), "format");
  assert.equal(componentRole("Stripes"), "format");
  assert.ok(isCompanionRole("hardener") && !isCompanionRole("format") && !isCompanionRole("main"));
});

test("atributi varijante se čitaju samo iz onoga što doslovno piše", () => {
  assert.deepEqual(parseDescriptor("grit P40, 50 pcs."), { grit: "P40", pieces: "50" });
  assert.deepEqual(parseDescriptor("2,5 l fast"), { volume: "2.5 L" });
  assert.deepEqual(parseDescriptor("1.0 kg (can), with hardener"), { weight: "1.0 kg" });
  assert.equal(parseDescriptor("19 mm x 45 m").dimensions, "19 mm × 45 m");
  assert.equal(parseDescriptor("P80, 50 pcs., 14 holes").holes, "14");
  assert.deepEqual(parseDescriptor(null), {});
});

test("dokumenti: vrsta i komponenta iz natpisa linka", () => {
  const html = '<a href="https://carfitrepair.com/a.pdf">Technical data sheet</a><a href="https://carfitrepair.com/b.pdf">Safety datasheet (hardener)</a>';
  assert.deepEqual(parseDocuments(html).map((document) => [document.kind, document.component]), [["tds", null], ["sds", "hardener"]]);
});

test("mera pakovanja se poredi bez obzira na zapis", () => {
  assert.equal(measureKey("4 x 5 m"), measureKey("4 m x 5 m"));
  assert.equal(measureKey("4m × 5m"), "4mx5m");
  assert.notEqual(measureKey("4 x 150 m"), measureKey("4 m x 200 m"));
  assert.equal(measureKey("1,0 l"), measureKey("1 L"));
});

const officialProduct = {
  sourceKey: "film",
  officialName: "Masking film with electrostatic effect",
  variants: [{ articleNumber: "1-201-0450", owned: true, descriptor: "4 m x 5 m" }],
  catalogueOnlyVariants: [],
};
const localRecord = (overrides) => ({ slug: "local", name: "Car Fit maskirna folija 4 x 5 m", ownArticleNumbers: [], imageSha256s: [], packages: ["4 x 5 m"], ...overrides });

test("matching: zvanična šifra koju zapis sam nosi → EXACT_MATCH", () => {
  const match = matchLocalProduct(localRecord({ ownArticleNumbers: ["1-201-0450"] }), [officialProduct], new Map());
  assert.equal(match.classification, "EXACT_MATCH");
  assert.equal(match.autoApply, true);
});

test("matching: bajt-identična slika + isto pakovanje → HIGH_CONFIDENCE_MATCH", () => {
  const match = matchLocalProduct(localRecord({ imageSha256s: ["abc"] }), [officialProduct], new Map([["abc", "film"]]));
  assert.equal(match.classification, "HIGH_CONFIDENCE_MATCH");
  assert.deepEqual(match.matchedArticleNumbers, ["1-201-0450"]);
});

test("matching: samo slika, pakovanje ne postoji → PROBABLE_MATCH i NE spaja se automatski", () => {
  const match = matchLocalProduct(localRecord({ imageSha256s: ["abc"], name: "Car Fit folija 4 x 150 m", packages: ["4 x 150 m"] }), [officialProduct], new Map([["abc", "film"]]));
  assert.equal(match.classification, "PROBABLE_MATCH");
  assert.equal(match.autoApply, false);
});

test("matching: sličan naziv bez šifre, slike i pakovanja nije dokaz → LOCAL_ONLY_UNKNOWN", () => {
  const match = matchLocalProduct(localRecord({ name: "Car Fit maskirna folija 4 x 150 m", packages: ["4 x 150 m"] }), [officialProduct], new Map());
  assert.equal(match.classification, "LOCAL_ONLY_UNKNOWN");
  assert.equal(match.autoApply, false);
});

test("matching: zvanična šifra koje nema na sajtu → LEGACY_NOT_ON_CURRENT_WEBSITE", () => {
  const match = matchLocalProduct(localRecord({ ownArticleNumbers: ["9-999-0001"] }), [officialProduct], new Map(), new Set(["9-999-0001"]));
  assert.equal(match.classification, "LEGACY_NOT_ON_CURRENT_WEBSITE");
});

test("dataset: svaka šifra je na tačno jednom proizvodu, a svaki slug je u registru", { skip: !existsSync(PATHS.siteDataset) }, () => {
  const dataset = readJson(PATHS.siteDataset);
  const registry = readJson(PATHS.identityRegistry, { products: {} });
  const seen = new Map();
  for (const product of dataset.products) {
    assert.ok(registry.products[product.slug], `${product.slug} nije u registru`);
    for (const variant of product.variants) {
      assert.ok(!seen.has(variant.articleNumber), `${variant.articleNumber}: ${seen.get(variant.articleNumber)} i ${product.slug}`);
      seen.set(variant.articleNumber, product.slug);
    }
    assert.equal(new Set(product.variants.map((variant) => variant.label)).size, product.variants.length, `${product.slug}: oznake varijanti nisu jedinstvene`);
  }
});

test("dataset: porodica sa mnogo granulacija je JEDAN proizvod, ne kartica po granulaciji", { skip: !existsSync(PATHS.siteDataset) }, () => {
  const dataset = readJson(PATHS.siteDataset);
  const gold = dataset.products.filter((product) => product.officialName === "Gold Paper Disc");
  assert.equal(gold.length, 1);
  assert.ok(gold[0].variants.length >= 13);
});

test("dataset: slovna razlika sajt ↔ PDF je JEDNA varijanta sa alternativnim zapisom, ne dve varijante", { skip: !existsSync(PATHS.siteDataset) }, () => {
  const dataset = readJson(PATHS.siteDataset);
  const variantNumbers = new Set(dataset.products.flatMap((product) => product.variants.map((variant) => variant.articleNumber)));
  const alternates = dataset.products.flatMap((product) => product.variants.flatMap((variant) => (variant.alternateArticleNumbers ?? []).map((alternate) => [variant, alternate])));
  assert.ok(alternates.length >= 1);
  for (const [variant, alternate] of alternates) {
    assert.ok(!variantNumbers.has(alternate.articleNumber), `${alternate.articleNumber} je i varijanta i alternativni zapis`);
    assert.ok(variant.onWebsite, "red tabele nosi šifru sa sajta");
    assert.ok(alternate.source);
  }
});

test("dataset: ručni zapis prepoznat kao porodica ne nosi naziv jedne dimenzije", { skip: !existsSync(PATHS.siteDataset) }, () => {
  const { enrichments } = readJson(PATHS.siteDataset);
  const film = enrichments["carfit-maskirna-folija-4x5m"];
  assert.equal(film.variants.length, 3);
  assert.ok(film.presentation?.name);
  assert.doesNotMatch(film.presentation.name, /4 ?[x×] ?5/i);
});

test("idempotentnost: dokaz za matching se čita iz RUČNOG izvora, ne iz runtime-a posle dopune", { skip: !existsSync(PATHS.siteDataset) }, () => {
  // Runtime prikazuje zvanični naziv porodice i „3 varijante”; ručni zapis kaže „4 x 5 m”.
  // Da matching čita runtime, drugi prolaz bi izgubio dokaz pakovanja i uvezao porodicu dvaput.
  const registry = readJson(PATHS.identityRegistry, { products: {} });
  const { local } = loadLocalProducts(new Set(Object.keys(registry.products)));
  const film = local.find((record) => record.slug === "carfit-maskirna-folija-4x5m");
  assert.ok(film);
  assert.match(film.name, /4 x 5 m/);
  assert.deepEqual(film.packages, ["4 x 5 m"]);
  assert.deepEqual(film.ownArticleNumbers, [], "prikazana zvanična šifra nije šifra koju zapis sam nosi");
  assert.doesNotMatch(film.displayedName, /4 x 5 m/);
  assert.equal(new Set(Object.values(registry.products).map((entry) => entry.sourceKey)).has("abdeckmaterial-mit-elektrostatischen-eigenschaften"), false, "porodica ne sme biti uvezena i kao zaseban proizvod");
});
