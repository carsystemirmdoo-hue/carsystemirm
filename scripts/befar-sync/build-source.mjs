#!/usr/bin/env node
/**
 * BEFAR sync, korak 3 — od BLOKOVA sajta do PROIZVODA, pa ukrštanje sa katalogom.
 *
 * Befar nema stranice proizvoda: ista HTML stranica nosi i porodice sa varijantama
 * i tabele u kojima je svaki red DRUGI proizvod. Pravila (deterministička, testirana
 * u befar-sync.test.mjs, opisana u docs/BEFAR_CATALOG_SYNC.md):
 *
 *   P1. Blok čija kolona „Product” ima RAZLIČITE vrednosti je tabela proizvoda:
 *       svaka vrednost je zaseban proizvod (Liquid Compound ≠ Auto Polish ≠ Anti
 *       Hologram ≠ Paint Protector), a naslov bloka je samo grupa („1000gr. Surface
 *       Chemicals”). Isti proizvod u više takvih blokova iste stranice je JEDAN
 *       proizvod sa više pakovanja (75011 1000 g + 75250 250 g).
 *   P2. Svaki drugi blok je PORODICA: naslov bloka je naziv, redovi su varijante
 *       (boja, dimenzija, broj rupa), svaka sa svojom šifrom.
 *   P3. Oznaka uz tabelu („SOFT”, „Hard Red”, „Premium”) je deo identiteta porodice:
 *       „Sanding Block · Hard Red” ≠ „Sanding Block · Soft Orange”.
 *   P4. Linija (logo bloka: Befar / Befar Plus / Leo / Turkuaz) je deo identiteta:
 *       „Velcro Polishing Pad” linije Befar ≠ isti naslov linije Befar Plus.
 *   P5. Blokovi sa ISTIM identitetom (linija + naslov + oznaka) spajaju se u jednu
 *       porodicu kada im se varijante ne sudaraju po (boja, dimenzija, rupe) — isti
 *       sunđer u više dimenzija. Ako se sudaraju, ostaju zasebne porodice.
 *   P6. Isti skup šifara na više stranica (Leo proizvodi su i na Leo stranici i u
 *       svojoj kategoriji) je ISTI proizvod prikazan dvaput, ne dva proizvoda.
 *   P7. Boja ispisana uz JEDAN red tabele je spojena ćelija i važi za celu tabelu
 *       samo kada je katalog potvrdi (isti naziv boje uz ostale šifre); bez potvrde
 *       ostali redovi ostaju bez boje.
 *
 * Ključ spajanja sa katalogom je ISKLJUČIVO zvanična šifra.
 *
 * Izlaz: data/befar-sync/source-products.generated.json
 */

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS } from "./lib/config.mjs";
import { applySpanningColour, buildProducts } from "./lib/families.mjs";

const website = readJson(PATHS.rawWebsite);
const catalogue = readJson(PATHS.rawCatalogue);
if (!website || !catalogue) throw new Error("Nedostaje RAW dataset: prvo `npm run befar:sync:acquire`.");

const { products, conflicts } = buildProducts(website.blocks);

/* -- Katalog po šifri ------------------------------------------------------------------ */

const catalogueByCode = new Map();
for (const row of catalogue.rows) catalogueByCode.set(row.code, [...(catalogueByCode.get(row.code) ?? []), row]);

/** Brojevi mere u milimetrima/gramima, da „15x22cm” i „150 x 220 mm” budu isto. */
function measureNumbers(value) {
  const text = String(value ?? "").toLowerCase().replace(/,/g, ".");
  const factor = /\bcm\b|cm$|\dcm/.test(text) ? 10 : 1;
  return [...text.matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0]) * factor);
}

const legendByPage = new Map(catalogue.pages.filter((page) => page.hardnessLegend?.length).map((page) => [page.pdfPage, page.hardnessLegend]));

