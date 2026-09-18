import assert from "node:assert/strict";
import { test } from "node:test";

import { matchLocalProduct, nameTokens, seriesCodes } from "./lib/match.mjs";
import { parseSpecification, parseSubtitle } from "./lib/attributes.mjs";

const article = (articleNumber, specification = null) => ({ articleNumber, specification });
const source = [
  { sourceKey: "abrasives/f23", officialName: "Sanding Disc F.23 Ceramic", subtitle: "Film abrasive - 150 mm - 25 holes", articles: [article("159.218", "P 80"), article("159.219", "P 120")] },
  { sourceKey: "abrasives/f19-150", officialName: "Sanding Disc F.19", subtitle: "Film abrasive - 150 mm - 25 holes", articles: [article("156.046", "P 80")] },
  { sourceKey: "abrasives/f19-77", officialName: "Sanding Disc F.19", subtitle: "Film abrasive - 77 mm", articles: [article("156.647", "P 80")] },
  { sourceKey: "putties/multi-green", officialName: "Multi Green", subtitle: "Multifuncional polyester putty", articles: [article("146.706", "1.6 kg tin incl. hardener")] },
  { sourceKey: "putties/multi-green-changer", officialName: "Multi Green Changer", subtitle: "Multifuncional polyester putty", articles: [article("157.622", "1.6 kg tin incl. hardener")] },
  { sourceKey: "putties/elastic-white", officialName: "Elastic white", subtitle: "Polyester - fine putty", articles: [article("130.856", "1.0 kg tin incl. hardener")] },
  { sourceKey: "safety/jacket", officialName: "Classic Coverall Jacket Anthracite", subtitle: "Protective coverall", articles: [article("158.100", "S")] },
];

const local = (overrides) => ({
  slug: "x", name: "x", ownArticleNumbers: [], seriesArticleNumbers: [], imageSha256: null, packages: [], ...overrides,
});

test("šifra artikla koju zapis nosi je tačno poklapanje, bez obzira na naziv", () => {
  const result = matchLocalProduct(local({ name: "Potpuno drugi naziv", ownArticleNumbers: ["159.218", "159.219"] }), source, new Map());
  assert.equal(result.classification, "EXACT_MATCH");
  assert.deepEqual(result.sourceKeys, ["abrasives/f23"]);
  assert.equal(result.autoApply, true);
});

test("šifre koje pripadaju različitim proizvodima su sukob, ne poklapanje", () => {
  const result = matchLocalProduct(local({ ownArticleNumbers: ["159.218", "156.046"] }), source, new Map());
  assert.equal(result.classification, "SOURCE_CONFLICT");
  assert.equal(result.autoApply, false);
});

test("raspon serije iz naših potvrđenih podataka razrešava generički naziv", () => {
  const result = matchLocalProduct(local({ name: "Carsystem F19 brusni diskovi", seriesArticleNumbers: ["156.046"] }), source, new Map());
  assert.equal(result.classification, "HIGH_CONFIDENCE_MATCH");
  assert.deepEqual(result.sourceKeys, ["abrasives/f19-150"]);
});

test("kôd serije sa više kandidata je AMBIGUOUS i nikad se ne primenjuje sam", () => {
  const result = matchLocalProduct(local({ name: "Carsystem F19 brusni diskovi" }), source, new Map());
  assert.equal(result.classification, "AMBIGUOUS");
  assert.equal(result.autoApply, false);
  assert.equal(result.sourceKeys.length, 2);
});

test("sličan naziv nije dokaz: „Multi Green” se ne spaja sa „Multi Green Changer”", () => {
  const result = matchLocalProduct(local({ name: "Carsystem Git Multi Green" }), source, new Map());
  assert.deepEqual(result.sourceKeys, ["putties/multi-green"]);
  assert.equal(result.classification, "HIGH_CONFIDENCE_MATCH");
});

test("isti naziv uz pakovanja koja se ne slažu je samo PROBABLE", () => {
  const result = matchLocalProduct(local({ name: "Carsystem Git Multi Green", packages: ["1.8 kg", "2 kg"] }), source, new Map());
  assert.equal(result.classification, "PROBABLE_MATCH");
  assert.equal(result.autoApply, false);
});

test("identičan zvanični packshot + naziv (DE alias) daje visoku pouzdanost", () => {
  const images = new Map([["sha-elastic", "putties/elastic-white"]]);
  const result = matchLocalProduct(local({ name: "Carsystem Git Elastic Weiss", imageSha256: "sha-elastic" }), source, images);
  assert.equal(result.classification, "HIGH_CONFIDENCE_MATCH");
});

test("identičan zvanični TDS + tačan naziv nadjačava neslaganje ručno upisanih pakovanja", () => {
  const tds = new Map([["sha-tds-multi-green", "putties/multi-green"]]);
  const result = matchLocalProduct(
    local({ name: "Carsystem Git Multi Green", packages: ["1.8 kg", "2 kg"], documentSha256s: ["sha-tds-multi-green"] }),
    source, new Map(), new Map(), tds,
  );
  assert.equal(result.classification, "HIGH_CONFIDENCE_MATCH");
  assert.deepEqual(result.sourceKeys, ["putties/multi-green"]);
});

test("identičan TDS bez potvrde naziva ne spaja identitet", () => {
  const tds = new Map([["sha-tds", "putties/multi-green-changer"]]);
  const result = matchLocalProduct(local({ name: "Carsystem neki git", documentSha256s: ["sha-tds"] }), source, new Map(), new Map(), tds);
  assert.notEqual(result.classification, "HIGH_CONFIDENCE_MATCH");
  assert.equal(result.autoApply, false);
});

test("samo identična slika uz generički naziv ostaje PROBABLE", () => {
  const images = new Map([["sha-jacket", "safety/jacket"]]);
  const result = matchLocalProduct(local({ name: "Carsystem zaštitno odelo", imageSha256: "sha-jacket" }), source, images);
  assert.equal(result.classification, "PROBABLE_MATCH");
  assert.equal(result.autoApply, false);
});

test("bez ijednog dokaza zapis je legacy, ne briše se i ne spaja", () => {
  const result = matchLocalProduct(local({ name: "Carsystem P23 brusni diskovi" }), source, new Map());
  assert.equal(result.classification, "LEGACY_NOT_IN_CATALOGUE");
  assert.deepEqual(result.sourceKeys, []);
});

test("normalizacija naziva i kodova serije", () => {
  assert.deepEqual(nameTokens("Carsystem Git Elastic Weiss"), ["elastic", "white"]);
  assert.deepEqual(seriesCodes("Sanding Disc F.23 Ceramic"), ["f23"]);
  assert.deepEqual(seriesCodes("Carsystem P19 brusni diskovi"), ["p19"]);
});

test("atributi se čitaju samo iz zvaničnog teksta", () => {
  assert.deepEqual(parseSpecification("P 80"), { grit: "P80" });
  assert.deepEqual(parseSpecification("1.0 kg tin incl. hardener"), { weight: "1.0 kg", container: "tin", includes: "hardener" });
  assert.equal(parseSpecification("400 cm x 150 m (middle folding)").dimensions, "400 cm × 150 m");
  assert.equal(parseSpecification("XXL").size, "XXL");
  assert.deepEqual(parseSpecification(null), {});
  assert.deepEqual(parseSubtitle("Film abrasive - 150 mm - 25 holes"), { diameter: "150 mm", holePattern: "25 holes", productType: "Film abrasive" });
});
