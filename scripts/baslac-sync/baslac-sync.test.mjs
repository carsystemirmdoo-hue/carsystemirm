/**
 * baslac sync — pravila modela, na fiksiranim primerima i na stvarnom datasetu.
 *
 * Testira se ono što bi tiho pokvarilo katalog: odsečen naziv sa kartice, slika vezana za
 * pogrešnu šifru, toner kao kartica, mixing komponenta kao kartica, i broj artikla iz imena
 * fajla objavljen kao da je javna šifra.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { REPO_ROOT } from "./lib/config.mjs";
import { codesIn, plain, stripLeadingCodes } from "./lib/website-text.mjs";
import { codesInRatio, parseTds } from "./lib/parse-tds.mjs";

const read = (file) => JSON.parse(readFileSync(path.join(REPO_ROOT, file), "utf8"));
const exists = (file) => existsSync(path.join(REPO_ROOT, file));
const source = exists("data/baslac-sync/source-products.generated.json") ? read("data/baslac-sync/source-products.generated.json") : null;
const plan = exists("data/baslac-sync/reports/sync-plan.generated.json") ? read("data/baslac-sync/reports/sync-plan.generated.json") : null;
const dataset = exists("data/baslac-catalog-products.generated.json") ? read("data/baslac-catalog-products.generated.json") : null;

/* -- Tekst sa kartice --------------------------------------------------------------------- */

test("naziv sa kartice ostaje ceo: vodeća šifra se skida kao token, ne kao cifra", () => {
  assert.equal(stripLeadingCodes("12-20 2K Universal Bodyfiller"), "2K Universal Bodyfiller");
  assert.equal(stripLeadingCodes("20-24 /-34 /-94 2K Primerfiller"), "2K Primerfiller");
  assert.equal(stripLeadingCodes("20-35/ -95 Wet-on-Wet"), "Wet-on-Wet");
  assert.equal(stripLeadingCodes("40-440"), "");
});

test("skraćeni zapis šifara nasleđuje prefiks prethodne pune šifre", () => {
  assert.deepEqual(codesIn("20-24 /-34 /-94 2K Primerfiller"), ["20-24", "20-34", "20-94"]);
  assert.deepEqual(codesIn("20-35/ -95 Wet-on-Wet"), ["20-35", "20-95"]);
  // Grupna kartica imenuje samo prefikse — to NISU šifre.
  assert.deepEqual(codesIn("50- /55- /57- Hardeners (Slow to Extra Fast)"), []);
  assert.deepEqual(codesIn("30-S00"), ["30-S00"]);
  // Non-breaking hyphen i zero-width space sa sajta ne smeju da sakriju šifru.
  assert.deepEqual(codesIn(plain("21‑10 1K Plastic Primer")), ["21-10"]);
});

/* -- Tehnički list ------------------------------------------------------------------------ */

const TDS_CLEAR = [
  [
    "Safety advice:",
    "2004/42/IIB(cII)(540)530: ",
    "The EU limit value for this product ( product category: IIB.cII) in ready to use form is",
    "max 540 g/l of VOC.",
    "The VOC content of this product is 530 g/l.",
    "T",
    "echnical Information",
    "40-40",
    "2",
    "K Universal Clear",
    "JSON created 2023-06-22T07:32:50+0000, MPV 4.3",
    "06/2023",
    "page 1 of 1",
    "HS clearcoat for high quality",
    "Repairs should prior be treated with 27-10 2K W",
    "ash primer",
    "Application",
    "Mixing Ratio",
    "2:1+10 %",
    "100 % by volume",
    "40-40",
    "50 % by volume",
    "50-20, -30",
    "10 % by volume",
    "60-10, -20, -30, -40",
    "Potlife at 20°C",
    "4 h",
    "Drying",
    "Drying at 20°C",
    "8 h",
  ].join("\n"),
];

test("tehnički list se čita kao činjenice: razmera, odnosi, VOC, sušenje", () => {
  const tds = parseTds(TDS_CLEAR, "40-40");
  assert.equal(tds.officialName, "2K Universal Clear");
  assert.equal(tds.revision, "06/2023");
  assert.equal(tds.facts.mixingRatio, "2:1+10 %");
  assert.equal(tds.facts.potLife, "4 h");
  assert.deepEqual(tds.drying, ["Drying at 20°C: 8 h"]);
  assert.deepEqual(tds.voc, { content: 530, limit: 540, category: "IIB.cII" });
  // Skraćen zapis u tabeli udela: „50-20, -30" su dve šifre.
  assert.deepEqual(codesInRatio("50-20, -30"), ["50-20", "50-30"]);
  assert.deepEqual(tds.relatedCodes, ["50-20", "50-30", "60-10", "60-20", "60-30", "60-40"]);
  // Reč presečena prelomom reda se spaja bez razmaka, rečenica sa razmakom.
  assert.ok(tds.intro.some((line) => line.includes("2K Wash primer")), tds.intro.join(" | "));
});

test("„Mixing Ratio” nad tabelom udela nije odnos mešanja", () => {
  const tds = parseTds(["page 1 of 1\nApplication\nMixing Ratio\n100 % by weight\n12-20\n2-3 % by weight\n56-20\nPotlife at 20°C\n5 min"], "12-20");
  assert.equal(tds.facts.mixingRatio, undefined, "„100 % by weight” je udeo, ne odnos");
  assert.deepEqual(tds.relatedCodes, ["56-20"]);
});

