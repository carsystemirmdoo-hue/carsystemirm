import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import { readJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS } from "./lib/config.mjs";
import { applySpanningColour, buildProducts, imagesForProductRow } from "./lib/families.mjs";
import { colourSr, holesSr, sizeSr, variantLabel, varyingKeysOf } from "./lib/labels.mjs";
import { CODE, parseWixPage } from "./lib/wix.mjs";

/* -- Wix parser ------------------------------------------------------------------------------ */

/** Minimalna Wix stranica: ćelije su zasebni tekstovi, položaj je u CSS-u, redosled u HTML-u je PO KOLONAMA. */
function wixFixture(cells, { section = "comp-sec1" } = {}) {
  const css = cells.map(([id, row, left]) => `[data-mesh-id=${section}inlineContent-gridContainer] > [id="${id}"], x{position:relative;left:${left}px;grid-area:${row} / 1 / ${row + 1} / 2;}`).join("");
  const body = cells.map(([id, , , text, heading]) => `<div id="${id}" class="x" data-testid="richTextElement">${heading ? `<h2>${text}</h2>` : `<p>${text}</p>`}</div><!--/$-->`).join("");
  return `<style>${css}</style><script>{"${section}":"ClassicSection"}</script>${body}`;
}

test("tabela se rekonstruiše iz reda mreže i x-pozicije, ne iz redosleda u HTML-u", () => {
  const html = wixFixture([
    ["comp-t", 1, 500, "Surface Chemicals", true],
    ["comp-h1", 2, 550, "Product"], ["comp-p1", 3, 510, "Liquid Compound"], ["comp-p2", 4, 510, "Auto Polish"],
    ["comp-h2", 2, 717, "Code"], ["comp-c1", 3, 712, "75011"], ["comp-c2", 4, 712, "80011"],
    ["comp-h3", 2, 855, "Size"], ["comp-s1", 3, 839, "1000 gr."], ["comp-s2", 4, 839, "1000 gr."],
  ]);
  const [block] = parseWixPage(html).blocks;
  assert.equal(block.title, "Surface Chemicals");
  assert.deepEqual(block.columns, ["product", "code", "size"]);
  assert.deepEqual(block.rows.map((row) => [row.code, row.cells.product, row.cells.size]), [["75011", "Liquid Compound", "1000 gr."], ["80011", "Auto Polish", "1000 gr."]]);
});

test("dve tabele jedna ispod druge u istom bloku su dva proizvoda", () => {
  const html = wixFixture([
    ["comp-t1", 1, 500, "Leo Ceramic Aplication Block", true], ["comp-h1", 2, 700, "Code"], ["comp-c1", 3, 700, "80012O"],
    ["comp-t2", 4, 600, "Leo Ceramic Cloth"], ["comp-h2", 5, 700, "Code"], ["comp-c2", 6, 700, "10175TM"],
  ]);
  const blocks = parseWixPage(html).blocks;
  assert.deepEqual(blocks.map((block) => [block.title, block.rows.map((row) => row.code)]), [["Leo Ceramic Aplication Block", ["80012O"]], ["Leo Ceramic Cloth", ["10175TM"]]]);
});

test("zvanični format Befar šifre", () => {
  for (const code of ["75011", "024012", "56401ORB", "08401SND", "80012O", "59507ADV"]) assert.ok(CODE.test(code), code);
  for (const text of ["150mm", "1000", "SOFT", "4x5m²"]) assert.ok(!CODE.test(text), text);
});

/* -- Porodica / varijanta --------------------------------------------------------------------- */

const block = (overrides) => ({ blockKey: "p#1", pageKey: "p", category: "Cat", line: "Befar", title: "T", titleTr: null, columns: ["colour", "code", "size"], qualifiers: [], images: [], rows: [], ...overrides });
const row = (code, extra = {}) => ({ code, product: null, colour: null, size: null, holes: null, ...extra });

test("P1: red tabele proizvoda je zaseban proizvod; isti proizvod u drugom bloku je pakovanje, ne drugi proizvod", () => {
  const { products } = buildProducts([
    block({ blockKey: "c#1", title: "1000gr. Surface Chemicals", columns: ["product", "code", "size"], rows: [row("75011", { product: "Liquid Compound", size: "1000 gr." }), row("80011", { product: "Auto Polish", size: "1000 gr." })] }),
    block({ blockKey: "c#2", title: "250gr. Surface Chemicals", columns: ["product", "code", "size"], rows: [row("75250", { product: "Liquid Compound", size: "250 gr." }), row("80250", { product: "Auto Polish", size: "250 gr." })] }),
  ]);
  assert.deepEqual(products.map((product) => [product.officialName, product.variants.map((variant) => variant.code)]), [["Auto Polish", ["80011", "80250"]], ["Liquid Compound", ["75011", "75250"]]]);
  assert.ok(products.every((product) => product.kind === "product-row"));
});