for (const product of products) {
  for (const variant of product.variants) {
    const rows = catalogueByCode.get(variant.code) ?? [];
    const row = rows[0] ?? null;
    variant.inCatalogue = rows.length > 0;
    // Boja kod Befara nosi tvrdoću: legenda („ORANGE: ★★★★★ · apply with…”) je štampana na strani
    // kataloga na kojoj je šifra. „Cherry” u katalogu = „Burgundy / Claret Red” na sajtu.
    const legend = row ? legendByPage.get(row.pdfPage) ?? [] : [];
    const colourKey = String(variant.colour ?? "").toLowerCase().replace(/burgundy|claret red/, "cherry");
    const hardness = legend.find((entry) => entry.colour.toLowerCase() === colourKey) ?? null;
    variant.hardness = hardness ? { stars: hardness.stars, applyWith: hardness.applyWith ?? null, source: `${catalogue.meta.title}, str. ${row.pdfPage}` } : null;
    variant.catalogue = row ? { pdfPage: row.pdfPage, label: row.label, dimension: row.dimension, boxQuantity: row.boxQuantity } : null;
    if (row?.dimension && variant.size) {
      // Katalog ume da doda debljinu („180mm” ↔ „180 x 35 mm”) ili broj rupa u istu ćeliju;
      // konflikt je samo kada NEKI broj sa sajta ne postoji u katalogu.
      // Broj rupa („180mm/16Hole”) nije dimenzija; PDF ćelija bez jedinice („3 in1”) nije mera.
      const web = measureNumbers(variant.size.replace(/\d+\s?holes?/gi, ""));
      const pdf = /(mm|cm|gr|g|ml|m)\b/i.test(row.dimension) ? measureNumbers(`${row.dimension} ${row.label ?? ""}`) : [];
      const missing = web.filter((number) => !pdf.includes(number));
      if (web.length && pdf.length && missing.length) {
        conflicts.push({
          type: "WEBSITE_VS_CATALOGUE_DIMENSION",
          code: variant.code,
          sourceKey: product.sourceKey,
          detail: `sajt „${variant.size}” ↔ katalog str. ${row.pdfPage} „${row.dimension}”`,
          resolution: "merodavan je aktuelni sajt; vrednost iz kataloga ostaje zabeležena uz varijantu",
        });
      }
    }
  }
  applySpanningColour(product, catalogue.meta.title);
  product.classification = product.variants.some((variant) => variant.inCatalogue) ? "WEBSITE_AND_CATALOGUE" : "WEBSITE_ONLY";
  product.cataloguePages = [...new Set(product.variants.map((variant) => variant.catalogue?.pdfPage).filter(Boolean))].sort((a, b) => a - b);
  product.active = true;
  product.orderable = product.variants.length > 0;
}

/* -- Samo u katalogu ---------------------------------------------------------------------- */

const websiteCodes = new Set(products.flatMap((product) => product.variants.map((variant) => variant.code)));
const catalogueOnlyGroups = new Map();
for (const row of catalogue.rows) {
  if (websiteCodes.has(row.code)) continue;
  const key = `${row.pdfPage}`;
  const group = catalogueOnlyGroups.get(key) ?? { status: "CATALOGUE_ONLY_NOT_ON_CURRENT_WEBSITE", pdfPage: row.pdfPage, pageHeadings: row.pageHeadings, codes: [] };
  if (!group.codes.some((entry) => entry.code === row.code)) group.codes.push({ code: row.code, label: row.label, dimension: row.dimension, boxQuantity: row.boxQuantity });
  catalogueOnlyGroups.set(key, group);
}

for (const product of products) {
  if (conflicts.some((conflict) => conflict.sourceKey === product.sourceKey || product.variants.some((variant) => variant.code === conflict.code))) product.sourceConflict = true;
}

const allCodes = products.flatMap((product) => product.variants.map((variant) => variant.code));
const count = (label) => products.filter((product) => product.classification === label).length;

writeJson(PATHS.source, {
  meta: {
    website: { source: website.meta.source, controlSource: website.meta.controlSource, crawledAt: website.meta.crawledAt, productBlocks: website.meta.productBlocks },
    catalogue: { title: catalogue.meta.title, sourceUrl: catalogue.meta.sourceUrl, sha256: catalogue.meta.sha256, pdfPages: catalogue.meta.pdfPages, downloadedAt: catalogue.meta.downloadedAt },
    rule: "aktuelni sajt befar.com.tr → digitalni katalog (PDF) → lokalni podaci; ključ je zvanična šifra proizvoda",
  },
  summary: {
    websiteBlocks: website.blocks.length,
    websiteCodeRows: website.meta.codeRows,
    productFamilies: products.length,
    productCodes: new Set(allCodes).size,
    codesAssignedMoreThanOnce: allCodes.length - new Set(allCodes).size,
    byLine: Object.fromEntries([...new Set(products.map((product) => product.line))].sort().map((line) => [line, products.filter((product) => product.line === line).length])),
    byKind: { productRow: products.filter((product) => product.kind === "product-row").length, family: products.filter((product) => product.kind === "family").length },
    catalogueCodes: catalogueByCode.size,
    codesInBoth: [...websiteCodes].filter((code) => catalogueByCode.has(code)).length,
    codesWebsiteOnly: [...websiteCodes].filter((code) => !catalogueByCode.has(code)).length,
    codesCatalogueOnly: [...catalogueByCode.keys()].filter((code) => !websiteCodes.has(code)).length,
    WEBSITE_AND_CATALOGUE: count("WEBSITE_AND_CATALOGUE"),
    WEBSITE_ONLY: count("WEBSITE_ONLY"),
    CATALOGUE_ONLY_PAGES: catalogueOnlyGroups.size,
    SOURCE_CONFLICT: conflicts.length,
  },
  conflicts,
  products,
  catalogueOnly: [...catalogueOnlyGroups.values()].sort((a, b) => a.pdfPage - b.pdfPage),
});

const summary = readJson(PATHS.source).summary;
console.log(
  `source: ${summary.productFamilies} proizvoda/porodica · ${summary.productCodes} šifara · ${summary.WEBSITE_AND_CATALOGUE} i u katalogu, ${summary.WEBSITE_ONLY} samo sajt · ` +
    `${summary.codesCatalogueOnly} šifara samo u katalogu · ${summary.SOURCE_CONFLICT} konflikata`,
);