test("list komponente nema nijednu etiketu — ceo sadržaj je zvanična izjava o upotrebi", () => {
  const tds = parseTds(["page 1 of 1\nThis product is used in baslac 2K Primerfiller, 2K Plastic Primer,\nT\nopcoat direct gloss 30 and Clears 40-10, -40."], "50-20");
  assert.equal(tds.facts.mixingRatio, undefined);
  assert.ok(tds.intro.join(" ").includes("Topcoat direct gloss 30"));
  assert.ok(tds.intro.join(" ").includes("Clears 40-10, -40"));
});

test("VOC se čita po BLOKU: list sa dva bezbednosna bloka ne meša granicu i sadržaj", () => {
  const twoBlocks = [
    "page 1 of 2",
    "2004/42/IIB (c II)(540)530: ",
    "The EU limit value for this product (product category: IIB.c II) in ready to use form is",
    "max. 540 g/l.",
    "The VOC content of this product is 530 g/l.",
    "page 2 of 2",
    "2004/42/IIB(d)(420)419: ",
    "The EU limit value for this product ( product category: IIB.d) in ready to use form is max",
    "420 g/litre of VOC.",
    "The VOC content of this product is 419 g/litre.",
  ].join("\n");
  const tds = parseTds([twoBlocks], "81-30");
  assert.equal(tds.vocBlocks, 2);
  // Prvi blok u celosti — nikad granica iz drugog uz sadržaj iz prvog.
  assert.deepEqual(tds.voc, { content: 530, limit: 540, category: "IIB.cII" });
  assert.ok(tds.voc.content <= tds.voc.limit, "sadržaj iznad granice je znak pomešanih blokova");
});

/* -- Model: stvarni dataset ---------------------------------------------------------------- */

const modelTest = source && plan && dataset ? test : test.skip;

modelTest("toneri se zvanično ne objavljuju: nijedna toner šifra nije kartica", () => {
  assert.equal(source.summary.CURRENT_PUBLIC_TONERS, 0);
  const tonerLike = /^(30-S\d|35-M\d|45-W\d|49-W)/;
  const cards = plan.items.filter((item) => item.action === "IMPORT" || item.action === "ENRICH_EXISTING");
  assert.deepEqual(cards.filter((item) => item.code && tonerLike.test(item.code) && !source.products.find((product) => product.code === item.code)?.promotedFromLine).map((item) => item.code), []);
});

modelTest("mixing komponente su ugnježdene činjenice sistema, ne kartice", () => {
  const nested = plan.items.filter((item) => item.action === "NEST_IN_SYSTEM").map((item) => item.code);
  assert.deepEqual(nested, ["30-S00", "30-S01", "35-M00", "45-W00"]);
  for (const code of nested) assert.ok(!dataset.products.some((product) => product.code === code), `${code} ne sme biti zaseban zapis`);
  // Svaka komponenta mora biti navedena u svom sistemu.
  const inSystems = dataset.products.filter((product) => product.kind === "system").flatMap((product) => product.systemComponents.map((component) => component.code));
  assert.deepEqual([...inSystems].sort(), nested);
});

modelTest("sistem zaključava javno ime i POSTOJEĆU adresu svoje porodice", () => {
  const systems = dataset.products.filter((product) => product.kind === "system");
  assert.equal(systems.length, 4);
  for (const system of systems) {
    assert.equal(system.family.identity.name, system.officialName);
    assert.equal(system.family.identity.slug, system.family.baseProductSlug);
    assert.match(system.family.baseProductSlug, /^baslac-line-/, "adresa porodice se ne sme pomeriti");
  }
});

modelTest("promovisane šifre izlaze iz porodice pod SVOJIM postojećim slugom", () => {
  assert.deepEqual(dataset.meta.promotedFromLine.sort(), ["45-R45", "45-W10"]);
  for (const code of ["45-R45", "45-W10"]) {
    const [slug, enrichment] = Object.entries(dataset.enrichments).find(([, entry]) => entry.code === code);
    assert.equal(enrichment.detachFromFamily, true);
    assert.equal(slug, `baslac-${code.toLowerCase()}`, "postojeća adresa mora ostati ista");
  }
});

modelTest("broj artikla postoji samo u imenu zvanične slike i ne objavljuje se", () => {
  const published = JSON.stringify(dataset.products.map((product) => ({ ...product, image: null })));
  assert.equal(/\b\d{8}\b/.exec(published), null);
  // A u izvoru je vidljiv — dokaz da test meri objavu, ne odsustvo podatka.
  assert.ok(source.products.some((product) => product.officialImages.some((url) => /\d{8}/.test(url))));
});

modelTest("nijedan zapis nema VOC sadržaj iznad zvanične granice", () => {
  for (const product of dataset.products) {
    const voc = product.technical.voc;
    if (!voc?.limit) continue;
    assert.ok(voc.content <= voc.limit, `${product.slug}: VOC ${voc.content} > granica ${voc.limit}`);
  }
});

modelTest("svaki uvezen zapis ima zvanični tehnički list i SR sadržaj", () => {
  for (const product of dataset.products) {
    assert.ok(product.documents.length, `${product.slug}: bez tehničkog lista`);
    assert.ok(product.content.productType && product.content.shortDescription, `${product.slug}: bez SR sadržaja`);
    assert.ok(!/\d{4,}/.test(product.content.productType), `${product.slug}: broj u tipu proizvoda`);
  }
});