test("P1: kolona Product sa ISTOM vrednošću nije tabela proizvoda — blok je porodica sa pakovanjima", () => {
  const { products } = buildProducts([block({ title: "Extra Cream Compound", columns: ["product", "code", "size"], qualifiers: ["EXTRA"], rows: [row("76125", { product: "Cream Compound", size: "125 gr." }), row("76300", { product: "Cream Compound", size: "300 gr." })] })]);
  assert.equal(products.length, 1);
  assert.equal(products[0].officialName, "Extra Cream Compound");
  assert.equal(products[0].variants.length, 2);
});

test("P2+P5: isti sunđer u više dimenzija je JEDNA porodica; boje i dimenzije su varijante", () => {
  const { products } = buildProducts([
    block({ blockKey: "v#1", title: "Velcro Polishing Pad", rows: [row("04401", { colour: "White", size: "150x25mm" }), row("04402", { colour: "Orange", size: "150x25mm" })] }),
    block({ blockKey: "v#2", title: "Velcro Polishing Pad", rows: [row("06401", { colour: "White", size: "180x35mm" })] }),
  ]);
  assert.equal(products.length, 1);
  assert.deepEqual(products[0].variants.map((variant) => variant.code), ["04401", "04402", "06401"]);
});

test("P4: isti naslov u drugoj LINIJI je druga porodica", () => {
  const { products } = buildProducts([
    block({ blockKey: "v#1", title: "Velcro Polishing Pad", line: "Befar", rows: [row("04402", { colour: "Orange", size: "150x25mm" })] }),
    block({ blockKey: "v#2", title: "Velcro Polishing Pad", line: "Befar Plus", rows: [row("54402", { colour: "Orange", size: "150x25mm" })] }),
  ]);
  assert.deepEqual(products.map((product) => product.displayNameEn).sort(), ["Befar Plus Velcro Polishing Pad", "Velcro Polishing Pad"]);
});

test("P3: oznaka uz tabelu razdvaja porodice istog naslova (Hard Red ≠ Soft Orange)", () => {
  const { products } = buildProducts([
    block({ blockKey: "s#1", title: "Sanding Block", qualifiers: ["Hard Red"], columns: ["code", "size"], rows: [row("89010", { size: "Standard" })] }),
    block({ blockKey: "s#2", title: "Sanding Block", qualifiers: ["Soft Orange"], columns: ["code", "size"], rows: [row("88010", { size: "Standard" })] }),
  ]);
  assert.deepEqual(products.map((product) => product.officialName).sort(), ["Sanding Block · Hard Red", "Sanding Block · Soft Orange"]);
});

test("P6: isti skup šifara na dve stranice je isti proizvod, ne duplikat", () => {
  const { products, conflicts } = buildProducts([
    block({ blockKey: "leo#1", pageKey: "leo", title: "Leo Detailing Pad", line: "Leo", rows: [row("09901", { size: "125mm" }), row("09902", { size: "145mm" })] }),
    block({ blockKey: "taban#1", pageKey: "taban", title: "Leo Detailing Backing Pad", line: "Leo", rows: [row("09901", { size: "125mm" }), row("09902", { size: "145mm" })] }),
  ]);
  assert.equal(products.length, 1);
  assert.deepEqual(products[0].pages.sort(), ["leo", "taban"]);
  assert.equal(products[0].officialName, "Leo Detailing Backing Pad");
  assert.ok(conflicts.some((conflict) => conflict.type === "SAME_CODES_DIFFERENT_TITLES"));
});

test("iste šifre sa suprotnom oznakom tvrdoće: jedan proizvod, oznaka se NE prenosi u naziv", () => {
  const { products, conflicts } = buildProducts([
    block({ blockKey: "z#2", title: "Backing Pad", qualifiers: ["SOFT"], columns: ["code", "holes", "size"], rows: [row("93107", { holes: "7 Holes", size: "150mm" })] }),
    block({ blockKey: "z#3", title: "Backing Pad", qualifiers: ["HARD"], columns: ["code", "holes", "size"], rows: [row("93107", { holes: "7 Holes", size: "150mm" })] }),
  ]);
  assert.equal(products.length, 1);
  assert.equal(products[0].officialName, "Backing Pad");
  assert.deepEqual(products[0].qualifierConflict, ["SOFT", "HARD"]);
  assert.ok(conflicts.some((conflict) => conflict.type === "SAME_CODES_DIFFERENT_QUALIFIER"));
});

test("set sa svojom šifrom je zaseban proizvod i nije rastavljen na komponente", () => {
  const { products } = buildProducts([block({ title: "Headlight Cleaning Set", columns: ["code", "size"], rows: [row("05812", { size: "12 Pieces" })] })]);
  assert.equal(products.length, 1);
  assert.equal(products[0].isSet, true);
  assert.deepEqual(products[0].variants.map((variant) => variant.code), ["05812"]);
});

test("slajd galerije pripada proizvodu po TURSKOM naslovu; bez dokaza ostaje grupna fotografija", () => {
  const images = [{ mediaId: "a", titleTr: "250gr. Likit Pasta" }, { mediaId: "b", titleTr: "250gr. Oto Cilası" }];
  assert.deepEqual(imagesForProductRow(images, "Oto Cilası").images.map((image) => image.mediaId), ["b"]);
  assert.equal(imagesForProductRow(images, "Hare Giderici").sharedGroupImages, true);
});

/* -- Oznake varijanti ---------------------------------------------------------------------------- */

test("srpske oznake se grade iz strukturisanih činjenica", () => {
  assert.equal(colourSr("Claret Red"), "bordo");
  assert.equal(colourSr("Beyaz"), "bela");
  assert.equal(sizeSr("150x25mm"), "150 × 25 mm");
  assert.equal(sizeSr("4x150m²"), "4 × 150 m²");
  assert.equal(sizeSr("1000 gr."), "1000 g");
  assert.equal(sizeSr("180mm/16Hole"), "180 mm · 16 rupa");
  assert.equal(holesSr("62 Holes"), "62 rupa");
  const variants = [{ colour: "Orange", size: "150x25mm" }, { colour: "Orange", size: "180x35mm" }];
  assert.deepEqual(variants.map((variant) => variantLabel(variant, varyingKeysOf(variants))), ["150 × 25 mm", "180 × 35 mm"]);
});

/* -- Dataset ----------------------------------------------------------------------------------------- */

const hasDataset = existsSync(PATHS.siteDataset) && (readJson(PATHS.siteDataset)?.products ?? []).length > 0;

test("dataset: svaka šifra je na tačno jednom proizvodu; Leo/Plus/Turkuaz su linije, ne brendovi", { skip: !hasDataset }, () => {
  const dataset = readJson(PATHS.siteDataset);
  const seen = new Map();
  for (const product of dataset.products) {
    assert.ok(["Befar", "Befar Plus", "Leo", "Turkuaz", "Opencell"].includes(product.line), product.line);
    assert.ok(product.slug.startsWith("befar-"));
    for (const variant of product.variants) {
      assert.ok(!seen.has(variant.code), `${variant.code}: ${seen.get(variant.code)} i ${product.slug}`);
      seen.set(variant.code, product.slug);
    }
    assert.equal(new Set(product.variants.map((variant) => variant.label)).size, product.variants.length, `${product.slug}: oznake nisu jedinstvene`);
  }
});

test("dataset: četiri hemikalije su četiri proizvoda, svaka sa svoja dva pakovanja", { skip: !hasDataset }, () => {
  const dataset = readJson(PATHS.siteDataset);
  for (const [name, codes] of [["Liquid Compound", ["75011", "75250"]], ["Auto Polish", ["80011", "80250"]], ["Anti Hologram", ["85011", "85250"]], ["Paint Protector", ["90011", "90250"]]]) {
    const product = dataset.products.find((entry) => entry.officialName === name);
    assert.ok(product, name);
    assert.deepEqual(product.variants.map((variant) => variant.code).sort(), codes);
  }
});

test("dataset: ista dimenzija sa 7/15/62 rupe su tri zasebne šifre istog proizvoda", { skip: !hasDataset }, () => {
  const dataset = readJson(PATHS.siteDataset);
  const pad = dataset.products.find((entry) => entry.variants.some((variant) => variant.code === "93107"));
  assert.deepEqual(pad.variants.map((variant) => [variant.code, variant.holes]), [["93107", "7 Holes"], ["93115", "15 Holes"], ["93162", "62 Holes"]]);
});

test("P7: boja uz jedan red važi za celu tabelu samo uz potvrdu kataloga", () => {
  const row = (code, colour, label) => ({ code, colour, catalogue: label ? { label, pdfPage: 26 } : null });
  const confirmed = { variants: [row("07400", null, null), row("07404", "White", "WHITE"), row("07405", null, "WHITE")] };
  assert.equal(applySpanningColour(confirmed, "Katalog"), true);
  assert.deepEqual(confirmed.variants.map((variant) => variant.colour), ["White", "White", "White"]);
  assert.match(confirmed.variants[0].colourSource, /str\. 26/);

  const disputed = { variants: [row("1", "White", "WHITE"), row("2", null, "YELLOW")] };
  assert.equal(applySpanningColour(disputed, "Katalog"), false);
  assert.equal(disputed.variants[1].colour, null);

  const unwitnessed = { variants: [row("1", "White", null), row("2", null, null)] };
  assert.equal(applySpanningColour(unwitnessed, "Katalog"), false);
});
